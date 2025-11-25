import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { setCooldown } from '../../core/cooldownManager.js';
import { startTeleportWarmup } from '../../core/utils.js';
import { errorLog, debugLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { constants } from '../../core/constants.js';

const rtpCommand: CustomCommand = {
    name: 'rtp',
    aliases: ['randomtp'],
    description: 'Teleports you to a random safe location in the world.',
    permissionLevel: 1024,
    hasCooldown: true,
    execute: (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {return;}

        const config = getConfig();
        if (!config.rtp.enabled) {
            sendMessage(constants.rtpDisabled, executor);
            return;
        }

        if (executor.dimension.id !== 'minecraft:overworld') {
            sendMessage('§cYou can only use /rtp in the Overworld.', executor);
            return;
        }

        findSafeLocationAndTeleport(executor, config.rtp.minRange, config.rtp.maxRange);
    }
};

async function findSafeLocationAndTeleport(player: mc.Player, minRange: number, maxRange: number) {
    sendMessage('§aSearching for a safe random location...', player);
    const searchAttempts = 10;
    const searchRadius = 16;

    for (let i = 0; i < searchAttempts; i++) {
        const centerX = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const centerZ = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));

        const tickingAreaName = `rtp_${player.id}`;

        try {
            player.dimension.runCommand(`tickingarea add circle ${centerX} 0 ${centerZ} 1 ${tickingAreaName}`);

            let chunkLoaded = false;
            let waitAttempts = 0;
            const maxWaitAttempts = 10;

            await new Promise<void>(resolve => mc.system.runTimeout(resolve, 60));

            while (!chunkLoaded && waitAttempts < maxWaitAttempts) {
                try {
                    player.dimension.getBlock({ x: centerX, y: 300, z: centerZ });
                    chunkLoaded = true;
                } catch {
                    waitAttempts++;
                    await new Promise<void>(resolve => mc.system.runTimeout(resolve, 10));
                }
            }

            if (!chunkLoaded) {
                 safeRemoveTickingArea(player.dimension, tickingAreaName);
                 continue;
            }

            sendMessage(`§7Searching... Attempt ${i + 1}/${searchAttempts}`, player);

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
                            } catch (e: any) {
                                sendMessage('§cFailed to teleport to the location. Please try again.', player);
                                errorLog(`[/rtp] Failed to teleport: ${e.stack}`);
                            }
                        };

                        sendMessage(`§aSafe location found! Teleportation will begin in ${warmupSeconds} seconds. Please do not move.`, player);
                        startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location');

                        safeRemoveTickingArea(player.dimension, tickingAreaName);
                        return;
                    }
                }
            }
        } catch (error: any) {
            debugLog(`[RTP] Search attempt ${i + 1} error: ${error}`);
        } finally {
            safeRemoveTickingArea(player.dimension, tickingAreaName);
        }

        await new Promise<void>(resolve => mc.system.runTimeout(resolve, 20));
    }

    sendMessage('§cCould not find a safe location after multiple attempts. Please try again or try walking a bit further.', player);
}

function safeRemoveTickingArea(dimension: mc.Dimension, name: string) {
    try {
        dimension.runCommand(`tickingarea remove ${name}`);
    } catch {
        // Ignore if it doesn't exist
    }
}

async function findHighestSolidBlock(dimension: mc.Dimension, x: number, z: number): Promise<number | null> {
    for (let y = 150; y >= dimension.heightRange.min; y--) {
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

function isLocationSafe(dimension: mc.Dimension, location: mc.Vector3): boolean {
    const { x, y, z } = location;
    const groundBlock = dimension.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
    if (!groundBlock || !groundBlock.isSolid) { return false; }

    const unsafeGroundBlocks = [
        'minecraft:lava', 'minecraft:flowing_lava',
        'minecraft:fire', 'minecraft:magma_block',
        'minecraft:cactus', 'minecraft:water', 'minecraft:flowing_water'
    ];
    if (unsafeGroundBlocks.includes(groundBlock.typeId)) { return false; }
    if (groundBlock.typeId.includes('leaves')) { return false; }

    const blockHead = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });
    const blockEyes = dimension.getBlock({ x: Math.floor(x), y: y + 1, z: Math.floor(z) });

    if (!blockHead || blockHead.isSolid) { return false; }
    if (!blockEyes || blockEyes.isSolid) { return false; }

    if (blockHead.isLiquid || blockEyes.isLiquid) { return false; }

    return true;
}

export default rtpCommand;
