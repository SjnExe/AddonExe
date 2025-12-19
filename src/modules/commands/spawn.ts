import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import { getConfig } from '@core/configManager.js';
import { getSpawnConfig, saveSpawnConfig } from '@core/configurations.js';
import { setCooldown } from '@core/cooldownManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerRank } from '@core/rankManager.js';
import { playSound, startTeleportWarmup } from '@core/utils.js';
import { saveLastLocation } from '@features/teleportation/teleportUtils.js';

import { initializeSpawnProtection } from '@modules/detections/spawnProtection.js';

import { CommandExecutor, CustomCommand } from './commandManager.js';

interface SpawnLocation {
    x: number | undefined;
    y: number | undefined;
    z: number | undefined;
    dimensionId: string;
}

const spawnCommand: CustomCommand = {
    name: 'spawn',
    aliases: ['lobby', 'hub'],
    description: 'Teleports you to the server spawn point.',
    category: 'Transportation',
    permissionLevel: 1024,
    hasCooldown: true,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const config = getConfig();
        const spawnConfig = getSpawnConfig();
        const spawnLocation = spawnConfig.spawn.spawnLocation as SpawnLocation | undefined;

        if (!spawnLocation || typeof spawnLocation.x !== 'number') {
            sendMessage('§cThe server spawn point has not been set.', executor);
            const rank = getPlayerRank(executor, config);
            if (rank.permissionLevel <= 1) {
                // Is admin or owner
                sendMessage(
                    '§eAs an admin, you can set it by running §a/setspawn§e at the desired location.',
                    executor,
                    { raw: true }
                );
            }
            playSound(executor, 'note.bass');
            return;
        }

        const warmupSeconds = spawnConfig.spawn.teleportWarmupSeconds;

        const teleportLogic = () => {
            try {
                const dimension = mc.world.getDimension(spawnLocation.dimensionId);
                saveLastLocation(executor);
                executor.teleport(spawnLocation as mc.Vector3, { dimension: dimension });
                sendMessage('§aTeleporting you to spawn...', executor);
                playSound(executor, 'random.orb');
                setCooldown(executor, 'spawn');
            } catch (error: unknown) {
                sendMessage(
                    '§cFailed to teleport to spawn. The dimension may be invalid or the location unsafe.',
                    executor
                );
                if (error instanceof Error) {
                    errorLog(`[/spawn] Failed to teleport: ${error.stack}`);
                }
                playSound(executor, 'note.bass');
            }
        };

        startTeleportWarmup(executor, warmupSeconds, teleportLogic, 'spawn');
    }
};

interface SetSpawnArgs {
    x?: number;
    y?: number;
    z?: number;
}

const setSpawnCommand: CustomCommand = {
    name: 'setspawn',
    aliases: ['setworldspawn', 'spawnset'],
    description: "Sets the server's spawn location to your current position or specified coordinates.",
    category: 'Transportation',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'x', type: 'float', optional: true },
        { name: 'y', type: 'float', optional: true },
        { name: 'z', type: 'float', optional: true }
    ],
    execute: (executor: CommandExecutor, args: SetSpawnArgs) => {
        let location: SpawnLocation;
        const { x, y, z } = args;

        if (x !== undefined && y !== undefined && z !== undefined) {
            location = {
                x: Math.round(x * 100) / 100,
                y: Math.round(y * 100) / 100,
                z: Math.round(z * 100) / 100,
                dimensionId: executor instanceof mc.Player ? executor.dimension.id : MinecraftDimensionTypes.Overworld
            };
        } else {
            if (!(executor instanceof mc.Player)) {
                if (executor instanceof mc.Player) {
                    sendMessage(
                        '§cYou must specify X, Y, and Z coordinates when running this command from the console.',
                        executor
                    );
                } else {
                    executor.sendMessage(
                        '§cYou must specify X, Y, and Z coordinates when running this command from the console.'
                    );
                }
                return;
            }
            location = {
                x: Math.round(executor.location.x * 100) / 100,
                y: Math.round(executor.location.y * 100) / 100,
                z: Math.round(executor.location.z * 100) / 100,
                dimensionId: executor.dimension.id
            };
        }

        try {
            const spawnConfig = getSpawnConfig();
            spawnConfig.spawn.spawnLocation = location;
            saveSpawnConfig(spawnConfig);
            const locationString = `§aAddon spawn point set to: §fX: ${location.x!.toFixed(2)}, Y: ${location.y!.toFixed(2)}, Z: ${location.z!.toFixed(2)} in ${location.dimensionId.replace('minecraft:', '')}`;

            if (executor instanceof mc.Player) {
                sendMessage(locationString, executor);
                initializeSpawnProtection();
                sendMessage('§aSpawn protection system has been updated.', executor);
            } else {
                executor.sendMessage(locationString);
                initializeSpawnProtection();
                executor.sendMessage('§aSpawn protection system has been updated.');
            }

            if (
                location.dimensionId === (MinecraftDimensionTypes.Overworld as string) &&
                spawnConfig.spawn.syncWorldSpawn
            ) {
                try {
                    const spawnPos = { x: location.x!, y: location.y!, z: location.z! };
                    mc.world.setDefaultSpawnLocation(spawnPos);
                    if (executor instanceof mc.Player) {
                        sendMessage('§aWorld spawn point updated successfully.', executor);
                    } else {
                        executor.sendMessage('§aWorld spawn point updated successfully.');
                    }
                } catch (error: unknown) {
                    if (error instanceof Error) {
                        errorLog(`[/setspawn] Failed to set default world spawn: ${error.stack}`);
                    }
                    if (executor instanceof mc.Player) {
                        sendMessage(
                            '§cError: Could not set the world spawn point. Check server logs for details.',
                            executor
                        );
                    } else {
                        executor.sendMessage(
                            '§cError: Could not set the world spawn point. Check server logs for details.'
                        );
                    }
                }
                try {
                    const radius = spawnConfig.spawn.worldSpawnRadius ?? 0;
                    mc.world.gameRules.spawnRadius = radius;
                    if (executor instanceof mc.Player) {
                        sendMessage(`§aWorld spawn radius set to ${radius}.`, executor);
                    } else {
                        executor.sendMessage(`§aWorld spawn radius set to ${radius}.`);
                    }
                } catch (error: unknown) {
                    if (error instanceof Error) {
                        errorLog(`[/setspawn] Failed to set spawnradius gamerule: ${error.stack}`);
                    }
                    if (executor instanceof mc.Player) {
                        sendMessage(
                            '§cError: Could not set the spawn radius. Check server logs for details.',
                            executor
                        );
                    } else {
                        executor.sendMessage('§cError: Could not set the spawn radius. Check server logs for details.');
                    }
                }
            }

            if (executor instanceof mc.Player) {
                playSound(executor, 'random.orb');
            }
        } catch (error: unknown) {
            if (executor instanceof mc.Player) {
                sendMessage('§cAn unexpected error occurred while setting the spawn.', executor);
            } else {
                executor.sendMessage('§cAn unexpected error occurred while setting the spawn.');
            }
            if (error instanceof Error) {
                errorLog(`[/setspawn] General error: ${error.stack}`);
            }
        }
    }
};

export default [spawnCommand, setSpawnCommand];
