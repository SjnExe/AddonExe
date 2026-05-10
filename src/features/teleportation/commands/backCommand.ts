import * as mc from '@minecraft/server';
import { CommandExecutor, CustomCommand } from '@core/commands/commandManager.js';
import { getBackConfig, getEconomyConfig } from '@core/configurations.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayer, incrementPlayerBalance } from '@core/playerDataManager.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';
import { isDefined } from '@lib/guards.js';
import { formatCurrency } from '@core/utils.js';

const backCommand: CustomCommand = {
    name: 'back',
    description: 'Teleports you to your last saved location (e.g., death or last teleport).',
    category: 'Transportation',
    permissionLevel: 1024,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const backConfig = getBackConfig();
        if (!backConfig.enabled) {
            sendMessage('§cThe /back command is currently disabled.', executor);
            return;
        }

        const playerData = getPlayer(executor.id);
        if (!playerData || !playerData.lastLocation) {
            sendMessage('§cYou do not have a last saved location to return to.', executor);
            return;
        }

        const cost = backConfig.cost;
        const economyConfig = getEconomyConfig();

        // Handle economy logic
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        if (economyConfig && (economyConfig as any).enabled && cost > 0) {
            if (playerData.balance < cost) {
                sendMessage(`§cYou need ${formatCurrency(cost)} to use the /back command.`, executor);
                return;
            }
        }

        const lastLoc = playerData.lastLocation;
        const teleportLogic = () => {
            try {
                // Deduct cost after warmup completes
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
                if (economyConfig && (economyConfig as any).enabled && cost > 0) {
                    // Double check balance just in case it changed during warmup
                    const pDataCheck = getPlayer(executor.id);
                    if (!pDataCheck || pDataCheck.balance < cost) {
                        sendMessage(`§cYou no longer have ${formatCurrency(cost)} to use the /back command. Teleport canceled.`, executor);
                        return;
                    }
                    incrementPlayerBalance(executor.id, -cost);
                    sendMessage(`§aPaid ${formatCurrency(cost)} to use /back.`, executor);
                }

                const dimension = mc.world.getDimension(lastLoc.dimensionId);
                if (isDefined(dimension)) {
                    executor.teleport(lastLoc, { dimension });
                    sendMessage('§aTeleported to your last location.', executor);
                } else {
                    sendMessage(`§cError: Dimension '${lastLoc.dimensionId}' not found.`, executor);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                sendMessage(`§cFailed to teleport. Error: ${message}`, executor);
                errorLog(`[/back] Failed to teleport: ${message}`);
            }
        };

        // Default fallback to 5 seconds if not defined in config
        const warmupSeconds = 5;

        startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'previous location');
    }
};

export default [backCommand];