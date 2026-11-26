import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as configManager from '@core/config/configManager.js';
import * as cooldownManager from '@core/data/cooldownManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { backDisabled } from '@core/utils/constants.js';
import { formatCooldown, formatCurrency, playSound } from '@core/utils/index.js';
import { errorLog } from '@core/utils/logger.js';
import * as messaging from '@core/utils/messaging.js';
import * as teleportLogicModule from '@core/utils/teleportLogic.js';
import {
  getPlayerGraves,
  getUnifiedDeathTeleportPolicy,
  teleportPlayerToGrave,
} from '@features/essentials/graves/manager.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorder/manager.js';
import { saveLastLocation, teleportPlayerWithTransition } from '@features/teleport/utils.js';
import * as mc from '@minecraft/server';

interface BackConfig {
  enabled: boolean;
  cooldownSeconds: number;
  teleportWarmupSeconds: number;
  cost: number;
}

const backCommand: CustomCommand = {
  name: 'back',
  description: 'Teleports you to your previous location (before death or teleport).',
  category: 'Transportation',
  permissionNode: 'cmd.back.member',
  execute: (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const config = configManager.getConfig();
    const backConfig = config.back as unknown as BackConfig | undefined;

    // Check global feature toggle first
    if (!backConfig || !backConfig.enabled) {
      messaging.sendMessage(backDisabled, executor);
      return;
    }

    const pData = playerDataManager.getOrCreatePlayer(executor);
    const lastLocation = pData.lastLocation;
    const now = Date.now();
    const activeGraves = config.graves?.enabled
      ? getPlayerGraves(executor.id).filter((g) => g.expiresAt <= 0 || g.expiresAt > now)
      : [];

    if (!lastLocation) {
      if (activeGraves.length > 0) {
        teleportPlayerToGrave(executor, activeGraves[0]!.id);
        return;
      }
      messaging.sendMessage('§cYou have nowhere to go back to.', executor);
      return;
    }

    const remainingCd = cooldownManager.getCooldown(executor.id, 'back');
    if (remainingCd > 0) {
      messaging.sendMessage(`§cYou must wait ${formatCooldown(remainingCd)} before using /back again.`, executor);
      return;
    }

    if (!isWithinWorldBorder(lastLocation, lastLocation.dimensionId) && !canBypassWorldBorder(executor)) {
      messaging.sendMessage('§cYour previous location is outside the active world border.', executor);
      return;
    }

    const rawBackCost = typeof backConfig.cost === 'string' ? parseFloat(backConfig.cost) : backConfig.cost;
    const isReturningToGrave = lastLocation.graveId
      ? activeGraves.some((g) => g.id === lastLocation.graveId)
      : activeGraves.some(
          (g) =>
            g.dimensionId === lastLocation.dimensionId &&
            Math.floor(lastLocation.x) === g.x &&
            Math.floor(lastLocation.z) === g.z &&
            Math.abs(Math.floor(lastLocation.y) - g.y) <= 2,
        );
    const cost = isReturningToGrave ? Math.max(rawBackCost, getUnifiedDeathTeleportPolicy().cost) : rawBackCost;

    // Properly type the economy config check

    const isEconomyEnabled = isFeatureActive('eco');

    // Cost Check
    if (isEconomyEnabled && cost > 0 && pData.balance < cost) {
      messaging.sendMessage(`§cInsufficient funds. Cost: ${formatCurrency(cost)}`, executor);
      return;
    }

    const warmupSeconds =
      typeof backConfig.teleportWarmupSeconds === 'string'
        ? parseInt(backConfig.teleportWarmupSeconds, 10)
        : backConfig.teleportWarmupSeconds;

    const teleportLogic = (): boolean => {
      try {
        if (!executor.isValid) {
          return false;
        }
        if (!isWithinWorldBorder(lastLocation, lastLocation.dimensionId) && !canBypassWorldBorder(executor)) {
          messaging.sendMessage('§cYour previous location is outside the active world border.', executor);
          return false;
        }
        if (isReturningToGrave) {
          const currentGraveCost = getUnifiedDeathTeleportPolicy().cost;
          if (currentGraveCost !== cost) {
            messaging.sendMessage(
              `§cTeleport cancelled. Grave teleport fee changed to ${formatCurrency(currentGraveCost)}.`,
              executor,
            );
            return false;
          }
        }
        // Deduct cost (Re-check funds to prevent bypass)
        if (isEconomyEnabled && cost > 0) {
          const currentData = playerDataManager.getOrCreatePlayer(executor);
          if (currentData.balance < cost) {
            messaging.sendMessage(`§cTeleport cancelled. Insufficient funds.`, executor);
            return false;
          }
          playerDataManager.incrementPlayerBalance(executor.id, -cost);
        }

        const targetDestination = { ...lastLocation };
        const dimension = mc.world.getDimension(targetDestination.dimensionId);
        saveLastLocation(executor, 'teleport');
        teleportPlayerWithTransition(executor, targetDestination, { dimension: dimension });
        messaging.sendMessage('§aTeleported back to previous location.', executor);
        playSound(executor, 'random.orb');
        cooldownManager.setCooldown(executor.id, 'back', backConfig.cooldownSeconds);
        return true;
      } catch (error: unknown) {
        messaging.sendMessage('§cFailed to teleport back. Dimension might be unloaded.', executor);
        if (error instanceof Error) {
          errorLog(`[/back] Teleport error: ${error.message}`);
        }
        return false;
      }
    };

    teleportLogicModule.startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'previous location');
  },
};

export default [backCommand];
