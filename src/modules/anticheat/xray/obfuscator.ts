import * as mc from '@minecraft/server';

import { getXrayConfig } from '../../../core/configurations.js';
import { jobManager } from '../../../core/jobManager.js';

import { getAllHiddenBlocks, getHiddenBlock, recordHiddenBlock, removeHiddenBlock } from './xrayData.js';

// Configuration constants (could be moved to config file later)
const DEBUG_MODE = false; // If true, shows particles instead of changing blocks
const OBFUSCATE_RADIUS = 1; // Chunk radius (1 = 3x3 chunks)

function isSolid(block: mc.Block | undefined): boolean {
    if (!block || block.isAir || block.isLiquid) return false;
    // Basic solid check. In a perfect world, we'd check strict opacity.
    // For Bedrock, we assume anything not air/liquid is "solid enough" to hide an ore.
    return true;
}

function getSurroundingBlocks(block: mc.Block): mc.Block[] {
    const dim = block.dimension;
    const { x, y, z } = block.location;
    return [
        dim.getBlock({ x: x + 1, y, z }),
        dim.getBlock({ x: x - 1, y, z }),
        dim.getBlock({ x, y: y + 1, z }),
        dim.getBlock({ x, y: y - 1, z }),
        dim.getBlock({ x, y, z: z + 1 }),
        dim.getBlock({ x, y, z: z - 1 })
    ].filter((b): b is mc.Block => b !== undefined);
}

function isCompletelyHidden(block: mc.Block): boolean {
    const neighbors = getSurroundingBlocks(block);
    // If any neighbor is NOT solid (air, water, lava, transparent), the ore is exposed.
    // We only hide if ALL 6 neighbors are solid.
    return neighbors.every((n) => isSolid(n));
}

function getReplacementBlock(block: mc.Block): string {
    const dimId = block.dimension.id;
    const y = block.location.y;

    if (dimId === 'minecraft:nether') {
        return 'minecraft:netherrack';
    } else if (dimId === 'minecraft:the_end') {
        return 'minecraft:end_stone';
    } else {
        // Overworld
        return y < 0 ? 'minecraft:deepslate' : 'minecraft:stone';
    }
}

function processSubChunk(dimension: mc.Dimension, cx: number, cz: number, startY: number) {
    const xrayConfig = getXrayConfig();
    const monitoredOres = xrayConfig?.monitoredOreTypes;
    if (!monitoredOres) return;

    // Create a Set of monitored block IDs for fast lookup
    const monitoredIds = new Set<string>();
    for (const key in monitoredOres) {
        // Cast to any or record to access by string key safely in loop
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oreType = (monitoredOres as any)[key];
        if (oreType && oreType.enabled) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            oreType.blocks.forEach((b: any) => monitoredIds.add(b.blockId));
        }
    }

    const startX = cx * 16;
    const startZ = cz * 16;
    const endX = startX + 16;
    const endZ = startZ + 16;
    const endY = startY + 16;

    for (let x = startX; x < endX; x++) {
        for (let z = startZ; z < endZ; z++) {
            for (let y = startY; y < endY; y++) {
                const block = dimension.getBlock({ x, y, z });
                if (!block) continue;

                if (monitoredIds.has(block.typeId)) {
                    // It's an ore. Check if hidden.
                    if (isCompletelyHidden(block)) {
                        // Hide it!
                        const originalType = block.typeId;
                        const replacement = getReplacementBlock(block);

                        if (DEBUG_MODE) {
                            // Visual debug
                            try {
                                dimension.spawnParticle('minecraft:villager_happy', block.center());
                            } catch {
                                // Ignore
                            }
                        } else {
                            // Actual logic
                            // 1. Record it
                            recordHiddenBlock(block, originalType);
                            // 2. Replace it
                            block.setType(replacement);
                        }
                    }
                }
            }
        }
    }
}

/**
 * Scans a chunk for ores and hides them if they are buried.
 */
