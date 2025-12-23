import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { setCooldown } from '@core/cooldownManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/playerDataManager.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';
import { formatCurrency, playSound } from '@core/utils.js';

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
    permissionLevel: 1024,
    hasCooldown: true,
    cooldownId: 'back',
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        const config = getConfig();
        const backConfig = config.back as unknown as BackConfig | undefined;

        // Check global feature toggle first
        if (!backConfig || !backConfig.enabled) {
            sendMessage('§cThe Back system is currently disabled globally.', executor);
            return;
        }

        const pData = getOrCreatePlayer(executor);
        const lastLocation = pData.lastLocation;

        if (!lastLocation) {
            sendMessage('§cYou have nowhere to go back to.', executor);
            return;
        }

        // Cost Check
        if (backConfig.cost > 0 && pData.balance < backConfig.cost) {
            sendMessage(`§cInsufficient funds. Cost: ${formatCurrency(backConfig.cost)}`, executor);
            return;
        }

        const warmupSeconds = backConfig.teleportWarmupSeconds;

        const teleportLogic = () => {
            try {
                // Deduct cost (Re-check funds to prevent bypass)
                if (backConfig.cost > 0) {
                    const currentData = getOrCreatePlayer(executor);
                    if (currentData.balance < backConfig.cost) {
                        sendMessage(`§cTeleport cancelled. Insufficient funds.`, executor);
                        return;
                    }
                    incrementPlayerBalance(executor.id, -backConfig.cost);
                }

                const dimension = mc.world.getDimension(lastLocation.dimensionId);
                executor.teleport(lastLocation as mc.Vector3, { dimension: dimension });
                sendMessage('§aTeleported back to previous location.', executor);
                playSound(executor, 'random.orb');
                setCooldown(executor, 'back');
            } catch (error: unknown) {
                sendMessage('§cFailed to teleport back. Dimension might be unloaded.', executor);
                if (error instanceof Error) {
                    errorLog(`[/back] Teleport error: ${error.message}`);
                }
            }
        };

        startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'previous location');
    }
};

export default [backCommand];
