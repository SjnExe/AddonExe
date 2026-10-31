import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getCooldown, setCooldown } from '@core/data/cooldownManager.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { soundTeleport } from '@core/utils/constants.js';
import { formatCurrency } from '@core/utils/economy.js';
import { playSound } from '@core/utils/index.js';
import { errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { startTeleportWarmup } from '@core/utils/teleportLogic.js';
import { formatCooldown } from '@core/utils/time.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorder/manager.js';
import { findSafeLocation, saveLastLocation, teleportPlayerWithTransition } from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const bedCommand: CustomCommand = {
  name: 'bed',
  aliases: ['mybed', 'respawn'],
  description: 'Teleports you to your bed or respawn anchor location.',
  category: 'Transportation',
  permissionNode: 'cmd.bed.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    if (typeof executor.getSpawnPoint !== 'function') {
      sendMessage('§cThe bed spawn feature is not supported in this Bedrock environment.', executor);
      return;
    }

    const spawnPoint = executor.getSpawnPoint();
    if (!isDefined(spawnPoint) || !isDefined(spawnPoint.dimension)) {
      sendMessage(
        '§cYou do not have a bed or respawn anchor set. Use §e/spawn§c to travel to the server spawn.',
        executor,
      );
      playSound(executor, 'note.bass');
      return;
    }

    const cfg = getConfig();
    const cost = Math.max(0, Number(cfg.homes?.cost ?? 0));
    const warmupSeconds = Number(cfg.homes?.teleportWarmupSeconds ?? 3);
    const cooldownSeconds = Number(cfg.homes?.cooldownSeconds ?? 60);

    const remainingCd = getCooldown(executor.id, 'bed');
    if (remainingCd > 0) {
      sendMessage(`§cYou must wait ${formatCooldown(remainingCd)} before using /bed again.`, executor);
      return;
    }

    const targetDimension = spawnPoint.dimension;
    const targetDimId = targetDimension.id;

    if (!isWithinWorldBorder({ x: spawnPoint.x, z: spawnPoint.z }, targetDimId) && !canBypassWorldBorder(executor)) {
      sendMessage('§cCannot teleport: Your bed or respawn anchor is outside the active world border.', executor);
      return;
    }

    const chargeCost = isFeatureActive('eco') && cost > 0 && !hasPermission(executor, 'group.admin') ? cost : 0;
    if (chargeCost > 0) {
      const pData = getOrCreatePlayer(executor);
      if (pData.balance < chargeCost) {
        sendMessage(`§cInsufficient funds for /bed. Cost: §e${formatCurrency(chargeCost)}§c.`, executor);
        return;
      }
    }

    const teleportLogic = () => {
      try {
        if (!executor.isValid) {
          return;
        }

        const safeSpot = findSafeLocation(targetDimension, spawnPoint) ?? {
          x: spawnPoint.x + 0.5,
          y: spawnPoint.y,
          z: spawnPoint.z + 0.5,
        };

        if (chargeCost > 0) {
          const curData = getOrCreatePlayer(executor);
          if (curData.balance < chargeCost) {
            sendMessage(`§cTeleport cancelled: Insufficient funds (${formatCurrency(chargeCost)} required).`, executor);
            return;
          }
          incrementPlayerBalance(executor.id, -chargeCost);
        }

        saveLastLocation(executor, 'teleport');
        teleportPlayerWithTransition(executor, safeSpot, { dimension: targetDimension });
        playSound(executor, soundTeleport);

        const costSuffix = chargeCost > 0 ? ` §7(-${formatCurrency(chargeCost)})` : '';
        sendMessage(`§aTeleported to your bed/respawn point!${costSuffix}`, executor);
        setCooldown(executor.id, 'bed', cooldownSeconds);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        sendMessage('§cFailed to teleport to bed. Location might be obstructed or unloaded.', executor);
        errorLog(`[/bed] Failed to teleport: ${message}`);
      }
    };

    startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'your bed');
  },
};

export default [bedCommand];
