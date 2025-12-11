import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { constants } from '@core/constants.js';
import { setCooldown } from '@core/cooldownManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/playerDataManager.js';
import { formatCurrency, playSound, startTeleportWarmup } from '@core/utils.js';

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

        // Config access via casting or interface augmentation (since we added it to default but type might lag)
        const config = getConfig();
        // @ts-expect-error - 'back' added to config.default.ts dynamically in this session
        const backConfig = config.back as BackConfig;

        if (!backConfig || !backConfig.enabled) {
            sendMessage('§cThe /back command is disabled.', executor);
            return;
        }

        const pData = getOrCreatePlayer(executor);
        const lastLocation = pData.lastLocation;

        if (!lastLocation) {
            sendMessage('§cYou have nowhere to go back to.', executor);
            return;
        }

        // Cost Check
        if (backConfig.cost > 0) {
            if (pData.balance < backConfig.cost) {
                sendMessage(`§cInsufficient funds. Cost: ${formatCurrency(backConfig.cost)}`, executor);
                return;
            }
        }

        const warmupSeconds = backConfig.teleportWarmupSeconds;

        const teleportLogic = () => {
            try {
                // Deduct cost
                if (backConfig.cost > 0) {
                    incrementPlayerBalance(executor.id, -backConfig.cost);
                }

                const dimension = mc.world.getDimension(lastLocation.dimensionId);
                executor.teleport(lastLocation as mc.Vector3, { dimension: dimension });
                sendMessage('§aTeleported back to previous location.', executor);
                playSound(executor, 'random.orb');
                setCooldown(executor, 'back');
            } catch (e: unknown) {
                sendMessage('§cFailed to teleport back. Dimension might be unloaded.', executor);
                if (e instanceof Error) {
                    errorLog(`[/back] Teleport error: ${e.message}`);
                }
            }
        };

        startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'previous location');
    }
};

export default [backCommand];
