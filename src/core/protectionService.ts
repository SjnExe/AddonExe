import { getSpawnConfig, getWorldProtectionConfig } from './configurations.js';
import type { Vector3 } from '@minecraft/server';
import { isDefined, isNumber } from '@lib/guards.js';

export type ProtectionFlags = {
    preventPvP: boolean;
    preventHostileDamage: boolean;
    preventHostileMobSpawning: boolean;
    preventBlockBreaking: boolean;
    preventBlockPlacing: boolean;
    preventExplosions: boolean;
    preventBlockInteraction: boolean;
};

const defaultFlags: ProtectionFlags = {
    preventPvP: false,
    preventHostileDamage: false,
    preventHostileMobSpawning: false,
    preventBlockBreaking: false,
    preventBlockPlacing: false,
    preventExplosions: false,
    preventBlockInteraction: false
};

/**
 * Checks if a coordinate is within a bounding box.
 * @param location The coordinate to check.
 * @param min The minimum point of the bounding box.
 * @param max The maximum point of the bounding box.
 * @returns true if the coordinate is within the box.
 */
function isWithinBox(location: Vector3, min: Vector3, max: Vector3): boolean {
    const minX = Math.min(min.x, max.x);
    const minY = Math.min(min.y, max.y);
    const minZ = Math.min(min.z, max.z);

    const maxX = Math.max(min.x, max.x);
    const maxY = Math.max(min.y, max.y);
    const maxZ = Math.max(min.z, max.z);

    return (
        location.x >= minX && location.x <= maxX &&
        location.y >= minY && location.y <= maxY &&
        location.z >= minZ && location.z <= maxZ
    );
}

/**
 * Gets the combined protection flags for a given location and dimension.
 * @param location The coordinate to check.
 * @param dimensionId The dimension of the coordinate (e.g., 'minecraft:overworld').
 * @returns The combined active protection flags. If any overlapping zone prevents an action, it is prevented.
 */
export function getProtectionFlags(location: Vector3, dimensionId: string): ProtectionFlags {
    const activeFlags: ProtectionFlags = { ...defaultFlags };

    // 1. Check World Protection Zones
    const worldConfig = getWorldProtectionConfig();
    for (const zone of worldConfig.zones) {
        if (zone.dimension === dimensionId) {
            if (isWithinBox(location, zone.box.min, zone.box.max)) {
                // Combine flags (OR logic: if any zone prevents it, it's prevented)
                activeFlags.preventPvP = activeFlags.preventPvP || zone.flags.preventPvP;
                activeFlags.preventHostileDamage = activeFlags.preventHostileDamage || zone.flags.preventHostileDamage;
                activeFlags.preventHostileMobSpawning = activeFlags.preventHostileMobSpawning || zone.flags.preventHostileMobSpawning;
                activeFlags.preventBlockBreaking = activeFlags.preventBlockBreaking || zone.flags.preventBlockBreaking;
                activeFlags.preventBlockPlacing = activeFlags.preventBlockPlacing || zone.flags.preventBlockPlacing;
                activeFlags.preventExplosions = activeFlags.preventExplosions || zone.flags.preventExplosions;
                activeFlags.preventBlockInteraction = activeFlags.preventBlockInteraction || zone.flags.preventBlockInteraction;
            }
        }
    }

    // 2. Check Spawn Protection Zone
    const spawnConfig = getSpawnConfig();
    if (spawnConfig.spawnProtection.enabled) {
        const spawnLoc = spawnConfig.spawn.spawnLocation;
        // Verify spawn location has coordinates
        if (isDefined(spawnLoc.x) && isDefined(spawnLoc.z) && isNumber(spawnLoc.x) && isNumber(spawnLoc.z)) {
            // Spawn protection uses the configured dimension (or Overworld if undefined, though it defaults to Overworld)
            const spawnDimension = spawnLoc.dimensionId || 'minecraft:overworld';
            if (dimensionId === spawnDimension) {
                const radius = spawnConfig.spawnProtection.protectionRadius;

                // Construct Bounding Box for Spawn Protection (infinite Y axis realistically bounded by world limits)
                // Spawn column on X and Z axes
                const minSpawn = { x: spawnLoc.x - radius, y: -64, z: spawnLoc.z - radius };
                const maxSpawn = { x: spawnLoc.x + radius, y: 320, z: spawnLoc.z + radius };

                if (isWithinBox(location, minSpawn, maxSpawn)) {
                    // Combine spawn protection flags
                    activeFlags.preventPvP = activeFlags.preventPvP || spawnConfig.spawnProtection.preventPvP;
                    activeFlags.preventHostileDamage = activeFlags.preventHostileDamage || spawnConfig.spawnProtection.preventHostileDamage;
                    activeFlags.preventHostileMobSpawning = activeFlags.preventHostileMobSpawning || spawnConfig.spawnProtection.preventHostileMobSpawning;
                    activeFlags.preventBlockBreaking = activeFlags.preventBlockBreaking || spawnConfig.spawnProtection.preventBlockBreaking;
                    activeFlags.preventBlockPlacing = activeFlags.preventBlockPlacing || spawnConfig.spawnProtection.preventBlockPlacing;
                    activeFlags.preventExplosions = activeFlags.preventExplosions || spawnConfig.spawnProtection.preventExplosions;
                    activeFlags.preventBlockInteraction = activeFlags.preventBlockInteraction || spawnConfig.spawnProtection.preventBlockInteraction;
                }
            }
        }
    }

    return activeFlags;
}
