import * as mc from '@minecraft/server';

import { warnLog } from '../../../core/logger.js';

const PROPERTY_PREFIX = 'xray:hidden:';

// Key format: xray:hidden:chunkX:chunkZ
function getChunkKey(chunkLoc: mc.Vector3): string {
    const cx = Math.floor(chunkLoc.x / 16);
    const cz = Math.floor(chunkLoc.z / 16);
    // Use dimension ID if possible, but Vector3 doesn't have it.
    // We will prepend dimension ID in the wrapper function.
    return `${cx}:${cz}`;
}

export interface HiddenBlockData {
    originalType: string; // e.g., "minecraft:diamond_ore"
    location: { x: number, y: number, z: number };
}

// In-memory cache to avoid reading DynamicProperties every tick
// Map<DimensionId, Map<ChunkKey, Map<BlockKey, HiddenBlockData>>>
const chunkCache = new Map<string, Map<string, Map<string, HiddenBlockData>>>();

function getBlockKey(loc: mc.Vector3): string {
    return `${loc.x},${loc.y},${loc.z}`;
}

/**
 * Loads hidden block data for a specific chunk from DynamicProperties into the cache.
 */
function loadChunkData(dimension: mc.Dimension, chunkLoc: mc.Vector3): void {
    const dimId = dimension.id;
    const chunkKey = getChunkKey(chunkLoc);
    const propKey = `${PROPERTY_PREFIX}${dimId}:${chunkKey}`;

    if (!chunkCache.has(dimId)) {
        chunkCache.set(dimId, new Map());
    }
    const dimCache = chunkCache.get(dimId)!;

    if (dimCache.has(chunkKey)) return; // Already loaded

    const dataStr = mc.world.getDynamicProperty(propKey) as string;
    const dataMap = new Map<string, HiddenBlockData>();

    if (dataStr) {
        try {
            const rawData = JSON.parse(dataStr) as HiddenBlockData[];
            for (const item of rawData) {
                dataMap.set(getBlockKey(item.location as mc.Vector3), item);
            }
        } catch (e) {
            warnLog(`[XRay] Failed to parse hidden block data for ${propKey}: ${e}`);
        }
    }

    dimCache.set(chunkKey, dataMap);
}

/**
 * Saves the cache for a specific chunk back to DynamicProperties.
 */
function saveChunkData(dimension: mc.Dimension, chunkLoc: mc.Vector3): void {
    const dimId = dimension.id;
    const chunkKey = getChunkKey(chunkLoc);
    const propKey = `${PROPERTY_PREFIX}${dimId}:${chunkKey}`;

    const dimCache = chunkCache.get(dimId);
    if (!dimCache) return;
    const dataMap = dimCache.get(chunkKey);
    if (!dataMap) return;

    if (dataMap.size === 0) {
        mc.world.setDynamicProperty(propKey, undefined); // Delete if empty
        return;
    }

    const dataArray = Array.from(dataMap.values());
    // Limitation: DynamicProperty string max length is 32767.
    // If we exceed this, we might need to split. For now, we assume simple chunks.
    const json = JSON.stringify(dataArray);

    if (json.length > 30000) {
        warnLog(`[XRay] Chunk data too large for ${propKey} (${json.length} chars). Obfuscation may be compromised.`);
        // Basic safety: Don't save corrupted partial data, just warn.
        // In a real robust system, we would split into multiple keys.
        return;
    }

    mc.world.setDynamicProperty(propKey, json);
}

export function recordHiddenBlock(block: mc.Block, originalType: string): void {
    loadChunkData(block.dimension, block.location);

    const dimId = block.dimension.id;
    const chunkKey = getChunkKey(block.location);
    const blockKey = getBlockKey(block.location);

    const map = chunkCache.get(dimId)?.get(chunkKey);
    if (map) {
        map.set(blockKey, {
            originalType,
            location: { x: block.location.x, y: block.location.y, z: block.location.z }
        });
        // We defer saving to avoid lag. Ideally, save periodically or on chunk unload.
        // For this plan, we will add a "dirty" flag or just save immediately for safety until optimized.
        saveChunkData(block.dimension, block.location);
    }
}

export function getHiddenBlock(block: mc.Block): HiddenBlockData | undefined {
    // Ensure data is loaded
    loadChunkData(block.dimension, block.location);

    const dimId = block.dimension.id;
    const chunkKey = getChunkKey(block.location);
    const blockKey = getBlockKey(block.location);

    return chunkCache.get(dimId)?.get(chunkKey)?.get(blockKey);
}

export function removeHiddenBlock(block: mc.Block): void {
    loadChunkData(block.dimension, block.location);

    const dimId = block.dimension.id;
    const chunkKey = getChunkKey(block.location);
    const blockKey = getBlockKey(block.location);

    const map = chunkCache.get(dimId)?.get(chunkKey);
    if (map && map.has(blockKey)) {
        map.delete(blockKey);
        saveChunkData(block.dimension, block.location);
    }
}

/**
 * Returns all hidden blocks in the current cache for a dimension.
 * Useful for "Restore All" command.
 */
export function getAllHiddenBlocks(dimensionId: string): HiddenBlockData[] {
    const allData: HiddenBlockData[] = [];

    // Note: This only gets cached data. To get EVERYTHING, we'd need to iterate all dynamic properties.
    // Since we lazy-load, this might miss unloaded chunks.
    // For a robust "Restore All", we should iterate World Dynamic IDs.

    const propIds = mc.world.getDynamicPropertyIds();
    for (const id of propIds) {
        if (id.startsWith(`${PROPERTY_PREFIX}${dimensionId}:`)) {
            const dataStr = mc.world.getDynamicProperty(id) as string;
            if (dataStr) {
                try {
                    const items = JSON.parse(dataStr) as HiddenBlockData[];
                    allData.push(...items);
                } catch { /* ignore */ }
            }
        }
    }
    return allData;
}
