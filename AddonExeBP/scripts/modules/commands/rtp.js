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
                errorLog(`[RTP] Error in findSafeLocation: ${error}\n${error.stack}`);
            });
    }
});

const sleep = (ticks) => {
    return new Promise(resolve => {
        system.runTimeout(() => {
            resolve();
        }, ticks);
    });
};

async function findSafeLocation(player, minRange, maxRange) {
    const maxAttempts = 10;
    const dimension = player.dimension;

    for (let i = 0; i < maxAttempts; i++) {
        const x = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const z = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const tickingAreaName = `rtp_${Date.now()}`;

        try {
            await dimension.runCommandAsync(`tickingarea add circle ${x} 64 ${z} 1 ${tickingAreaName}`);
            await sleep(10);
            const y = await findHighestSolidBlock(dimension, x, z);
            if (y !== null) {
                const block = dimension.getBlock({ x, y, z });
                const blockAbove = dimension.getBlock({ x, y: y + 1, z });
                const blockAbove2 = dimension.getBlock({ x, y: y + 2, z });
                if (isSafeBlock(block) && blockAbove && !blockAbove.isSolid && blockAbove2 && !blockAbove2.isSolid) {
                    return { x: x + 0.5, y: y + 1, z: z + 0.5 };
                }
            }
        } catch (error) {
            errorLog(`[RTP] Attempt ${i + 1} at ${x},${z} failed: ${error}`);
        } finally {
            try {
                await dimension.runCommandAsync(`tickingarea remove ${tickingAreaName}`);
            } catch (e) {
                // Ignore
            }
        }
    }
    return null;
}

async function findHighestSolidBlock(dimension, x, z) {
    for (let y = dimension.heightRange.max; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (block && block.isSolid) {
                return y;
            }
        } catch (e) {
            console.warn(`[RTP] getBlock failed at ${x},${y},${z}: ${e}`);
            return null;
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