async function processChunk(dimension: mc.Dimension, chunkX: number, chunkZ: number) {
    const xrayConfig = getXrayConfig();
    if (!xrayConfig?.obfuscation?.enabled) return;

    // Define scanning volume (entire chunk height is too expensive, maybe just near player?)
    // For this plan, we scan a relevant slice or the whole chunk height if budget permits.
    // Optimization: Only scan Y levels where ores exist (-64 to 320 for simplicity, or stricter).

    // Using BlockVolume is more efficient in Beta API if available, but simple iteration is safer for custom logic.
    // Let's stick to a targeted scan range. For now, scanning -64 to 128 (approx).
    const range = { min: -64, max: 128 };

    // We iterate the chunk.
    // WARN: Iterating 16*16*(128+64) = 49k blocks is HEAVY.
    // We must break this into small jobs.

    // BETTER APPROACH: We don't scan the whole chunk blindly.
    // We only react to "Exposed" blocks? No, that's not obfuscation.
    // We MUST scan. To make it performant, we slice the chunk into 16x16x16 sections.

    for (let y = range.min; y < range.max; y += 16) {
        jobManager.addJob({
            id: `obf:${dimension.id}:${chunkX}:${chunkZ}:${y}`,
            priority: 1, // Low priority background task
            work: () => processSubChunk(dimension, chunkX, chunkZ, y)
        });
    }
}

/**
 * Triggered when a player breaks a block.
 * Reveals any hidden ores adjacent to the broken block.
 */
function handleBlockBreak(event: mc.PlayerBreakBlockAfterEvent) {
    const { block } = event;
    const neighbors = getSurroundingBlocks(block);

    for (const neighbor of neighbors) {
        const hiddenData = getHiddenBlock(neighbor);
        if (hiddenData) {
            // It was hidden! Restore it.
            // Check if it's still effectively hidden?
            // No, if a neighbor is broken, it is by definition exposed (or at least one face is).
            // Actually, if I break a block above it, the top face is exposed.

            // Restore:
            neighbor.setType(hiddenData.originalType);
            removeHiddenBlock(neighbor);
        }
    }
}

/**
 * Periodically schedules obfuscation for chunks around players.
 */
function scheduleObfuscation() {
    mc.system.runInterval(() => {
        void (async () => {
            const xrayConfig = getXrayConfig();
            if (!xrayConfig?.obfuscation?.enabled) return;

            const players = mc.world.getAllPlayers();
            for (const player of players) {
                // Only scan if player is underground (heuristic) or generally enabled
                if (player.location.y > 64 && player.dimension.id === 'minecraft:overworld') continue;

                const chunkX = Math.floor(player.location.x / 16);
                const chunkZ = Math.floor(player.location.z / 16);

                // Radius scan
                for (let dx = -OBFUSCATE_RADIUS; dx <= OBFUSCATE_RADIUS; dx++) {
                    for (let dz = -OBFUSCATE_RADIUS; dz <= OBFUSCATE_RADIUS; dz++) {
                        await processChunk(player.dimension, chunkX + dx, chunkZ + dz);
                    }
                }
            }
        })();
    }, (getXrayConfig()?.obfuscation?.updateInterval ?? 10) * 20); // Default 10s
}

/**
 * Emergency restore function.
 */
export function restoreAllHiddenOres(dimensionId: string = 'minecraft:overworld') {
    const hiddenBlocks = getAllHiddenBlocks(dimensionId);
    const dim = mc.world.getDimension(dimensionId);
    let count = 0;

    for (const data of hiddenBlocks) {
        try {
            const block = dim.getBlock(data.location);
            if (block) {
                block.setType(data.originalType);
                removeHiddenBlock(block);
                count++;
            }
        } catch {
            // chunk maybe unloaded
        }
    }
    return count;
}

export function initializeObfuscator() {
    mc.world.afterEvents.playerBreakBlock.subscribe(handleBlockBreak);
    scheduleObfuscation();
}
