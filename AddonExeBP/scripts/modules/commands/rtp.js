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
    parameters: [],
    execute: (player, args) => {
        const config = getConfig();
        if (!config.rtp.enabled) {
            player.sendMessage('§cThe Random Teleport system is currently disabled.');
            return;
        }

        player.sendMessage('§aFinding a safe location...');

        findSafeLocation(player, config.rtp.minRange, config.rtp.maxRange)
            .then(location => {
                if (!location) {
                    player.sendMessage('§cCould not find a safe location after multiple attempts. Please try again.');
                    return;
                }

                const warmupSeconds = config.rtp.teleportWarmupSeconds;
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
            })
            .catch(error => {
                player.sendMessage('§cAn unexpected error occurred while finding a safe location.');
                errorLog(`[RTP] Error in findSafeLocation: ${error}`);
            });
    }
});

/**
 * Finds a random safe location for the player to teleport to.
 * @param {import('@minecraft/server').Player} player
 * @param {number} minRange
 * @param {number} maxRange
 * @returns {Promise<import('@minecraft/server').Vector3 | null>}
 */
async function findSafeLocation(player, minRange, maxRange) {
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
        const x = player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1);
        const z = player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1);

        try {
            const y = await findHighestSolidBlock(player.dimension, x, z);

            if (y !== null) {
                const block = player.dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });
                const blockAbove = player.dimension.getBlock({ x: Math.floor(x), y: y + 1, z: Math.floor(z) });
                const blockAbove2 = player.dimension.getBlock({ x: Math.floor(x), y: y + 2, z: Math.floor(z) });

                if (isSafeBlock(block) && blockAbove && !blockAbove.isSolid && blockAbove2 && !blockAbove2.isSolid) {
                    return { x: x, y: y + 1, z: z };
                }
            }
        } catch (error) {
            // This can happen if the location is unloaded, just try again.
            errorLog(`[RTP] Attempt ${i + 1} failed: ${error}`);
        }
    }
    return null;
}

/**
 * Finds the Y coordinate of the highest solid block at a given X and Z.
 * @param {import('@minecraft/server').Dimension} dimension
 * @param {number} x
 * @param {number} z
 * @returns {Promise<number | null>}
 */
async function findHighestSolidBlock(dimension, x, z) {
    for (let y = dimension.heightRange.max; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });
            if (block && block.isSolid) {
                return y;
            }
        } catch {
            // Block is not loaded, this is expected in some cases.
            // We can't check this column, so we'll return null and let the caller try a new location.
            return null;
        }
    }
    return null;
}

/**
 * Checks if a block is safe to stand on.
 * @param {import('@minecraft/server').Block} block
 * @returns {boolean}
 */
function isSafeBlock(block) {
    if (!block) {return false;}
    // Add any other unsafe block IDs here
    const unsafeBlocks = [
        'minecraft:lava',
        'minecraft:flowing_lava',
        'minecraft:water',
        'minecraft:flowing_water',
        'minecraft:fire',
        'minecraft:cactus',
        'minecraft:magma_block'
    ];
    return !unsafeBlocks.includes(block.typeId);
}
