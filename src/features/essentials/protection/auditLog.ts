import { getWorldProtectionConfig } from '@core/config/configurations.js';
import type { Vector3 } from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

/** Categories of audited protection actions. */
export type AuditActionType = 'break' | 'place' | 'container';

/** Single protection audit log record. */
export interface ProtectionAuditEntry {
  timestamp: number;
  playerName: string;
  action: AuditActionType;
  blockType: string;
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

const valuableBlockTypes = new Set<string>([
  MinecraftBlockTypes.DiamondOre,
  MinecraftBlockTypes.DeepslateDiamondOre,
  MinecraftBlockTypes.EmeraldOre,
  MinecraftBlockTypes.DeepslateEmeraldOre,
  MinecraftBlockTypes.AncientDebris,
  MinecraftBlockTypes.DiamondBlock,
  MinecraftBlockTypes.EmeraldBlock,
  MinecraftBlockTypes.NetheriteBlock,
  MinecraftBlockTypes.GoldBlock,
  MinecraftBlockTypes.Beacon,
  MinecraftBlockTypes.MobSpawner,
  MinecraftBlockTypes.Chest,
  MinecraftBlockTypes.TrappedChest,
  MinecraftBlockTypes.Barrel,
  MinecraftBlockTypes.UndyedShulkerBox,
]);

const hazardousBlockTypes = new Set<string>([
  MinecraftBlockTypes.Tnt,
  MinecraftBlockTypes.Fire,
  MinecraftBlockTypes.SoulFire,
  MinecraftBlockTypes.Lava,
  MinecraftBlockTypes.FlowingLava,
  MinecraftBlockTypes.RespawnAnchor,
]);

const auditEntries: ProtectionAuditEntry[] = [];

/**
 * Checks whether a block type should be recorded by the lightweight protection audit log.
 *
 * @param action Audit action category.
 * @param blockType Block type identifier.
 * @returns True if the event matches enabled audit filters.
 */
export function shouldRecordAuditEvent(action: AuditActionType, blockType: string): boolean {
  const cfg = getWorldProtectionConfig().auditLog;
  if (!cfg?.enabled) {
    return false;
  }
  if (action === 'container') {
    return cfg.logContainerAccess !== false;
  }
  if (action === 'place' && cfg.logHazardousPlacement !== false && hazardousBlockTypes.has(blockType)) {
    return true;
  }
  if (
    (action === 'break' || action === 'place') &&
    cfg.logValuableBlocks !== false &&
    valuableBlockTypes.has(blockType)
  ) {
    return true;
  }
  return false;
}

/**
 * Appends a protection audit entry to the capped rolling buffer when audit logging is enabled.
 *
 * @param entry Audit record excluding timestamp.
 */
export function recordAuditEntry(entry: Omit<ProtectionAuditEntry, 'timestamp'>): void {
  const cfg = getWorldProtectionConfig().auditLog;
  if (!cfg?.enabled) {
    return;
  }
  const now = Date.now();
  const maxEntries = Math.max(10, Math.min(2000, Number(cfg.maxEntries) || 500));
  const retentionMs = Math.max(1, Number(cfg.retentionMinutes) || 1440) * 60_000;

  // Prune expired entries from the front (timestamps are monotonic)
  while (auditEntries.length > 0 && now - auditEntries[0]!.timestamp > retentionMs) {
    auditEntries.shift();
  }

  auditEntries.push({
    ...entry,
    timestamp: now,
    x: Math.floor(entry.x),
    y: Math.floor(entry.y),
    z: Math.floor(entry.z),
  });

  if (auditEntries.length > maxEntries) {
    auditEntries.splice(0, auditEntries.length - maxEntries);
  }
}

/**
 * Queries recent audit entries near a world coordinate, ordered newest first.
 *
 * @param location Center coordinate.
 * @param dimensionId Dimension identifier.
 * @param radius Search radius in blocks.
 * @param limit Maximum results to return.
 * @returns Matching audit entries ordered newest-first.
 */
export function getAuditLogsNear(
  location: Vector3,
  dimensionId: string,
  radius = 8,
  limit = 20,
): ProtectionAuditEntry[] {
  const results: ProtectionAuditEntry[] = [];
  const rSq = radius * radius;
  for (let i = auditEntries.length - 1; i >= 0 && results.length < limit; i--) {
    const e = auditEntries[i]!;
    if (e.dimensionId !== dimensionId) {
      continue;
    }
    const dx = e.x - location.x;
    const dy = e.y - location.y;
    const dz = e.z - location.z;
    if (dx * dx + dy * dy + dz * dz <= rSq) {
      results.push(e);
    }
  }
  return results;
}

/** Clears all in-memory protection audit entries (for tests or admin reset). */
export function clearProtectionAuditLogs(): void {
  auditEntries.length = 0;
}
