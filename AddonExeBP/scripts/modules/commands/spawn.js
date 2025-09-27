import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getConfig, updateMultipleConfig } from '../../core/configManager.js';
import { playSound, startTeleportWarmup } from '../../core/utils.js';
import { errorLog } from '../../core/errorLogger.js';
import { setCooldown } from '../../core/cooldownManager.js';

commandManager.register({
    name: 'spawn',
    aliases: ['lobby', 'hub'],
    description: 'Teleports you to the server spawn point.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [],
    hasCooldown: true,
    execute: (player, args) => {
        const config = getConfig();
        const spawnLocation = config.spawn.spawnLocation;

        if (!spawnLocation || typeof spawnLocation.x !== 'number') {
            player.sendMessage('§cThe server spawn point has not been set by an admin.');
            playSound(player, 'note.bass');
            return;
        }

        const warmupSeconds = config.spawn.teleportWarmupSeconds;

        const teleportLogic = () => {
            try {
                const dimension = world.getDimension(spawnLocation.dimensionId);
                player.teleport(spawnLocation, { dimension: dimension });
                player.sendMessage('§aTeleporting you to spawn...');
                playSound(player, 'random.orb');
                setCooldown(player, 'spawn');
            } catch (e) {
                player.sendMessage('§cFailed to teleport to spawn. The dimension may be invalid or the location unsafe.');
                errorLog(`[/x:spawn] Failed to teleport: ${e.stack}`);
                playSound(player, 'note.bass');
            }
        };

        startTeleportWarmup(player, warmupSeconds, teleportLogic, 'spawn');
    }
});

commandManager.register({
    name: 'setspawn',
    aliases: ['setworldspawn'],
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
    execute: (player, args) => {
        let location;
        const { x, y, z } = args;

        if (x !== undefined && y !== undefined && z !== undefined) {
            // Coordinates are provided
            location = {
                x: x,
                y: y,
                z: z,
                dimensionId: player.isConsole ? 'minecraft:overworld' : player.dimension.id
            };
        } else {
            // No coordinates, use player location
            if (player.isConsole) {
                player.sendMessage('§cYou must specify X, Y, and Z coordinates when running this command from the console.');
                return;
            }
            location = {
                x: player.location.x,
                y: player.location.y,
                z: player.location.z,
                dimensionId: player.dimension.id
            };
        }

        try {
            // Update the addon's config first
            updateMultipleConfig({ 'spawn.spawnLocation': location });
            const locationString = `X: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)} in ${location.dimensionId.replace('minecraft:', '')}`;
            player.sendMessage(`§aAddon spawn point set to: ${locationString}`);

            // Then, update the world spawn if in the overworld
            if (location.dimensionId === 'minecraft:overworld') {
                const spawnPos = { x: location.x, y: location.y, z: location.z };
                world.setDefaultSpawnLocation(spawnPos);
                world.getDimension('minecraft:overworld').runCommandAsync('gamerule spawnradius 1');
                player.sendMessage('§aWorld spawn point and spawn radius have also been updated.');
            }

            if (!player.isConsole) { playSound(player, 'random.orb'); }
        } catch (e) {
            player.sendMessage('§cFailed to save the new spawn location.');
            errorLog(`[/x:setspawn] Failed to update config or world spawn: ${e.stack}`);
        }
    }
});
