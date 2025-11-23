import * as mc from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { errorLog, debugLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

commandManager.register({
    name: 'rtp',
    aliases: ['randomtp'],
    description: 'Teleports you to a random safe location in the world.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    hasCooldown: true,
    /**
     * Executes the /rtp command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        if (!config.rtp.enabled) {
            sendMessage(constants.rtpDisabled, player);
            return;
        }

        if (player.dimension.id !== 'minecraft:overworld') {
            sendMessage('§cYou can only use /rtp in the Overworld.', player);
            return;
        }

        findSafeLocationAndTeleport(player, config.rtp.minRange, config.rtp.maxRange);
    }
});

/**
 * Finds a safe location and teleports the player there.
 * @param {import('@minecraft/server').Player} player The player to teleport.
 * @param {number} minRange The minimum range to teleport.
 * @param {number} maxRange The maximum range to teleport.
 */
async function findSafeLocationAndTeleport(player, minRange, maxRange) {
    sendMessage('§aSearching for a safe random location...', player);
    const searchAttempts = 10; // Increased attempts
    const searchRadius = 16;

    for (let i = 0; i < searchAttempts; i++) {
        // Generate random center coordinates
        const centerX = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const centerZ = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));

        const tickingAreaName = `rtp_${player.id}`;

        try {
            // Create ticking area to load chunks
            player.dimension.runCommand(`tickingarea add circle ${centerX} 0 ${centerZ} 1 ${tickingAreaName}`);

            // WAIT for chunks to load.
            // 2 seconds (40 ticks) is usually safer than 60 ticks, but let's use 30 ticks.
            await new Promise(resolve => mc.system.runTimeout(resolve, 30));

            sendMessage(`§7Searching... Attempt ${i + 1}/${searchAttempts}`, player);

            // Try to find a spot near this center
            // We reduce the inner loop to avoid stalling too long on one bad spot
            const locationAttempts = 5;
            for (let j = 0; j < locationAttempts; j++) {
                const x = centerX + Math.floor(Math.random() * (searchRadius * 2) - searchRadius);
                const z = centerZ + Math.floor(Math.random() * (searchRadius * 2) - searchRadius);
                const y = await findHighestSolidBlock(player.dimension, x, z);

                if (y !== null) {
                    const potentialLoc = { x: x + 0.5, y: y + 1, z: z + 0.5 };
                    if (isLocationSafe(player.dimension, potentialLoc)) {
                        const warmupSeconds = getConfig().rtp.teleportWarmupSeconds;

                        const teleportLogic = () => {
                            try {
                                player.teleport(potentialLoc);
                                sendMessage('§aYou have been teleported to a random location!', player);
                                setCooldown(player, 'rtp');
                            } catch (e) {
                                sendMessage('§cFailed to teleport to the location. Please try again.', player);
                                errorLog(`[/rtp] Failed to teleport: ${e.stack}`);
                            }
                        };

                        sendMessage(`§aSafe location found! Teleportation will begin in ${warmupSeconds} seconds. Please do not move.`, player);
                        startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location');

                        // Cleanup immediately upon success
                        safeRemoveTickingArea(player.dimension, tickingAreaName);
                        return;
                    }
                }
            }
        } catch (error) {
            debugLog(`[RTP] Search attempt ${i + 1} error: ${error}`);
        } finally {
            safeRemoveTickingArea(player.dimension, tickingAreaName);
        }

        // Delay before next attempt to prevent spam and lag
        await new Promise(resolve => mc.system.runTimeout(resolve, 20));
    }

    sendMessage('§cCould not find a safe location after multiple attempts. Please try again or try walking a bit further.', player);
}

function safeRemoveTickingArea(dimension, name) {
    try {
        dimension.runCommand(`tickingarea remove ${name}`);
    } catch {
        // Ignore if it doesn't exist
    }
}

async function findHighestSolidBlock(dimension, x, z) {
    // Start high but not max height to save performance, assuming surface isn't at 300
    // Bedrock max height is 320 usually.
    for (let y = 150; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (block && block.isSolid) {
                return y;
            }
        } catch {
            // Chunk might still not be loaded or error accessing block
            return null;
        }
    }
    return null;
}

function isLocationSafe(dimension, location) {
    const { x, y, z } = location;
    const groundBlock = dimension.getBlock({ x, y: y - 1, z });
    if (!groundBlock || !groundBlock.isSolid) { return false; }

    const unsafeGroundBlocks = [
        'minecraft:lava', 'minecraft:flowing_lava',
        'minecraft:fire', 'minecraft:magma_block',
        'minecraft:cactus', 'minecraft:water', 'minecraft:flowing_water'
    ];
    if (unsafeGroundBlocks.includes(groundBlock.typeId)) { return false; }
    if (groundBlock.typeId.includes('leaves')) { return false; } // Avoid spawning on trees

    // Check space for player (2 blocks high)
    const blockHead = dimension.getBlock({ x, y, z });
    const blockEyes = dimension.getBlock({ x, y: y + 1, z });

    if (!blockHead || blockHead.isSolid) { return false; }
    if (!blockEyes || blockEyes.isSolid) { return false; }

    // Check for liquids at head/feet
    if (blockHead.isLiquid || blockEyes.isLiquid) { return false; }

    return true;
}
