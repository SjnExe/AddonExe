import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { setCooldown } from '@core/cooldownManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { startTeleportWarmup } from '@core/teleportLogic.js';

import { saveLastLocation } from '@features/teleport/utils.js';

const rtpCommand: CustomCommand = {
    name: 'rtp',
    aliases: ['randomtp'],
    description: 'Teleports you to a random safe location in the world.',
    category: 'Transportation',
    permissionNode: 'cmd.rtp.member',
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const config = getConfig();
        if (!config.rtp.enabled) {
            sendMessage('§cThe RTP system is currently disabled globally.', executor);
            return;
        }

        if (executor.dimension.id !== 'minecraft:overworld') {
            sendMessage('§cYou can only use /rtp in the Overworld.', executor);
            return;
        }

        await findSafeLocationAndTeleport(executor, config.rtp.minRange, config.rtp.maxRange);
    }
};

async function createTickingArea(dimension: mc.Dimension, name: string, x: number, z: number): Promise<void> {
    try {
        await mc.world.tickingAreaManager.createTickingArea(name, {
            dimension: dimension,
            from: { x: x - 16, y: 0, z: z - 16 },
            to: { x: x + 16, y: 0, z: z + 16 }
        });
        // Allow time for command to register
        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 60));
    } catch {
        // Fallback to command if API method fails (e.g., if there's no space in the manager)
        try {
            const sanitizedName = name.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`).replaceAll('\n', ' ');
            dimension.runCommand(`tickingarea add circle ${x} 0 ${z} 1 "${sanitizedName}"`);
            await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 60));
        } catch {
            // Ignore error
        }
    }
}

async function ensureChunkLoaded(dimension: mc.Dimension, x: number, z: number): Promise<boolean> {
    let chunkLoaded = false;
    let waitAttempts = 0;
    const maxWaitAttempts = 10;

    while (!chunkLoaded && waitAttempts < maxWaitAttempts) {
        try {
            dimension.getBlock({ x, y: 300, z });
            chunkLoaded = true;
        } catch {
            waitAttempts++;
            await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 10));
        }
    }
    return chunkLoaded;
}

function initiateTeleport(player: mc.Player, location: mc.Vector3, tickingAreaName: string, warmupSeconds: number) {
    const teleportLogic = () => {
        try {
            saveLastLocation(player);
            player.teleport(location);
            sendMessage('§aYou have been teleported to a random location!', player);
            const config = getConfig();
            setCooldown(player.id, 'rtp', config.rtp.cooldownSeconds);
        } catch (error: unknown) {
            const stack = error instanceof Error ? error.stack : String(error);
            sendMessage('§cFailed to teleport to the location. Please try again.', player);
            errorLog(`[/rtp] Failed to teleport: ${stack}`);
        }
    };

    sendMessage(`§aSafe location found! Please do not move. Teleportation sequence will begin in 5 seconds.`, player);

    mc.system.runTimeout(() => {
        if (!player.isValid) {
            safeRemoveTickingArea(player.dimension, tickingAreaName);
            return;
        }
        startTeleportWarmup(
            player,
            warmupSeconds,
            () => {
                teleportLogic();
                safeRemoveTickingArea(player.dimension, tickingAreaName);
            },
            'a random location',
            () => {
                safeRemoveTickingArea(player.dimension, tickingAreaName);
            }
        );
    }, 100);
}

function findSafeSpotInArea(dimension: mc.Dimension, centerX: number, centerZ: number, radius: number): mc.Vector3 | undefined {
    const locationAttempts = 5;
    for (let j = 0; j < locationAttempts; j++) {
        const x = centerX + Math.floor(Math.random() * (radius * 2) - radius);
        const z = centerZ + Math.floor(Math.random() * (radius * 2) - radius);
        const y = findHighestSolidBlock(dimension, x, z);

        if (y !== undefined) {
            const potentialLoc = { x: x + 0.5, y: y + 1, z: z + 0.5 };
            if (isLocationSafe(dimension, potentialLoc)) {
                return potentialLoc;
            }
        }
    }
    return undefined;
}

async function findSafeLocationAndTeleport(player: mc.Player, minRange: number, maxRange: number) {
    sendMessage('§aSearching for a safe random location...', player);
    const searchAttempts = 10;
    const searchRadius = 16;

    for (let i = 0; i < searchAttempts; i++) {
        const centerX = Math.floor(player.location.x + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));
        const centerZ = Math.floor(player.location.z + (Math.random() * (maxRange - minRange) + minRange) * (Math.random() < 0.5 ? 1 : -1));

        const tickingAreaName = `rtp_${player.id}`;
        let keepTickingArea = false;

        try {
            await createTickingArea(player.dimension, tickingAreaName, centerX, centerZ);

            const chunkLoaded = await ensureChunkLoaded(player.dimension, centerX, centerZ);
            if (!chunkLoaded) {
                safeRemoveTickingArea(player.dimension, tickingAreaName);
                continue;
            }

            sendMessage(`§7Searching... Attempt ${i + 1}/${searchAttempts}`, player);

            const safeLoc = findSafeSpotInArea(player.dimension, centerX, centerZ, searchRadius);

            if (safeLoc) {
                const warmupSeconds = getConfig().rtp.teleportWarmupSeconds;
                initiateTeleport(player, safeLoc, tickingAreaName, warmupSeconds);
                keepTickingArea = true;
                return;
            }
        } catch (error: unknown) {
            debugLog(`[RTP] Search attempt ${i + 1} error: ${String(error)}`);
        } finally {
            if (!keepTickingArea) {
                safeRemoveTickingArea(player.dimension, tickingAreaName);
            }
        }

        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 20));
    }

    sendMessage('§cCould not find a safe location after multiple attempts. Please try again or try walking a bit further.', player);
}

function safeRemoveTickingArea(dimension: mc.Dimension, name: string) {
    try {
        mc.world.tickingAreaManager.removeTickingArea(name);
    } catch {
        // Fallback to command
        try {
            const sanitizedName = name.replaceAll('\\', String.raw`\\`).replaceAll('"', String.raw`\"`).replaceAll('\n', ' ');
            dimension.runCommand(`tickingarea remove "${sanitizedName}"`);
        } catch {
            // Ignore if it doesn't exist
        }
    }
}

