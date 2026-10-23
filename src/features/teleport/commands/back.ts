import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as configManager from '@core/config/configManager.js';
import * as cooldownManager from '@core/data/cooldownManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCooldown, formatCurrency, playSound } from '@core/utils/index.js';
import { errorLog } from '@core/utils/logger.js';
import * as messaging from '@core/utils/messaging.js';
import * as teleportLogicModule from '@core/utils/teleportLogic.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorderManager.js';
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
            messaging.sendMessage('§cThe Back system is currently disabled globally.', executor);
            return;
        }

        const pData = playerDataManager.getOrCreatePlayer(executor);
        const lastLocation = pData.lastLocation;

        if (!lastLocation) {
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

        const cost = typeof backConfig.cost === 'string' ? parseFloat(backConfig.cost) : backConfig.cost;

        // Properly type the economy config check

        const isEconomyEnabled = isFeatureActive('eco');

        // Cost Check
        if (isEconomyEnabled && cost > 0 && pData.balance < cost) {
            messaging.sendMessage(`§cInsufficient funds. Cost: ${formatCurrency(cost)}`, executor);
            return;
        }

        const warmupSeconds = typeof backConfig.teleportWarmupSeconds === 'string' ? parseInt(backConfig.teleportWarmupSeconds, 10) : backConfig.teleportWarmupSeconds;

        const teleportLogic = () => {
            try {
                // Deduct cost (Re-check funds to prevent bypass)
                if (isEconomyEnabled && cost > 0) {
                    const currentData = playerDataManager.getOrCreatePlayer(executor);
                    if (currentData.balance < cost) {
                        messaging.sendMessage(`§cTeleport cancelled. Insufficient funds.`, executor);
                        return;
                    }
                    playerDataManager.incrementPlayerBalance(executor.id, -cost);
                }

                const dimension = mc.world.getDimension(lastLocation.dimensionId);
                executor.teleport(lastLocation, { dimension: dimension });
                messaging.sendMessage('§aTeleported back to previous location.', executor);
                playSound(executor, 'random.orb');
                cooldownManager.setCooldown(executor.id, 'back', backConfig.cooldownSeconds);
            } catch (error: unknown) {
                messaging.sendMessage('§cFailed to teleport back. Dimension might be unloaded.', executor);
                if (error instanceof Error) {
                    errorLog(`[/back] Teleport error: ${error.message}`);
                }
            }
        };

        teleportLogicModule.startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'previous location');
    }
};

export default [backCommand];
