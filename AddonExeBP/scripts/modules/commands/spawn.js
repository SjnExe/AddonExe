import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { getSpawnConfig, saveSpawnConfig } from '../../core/configurations.js';
import { playSound, startTeleportWarmup } from '../../core/utils.js';
import { errorLog } from '../../core/logger.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { getPlayerRank } from '../../core/rankManager.js';
import { initializeSpawnProtection } from '../detections/spawnProtection.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'spawn',
    aliases: ['lobby', 'hub'],
    description: 'Teleports you to the server spawn point.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [],
    hasCooldown: true,
    /**
     * Executes the /spawn command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        const spawnConfig = getSpawnConfig();
        const spawnLocation = spawnConfig.spawn.spawnLocation;

        if (!spawnLocation || typeof spawnLocation.x !== 'number') {
            sendMessage('§cThe server spawn point has not been set.', player);
            const rank = getPlayerRank(player, config);
            if (rank.permissionLevel <= 1) { // Is admin or owner
                sendMessage('§eAs an admin, you can set it by running §a/setspawn§e at the desired location.', player, { raw: true });
            }
            playSound(player, 'note.bass');
            return;
        }

        const warmupSeconds = spawnConfig.spawn.teleportWarmupSeconds;

        /**
         * The core logic for teleporting the player to spawn.
         */
        const teleportLogic = () => {
            try {
                const dimension = world.getDimension(spawnLocation.dimensionId);
                player.teleport(spawnLocation, { dimension: dimension });
                sendMessage('§aTeleporting you to spawn...', player);
                playSound(player, 'random.orb');
                setCooldown(player, 'spawn');
            } catch (e) {
                sendMessage('§cFailed to teleport to spawn. The dimension may be invalid or the location unsafe.', player);
                errorLog(`[/spawn] Failed to teleport: ${e.stack}`);
                playSound(player, 'note.bass');
            }
        };

        startTeleportWarmup(player, warmupSeconds, teleportLogic, 'spawn');
    }
});

commandManager.register({
    name: 'setspawn',
    aliases: ['setworldspawn', 'spawnset'],
    disabledSlashAliases: ['setworldspawn'],
    description: 'Sets the server\'s spawn location to your current position or specified coordinates.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'x', type: 'float', description: 'The X coordinate for the spawn.', optional: true },
        { name: 'y', type: 'float', description: 'The Y coordinate for the spawn.', optional: true },
        { name: 'z', type: 'float', description: 'The Z coordinate for the spawn.', optional: true }
    ],
    /**
     * Executes the /setspawn command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {number} [args.x] The X coordinate.
     * @param {number} [args.y] The Y coordinate.
     * @param {number} [args.z] The Z coordinate.
     */
    execute: (player, args) => {
        let location;
        const { x, y, z } = args;

        if (x !== undefined && y !== undefined && z !== undefined) {
            // Coordinates are provided
            location = {
                x: Math.round(x * 100) / 100,
                y: Math.round(y * 100) / 100,
                z: Math.round(z * 100) / 100,
                dimensionId: player.isConsole ? 'minecraft:overworld' : player.dimension.id
            };
        } else {
            // No coordinates, use player location
            if (player.isConsole) {
                sendMessage('§cYou must specify X, Y, and Z coordinates when running this command from the console.', player);
                return;
            }
            location = {
                x: Math.round(player.location.x * 100) / 100,
                y: Math.round(player.location.y * 100) / 100,
                z: Math.round(player.location.z * 100) / 100,
                dimensionId: player.dimension.id
            };
        }

        try {
            // Update the addon's config first
            const spawnConfig = getSpawnConfig();
            spawnConfig.spawn.spawnLocation = location;
            saveSpawnConfig(spawnConfig);
            const locationString = `X: ${location.x.toFixed(2)}, Y: ${location.y.toFixed(2)}, Z: ${location.z.toFixed(2)} in ${location.dimensionId.replace('minecraft:', '')}`;
            sendMessage(`§aAddon spawn point set to: §f${locationString}`, player);

            // Re-initialize spawn protection to apply any changes immediately
            initializeSpawnProtection();
            sendMessage('§aSpawn protection system has been updated.', player);

            // Then, update the world spawn if in the overworld
            if (location.dimensionId === 'minecraft:overworld') {
                try {
                    const spawnPos = { x: location.x, y: location.y, z: location.z };
                    world.setDefaultSpawnLocation(spawnPos);
                    sendMessage('§aWorld spawn point updated successfully.', player);
                } catch (e) {
                    errorLog(`[/setspawn] Failed to set default world spawn: ${e.stack}`);
                    sendMessage('§cError: Could not set the world spawn point. Check server logs for details.', player);
                }
                try {
                    world.getDimension('minecraft:overworld').runCommand('gamerule spawnradius 1');
                    sendMessage('§aWorld spawn radius set to 1.', player);
                } catch (e) {
                    errorLog(`[/setspawn] Failed to set spawnradius gamerule: ${e.stack}`);
                    sendMessage('§cError: Could not set the spawn radius. Check server logs for details.', player);
                }
            }

            if (!player.isConsole) { playSound(player, 'random.orb'); }
        } catch (e) {
            sendMessage('§cAn unexpected error occurred while setting the spawn.', player);
            errorLog(`[/setspawn] General error: ${e.stack}`);
        }
    }
});
