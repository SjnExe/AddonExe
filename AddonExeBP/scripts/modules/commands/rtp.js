import { system } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { Constants } from '../../core/constants.js';

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
            sendMessage(Constants.RTP_DISABLED, player);
            return;
        }

        if (player.dimension.id !== 'minecraft:overworld') {
            sendMessage('§cYou can only use /rtp in the Overworld.', player);
            return;
        }

        findSafeLocationAndTeleport(player, config.rtp.minRange, config.rtp.maxRange);
    }
});

const sleep = (ticks) => new Promise(resolve => system.runTimeout(resolve, ticks));

/**
 * Finds a safe location and teleports the player there.
 * @param {import('@minecraft/server').Player} player The player to teleport.
 * @param {number} minRange The minimum range to teleport.
 * @param {number} maxRange The maximum range to teleport.
 */
async function findSafeLocationAndTeleport(player, minRange, maxRange) {
    sendMessage('§aSearching for a safe random location...', player);
    const searchAttempts = 5;
    const locationAttempts = 10;
    const searchRadius = 16;

    for (let i = 0; i < searchAttempts; i++) {
        const centerX = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const centerZ = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const tickingAreaName = `rtp_${player.id}`;

        try {
            player.dimension.runCommand(`tickingarea add circle ${centerX} 64 ${centerZ} 1 ${tickingAreaName}`);
            await sleep(60);

            for (let j = 0; j < locationAttempts; j++) {
                sendMessage(`§7Searching... Attempt ${i * locationAttempts + j + 1}`, player);
                const x = centerX + Math.floor(Math.random() * (searchRadius * 2) - searchRadius);
                const z = centerZ + Math.floor(Math.random() * (searchRadius * 2) - searchRadius);
                const y = await findHighestSolidBlock(player.dimension, x, z);

                if (y !== null && isLocationSafe(player.dimension, { x, y, z })) {
                    const location = { x: x + 0.5, y: y + 1, z: z + 0.5 };
                    const warmupSeconds = getConfig().rtp.teleportWarmupSeconds;

                    const teleportLogic = () => {
                        try {
                            player.teleport(location);
                            sendMessage('§aYou have been teleported to a random location!', player);
                            setCooldown(player, 'rtp');
                        } catch (e) {
                            sendMessage('§cFailed to teleport to the location. Please try again.', player);
                            errorLog(`[/rtp] Failed to teleport: ${e.stack}`);
                        }
                    };

                    sendMessage('§aSafe location found! Teleportation will begin shortly. Please do not move.', player);
                    startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location');
                    player.dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                    return;
                }
            }
        } catch (error) {
            errorLog(`[RTP] Search attempt ${i + 1} at ${centerX},${centerZ} failed: ${error}`);
        } finally {
            player.dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
        }
    }

    sendMessage('§cCould not find a safe location after multiple attempts. Please try again.', player);
}

async function findHighestSolidBlock(dimension, x, z) {
    for (let y = 256; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (block && block.isSolid) {
                return y;
            }
        } catch {
            return null;
        }
    }
    return null;
}

function isLocationSafe(dimension, location) {
    const { x, y, z } = location;
    const groundBlock = dimension.getBlock({ x, y, z });
    if (!groundBlock || !groundBlock.isSolid) {return false;}

    const unsafeGroundBlocks = ['minecraft:lava', 'minecraft:flowing_lava', 'minecraft:fire', 'minecraft:cactus', 'minecraft:magma_block', 'minecraft:powder_snow', 'minecraft:water', 'minecraft:flowing_water'];
    if (unsafeGroundBlocks.includes(groundBlock.typeId) || groundBlock.typeId.includes('leaves')) {return false;}

    const blockAbove1 = dimension.getBlock({ x, y: y + 1, z });
    const blockAbove2 = dimension.getBlock({ x, y: y + 2, z });
    if (!blockAbove1 || blockAbove1.isSolid || !blockAbove2 || blockAbove2.isSolid) {return false;}

    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            if (dx === 0 && dz === 0) {continue;}
            const adjacentBlock = dimension.getBlock({ x: x + dx, y, z: z + dz });
            if (!adjacentBlock || unsafeGroundBlocks.includes(adjacentBlock.typeId)) {return false;}
        }
    }

    return true;
}
