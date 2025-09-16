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
    parameters: [],
    execute: async (player, args) => {
        const config = getConfig();
        if (!config.rtp.enabled) {
            player.sendMessage('§cThe Random Teleport system is currently disabled.');
            return;
        }

        player.sendMessage('§aFinding a safe location...');

        try {
            const location = await findSafeLocation(player, config.rtp.minRange, config.rtp.maxRange);
            if (!location) {
                player.sendMessage('§cCould not find a safe location. This may be because no other players are online or in a suitable area.');
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
        } catch (error) {
            player.sendMessage('§cAn unexpected error occurred while finding a safe location.');
            errorLog(`[RTP] Error in execute block: ${error}\n${error.stack}`);
        }
    }
});

/**
 * Finds a random safe location for the player to teleport to by finding other players.
 * @param {import('@minecraft/server').Player} player
 * @param {number} minRange
 * @param {number} maxRange
 * @returns {Promise<import('@minecraft/server').Vector3 | null>}
 */
async function findSafeLocation(player, minRange, maxRange) {
    const otherPlayers = world.getAllPlayers().filter(p => p.id !== player.id);

    if (otherPlayers.length === 0) {
        return null; // No other players to teleport near
    }

    // Shuffle the array of other players to randomize who we pick first
    for (let i = otherPlayers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherPlayers[i], otherPlayers[j]] = [otherPlayers[j], otherPlayers[i]];
    }

    for (const targetPlayer of otherPlayers) {
        // Try up to 5 times per player to find a spot
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * (maxRange - minRange) + minRange;
            const x = Math.floor(targetPlayer.location.x + distance * Math.cos(angle));
            const z = Math.floor(targetPlayer.location.z + distance * Math.sin(angle));

            // Since the chunk is loaded, we don't need ticking areas.
            // We can directly check for a safe spot.
            const y = await findHighestSolidBlock(targetPlayer.dimension, x, z);

            if (y !== null) {
                const block = targetPlayer.dimension.getBlock({ x, y, z });
                const blockAbove = targetPlayer.dimension.getBlock({ x, y: y + 1, z });
                const blockAbove2 = targetPlayer.dimension.getBlock({ x, y: y + 2, z });

                if (isSafeBlock(block) && blockAbove && !blockAbove.isSolid && blockAbove2 && !blockAbove2.isSolid) {
                    return { x: x + 0.5, y: y + 1, z: z + 0.5 }; // Found a safe spot
                }
            }
        }
    }

    return null; // Failed to find a safe spot near any player
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
            const block = dimension.getBlock({ x, y, z });
            if (block && block.isSolid) {
                return y; // Found the highest solid block
            }
        } catch (e) {
            // This error should not be hit in loaded chunks, but is a safe fallback.
            console.warn(`[RTP] getBlock failed in a supposedly loaded chunk at ${x},${y},${z}.`);
            return null;
        }
    }
    return null; // No solid block found in this column
}

/**
 * Checks if a block is safe to stand on.
 * @param {import('@minecraft/server').Block} block
 * @returns {boolean}
 */
function isSafeBlock(block) {
    if (!block) { return false; }
    const unsafeBlocks = [
        'minecraft:lava', 'minecraft:flowing_lava', 'minecraft:water',
        'minecraft:flowing_water', 'minecraft:fire', 'minecraft:cactus',
        'minecraft:magma_block', 'minecraft:powder_snow'
    ];
    return !unsafeBlocks.includes(block.typeId);
}
