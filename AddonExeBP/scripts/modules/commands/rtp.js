import { system } from '@minecraft/server';
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

        if (player.dimension.id !== 'minecraft:overworld') {
            player.sendMessage('§cYou can only use /rtp in the Overworld.');
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
    const searchAttempts = 5; // How many times to try a new major location
    const locationAttempts = 10; // How many times to try finding a spot within that location
    const searchRadius = 16; // 1 chunk radius around the test point

    for (let i = 0; i < searchAttempts; i++) {
        const centerX = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const centerZ = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const tickingAreaName = `rtp_${player.id}`;

        try {
            player.dimension.runCommand(`tickingarea add circle ${centerX} 64 ${centerZ} 1 ${tickingAreaName}`);
            await sleep(60); // Wait 3 seconds for the chunk to load

            for (let j = 0; j < locationAttempts; j++) {
                player.sendMessage(`§7Searching... Attempt ${i * locationAttempts + j + 1}`);
                const x = centerX + Math.floor(Math.random() * (searchRadius * 2) - searchRadius);
                const z = centerZ + Math.floor(Math.random() * (searchRadius * 2) - searchRadius);

                const y = await findHighestSolidBlock(player.dimension, x, z);

                if (y !== null && isLocationSafe(player.dimension, { x, y, z })) {
                    const location = { x: x + 0.5, y: y + 1, z: z + 0.5 };
                    const warmupSeconds = getConfig().rtp.teleportWarmupSeconds;

                    const teleportLogic = () => {
                        try {
                            player.teleport(location);
                            player.sendMessage('§aYou have been teleported to a random location!');
                            setCooldown(player, 'rtp');
                        } catch (e) {
                            player.sendMessage('§cFailed to teleport to the location. Please try again.');
                            errorLog(`[/rtp] Failed to teleport: ${e.stack}`);
                        }
                    };

                    player.sendMessage('§aSafe location found! Teleportation will begin shortly. Please do not move.');
                    startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location');
                    // Clean up before we exit
                    player.dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                    return;
                }
            }
        } catch (error) {
            errorLog(`[RTP] Search attempt ${i + 1} at ${centerX},${centerZ} failed: ${error}`);
        } finally {
            // Ensure cleanup even on failure
            player.dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
        }
    }

    player.sendMessage('§cCould not find a safe location after multiple attempts. Please try again.');
}

async function findHighestSolidBlock(dimension, x, z) {
    // Starts searching from a reasonable height to be more efficient
    for (let y = 256; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (block && block.isSolid) {
                return y;
            }
        } catch {
            return null; // Chunk probably not loaded
        }
    }
    return null;
}

function isLocationSafe(dimension, location) {
    const { x, y, z } = location;

    const groundBlock = dimension.getBlock({ x, y, z });
    if (!groundBlock || !groundBlock.isSolid) {
        return false;
    }

    const unsafeGroundBlocks = ['minecraft:lava', 'minecraft:flowing_lava', 'minecraft:fire', 'minecraft:cactus', 'minecraft:magma_block', 'minecraft:powder_snow', 'minecraft:water', 'minecraft:flowing_water'];
    if (unsafeGroundBlocks.includes(groundBlock.typeId) || groundBlock.typeId.includes('leaves')) {
        return false;
    }

    const blockAbove1 = dimension.getBlock({ x, y: y + 1, z });
    const blockAbove2 = dimension.getBlock({ x, y: y + 2, z });
    if (!blockAbove1 || blockAbove1.isSolid || !blockAbove2 || blockAbove2.isSolid) {
        return false;
    }

    // Check surrounding 3x3 area for immediate dangers (e.g., lava next to the landing spot)
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) {
                continue;
            }
            const adjacentBlock = dimension.getBlock({ x: x + dx, y, z: z + dz });
            if (!adjacentBlock || unsafeGroundBlocks.includes(adjacentBlock.typeId)) {
                return false;
            }
        }
    }

    return true;
}
