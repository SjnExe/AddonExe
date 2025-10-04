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

async function findSafeLocationAndTeleport(player, minRange, maxRange) {
    player.sendMessage('§aSearching for a safe random location...');
    const maxAttempts = 10;
    const dimension = player.dimension;

    for (let i = 0; i < maxAttempts; i++) {
        // We still message on the first attempt, but not on subsequent rapid-fire attempts.
        if (i === 0) {
            player.sendMessage(`§7Attempt ${i + 1}/${maxAttempts}...`);
        }

        const x = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const z = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));

        try {
            // Use getBlockFromRay to find the highest block efficiently.
            const hit = dimension.getBlockFromRay({ x, y: dimension.heightRange.max, z }, { x: 0, y: -1, z: 0 });
            if (!hit) { continue; } // Nothing was hit, try a new location.

            const landingBlock = hit.block;
            const landingLocation = { x, y: landingBlock.y, z };

            if (isLocationSafe(dimension, landingLocation)) {
                const warmupSeconds = getConfig().rtp.teleportWarmupSeconds;
                const teleportLocation = { x: x + 0.5, y: landingBlock.y + 1, z: z + 0.5 };

                const teleportLogic = () => {
                    try {
                        player.teleport(teleportLocation, { dimension });
                        player.sendMessage('§aYou have been teleported to a random location!');
                        setCooldown(player, 'rtp');
                    } catch (e) {
                        player.sendMessage('§cFailed to teleport to the location. Please try again.');
                        errorLog(`[/rtp] Failed to teleport: ${e.stack}`);
                    }
                };

                player.sendMessage('§aSafe location found! Teleportation will begin shortly. Please do not move.');
                startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location');
                return; // Exit successfully
            }
        } catch {
            // This might happen if the raycast goes into an unloaded chunk, though it's less likely than with getBlock.
            // We can just ignore this attempt and try a new location.
        }
    }

    player.sendMessage('§cCould not find a safe location after multiple attempts. Please try again.');
}

function isLocationSafe(dimension, location) {
    const { x, y, z } = location;

    const groundBlock = dimension.getBlock({ x, y, z });
    if (!groundBlock || !groundBlock.isSolid) {
        return false; // Must be standing on a solid block.
    }

    // Check if the landing block itself is unsafe (e.g., lava, cactus).
    if (isUnsafeBlock(groundBlock)) {
        return false;
    }

    // Check the two blocks above the ground for air.
    const blockAbove1 = dimension.getBlock({ x, y: y + 1, z });
    const blockAbove2 = dimension.getBlock({ x, y: y + 2, z });
    if (!blockAbove1 || blockAbove1.isSolid || !blockAbove2 || blockAbove2.isSolid) {
        return false; // Not enough space for the player.
    }

    // Check the surrounding 3x3 area at the player's feet for immediate dangers.
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) {
                continue;
            } // Already checked the center block.
            const adjacentBlock = dimension.getBlock({ x: x + dx, y, z: z + dz });
            if (!adjacentBlock || isUnsafeBlock(adjacentBlock)) {
                return false; // Found an adjacent hazard.
            }
        }
    }

    // Optional: Check for undesirable landing spots like leaves or water.
    if (groundBlock.typeId.includes('leaves') || groundBlock.typeId.includes('water')) {
        return false;
    }

    return true; // Location is deemed safe.
}

function isUnsafeBlock(block) {
    if (!block) {
        return true;
    } // An unloaded block is unsafe.
    const unsafeBlocks = [
        'minecraft:lava', 'minecraft:flowing_lava', 'minecraft:water',
        'minecraft:flowing_water', 'minecraft:fire', 'minecraft:cactus',
        'minecraft:magma_block', 'minecraft:powder_snow', 'minecraft:void_air',
        'minecraft:cobweb'
    ];
    return unsafeBlocks.includes(block.typeId);
}