function findHighestSolidBlock(dimension: mc.Dimension, x: number, z: number): number | undefined {
    // Attempt to use the newer getTopmostBlock API for performance
    try {
        const block = dimension.getTopmostBlock({ x, z });
        if (block) return block.location.y;
    } catch {
        // Fallback if API fails or method doesn't exist
    }

    for (let y = 320; y >= dimension.heightRange.min; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (block && !block.isAir) {
                return y;
            }
        } catch {
            return undefined;
        }
    }
    return undefined;
}

const UNSAFE_GROUND_BLOCKS = new Set<string>([
    MinecraftBlockTypes.Lava,
    MinecraftBlockTypes.FlowingLava,
    MinecraftBlockTypes.Fire,
    MinecraftBlockTypes.Magma,
    MinecraftBlockTypes.Cactus,
    MinecraftBlockTypes.Water,
    MinecraftBlockTypes.FlowingWater
]);

function isLocationSafe(dimension: mc.Dimension, location: mc.Vector3): boolean {
    const { x, y, z } = location;
    const groundBlock = dimension.getBlock({ x: Math.floor(x), y: y - 1, z: Math.floor(z) });
    if (!groundBlock || groundBlock.isAir) {
        return false;
    }

    if (UNSAFE_GROUND_BLOCKS.has(groundBlock.typeId)) {
        return false;
    }
    if (groundBlock.typeId.includes('leaves')) {
        return false;
    }

    const blockHead = dimension.getBlock({ x: Math.floor(x), y: y, z: Math.floor(z) });
    const blockEyes = dimension.getBlock({ x: Math.floor(x), y: y + 1, z: Math.floor(z) });

    if (!blockHead || !blockHead.isAir) {
        return false;
    }
    if (!blockEyes || !blockEyes.isAir) {
        return false;
    }

    if (blockHead.isLiquid || blockEyes.isLiquid) {
        return false;
    }

    return true;
}

export default rtpCommand;
