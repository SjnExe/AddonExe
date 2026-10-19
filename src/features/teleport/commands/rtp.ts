import * as mc from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import * as configManager from '@core/config/configManager.js';
import { getCooldown, setCooldown } from '@core/data/cooldownManager.js';
import { escapeCommandArg, formatCooldown, playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { startTeleportWarmup } from '@core/utils/teleportLogic.js';
import { getEffectiveBorderForDimension, isWithinWorldBorder } from '@features/essentials/worldBorderManager.js';
import { isSafeTeleportColumn, saveLastLocation } from '@features/teleport/utils.js';
import { isDefined, isNumber } from '@lib/guards.js';

const activeRtpSearches = new Set<string>();

const chunkScanOffsets: [number, number][] = [
    [0, 0],
    [6, 0],
    [-6, 0],
    [0, 6],
    [0, -6],
    [8, 8],
    [-8, 8],
    [8, -8],
    [-8, -8],
    [12, 0],
    [-12, 0],
    [0, 12]
];

const rtpCommand: CustomCommand = {
    name: 'rtp',
    aliases: ['randomtp'],
    description: 'Teleports you to a random safe location in the Overworld.',
    category: 'Transportation',
    permissionNode: 'cmd.rtp.member',
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }

        const config = configManager.getConfig();
        if (!config?.rtp?.enabled) {
            sendMessage('§cThe RTP system is currently disabled globally.', executor);
            return;
        }

        if (executor.dimension.id !== (MinecraftDimensionTypes.Overworld as string)) {
            sendMessage('§cYou can only use /rtp in the Overworld.', executor);
            return;
        }

        const remainingCooldown = getCooldown(executor.id, 'rtp');
        if (remainingCooldown > 0) {
            sendMessage(`§cYou are on RTP cooldown for ${formatCooldown(remainingCooldown)}.`, executor);
            return;
        }

        if (activeRtpSearches.has(executor.id)) {
            sendMessage('§eAn RTP search is already in progress for you. Please wait...', executor);
            return;
        }

        const rawMin = Math.max(0, config.rtp.minRange ?? 1000);
        const rawMax = Math.max(rawMin + 64, config.rtp.maxRange ?? 10000);

        await findSafeLocationAndTeleport(executor, rawMin, rawMax);
    }
};

function resolveRtpOriginAndBounds(minRange: number, maxRange: number): { centerX: number; centerZ: number; minRadius: number; maxRadius: number } {
    const border = getEffectiveBorderForDimension(MinecraftDimensionTypes.Overworld);
    const config = configManager.getConfig();
    const spawnLoc = config?.spawn?.spawnLocation;

    let centerX = 0;
    let centerZ = 0;

    if (border.enabled) {
        centerX = border.centerX;
        centerZ = border.centerZ;
    } else if (isDefined(spawnLoc) && isNumber(spawnLoc.x) && isNumber(spawnLoc.z)) {
        centerX = spawnLoc.x;
        centerZ = spawnLoc.z;
    } else {
        try {
            const worldSpawn = mc.world.getDefaultSpawnLocation();
            if (isDefined(worldSpawn)) {
                centerX = worldSpawn.x;
                centerZ = worldSpawn.z;
            }
        } catch {
            // Default to (0, 0)
        }
    }

    let effectiveMax = maxRange;
    if (border.enabled) {
        const safeBorderMax = Math.max(32, border.radius - border.knockbackBuffer - 16);
        effectiveMax = Math.min(effectiveMax, safeBorderMax);
    }

    const effectiveMin = Math.min(minRange, Math.max(0, effectiveMax - 32));
    return {
        centerX,
        centerZ,
        minRadius: effectiveMin,
        maxRadius: effectiveMax
    };
}

/**
 * Generates uniformly distributed random coordinates within the annulus [minRadius, maxRadius].
 */
function sampleUniformAnnulusPoint(centerX: number, centerZ: number, minRadius: number, maxRadius: number): { x: number; z: number } {
    const theta = Math.random() * Math.PI * 2;
    const minSq = minRadius * minRadius;
    const maxSq = maxRadius * maxRadius;
    const radius = Math.sqrt(Math.random() * (maxSq - minSq) + minSq);

    const x = Math.floor(centerX + radius * Math.cos(theta));
    const z = Math.floor(centerZ + radius * Math.sin(theta));
    return { x, z };
}

async function createTickingAreaFast(dimension: mc.Dimension, name: string, x: number, z: number): Promise<void> {
    safeRemoveTickingArea(dimension, name);
    try {
        await mc.world.tickingAreaManager.createTickingArea(name, {
            dimension,
            from: { x: x - 12, y: 0, z: z - 12 },
            to: { x: x + 12, y: 0, z: z + 12 }
        });
    } catch {
        try {
            const sanitizedName = escapeCommandArg(name);
            dimension.runCommand(`tickingarea add circle ${x} 0 ${z} 1 "${sanitizedName}"`);
        } catch {
            // Ignore command fallback error
        }
    }
}

