import { getConfig } from '@core/config/configManager.js';
import { getWorldProtectionConfig } from '@core/config/configurations.js';
import type { WorldProtectionZone } from '@features/essentials/protection/config.js';
import type { Vector3 } from '@minecraft/server';
import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

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

const defaultFlags: Readonly<ProtectionFlags> = Object.freeze({
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
  preventProjectileUsage: false,
});

interface CachedZone {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  flags: WorldProtectionZone['flags'];
}

let cachedZonesByDimension: Map<string, CachedZone[]> | undefined;
let cachedZonesRef: WorldProtectionZone[] | undefined;

export function invalidateProtectionZoneCache(): void {
  cachedZonesByDimension = undefined;
  cachedZonesRef = undefined;
}

function getZonesForDimension(zones: WorldProtectionZone[], dimensionId: string): CachedZone[] {
  if (!cachedZonesByDimension || cachedZonesRef !== zones) {
    cachedZonesByDimension = new Map();
    cachedZonesRef = zones;
    for (const z of zones) {
      let list = cachedZonesByDimension.get(z.dimension);
      if (!list) {
        list = [];
        cachedZonesByDimension.set(z.dimension, list);
      }
      list.push({
        minX: Math.min(z.box.min.x, z.box.max.x),
        minY: Math.min(z.box.min.y, z.box.max.y),
        minZ: Math.min(z.box.min.z, z.box.max.z),
        maxX: Math.max(z.box.min.x, z.box.max.x),
        maxY: Math.max(z.box.min.y, z.box.max.y),
        maxZ: Math.max(z.box.min.z, z.box.max.z),
        flags: z.flags,
      });
    }
  }
  return cachedZonesByDimension.get(dimensionId) ?? [];
}

export function getProtectionFlags(location: Vector3, dimensionId: string): ProtectionFlags {
  const worldConfig = getWorldProtectionConfig();
  const spawnConfig = getConfig();
  const dimZones = worldConfig.zones.length > 0 ? getZonesForDimension(worldConfig.zones, dimensionId) : [];
  const hasSpawnProt = Boolean(spawnConfig.spawnProtection?.enabled);

  if (dimZones.length === 0 && !hasSpawnProt) {
    return defaultFlags as ProtectionFlags;
  }

  let activeFlags: ProtectionFlags | undefined;
  const lx = location.x;
  const ly = location.y;
  const lz = location.z;

  // 1. Check World Protection Zones (pre-normalized bounds, O(1) dimension bucket)
  for (let i = 0; i < dimZones.length; i++) {
    const zone = dimZones[i]!;
    if (
      lx >= zone.minX &&
      lx <= zone.maxX &&
      ly >= zone.minY &&
      ly <= zone.maxY &&
      lz >= zone.minZ &&
      lz <= zone.maxZ
    ) {
      activeFlags ??= { ...defaultFlags };
      // Combine flags (OR logic: if any zone prevents it, it's prevented)
      activeFlags.preventPvP = activeFlags.preventPvP || zone.flags.preventPvP;
      activeFlags.preventHostileDamage = activeFlags.preventHostileDamage || zone.flags.preventHostileDamage;
      activeFlags.preventHostileMobSpawning =
        activeFlags.preventHostileMobSpawning || zone.flags.preventHostileMobSpawning;
      activeFlags.preventBlockBreaking = activeFlags.preventBlockBreaking || zone.flags.preventBlockBreaking;
      activeFlags.preventBlockPlacing = activeFlags.preventBlockPlacing || zone.flags.preventBlockPlacing;
      activeFlags.preventExplosions = activeFlags.preventExplosions || zone.flags.preventExplosions;
      activeFlags.preventBlockInteraction = activeFlags.preventBlockInteraction || zone.flags.preventBlockInteraction;
      activeFlags.preventItemPickup = activeFlags.preventItemPickup || zone.flags.preventItemPickup;
      activeFlags.preventFallDamage = activeFlags.preventFallDamage || zone.flags.preventFallDamage;
      activeFlags.preventMagicDamage = activeFlags.preventMagicDamage || zone.flags.preventMagicDamage;
      activeFlags.preventMobGriefing = activeFlags.preventMobGriefing || zone.flags.preventMobGriefing;
      activeFlags.preventEntityInteraction =
        activeFlags.preventEntityInteraction || zone.flags.preventEntityInteraction;
      activeFlags.preventProjectileUsage = activeFlags.preventProjectileUsage || zone.flags.preventProjectileUsage;
    }
  }

  // 2. Check Spawn Protection Zone
  if (hasSpawnProt) {
    const spawnLoc = spawnConfig.spawn.spawnLocation;
    const x = Number(spawnLoc.x);
    const z = Number(spawnLoc.z);

    if (!Number.isNaN(x) && !Number.isNaN(z)) {
      const spawnDimension = spawnLoc.dimensionId || MinecraftDimensionTypes.Overworld;
      if (dimensionId === spawnDimension) {
        const radius = Number(spawnConfig.spawnProtection.protectionRadius) || 0;
        const minSpawnX = x - radius;
        const maxSpawnX = x + radius;
        const minSpawnZ = z - radius;
        const maxSpawnZ = z + radius;

        if (lx >= minSpawnX && lx <= maxSpawnX && ly >= -64 && ly <= 320 && lz >= minSpawnZ && lz <= maxSpawnZ) {
          activeFlags ??= { ...defaultFlags };
          activeFlags.preventPvP = activeFlags.preventPvP || spawnConfig.spawnProtection.preventPvP;
          activeFlags.preventHostileDamage =
            activeFlags.preventHostileDamage || spawnConfig.spawnProtection.preventHostileDamage;
          activeFlags.preventHostileMobSpawning =
            activeFlags.preventHostileMobSpawning || spawnConfig.spawnProtection.preventHostileMobSpawning;
          activeFlags.preventBlockBreaking =
            activeFlags.preventBlockBreaking || spawnConfig.spawnProtection.preventBlockBreaking;
          activeFlags.preventBlockPlacing =
            activeFlags.preventBlockPlacing || spawnConfig.spawnProtection.preventBlockPlacing;
          activeFlags.preventExplosions =
            activeFlags.preventExplosions || spawnConfig.spawnProtection.preventExplosions;
          activeFlags.preventBlockInteraction =
            activeFlags.preventBlockInteraction || spawnConfig.spawnProtection.preventBlockInteraction;
          activeFlags.preventItemPickup =
            activeFlags.preventItemPickup || spawnConfig.spawnProtection.preventItemPickup;
          activeFlags.preventFallDamage =
            activeFlags.preventFallDamage || spawnConfig.spawnProtection.preventFallDamage;
          activeFlags.preventMagicDamage =
            activeFlags.preventMagicDamage || spawnConfig.spawnProtection.preventMagicDamage;
          activeFlags.preventMobGriefing =
            activeFlags.preventMobGriefing || spawnConfig.spawnProtection.preventMobGriefing;
          activeFlags.preventEntityInteraction =
            activeFlags.preventEntityInteraction || spawnConfig.spawnProtection.preventEntityInteraction;
          activeFlags.preventProjectileUsage =
            activeFlags.preventProjectileUsage || spawnConfig.spawnProtection.preventProjectileUsage;
        }
      }
    }
  }

  return activeFlags ?? (defaultFlags as ProtectionFlags);
}
