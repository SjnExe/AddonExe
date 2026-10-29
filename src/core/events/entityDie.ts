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
import { calculateTaxWithPolicy, formatCurrency } from '@core/utils/index.js';
import { errorLog, infoLog } from '@core/utils/logger.js';
import { processBountyAndSteal, resolveKiller } from '@features/essentials/combat/manager.js';
import { saveLastLocation } from '@features/teleport/utils.js';
import { isDefined, isNumber } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

export const eventName = 'entityDie';

interface MobKillWindow {
  count: number;
  windowStart: number;
}

const playerMobKillWindows = new Map<string, Map<string, MobKillWindow>>();

export function handleEntityDie(event: mc.EntityDieAfterEvent): void {
  try {
    const { deadEntity, damageSource } = event;
    const killer = resolveKiller(deadEntity, damageSource.damagingEntity);

    if (deadEntity.typeId === MinecraftEntityTypes.Player) {
      const deadPlayer = deadEntity as mc.Player;
      saveLastLocation(deadPlayer, 'death');

      getOrCreatePlayer(deadPlayer);
      setPlayerLastDeathLocation(deadPlayer.id, {
        x: deadPlayer.location.x,
        y: deadPlayer.location.y,
        z: deadPlayer.location.z,
        dimensionId: deadPlayer.dimension.id,
      });

      resetKillStreak(deadPlayer.id);

      if (isDefined(killer) && killer.isValid && killer.id !== deadPlayer.id) {
        incrementDeathCount(deadPlayer.id);
        incrementKillCount(killer.id);
        incrementKillStreak(killer.id);
        processBountyAndSteal(deadPlayer.id, deadPlayer.name, killer, deadPlayer);
      } else if (isFeatureActive('eco')) {
        const econCfg = getEconomyConfig();
        if (econCfg.deathTax?.enabled) {
          const pData = getOrCreatePlayer(deadPlayer);
          if (pData.balance > 0) {
            const { tax } = calculateTaxWithPolicy(pData.balance, {
              ratePercent: econCfg.deathTax.ratePercent,
              minTax: econCfg.deathTax.minTax,
              maxTax: econCfg.deathTax.maxTax,
            });
            if (tax > 0) {
              incrementPlayerBalance(deadPlayer.id, -tax);
              deadPlayer.sendMessage(
                `§cYou lost §e${formatCurrency(tax)}§c to Death Tax! (Tip: Deposit money in the Bank to keep it safe)`,
              );
            }
          }
        }
      }
      return;
    }

    if (!isDefined(killer) || !killer.isValid || !isFeatureActive('eco')) {
      return;
    }

    const economyConfig = getEconomyConfig();
    const reward = economyConfig.mobMoney[deadEntity.typeId];
    if (isNumber(reward) && reward !== 0) {
      if (reward > 0 && economyConfig.mobFarmCap?.enabled) {
        const now = Date.now();
        const windowMs = Math.max(10, Number(economyConfig.mobFarmCap.windowSeconds ?? 180)) * 1000;
        const maxKills = Math.max(1, Number(economyConfig.mobFarmCap.maxKillsPerWindow ?? 25));
        let mobMap = playerMobKillWindows.get(killer.id);
        if (!mobMap) {
          mobMap = new Map();
          playerMobKillWindows.set(killer.id, mobMap);
        }
        const entry = mobMap.get(deadEntity.typeId);
        if (!entry || now - entry.windowStart >= windowMs) {
          mobMap.set(deadEntity.typeId, { count: 1, windowStart: now });
        } else {
          entry.count++;
          if (entry.count > maxKills) {
            if (entry.count === maxKills + 1) {
              killer.sendMessage(
                `§e[Economy] Mob grinder limit reached for ${deadEntity.typeId.replace(/^minecraft:/, '')}. Payouts paused briefly.`,
              );
            }
            return;
          }
        }
      }
      incrementPlayerBalance(killer.id, reward);
      if (reward > 0) {
        if (economyConfig.logToConsole) {
          infoLog(`[Economy] Gave ${killer.name} ${formatCurrency(reward)} for killing a ${deadEntity.typeId}.`);
        }
      } else {
        if (economyConfig.logToConsole) {
          infoLog(
            `[Economy] Took ${formatCurrency(Math.abs(reward))} from ${killer.name} for killing a ${deadEntity.typeId}.`,
          );
        }
        killer.sendMessage(`§cPenalty: ${formatCurrency(reward)} for killing a ${deadEntity.typeId}.`);
      }
    }
  } catch (error: unknown) {
    errorLog('[EntityDie] A fatal error occurred during entityDie processing.', error);
  }
}

export default handleEntityDie;
