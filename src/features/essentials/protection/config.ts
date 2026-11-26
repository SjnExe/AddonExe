export type WorldProtectionZone = {
  id: string;
  name: string;
  dimension: string;
  box: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  flags: {
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
};

/** Server-wide global protection flags applied across all dimensions. */
export type GlobalProtectionFlags = {
  preventPvP: boolean;
  preventExplosions: boolean;
  preventMobGriefing: boolean;
  preventFireSpread: boolean;
};

/** Configuration options for the capped protection audit log. */
export type ProtectionAuditLogConfig = {
  enabled: boolean;
  maxEntries: number;
  retentionMinutes: number;
  logContainerAccess: boolean;
  logValuableBlocks: boolean;
  logHazardousPlacement: boolean;
};

export type WorldProtectionConfig = typeof worldProtectionConfig;
export const worldProtectionConfig = {
  zones: [] as WorldProtectionZone[],
  globalFlags: {
    preventPvP: false,
    preventExplosions: false,
    preventMobGriefing: false,
    preventFireSpread: false,
  } as GlobalProtectionFlags,
  auditLog: {
    enabled: false,
    maxEntries: 500,
    retentionMinutes: 1440,
    logContainerAccess: true,
    logValuableBlocks: true,
    logHazardousPlacement: true,
  } as ProtectionAuditLogConfig,
};

export default worldProtectionConfig;
