import { getConfig } from '@core/config/configManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import {
  getOrCreatePlayer,
  incrementDeathCount,
  incrementKillCount,
  incrementKillStreak,
  incrementPlayerBalance,
  resetKillStreak,
  setPlayerLastDeathLocation,
} from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { errorLog, infoLog } from '@core/utils/logger.js';
import { processBountyAndSteal, resolveKiller } from '@features/essentials/combatManager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export const eventName = 'entityDie';

export function handleEntityDie(event: mc.EntityDieAfterEvent): void {
  try {
    const { deadEntity, damageSource } = event;
    const config = getConfig();
    const killer = resolveKiller(deadEntity, damageSource.damagingEntity);

    if (deadEntity.typeId === MinecraftEntityTypes.Player) {
      const deadPlayer = deadEntity as mc.Player;
      saveLastLocation(deadPlayer, 'death');

      if (config.playerInfo.enableDeathCoords) {
        getOrCreatePlayer(deadPlayer);
        setPlayerLastDeathLocation(deadPlayer.id, {
          x: deadPlayer.location.x,
          y: deadPlayer.location.y,
          z: deadPlayer.location.z,
          dimensionId: deadPlayer.dimension.id,
        });
      }

      resetKillStreak(deadPlayer.id);

      if (isDefined(killer) && killer.isValid && killer.id !== deadPlayer.id) {
        incrementDeathCount(deadPlayer.id);
        incrementKillCount(killer.id);
        incrementKillStreak(killer.id);
        processBountyAndSteal(deadPlayer.id, deadPlayer.name, killer, deadPlayer);
      }
      return;
    }

    if (!isDefined(killer) || !killer.isValid || !isFeatureActive('eco')) {
      return;
    }

    const economyConfig = getEconomyConfig();
    const reward = economyConfig.mobMoney[deadEntity.typeId];
    if (isNumber(reward) && reward !== 0) {
      incrementPlayerBalance(killer.id, reward);
      if (reward > 0) {
        infoLog(`Gave ${killer.name} ${formatCurrency(reward)} for killing a ${deadEntity.typeId}.`);
      } else {
        infoLog(`Took ${formatCurrency(Math.abs(reward))} from ${killer.name} for killing a ${deadEntity.typeId}.`);
        killer.sendMessage(`§cPenalty: ${formatCurrency(reward)} for killing a ${deadEntity.typeId}.`);
      }
    }
  } catch (error: unknown) {
    errorLog('[EntityDie] A fatal error occurred during entityDie processing.', error);
  }
}

export default handleEntityDie;