async function waitForChunkReady(dimension: mc.Dimension, x: number, z: number): Promise<boolean> {
    const maxPolls = 12;
    for (let attempt = 0; attempt < maxPolls; attempt++) {
        try {
            const probe = dimension.getBlock({ x, y: 64, z });
            if (isDefined(probe)) {
                return true;
            }
        } catch {
            // Chunk still loading
        }
        await new Promise<void>((resolve) => mc.system.runTimeout(resolve, 2));
    }
    return false;
}

function safeRemoveTickingArea(dimension: mc.Dimension, name: string): void {
    try {
        mc.world.tickingAreaManager.removeTickingArea(name);
    } catch {
        try {
            const sanitizedName = escapeCommandArg(name);
            dimension.runCommand(`tickingarea remove "${sanitizedName}"`);
        } catch {
            // Ignore if already removed
        }
    }
}

function findHighestSurfaceY(dimension: mc.Dimension, x: number, z: number): number | undefined {
    try {
        const topBlock = dimension.getTopmostBlock({ x, z });
        if (isDefined(topBlock) && !topBlock.isAir) {
            return topBlock.location.y;
        }
    } catch {
        // Fallback scan
    }

    const minY = dimension.heightRange?.min ?? -64;
    for (let y = 319; y >= minY; y--) {
        try {
            const block = dimension.getBlock({ x, y, z });
            if (isDefined(block) && !block.isAir) {
                return y;
            }
        } catch {
            return undefined;
        }
    }
    return undefined;
}

function scanChunkForSafeSpot(dimension: mc.Dimension, centerX: number, centerZ: number): mc.Vector3 | undefined {
    for (const [dx, dz] of chunkScanOffsets) {
        const x = centerX + dx;
        const z = centerZ + dz;

        if (!isWithinWorldBorder({ x, z }, MinecraftDimensionTypes.Overworld)) {
            continue;
        }

        const surfaceY = findHighestSurfaceY(dimension, x, z);
        if (surfaceY === undefined || surfaceY < -58 || surfaceY > 316) {
            continue;
        }

        const spawnY = surfaceY + 1;
        if (isSafeTeleportColumn(dimension, x, spawnY, z, true)) {
            return { x: x + 0.5, y: spawnY, z: z + 0.5 };
        }
    }
    return undefined;
}

function initiateRtpWarmup(player: mc.Player, location: mc.Vector3, tickingAreaName: string, warmupSeconds: number): void {
    const dimension = player.dimension;

    const teleportLogic = () => {
        try {
            if (!player.isValid) {
                return;
            }
            saveLastLocation(player);
            player.teleport(location, { dimension });
            sendMessage(`§aTeleported to random safe coordinates: §eX: ${Math.floor(location.x)}, Y: ${Math.floor(location.y)}, Z: ${Math.floor(location.z)}§a!`, player);
            playSound(player, 'random.orb');
            const config = configManager.getConfig();
            setCooldown(player.id, 'rtp', config?.rtp?.cooldownSeconds ?? 600);
        } catch (error: unknown) {
            const stack = error instanceof Error ? error.stack : String(error);
            sendMessage('§cFailed to teleport to the random location. Please try again.', player);
            errorLog(`[/rtp] Failed to teleport: ${stack}`);
        } finally {
            safeRemoveTickingArea(dimension, tickingAreaName);
        }
    };

    startTeleportWarmup(player, warmupSeconds, teleportLogic, 'a random location', () => {
        safeRemoveTickingArea(dimension, tickingAreaName);
    });
}

async function findSafeLocationAndTeleport(player: mc.Player, minRange: number, maxRange: number): Promise<void> {
    activeRtpSearches.add(player.id);
    const tickingAreaName = `rtp_${player.id}`;
    const { centerX, centerZ, minRadius, maxRadius } = resolveRtpOriginAndBounds(minRange, maxRange);
    const maxAttempts = 12;

    sendMessage('§aSearching for a safe random location...', player);

    try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (!player.isValid) {
                safeRemoveTickingArea(player.dimension, tickingAreaName);
                return;
            }

            const candidate = sampleUniformAnnulusPoint(centerX, centerZ, minRadius, maxRadius);
            let keepTickingArea = false;

            try {
                await createTickingAreaFast(player.dimension, tickingAreaName, candidate.x, candidate.z);
                const chunkReady = await waitForChunkReady(player.dimension, candidate.x, candidate.z);

                if (chunkReady) {
                    const safeSpot = scanChunkForSafeSpot(player.dimension, candidate.x, candidate.z);
                    if (isDefined(safeSpot)) {
                        const warmupSeconds = configManager.getConfig()?.rtp?.teleportWarmupSeconds ?? 10;
                        keepTickingArea = true;
                        initiateRtpWarmup(player, safeSpot, tickingAreaName, warmupSeconds);
                        return;
                    }
                }
            } catch (error: unknown) {
                debugLog(`[RTP] Attempt ${attempt} error: ${String(error)}`);
            } finally {
                if (!keepTickingArea) {
                    safeRemoveTickingArea(player.dimension, tickingAreaName);
                }
            }
        }

        sendMessage('§cCould not find a safe dry land location. Please try /rtp again!', player);
    } finally {
        activeRtpSearches.delete(player.id);
    }
}

export default rtpCommand;
