import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

import { getConfig } from '@core/configManager.js';
import { getWorldProtectionConfig } from '@core/configurations.js';
import type { Vector3 } from '@minecraft/server';

export type ProtectionFlags = {
    preventPvP: boolean;
    preventHostileDamage: boolean;
    preventHostileMobSpawning: boolean;
    preventBlockBreaking: boolean;
    preventBlockPlacing: boolean;
    preventExplosions: boolean;
    preventBlockInteraction: boolean;
    preventItemPickup: boolean;
    preventFallDamage: boolean;
    preventMagicDamage: boolean;
    preventMobGriefing: boolean;
    preventEntityInteraction: boolean;
    preventProjectileUsage: boolean;
};

const defaultFlags: ProtectionFlags = {
    preventPvP: false,
    preventHostileDamage: false,
    preventHostileMobSpawning: false,
    preventBlockBreaking: false,
    preventBlockPlacing: false,
    preventExplosions: false,
    preventBlockInteraction: false,
    preventItemPickup: false,
    preventFallDamage: false,
    preventMagicDamage: false,
    preventMobGriefing: false,
    preventEntityInteraction: false,
    preventProjectileUsage: false
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

    return location.x >= minX && location.x <= maxX && location.y >= minY && location.y <= maxY && location.z >= minZ && location.z <= maxZ;
}

/**
 * Gets the combined protection flags for a given location and dimension.
 * @param location The coordinate to check.
 * @param dimensionId The dimension of the coordinate (e.g., MinecraftDimensionTypes.Overworld).
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
                activeFlags.preventItemPickup = activeFlags.preventItemPickup || zone.flags.preventItemPickup;
                activeFlags.preventFallDamage = activeFlags.preventFallDamage || zone.flags.preventFallDamage;
                activeFlags.preventMagicDamage = activeFlags.preventMagicDamage || zone.flags.preventMagicDamage;
                activeFlags.preventMobGriefing = activeFlags.preventMobGriefing || zone.flags.preventMobGriefing;
                activeFlags.preventEntityInteraction = activeFlags.preventEntityInteraction || zone.flags.preventEntityInteraction;
                activeFlags.preventProjectileUsage = activeFlags.preventProjectileUsage || zone.flags.preventProjectileUsage;
            }
        }
    }

    // 2. Check Spawn Protection Zone
    const spawnConfig = getConfig();
    if (spawnConfig.spawnProtection.enabled) {
        const spawnLoc = spawnConfig.spawn.spawnLocation;
        const x = Number(spawnLoc.x);
        const z = Number(spawnLoc.z);

        // Verify spawn location has coordinates
        if (!isNaN(x) && !isNaN(z)) {
            // Spawn protection uses the configured dimension (or Overworld if undefined, though it defaults to Overworld)
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const spawnDimension = spawnLoc.dimensionId || MinecraftDimensionTypes.Overworld;
            if (dimensionId === (spawnDimension as string)) {
                const radius = Number(spawnConfig.spawnProtection.protectionRadius) || 0;

                // Construct Bounding Box for Spawn Protection (infinite Y axis realistically bounded by world limits)
                // Spawn column on X and Z axes
                const minSpawn = { x: x - radius, y: -64, z: z - radius };
                const maxSpawn = { x: x + radius, y: 320, z: z + radius };

                if (isWithinBox(location, minSpawn, maxSpawn)) {
                    // Combine spawn protection flags
                    activeFlags.preventPvP = activeFlags.preventPvP || spawnConfig.spawnProtection.preventPvP;
                    activeFlags.preventHostileDamage = activeFlags.preventHostileDamage || spawnConfig.spawnProtection.preventHostileDamage;
                    activeFlags.preventHostileMobSpawning = activeFlags.preventHostileMobSpawning || spawnConfig.spawnProtection.preventHostileMobSpawning;
                    activeFlags.preventBlockBreaking = activeFlags.preventBlockBreaking || spawnConfig.spawnProtection.preventBlockBreaking;
                    activeFlags.preventBlockPlacing = activeFlags.preventBlockPlacing || spawnConfig.spawnProtection.preventBlockPlacing;
                    activeFlags.preventExplosions = activeFlags.preventExplosions || spawnConfig.spawnProtection.preventExplosions;
                    activeFlags.preventBlockInteraction = activeFlags.preventBlockInteraction || spawnConfig.spawnProtection.preventBlockInteraction;
                    activeFlags.preventItemPickup = activeFlags.preventItemPickup || spawnConfig.spawnProtection.preventItemPickup;
                    activeFlags.preventFallDamage = activeFlags.preventFallDamage || spawnConfig.spawnProtection.preventFallDamage;
                    activeFlags.preventMagicDamage = activeFlags.preventMagicDamage || spawnConfig.spawnProtection.preventMagicDamage;
                    activeFlags.preventMobGriefing = activeFlags.preventMobGriefing || spawnConfig.spawnProtection.preventMobGriefing;
                    activeFlags.preventEntityInteraction = activeFlags.preventEntityInteraction || spawnConfig.spawnProtection.preventEntityInteraction;
                    activeFlags.preventProjectileUsage = activeFlags.preventProjectileUsage || spawnConfig.spawnProtection.preventProjectileUsage;
                }
            }
        }
    }

    return activeFlags;
}
