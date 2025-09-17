import { world, system } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { errorLog } from '../../core/errorLogger.js';

commandManager.register({
    name: 'rtp',
    aliases: ['randomtp'],
    description: 'Teleports you to a random safe location in the world.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    hasCooldown: true,
    execute: (player, args) => {
        const config = getConfig();
        if (!config.rtp.enabled) {
            player.sendMessage('§cThe Random Teleport system is currently disabled.');
            return;
        }

        // We don't need to await this, it will run in the background and message the player.
        findSafeLocationAndTeleport(player, config.rtp.minRange, config.rtp.maxRange);
    }
});

const sleep = (ticks) => {
    return new Promise(resolve => {
        system.runTimeout(() => {
            resolve();
        }, ticks);
    });
};

async function findSafeLocationAndTeleport(player, minRange, maxRange) {
    player.sendMessage('§aSearching for a safe random location...');
    const maxAttempts = 10;

    for (let i = 0; i < maxAttempts; i++) {
        player.sendMessage(`§7Attempt ${i + 1}/${maxAttempts}...`);
        const x = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const z = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const tickingAreaName = `rtp_${player.id}`; // Unique name per player

        try {
            // Use player.dimension.runCommand to run with server permissions
            player.dimension.runCommand(`tickingarea add circle ${x} 64 ${z} 1 ${tickingAreaName}`);
            await sleep(60); // Wait 3 seconds for the chunk to load

            const y = await findHighestSolidBlock(player.dimension, x, z);
            if (y !== null) {
                const block = player.dimension.getBlock({ x, y, z });
                const blockAbove = player.dimension.getBlock({ x, y: y + 1, z });
                const blockAbove2 = player.dimension.getBlock({ x, y: y + 2, z });

                if (isSafeBlock(block) && blockAbove && !blockAbove.isSolid && blockAbove2 && !blockAbove2.isSolid) {
                    player.dimension.runCommand(`tickingarea remove ${tickingAreaName}`);

                    const location = { x: x + 0.5, y: y + 1, z: z + 0.5 };
                    const warmupSeconds = getConfig().rtp.teleportWarmupSeconds;

                    const teleportLogic = () => {
                        try {
                            player.teleport(location);
                            player.sendMessage('§aYou have been teleported to a random location!');
                            setCooldown(player, 'rtp');
                        } catch (e) {
                            player.sendMessage('§cFailed to teleport to the location. Please try again.');
                            errorLog(`[/x:rtp] Failed to teleport: ${e.stack}`);
                        }
                    };

                    startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location');
                    return; // Exit successfully
                }
            }
        } catch (error) {
            errorLog(`[RTP] Attempt ${i + 1} at ${x},${z} failed: ${error}`);
        }

        // Ensure cleanup even on failure
        player.dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
    }

    player.sendMessage('§cCould not find a safe location after multiple attempts. Please try again.');
}

async function findHighestSolidBlock(dimension, x, z) {
    for (let y = dimension.heightRange.max; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (block && block.isSolid) {
                return y;
            }
        } catch (e) {
            return null; // Chunk probably not loaded, fail this attempt
        }
    }
    return null;
}

function isSafeBlock(block) {
    if (!block) { return false; }
    const unsafeBlocks = [
        'minecraft:lava', 'minecraft:flowing_lava', 'minecraft:water',
        'minecraft:flowing_water', 'minecraft:fire', 'minecraft:cactus',
        'minecraft:magma_block', 'minecraft:powder_snow'
    ];
    return !unsafeBlocks.includes(block.typeId);
}
