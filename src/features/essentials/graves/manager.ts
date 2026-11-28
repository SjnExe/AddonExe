import { getConfig } from '@core/config/configManager.js';
import { getGameplayConfig } from '@core/config/configurations.js';
import * as cooldownManager from '@core/data/cooldownManager.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { floatingTextId, graveLabelPrefix } from '@core/utils/constants.js';
import { formatCooldown, formatCurrency, playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import * as teleportLogicModule from '@core/utils/teleportLogic.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { canBypassWorldBorder, isWithinWorldBorder } from '@features/essentials/worldBorder/manager.js';
import { saveLastLocation, teleportPlayerWithTransition } from '@features/teleport/utils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

/** Serialized item entry stored inside a player's grave. */
export interface GraveSlotEntry {
  slotType: 'inventory' | 'equipment';
  slotIndex?: number;
  equipmentSlot?: string;
  item: SerializedItem;
}

/** Persisted grave record containing location, owner, expiry, and stored items. */
export interface GraveRecord {
  id: string;
  ownerId: string;
  ownerName: string;
  dimensionId: string;
  x: number;
  y: number;
  z: number;
  createdAt: number;
  expiresAt: number;
  items: GraveSlotEntry[];
  unlocked: boolean;
  markerPending?: boolean;
  markerPlaced?: boolean;
  abandoned?: boolean;
}

const storage = new StorageManager('exe:graves:v1');
let graves = new Map<string, GraveRecord>();
let gravesByCoord = new Map<string, string>();
let expiryIntervalId: number | undefined;
let pendingRetryCursor = 0;
let hologramRefreshCursor = 0;
interface HurtInventorySnapshot {
  capturedAt: number;
  slots: GraveSlotEntry[];
  typeIds: Set<string>;
  counts: Map<string, number>;
  preExistingEntityIds: Set<string>;
}

const recentHurtSnapshots = new Map<string, HurtInventorySnapshot>();
const hurtSnapshotTtlMs = 1_000;

function pruneExpiredHurtSnapshots(now = Date.now()): void {
  for (const [id, entry] of recentHurtSnapshots) {
    if (now - entry.capturedAt > hurtSnapshotTtlMs) {
      recentHurtSnapshots.delete(id);
    }
  }
}

const equipmentSlotsOrder: EquipmentSlot[] = [
  EquipmentSlot.Head,
  EquipmentSlot.Chest,
  EquipmentSlot.Legs,
  EquipmentSlot.Feet,
  EquipmentSlot.Offhand,
];

function collectPlayerSlotEntries(
  invComp?: mc.EntityInventoryComponent,
  eqComp?: mc.EntityEquippableComponent,
): { slots: GraveSlotEntry[]; typeIds: Set<string>; counts: Map<string, number> } {
  const slots: GraveSlotEntry[] = [];
  const typeIds = new Set<string>();
  const counts = new Map<string, number>();

  if (invComp?.container) {
    for (let i = 0; i < invComp.container.size; i++) {
      const item = invComp.container.getItem(i);
      if (isDefined(item) && !item.keepOnDeath) {
        slots.push({ slotType: 'inventory', slotIndex: i, item: serializeItem(item) });
        typeIds.add(item.typeId);
        counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + item.amount);
      }
    }
  }

  if (eqComp) {
    for (const eqSlot of equipmentSlotsOrder) {
      const item = eqComp.getEquipment(eqSlot);
      if (isDefined(item) && !item.keepOnDeath) {
        slots.push({ slotType: 'equipment', equipmentSlot: eqSlot, item: serializeItem(item) });
        typeIds.add(item.typeId);
        counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + item.amount);
      }
    }
  }

  return { slots, typeIds, counts };
}

/**
 * Snapshots a player's non-keepOnDeath inventory and equipment when taking damage so post-death grave capture preserves
 * exact slots, enchantments, and items even if dropped entities burn in lava/fire/void or scatter.
 *
 * @param player The damaged player.
 */
export function snapshotPlayerInventoryForGrave(player: mc.Player): void {
  if (
    !getConfig().graves?.enabled ||
    !player.isValid ||
    getGameplayConfig().keepInventory ||
    mc.world.gameRules?.keepInventory
  ) {
    return;
  }
  let invComp: mc.EntityInventoryComponent | undefined;
  let eqComp: mc.EntityEquippableComponent | undefined;
  try {
    invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    eqComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  } catch {
    return;
  }

  const { slots, typeIds, counts } = collectPlayerSlotEntries(invComp, eqComp);

  if (recentHurtSnapshots.size > 16) {
    pruneExpiredHurtSnapshots();
  }
  if (slots.length > 0) {
    const preExistingEntityIds = new Set<string>();
    try {
      const nearby = player.dimension.getEntities({
        location: player.location,
        maxDistance: 12,
      });
      for (const ent of nearby) {
        if (ent.id && ent.id !== player.id) {
          preExistingEntityIds.add(ent.id);
        }
      }
    } catch {
      // Ignore unloaded chunk or mock errors
    }
    recentHurtSnapshots.set(player.id, {
      capturedAt: Date.now(),
      slots,
      typeIds,
      counts,
      preExistingEntityIds,
    });
  } else {
    recentHurtSnapshots.delete(player.id);
  }
}

function coordKey(dimensionId: string, x: number, y: number, z: number): string {
  return `${dimensionId}:${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}

function rebuildCoordIndex(): void {
  gravesByCoord = new Map();
  for (const [id, grave] of graves) {
    gravesByCoord.set(coordKey(grave.dimensionId, grave.x, grave.y, grave.z), id);
  }
}

function isValidGraveSlotEntry(value: unknown): value is GraveSlotEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Partial<GraveSlotEntry>;
  if (entry.slotType !== 'inventory' && entry.slotType !== 'equipment') {
    return false;
  }
  if (entry.slotIndex !== undefined && (typeof entry.slotIndex !== 'number' || !Number.isInteger(entry.slotIndex))) {
    return false;
  }
  if (entry.equipmentSlot !== undefined && typeof entry.equipmentSlot !== 'string') {
    return false;
  }
  if (!entry.item || typeof entry.item !== 'object') {
    return false;
  }
  const item = entry.item as Partial<SerializedItem>;
  return (
    typeof item.typeId === 'string' &&
    item.typeId.length > 0 &&
    typeof item.amount === 'number' &&
    Number.isFinite(item.amount) &&
    item.amount > 0 &&
    (item.enchantments === undefined || Array.isArray(item.enchantments))
  );
}

function isValidGraveRecord(value: unknown): value is GraveRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const rec = value as Partial<GraveRecord>;
  return (
    typeof rec.id === 'string' &&
    rec.id.length > 0 &&
    typeof rec.ownerId === 'string' &&
    typeof rec.ownerName === 'string' &&
    typeof rec.dimensionId === 'string' &&
    typeof rec.x === 'number' &&
    typeof rec.y === 'number' &&
    typeof rec.z === 'number' &&
    typeof rec.createdAt === 'number' &&
    typeof rec.expiresAt === 'number' &&
    Array.isArray(rec.items) &&
    rec.items.every(isValidGraveSlotEntry)
  );
}

/** Loads persisted grave records from world dynamic properties, validating each entry individually. */
export function loadGraves(): void {
  try {
    const parsed = storage.load<unknown>();
    graves = new Map();
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          isValidGraveRecord(entry[1]) &&
          entry[0] === entry[1].id
        ) {
          if (entry[1].items.length > 0 || entry[1].abandoned === true) {
            graves.set(entry[0], entry[1]);
          }
        }
      }
    }
    rebuildCoordIndex();
    debugLog(`[Graves] Loaded ${graves.size} active graves.`);
  } catch (err) {
    errorLog(`[Graves] Failed to load graves: ${String(err)}`);
    graves = new Map();
    gravesByCoord = new Map();
  }
}

/**
 * Saves active grave records to world dynamic properties.
 *
 * @returns True if saved successfully.
 */
export function saveGraves(): boolean {
  try {
    return storage.save([...graves.entries()]);
  } catch (err) {
    errorLog(`[Graves] Failed to save graves: ${String(err)}`);
    return false;
  }
}

function getDimensionBounds(dimensionId: string): { minY: number; maxY: number } {
  if (dimensionId === MinecraftDimensionTypes.Overworld) {
    return { minY: -63, maxY: 319 };
  }
  if (dimensionId === MinecraftDimensionTypes.Nether) {
    return { minY: 1, maxY: 126 };
  }
  return { minY: 1, maxY: 255 };
}

function formatDimensionLabel(dimensionId: string): string {
  if (dimensionId === MinecraftDimensionTypes.Overworld) {
    return 'Overworld';
  }
  if (dimensionId === MinecraftDimensionTypes.Nether) {
    return 'Nether';
  }
  if (dimensionId === MinecraftDimensionTypes.TheEnd) {
    return 'The End';
  }
  return dimensionId.replace('minecraft:', '');
}

function isReplaceableForGrave(blk: mc.Block | undefined): boolean {
  return Boolean(blk?.isAir);
}

function hasAdjacentChestOrGrave(dimension: mc.Dimension, loc: { x: number; y: number; z: number }): boolean {
  const offsets = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];
  for (const off of offsets) {
    const ax = loc.x + off.x;
    const az = loc.z + off.z;
    if (gravesByCoord.has(coordKey(dimension.id, ax, loc.y, az))) {
      return true;
    }
    try {
      const adj = dimension.getBlock({ x: ax, y: loc.y, z: az });
      if (adj && (adj.typeId === MinecraftBlockTypes.Chest || adj.typeId === MinecraftBlockTypes.TrappedChest)) {
        return true;
      }
    } catch {
      // Unloaded chunk: ignore
    }
  }
  return false;
}

function findSafeGraveLocation(
  dimension: mc.Dimension,
  origin: mc.Vector3,
): { x: number; y: number; z: number } | undefined {
  const { minY, maxY } = getDimensionBounds(dimension.id);
  const bx = Math.floor(origin.x);
  const bz = Math.floor(origin.z);
  const isVoidDeath = origin.y < minY;
  const by = Math.max(minY, Math.min(maxY, Math.floor(origin.y)));

  function* generateCandidates(): Generator<{ x: number; y: number; z: number }> {
    if (isVoidDeath) {
      // Void death: search upward from safe floor so the grave isn't buried at the void boundary
      for (let y = minY + 1; y <= Math.min(maxY, minY + 40); y++) {
        yield { x: bx, y, z: bz };
      }
      for (let radius = 1; radius <= 2; radius++) {
        for (let y = minY + 1; y <= Math.min(maxY, minY + 10); y++) {
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
                continue;
              }
              yield { x: bx + dx, y, z: bz + dz };
            }
          }
        }
      }
      return;
    }

    const yOffsets = [0, 1, -1, 2, -2, 3];
    for (let radius = 0; radius <= 4; radius++) {
      for (const dy of yOffsets) {
        const y = by + dy;
        if (y < minY || y > maxY) {
          continue;
        }
        if (radius === 0) {
          yield { x: bx, y, z: bz };
          continue;
        }
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
              continue;
            }
            yield { x: bx + dx, y, z: bz + dz };
          }
        }
      }
    }
  }

  // Prefer replaceable blocks not adjacent to any existing chest or grave (prevents double-chest merge)
  let firstUnloaded: { x: number; y: number; z: number } | undefined;
  for (const c of generateCandidates()) {
    if (gravesByCoord.has(coordKey(dimension.id, c.x, c.y, c.z))) {
      continue;
    }
    try {
      const blk = dimension.getBlock(c);
      if (!blk) {
        // Bedrock getBlock() returns undefined in unloaded chunks instead of throwing
        if (!firstUnloaded) {
          firstUnloaded = c;
        }
        continue;
      }
      if (isReplaceableForGrave(blk) && !hasAdjacentChestOrGrave(dimension, c)) {
        return c;
      }
    } catch {
      if (!firstUnloaded) {
        firstUnloaded = c;
      }
    }
  }

  return firstUnloaded;
}

function formatGraveHologramText(grave: GraveRecord): string {
  const count = grave.items.length;
  const now = Date.now();
  const publicMins = Number(getConfig().graves?.publicUnlockMinutes ?? 0);
  const isPublic = publicMins > 0 && now - grave.createdAt >= publicMins * 60_000;
  const status = isPublic ? '§aPublic' : grave.unlocked ? '§eProtected' : '§cLocked';
  const timeLeft = grave.expiresAt > 0 ? ` §8(${Math.max(0, Math.ceil((grave.expiresAt - now) / 60_000))}m)` : '';
  return `§6☠ §e${grave.ownerName}'s Grave\n§7${count} item${count === 1 ? '' : 's'} §8• ${status}${timeLeft}`;
}

function removeGraveHologram(grave: GraveRecord): void {
  try {
    const dim = mc.world.getDimension(grave.dimensionId);
    const entities = dim.getEntities({
      type: floatingTextId,
      location: { x: grave.x + 0.5, y: grave.y + 1.15, z: grave.z + 0.5 },
      maxDistance: 2.5,
    });
    const tag = `${graveLabelPrefix}${grave.id}`;
    for (const ent of entities) {
      if (ent.isValid && ent.hasTag(tag)) {
        ent.remove();
      }
    }
  } catch {
    // Ignore unloaded chunk or mock environment without floatingTextId
  }
}

function syncGraveHologram(grave: GraveRecord): void {
  if (!grave.markerPlaced) {
    return;
  }
  try {
    const dim = mc.world.getDimension(grave.dimensionId);
    const pos = { x: grave.x + 0.5, y: grave.y + 1.15, z: grave.z + 0.5 };
    const tag = `${graveLabelPrefix}${grave.id}`;
    const existing = dim
      .getEntities({ type: floatingTextId, location: pos, maxDistance: 2.5 })
      .find((ent) => ent.isValid && ent.hasTag(tag));
    const text = formatGraveHologramText(grave);
    if (existing) {
      if (existing.nameTag !== text) {
        existing.nameTag = text;
      }
      return;
    }
    const spawned = dim.spawnEntity(floatingTextId as unknown as Parameters<mc.Dimension['spawnEntity']>[0], pos);
    spawned.addTag(tag);
    spawned.nameTag = text;
  } catch {
    // Ignore unloaded chunk or mock environment without floatingTextId
  }
}

function hasGraveHologram(dim: mc.Dimension, grave: GraveRecord): boolean {
  try {
    const pos = { x: grave.x + 0.5, y: grave.y + 1.15, z: grave.z + 0.5 };
    const tag = `${graveLabelPrefix}${grave.id}`;
    return dim
      .getEntities({ type: floatingTextId, location: pos, maxDistance: 2.5 })
      .some((ent) => ent.isValid && ent.hasTag(tag));
  } catch {
    return false;
  }
}

function placeGraveMarker(dimension: mc.Dimension, loc: { x: number; y: number; z: number }): boolean {
  try {
    const blk = dimension.getBlock(loc);
    if (isReplaceableForGrave(blk) && !hasAdjacentChestOrGrave(dimension, loc)) {
      blk!.setType(MinecraftBlockTypes.Chest);
      return true;
    }
  } catch {
    // Ignore unloaded chunk or mock errors
  }
  return false;
}

function removeGraveMarker(grave: GraveRecord): boolean {
  try {
    const dim = mc.world.getDimension(grave.dimensionId);
    const blk = dim.getBlock({ x: grave.x, y: grave.y, z: grave.z });
    if (!blk) {
      // Chunk unloaded: only allow removal if marker was never placed
      return !grave.markerPlaced;
    }
    const isProvenMarker = grave.markerPlaced === true || hasGraveHologram(dim, grave);
    removeGraveHologram(grave);
    if (
      isProvenMarker &&
      (blk.typeId === MinecraftBlockTypes.Chest || blk.typeId === MinecraftBlockTypes.TrappedChest)
    ) {
      blk.setType(MinecraftBlockTypes.Air);
    }
    return true;
  } catch {
    removeGraveHologram(grave);
    return !grave.markerPlaced;
  }
}

function deleteGrave(graveId: string): boolean {
  const grave = graves.get(graveId);
  if (!grave) {
    return true;
  }
  if (!removeGraveMarker(grave)) {
    grave.abandoned = true;
    saveGraves();
    return false;
  }
  graves.delete(graveId);
  gravesByCoord.delete(coordKey(grave.dimensionId, grave.x, grave.y, grave.z));
  saveGraves();
  return true;
}

interface OwnerSnapshot {
  id: string;
  name: string;
}

function finalizeGraveCreation(
  owner: OwnerSnapshot,
  player: mc.Player,
  dim: mc.Dimension,
  deathOrigin: mc.Vector3,
  captured: GraveSlotEntry[],
  capturedTypeIds: Set<string>,
  invComp?: mc.EntityInventoryComponent,
  eqComp?: mc.EntityEquippableComponent,
  droppedEntities: mc.Entity[] = [],
  onGraveCreated?: (graveId: string) => void,
  preExistingEntityIds?: Set<string>,
): void {
  if (captured.length === 0) {
    return;
  }

  const cfg = getConfig().graves;
  const safeLoc = findSafeGraveLocation(dim, deathOrigin);
  const { minY, maxY } = getDimensionBounds(dim.id);
  let loc = safeLoc ?? {
    x: Math.floor(deathOrigin.x),
    y: Math.max(minY, Math.min(maxY, Math.floor(deathOrigin.y))),
    z: Math.floor(deathOrigin.z),
  };
  if (gravesByCoord.has(coordKey(dim.id, loc.x, loc.y, loc.z))) {
    let resolved: { x: number; y: number; z: number } | undefined;
    for (let dy = 0; dy <= 16 && !resolved; dy++) {
      const y = loc.y + dy;
      if (y <= maxY && !gravesByCoord.has(coordKey(dim.id, loc.x, y, loc.z))) {
        resolved = { x: loc.x, y, z: loc.z };
      }
    }
    if (!resolved) {
      if (player.isValid) {
        player.sendMessage('§c[Grave] Could not find an unoccupied coordinate for your grave.');
      }
      return;
    }
    loc = resolved;
  }

  const now = Date.now();
  const expiryMinutes = Math.max(0, Number(cfg?.expiryMinutes ?? 60));
  const expiresAt = expiryMinutes > 0 ? now + expiryMinutes * 60_000 : 0;
  const id = `grave_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const record: GraveRecord = {
    id,
    ownerId: owner.id,
    ownerName: owner.name,
    dimensionId: dim.id,
    x: loc.x,
    y: loc.y,
    z: loc.z,
    createdAt: now,
    expiresAt,
    items: captured,
    unlocked: (Number(cfg?.unlockCost) || 0) <= 0,
    markerPending: true,
    markerPlaced: false,
  };

  graves.set(id, record);
  gravesByCoord.set(coordKey(dim.id, loc.x, loc.y, loc.z), id);
  if (!saveGraves()) {
    graves.delete(id);
    gravesByCoord.delete(coordKey(dim.id, loc.x, loc.y, loc.z));
    return;
  }
  onGraveCreated?.(id);

  // Clear slots only after persistence succeeds
  if (invComp?.container) {
    for (const entry of captured) {
      if (entry.slotType === 'inventory' && isDefined(entry.slotIndex)) {
        invComp.container.setItem(entry.slotIndex, undefined);
      }
    }
  }
  if (eqComp) {
    for (const entry of captured) {
      if (entry.slotType === 'equipment' && entry.equipmentSlot) {
        eqComp.setEquipment(entry.equipmentSlot as EquipmentSlot, undefined);
      }
    }
  }
  const remainingCounts = new Map<string, number>();
  for (const entry of captured) {
    remainingCounts.set(entry.item.typeId, (remainingCounts.get(entry.item.typeId) ?? 0) + entry.item.amount);
  }
  for (const ent of droppedEntities) {
    try {
      if (ent.isValid) {
        const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
        const stack = itemComp?.itemStack;
        if (stack) {
          const rem = remainingCounts.get(stack.typeId) ?? 0;
          if (rem <= stack.amount) {
            remainingCounts.delete(stack.typeId);
          } else {
            remainingCounts.set(stack.typeId, rem - stack.amount);
          }
        }
        ent.remove();
      }
    } catch {
      // Ignore already-removed item entities
    }
  }

  const removeMatchingDroppedItems = () => {
    if (remainingCounts.size === 0 || capturedTypeIds.size === 0) {
      return;
    }
    try {
      const nearbyItems = dim.getEntities({
        location: deathOrigin,
        maxDistance: 10,
      });
      for (const ent of nearbyItems) {
        if (!ent.isValid || (preExistingEntityIds?.has(ent.id) ?? false)) {
          continue;
        }
        const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
        const stack = itemComp?.itemStack;
        if (!stack || !capturedTypeIds.has(stack.typeId)) {
          continue;
        }
        const allowed = remainingCounts.get(stack.typeId) ?? 0;
        if (allowed <= 0 || stack.amount > allowed) {
          continue;
        }
        if (allowed <= stack.amount) {
          remainingCounts.delete(stack.typeId);
        } else {
          remainingCounts.set(stack.typeId, allowed - stack.amount);
        }
        ent.remove();
      }
    } catch {
      // Ignore in unloaded chunks or mock environments
    }
  };

  // Attempt synchronous marker placement immediately so restarts on the next tick never leave an untracked chest
  if (placeGraveMarker(dim, loc)) {
    record.markerPending = false;
    record.markerPlaced = true;
    syncGraveHologram(record);
    saveGraves();
  }

  // Place marker (if still pending) & clean up matching dropped item entities on next tick
  const notifyAndCleanup = () => {
    const currentRecord = graves.get(id);
    if (currentRecord && !currentRecord.markerPlaced) {
      if (placeGraveMarker(dim, loc) || hasGraveHologram(dim, currentRecord)) {
        currentRecord.markerPending = false;
        currentRecord.markerPlaced = true;
        syncGraveHologram(currentRecord);
        saveGraves();
      }
    }
    if (remainingCounts.size > 0) {
      removeMatchingDroppedItems();
    }
    if (player.isValid) {
      const dimLabel = formatDimensionLabel(dim.id);
      const expiryLabel = expiryMinutes > 0 ? ` §8(Expires in ${expiryMinutes}m)` : '';
      if (currentRecord?.markerPlaced) {
        player.sendMessage(
          `§a[Grave] §fSaved §b${captured.length}§f item stack(s) at §e${loc.x}, ${loc.y}, ${loc.z} §7[${dimLabel}]${expiryLabel}§f. Use §b/grave§f to view or track.`,
        );
      } else {
        player.sendMessage(
          `§e[Grave] §fSaved §b${captured.length}§f item stack(s) at §e${loc.x}, ${loc.y}, ${loc.z} §7[${dimLabel}]${expiryLabel}§f (marker pending chunk load). Use §b/grave§f to collect or track.`,
        );
      }
    }
  };

  mc.system.run(notifyAndCleanup);
}

function captureDroppedItemEntities(
  dim: mc.Dimension,
  origin: mc.Vector3,
  expectedCounts: Map<string, number>,
  preExistingEntityIds?: Set<string>,
): { captured: GraveSlotEntry[]; typeIds: Set<string>; entities: mc.Entity[] } {
  const captured: GraveSlotEntry[] = [];
  const typeIds = new Set<string>();
  const entities: mc.Entity[] = [];
  if (expectedCounts.size === 0) {
    return { captured, typeIds, entities };
  }
  const remaining = new Map(expectedCounts);
  try {
    const dropped = dim.getEntities({
      location: origin,
      maxDistance: 6,
    });
    for (const ent of dropped) {
      if (!ent.isValid || (preExistingEntityIds?.has(ent.id) ?? false)) {
        continue;
      }
      const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
      const stack = itemComp?.itemStack;
      if (!stack) {
        continue;
      }
      const allowed = remaining.get(stack.typeId) ?? 0;
      if (allowed <= 0 || stack.amount > allowed) {
        continue;
      }
      remaining.set(stack.typeId, allowed - stack.amount);
      captured.push({ slotType: 'inventory', item: serializeItem(stack) });
      typeIds.add(stack.typeId);
      entities.push(ent);
    }
  } catch {
    // Ignore unloaded chunk or mock errors
  }
  return { captured, typeIds, entities };
}

/**
 * Captures a dying player's inventory into a protected grave when the graves feature is enabled.
 *
 * @param player The player who died.
 * @param onGraveCreated Optional callback invoked with the created grave ID.
 */
export function handlePlayerDeathGrave(
  player: mc.Player,
  onGraveCreated?: (graveId: string) => void,
  damageCause?: mc.EntityDamageCause,
): void {
  const cfg = getConfig().graves;
  if (!cfg?.enabled || !player.isValid) {
    return;
  }
  if (getGameplayConfig().keepInventory || mc.world.gameRules?.keepInventory) {
    return;
  }

  const owner: OwnerSnapshot = { id: player.id, name: player.name };
  const snapshot = recentHurtSnapshots.get(owner.id);
  recentHurtSnapshots.delete(owner.id);

  let invComp: mc.EntityInventoryComponent | undefined;
  let eqComp: mc.EntityEquippableComponent | undefined;
  try {
    invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    eqComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  } catch {
    return;
  }

  const direct = collectPlayerSlotEntries(invComp, eqComp);
  const dim = player.dimension;
  const deathOrigin = { ...player.location };

  if (direct.slots.length > 0) {
    finalizeGraveCreation(
      owner,
      player,
      dim,
      deathOrigin,
      direct.slots,
      direct.typeIds,
      invComp,
      eqComp,
      [],
      onGraveCreated,
    );
    return;
  }

  if (
    snapshot &&
    damageCause !== (mc.EntityDamageCause?.selfDestruct ?? 'selfDestruct') &&
    Date.now() - snapshot.capturedAt <= hurtSnapshotTtlMs &&
    snapshot.slots.length > 0
  ) {
    // Bedrock entityDie fires after vanilla drops items on the ground. Use the full pre-death snapshot
    // (preserving slot positions, enchantments, and durability even if items burned in lava/fire/void)
    // and remove matching dropped item entities so nothing duplicates.
    const immediateDrops = captureDroppedItemEntities(dim, deathOrigin, snapshot.counts, snapshot.preExistingEntityIds);
    finalizeGraveCreation(
      owner,
      player,
      dim,
      deathOrigin,
      snapshot.slots,
      snapshot.typeIds,
      undefined,
      undefined,
      immediateDrops.entities,
      onGraveCreated,
      snapshot.preExistingEntityIds,
    );
    return;
  }

  // Fallback when no hurt/health snapshot was recorded (e.g. instant /kill or expired/excluded snapshot):
  // capture dropped items around deathOrigin while still excluding pre-existing ground drops.
  const preExistingIds = snapshot?.preExistingEntityIds;
  const fallbackCapture = (
    maxDistance: number,
    excludedEntityIds?: Set<string>,
  ): { captured: GraveSlotEntry[]; typeIds: Set<string>; entities: mc.Entity[] } => {
    const captured: GraveSlotEntry[] = [];
    const typeIds = new Set<string>();
    const entities: mc.Entity[] = [];
    try {
      const dropped = dim.getEntities({ location: deathOrigin, maxDistance });
      for (const ent of dropped) {
        if (!ent.isValid || (excludedEntityIds?.has(ent.id) ?? false)) {
          continue;
        }
        const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
        const stack = itemComp?.itemStack;
        if (!stack || stack.keepOnDeath) {
          continue;
        }
        captured.push({ slotType: 'inventory', item: serializeItem(stack) });
        typeIds.add(stack.typeId);
        entities.push(ent);
      }
    } catch {
      // Ignore unloaded chunk or mock errors
    }
    return { captured, typeIds, entities };
  };

  const immediateFallback = fallbackCapture(6, preExistingIds);
  if (immediateFallback.captured.length > 0) {
    finalizeGraveCreation(
      owner,
      player,
      dim,
      deathOrigin,
      immediateFallback.captured,
      immediateFallback.typeIds,
      undefined,
      undefined,
      immediateFallback.entities,
      onGraveCreated,
      preExistingIds,
    );
    return;
  }

  mc.system.run(() => {
    const nextTickFallback = fallbackCapture(6, preExistingIds);
    if (nextTickFallback.captured.length > 0) {
      finalizeGraveCreation(
        owner,
        player,
        dim,
        deathOrigin,
        nextTickFallback.captured,
        nextTickFallback.typeIds,
        undefined,
        undefined,
        nextTickFallback.entities,
        onGraveCreated,
        preExistingIds,
      );
    }
  });
}

/**
 * Checks whether a block coordinate holds an active grave.
 *
 * @param dimensionId Dimension identifier.
 * @param location Block coordinate.
 * @returns Grave record if present, otherwise undefined.
 */
export function getGraveAt(dimensionId: string, location: mc.Vector3): GraveRecord | undefined {
  const id = gravesByCoord.get(coordKey(dimensionId, location.x, location.y, location.z));
  const grave = id ? graves.get(id) : undefined;
  return grave && !grave.abandoned ? grave : undefined;
}

/**
 * Checks if a player can access a grave (owner, admin, or public-unlock elapsed).
 *
 * @param grave Grave record.
 * @param player Player attempting access.
 * @returns True if authorized to collect from the grave.
 */
export function canAccessGrave(grave: GraveRecord, player: mc.Player): boolean {
  if (grave.ownerId === player.id || hasPermission(player, 'group.admin')) {
    return true;
  }
  const publicMins = Number(getConfig().graves?.publicUnlockMinutes ?? 0);
  if (publicMins > 0 && Date.now() - grave.createdAt >= publicMins * 60_000) {
    return true;
  }
  return false;
}

function tryUnlockGrave(grave: GraveRecord, player: mc.Player): boolean {
  if (grave.unlocked || hasPermission(player, 'group.admin')) {
    grave.unlocked = true;
    return true;
  }
  const cfg = getConfig().graves;
  const cost = Math.max(0, Number(cfg?.unlockCost ?? 0));
  if (cost <= 0) {
    grave.unlocked = true;
    return true;
  }

  if (cfg?.unlockCostType === 'xp') {
    if (player.level < cost) {
      player.sendMessage(`§cYou need §e${cost} XP levels§c to unlock this grave.`);
      return false;
    }
    player.addLevels(-cost);
    grave.unlocked = true;
    saveGraves();
    player.sendMessage(`§aUnlocked grave for §e${cost} XP levels§a.`);
    return true;
  }

  if (isFeatureActive('eco')) {
    if (getOrCreatePlayer(player).balance < cost) {
      player.sendMessage(`§cYou need §e${formatCurrency(cost)}§c to unlock this grave.`);
      return false;
    }
    incrementPlayerBalance(player.id, -cost);
    grave.unlocked = true;
    saveGraves();
    player.sendMessage(`§aUnlocked grave for §e${formatCurrency(cost)}§a.`);
    return true;
  }

  grave.unlocked = true;
  return true;
}

/**
 * Collects all items from a grave into the player's inventory (auto-equipping armor if configured). Deletes the grave
 * automatically once empty.
 *
 * @param grave Grave record to collect from.
 * @param player Collecting player.
 */
export function collectGrave(grave: GraveRecord, player: mc.Player): void {
  if (grave.abandoned) {
    player.sendMessage('§cThis grave is no longer available.');
    return;
  }
  if (grave.expiresAt > 0 && Date.now() >= grave.expiresAt) {
    deleteGrave(grave.id);
    player.sendMessage('§cThis grave has expired.');
    return;
  }
  if (!canAccessGrave(grave, player)) {
    player.sendMessage(`§cThis grave belongs to §e${grave.ownerName}§c.`);
    return;
  }
  if (!tryUnlockGrave(grave, player)) {
    return;
  }

  let invComp: mc.EntityInventoryComponent | undefined;
  let eqComp: mc.EntityEquippableComponent | undefined;
  try {
    invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    eqComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  } catch {
    return;
  }
  const container = invComp?.container;
  if (!container) {
    return;
  }

  const autoEquip = getConfig().graves?.autoEquipOnCollect !== false;
  const remaining: GraveSlotEntry[] = [];

  for (const entry of grave.items) {
    const stack = deserializeItem(entry.item);
    if (!isDefined(stack)) {
      errorLog(`[Graves] Skipping un-deserializable item '${entry.item.typeId}' in grave ${grave.id}.`);
      continue;
    }

    let placed = false;
    if (autoEquip && entry.slotType === 'equipment' && entry.equipmentSlot && eqComp) {
      const slot = entry.equipmentSlot as EquipmentSlot;
      if (!isDefined(eqComp.getEquipment(slot))) {
        eqComp.setEquipment(slot, stack);
        placed = true;
      }
    }

    if (!placed && entry.slotType === 'inventory' && isDefined(entry.slotIndex)) {
      if (entry.slotIndex >= 0 && entry.slotIndex < container.size && !isDefined(container.getItem(entry.slotIndex))) {
        container.setItem(entry.slotIndex, stack);
        placed = true;
      }
    }

    if (!placed) {
      const leftover = container.addItem(stack);
      if (!isDefined(leftover)) {
        placed = true;
      } else {
        entry.item = serializeItem(leftover);
      }
    }

    if (!placed) {
      remaining.push(entry);
    }
  }

  grave.items = remaining;
  playSound(player, 'random.pop');

  if (grave.items.length === 0) {
    deleteGrave(grave.id);
    player.sendMessage('§aCollected all items! The grave has disappeared.');
  } else {
    saveGraves();
    syncGraveHologram(grave);
    player.sendMessage(`§eInventory full! §f${grave.items.length} item(s) remain in the grave.`);
  }
}

/**
 * Handles block interaction with a grave chest (protected from vanilla chest UI).
 *
 * @param event Block interaction before event.
 * @returns True if the interaction was intercepted by a grave.
 */
export function handleGraveInteract(event: mc.PlayerInteractWithBlockBeforeEvent): boolean {
  const { player, block } = event;
  const dimId = block.dimension?.id ?? player.dimension.id;
  const blockLoc = { ...block.location };
  const grave = getGraveAt(dimId, blockLoc);
  if (!grave) {
    return false;
  }
  event.cancel = true;
  mc.system.run(() => {
    if (!player.isValid) {
      return;
    }
    const current = getGraveAt(dimId, blockLoc);
    if (!current) {
      return;
    }
    collectGrave(current, player);
  });
  return true;
}

/**
 * Returns all active graves belonging to a player.
 *
 * @param playerId Owner player ID.
 * @returns List of active graves sorted newest first.
 */
export function getPlayerGraves(playerId: string): GraveRecord[] {
  const list: GraveRecord[] = [];
  for (const grave of graves.values()) {
    if (grave.ownerId === playerId && !grave.abandoned) {
      list.push(grave);
    }
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

/** Unified teleport policy shared between `/back` and Grave TP to prevent cost/cooldown bypasses. */
export interface UnifiedDeathTeleportPolicy {
  cost: number;
  cooldownSeconds: number;
  warmupSeconds: number;
  allowGraveTeleport: boolean;
}

/**
 * Resolves the unified death/grave teleport cost, warmup, and cooldown policy.
 *
 * @returns Policy using the higher of `graves.teleportCost` and `back.cost` (when `/back` is enabled).
 */
export function getUnifiedDeathTeleportPolicy(): UnifiedDeathTeleportPolicy {
  const cfg = getConfig();
  const graveCfg = cfg.graves;
  const backCfg = cfg.back as
    { enabled?: boolean; cost?: number; cooldownSeconds?: number; teleportWarmupSeconds?: number } | undefined;
  const graveCost = Math.max(0, Number(graveCfg?.teleportCost ?? 0));
  const backCost = backCfg?.enabled ? Math.max(0, Number(backCfg.cost ?? 0)) : 0;
  return {
    cost: Math.max(graveCost, backCost),
    cooldownSeconds: Math.max(0, Number(backCfg?.cooldownSeconds ?? 0)),
    warmupSeconds: Math.max(0, Number(backCfg?.teleportWarmupSeconds ?? 0)),
    allowGraveTeleport: Boolean(graveCfg?.allowTeleport),
  };
}

function getEffectiveGraveTeleportCost(player: mc.Player, policy: UnifiedDeathTeleportPolicy): number {
  return !hasPermission(player, 'group.admin') && isFeatureActive('eco') && policy.cost > 0 ? policy.cost : 0;
}

const hazardousFloorTypes = new Set<string>([
  MinecraftBlockTypes.Fire,
  MinecraftBlockTypes.SoulFire,
  MinecraftBlockTypes.Magma,
  MinecraftBlockTypes.Cactus,
  MinecraftBlockTypes.Campfire,
  MinecraftBlockTypes.SoulCampfire,
  MinecraftBlockTypes.SweetBerryBush,
  MinecraftBlockTypes.PowderSnow,
]);

function findSafeGraveTeleportLocation(dim: mc.Dimension, grave: GraveRecord): mc.Vector3 {
  const { minY, maxY } = getDimensionBounds(dim.id);
  const isClearStandSpot = (x: number, y: number, z: number, requireSolidFloor: boolean): boolean => {
    if (y + 1 > maxY || (requireSolidFloor && y - 1 < minY)) {
      return false;
    }
    try {
      const feet = dim.getBlock({ x, y, z });
      const head = dim.getBlock({ x, y: y + 1, z });
      if (!feet || !head) {
        return !requireSolidFloor; // Unloaded chunk: only allow chest-top fallback, skip unverified horizontal spots
      }
      if (!feet.isAir || !head.isAir) {
        return false;
      }
      if (requireSolidFloor) {
        const floor = dim.getBlock({ x, y: y - 1, z });
        if (!floor) {
          return false;
        }
        if (floor.isAir || floor.isLiquid || hazardousFloorTypes.has(floor.typeId)) {
          return false;
        }
      }
      return true;
    } catch {
      return !requireSolidFloor;
    }
  };

  if (isClearStandSpot(grave.x, grave.y + 1, grave.z, false)) {
    return { x: grave.x + 0.5, y: grave.y + 1, z: grave.z + 0.5 };
  }
  const offsets = [
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
  ];
  for (const off of offsets) {
    if (isClearStandSpot(grave.x + off.x, grave.y, grave.z + off.z, true)) {
      return { x: grave.x + off.x + 0.5, y: grave.y, z: grave.z + off.z + 0.5 };
    }
  }
  return { x: grave.x + 0.5, y: Math.min(maxY, grave.y + 1), z: grave.z + 0.5 };
}

/**
 * Restores a grave marker chest if a piston displaced it.
 *
 * @param dimensionId Dimension identifier.
 * @param grave Grave record to restore.
 * @returns True if the grave marker was missing and restored into an air block.
 */
export function restoreDisplacedGraveMarker(dimensionId: string, grave: GraveRecord): boolean {
  if (grave.abandoned || !grave.markerPlaced) {
    return false;
  }
  try {
    const dim = mc.world.getDimension(dimensionId);
    const blk = dim.getBlock({ x: grave.x, y: grave.y, z: grave.z });
    if (blk && blk.isAir) {
      blk.setType(MinecraftBlockTypes.Chest);
      grave.markerPending = false;
      grave.markerPlaced = true;
      syncGraveHologram(grave);
      saveGraves();
      return true;
    }
  } catch {
    // Ignore unloaded chunk or mock errors
  }
  return false;
}

/**
 * Teleports a player to an active grave using the unified `/back` + Grave TP cost, cooldown, warmup, and world-border
 * checks.
 *
 * @param player Target player.
 * @param graveId Identifier of the grave to teleport to.
 */
export function teleportPlayerToGrave(player: mc.Player, graveId: string): void {
  if (!player.isValid) {
    return;
  }
  const currentGrave = graves.get(graveId);
  if (!currentGrave || currentGrave.abandoned || (currentGrave.expiresAt > 0 && Date.now() >= currentGrave.expiresAt)) {
    player.sendMessage('§cThis grave is no longer available.');
    return;
  }

  const policy = getUnifiedDeathTeleportPolicy();
  const isAdmin = hasPermission(player, 'group.admin');
  if (!policy.allowGraveTeleport && !isAdmin) {
    player.sendMessage('§cTeleporting to graves is disabled.');
    return;
  }

  const remainingCd = cooldownManager.getCooldown(player.id, 'back');
  if (remainingCd > 0 && !isAdmin) {
    player.sendMessage(`§cYou must wait ${formatCooldown(remainingCd)} before teleporting to a grave or using /back.`);
    return;
  }

  const dest = { x: currentGrave.x + 0.5, y: currentGrave.y + 1, z: currentGrave.z + 0.5 };
  if (!isWithinWorldBorder(dest, currentGrave.dimensionId) && !canBypassWorldBorder(player)) {
    player.sendMessage('§cThis grave is outside the active world border.');
    return;
  }

  const tpCost = getEffectiveGraveTeleportCost(player, policy);
  if (tpCost > 0 && getOrCreatePlayer(player).balance < tpCost) {
    player.sendMessage(`§cYou need §e${formatCurrency(tpCost)}§c to teleport to your grave.`);
    return;
  }

  const executeTeleport = (): boolean => {
    if (!player.isValid) {
      return false;
    }
    const freshPolicy = getUnifiedDeathTeleportPolicy();
    const freshIsAdmin = hasPermission(player, 'group.admin');
    if (!freshPolicy.allowGraveTeleport && !freshIsAdmin) {
      player.sendMessage('§cTeleporting to graves is disabled.');
      return false;
    }
    const freshGrave = graves.get(graveId);
    if (!freshGrave || freshGrave.abandoned || (freshGrave.expiresAt > 0 && Date.now() >= freshGrave.expiresAt)) {
      player.sendMessage('§cThis grave is no longer available.');
      return false;
    }
    let dim: mc.Dimension;
    try {
      dim = mc.world.getDimension(freshGrave.dimensionId);
    } catch {
      player.sendMessage('§cCould not teleport to grave dimension.');
      return false;
    }
    const freshDest = findSafeGraveTeleportLocation(dim, freshGrave);
    if (!isWithinWorldBorder(freshDest, freshGrave.dimensionId) && !canBypassWorldBorder(player)) {
      player.sendMessage('§cThis grave is outside the active world border.');
      return false;
    }
    const freshTpCost = getEffectiveGraveTeleportCost(player, freshPolicy);
    let charged = false;
    if (freshTpCost > 0) {
      if (getOrCreatePlayer(player).balance < freshTpCost) {
        player.sendMessage(`§cTeleport cancelled. You need §e${formatCurrency(freshTpCost)}§c.`);
        return false;
      }
      incrementPlayerBalance(player.id, -freshTpCost);
      charged = true;
    }
    try {
      const departureLocation = {
        x: player.location.x,
        y: player.location.y,
        z: player.location.z,
        dimensionId: player.dimension.id,
      };
      teleportPlayerWithTransition(player, freshDest, { dimension: dim });
      saveLastLocation(player, 'teleport', departureLocation);
      if (freshGrave.markerPending && !freshGrave.markerPlaced) {
        mc.system.run(() => {
          const activeGrave = graves.get(freshGrave.id);
          if (
            activeGrave?.markerPending &&
            !activeGrave.markerPlaced &&
            (placeGraveMarker(dim, { x: activeGrave.x, y: activeGrave.y, z: activeGrave.z }) ||
              hasGraveHologram(dim, activeGrave))
          ) {
            activeGrave.markerPending = false;
            activeGrave.markerPlaced = true;
            syncGraveHologram(activeGrave);
            saveGraves();
          }
        });
      }
      playSound(player, 'mob.endermen.portal');
      if (freshPolicy.cooldownSeconds > 0 && !freshIsAdmin) {
        cooldownManager.setCooldown(player.id, 'back', freshPolicy.cooldownSeconds);
      }
      return true;
    } catch {
      if (charged) {
        incrementPlayerBalance(player.id, freshTpCost);
      }
      player.sendMessage('§cCould not teleport to grave dimension.');
      return false;
    }
  };

  teleportLogicModule.startTeleportWarmup(player, policy.warmupSeconds, executeTeleport, 'grave');
}

/**
 * Opens the `/grave` UI listing the player's active graves.
 *
 * @param player Target player.
 */
export async function showPlayerGravesPanel(player: mc.Player): Promise<void> {
  const list = getPlayerGraves(player.id);
  const form = new ActionFormBuilder().title('Your Active Graves');
  if (list.length === 0) {
    form.body('§7You have no active graves.');
  } else {
    const now = Date.now();
    const lines = list.map((g, idx) => {
      const rem = g.expiresAt > 0 ? `${Math.max(0, Math.ceil((g.expiresAt - now) / 60_000))}m left` : 'No expiry';
      return `§e#${idx + 1} §f(${g.x}, ${g.y}, ${g.z}) §7[${formatDimensionLabel(g.dimensionId)}] - §b${g.items.length} items §8(${rem})`;
    });
    form.body(lines.join('\n'));
    list.forEach((g, idx) => {
      form.button(`§eGrave #${idx + 1} §7(${g.x}, ${g.y}, ${g.z})`, 'textures/blocks/chest_front', async () => {
        if (!player.isValid) {
          return;
        }
        const preview = g.items
          .slice(0, 10)
          .map((e) => {
            const ench = e.item.enchantments?.length ? ' §d✦' : '';
            return `§7- §f${e.item.typeId.replace('minecraft:', '')} §8x${e.item.amount}${ench}`;
          })
          .join('\n');
        const more = g.items.length > 10 ? `\n§8...and ${g.items.length - 10} more` : '';
        const rem =
          g.expiresAt > 0 ? `${Math.max(0, Math.ceil((g.expiresAt - Date.now()) / 60_000))}m left` : 'No expiry';
        const detail = new ActionFormBuilder()
          .title(`Grave #${idx + 1}`)
          .body(
            `§7Location: §f${g.x}, ${g.y}, ${g.z} §8[${formatDimensionLabel(g.dimensionId)}]\n§7Status: ${g.unlocked ? '§aUnlocked' : '§cLocked'} §8• §7${rem}\n\n§eItems (${g.items.length}):\n${preview}${more}`,
          );
        const canCollectFromUi =
          player.dimension.id === g.dimensionId &&
          Math.hypot(player.location.x - g.x, player.location.y - g.y, player.location.z - g.z) <= 8;
        if (canCollectFromUi) {
          detail.button('§l§aCollect Grave Items', 'textures/blocks/chest_front', () => {
            if (!player.isValid) {
              return;
            }
            const current = graves.get(g.id);
            if (!current || current.abandoned) {
              player.sendMessage('§cThis grave is no longer available.');
              return;
            }
            const stillEligible =
              player.dimension.id === current.dimensionId &&
              Math.hypot(player.location.x - current.x, player.location.y - current.y, player.location.z - current.z) <=
                8;
            if (!stillEligible) {
              player.sendMessage('§cYou must be within 8 blocks of the grave to collect it.');
              return;
            }
            if (current.markerPending && !current.markerPlaced) {
              try {
                const dim = mc.world.getDimension(current.dimensionId);
                if (placeGraveMarker(dim, { x: current.x, y: current.y, z: current.z })) {
                  current.markerPending = false;
                  current.markerPlaced = true;
                  saveGraves();
                }
              } catch {
                // Allow direct UI collection even if chunk/dimension marker placement fails
              }
            }
            collectGrave(current, player);
          });
        }
        const renderedPolicy = getUnifiedDeathTeleportPolicy();
        if (renderedPolicy.allowGraveTeleport || hasPermission(player, 'group.admin')) {
          const quotedCost = getEffectiveGraveTeleportCost(player, renderedPolicy);
          const costTag = quotedCost > 0 ? ` (${formatCurrency(quotedCost)})` : '';
          detail.button(`§l§bTeleport to Grave${costTag}`, 'textures/items/ender_pearl', async () => {
            if (!player.isValid) {
              return;
            }
            const currentPolicy = getUnifiedDeathTeleportPolicy();
            const currentCost = getEffectiveGraveTeleportCost(player, currentPolicy);
            if (currentCost !== quotedCost) {
              player.sendMessage('§eGrave teleport price changed. Refreshing quote...');
              await showPlayerGravesPanel(player);
              return;
            }
            teleportPlayerToGrave(player, g.id);
          });
        }
        detail.button('§cAbandon Grave', 'textures/ui/trash_default', () => {
          if (!player.isValid) {
            return;
          }
          const target = graves.get(g.id);
          if (!target || target.abandoned) {
            player.sendMessage('§cThis grave is no longer available.');
            return;
          }
          if (deleteGrave(g.id)) {
            player.sendMessage('§eGrave abandoned and removed.');
          } else {
            player.sendMessage('§eGrave abandoned. Marker chest will be removed when its chunk loads.');
          }
        });
        detail.addBackButton(async () => {
          if (!player.isValid) {
            return;
          }
          await showPlayerGravesPanel(player);
        });
        await detail.show(player);
      });
    });
  }
  await form.show(player);
}

function pruneStaleGraveHolograms(): void {
  const dims = [MinecraftDimensionTypes.Overworld, MinecraftDimensionTypes.Nether, MinecraftDimensionTypes.TheEnd];
  for (const dimId of dims) {
    try {
      const dim = mc.world.getDimension(dimId);
      const entities = dim.getEntities({ type: floatingTextId });
      for (const ent of entities) {
        if (!ent.isValid) {
          continue;
        }
        const labelTag = ent.getTags().find((t) => t.startsWith(graveLabelPrefix));
        if (!labelTag) {
          continue;
        }
        const graveId = labelTag.slice(graveLabelPrefix.length);
        const grave = graves.get(graveId);
        if (!grave || grave.abandoned) {
          ent.remove();
        }
      }
    } catch {
      // Ignore unloaded dimensions or mock environments
    }
  }
}

/** Purges expired/abandoned graves, retries pending markers, and refreshes loaded holograms (bounded per sweep). */
export function pruneExpiredGraves(): void {
  const now = Date.now();
  pruneExpiredHurtSnapshots(now);
  let changed = false;
  let removed = 0;
  for (const [id, grave] of graves) {
    if (removed >= 20) {
      break;
    }
    if (grave.abandoned || (grave.expiresAt > 0 && now >= grave.expiresAt)) {
      if (removeGraveMarker(grave)) {
        graves.delete(id);
        gravesByCoord.delete(coordKey(grave.dimensionId, grave.x, grave.y, grave.z));
        changed = true;
        removed++;
      }
    }
  }

  const pendingMarkers = [...graves.values()].filter((g) => !g.abandoned && g.markerPending && !g.markerPlaced);
  if (pendingMarkers.length > 0) {
    const maxPendingRetriesPerSweep = 10;
    const batchSize = Math.min(maxPendingRetriesPerSweep, pendingMarkers.length);
    const startIdx = pendingRetryCursor % pendingMarkers.length;
    for (let offset = 0; offset < batchSize; offset++) {
      const grave = pendingMarkers[(startIdx + offset) % pendingMarkers.length]!;
      try {
        const dim = mc.world.getDimension(grave.dimensionId);
        const loc = { x: grave.x, y: grave.y, z: grave.z };
        const existingChestWithHologram =
          hasGraveHologram(dim, grave) &&
          (() => {
            const blk = dim.getBlock(loc);
            return blk?.typeId === MinecraftBlockTypes.Chest || blk?.typeId === MinecraftBlockTypes.TrappedChest;
          })();
        if (placeGraveMarker(dim, loc) || existingChestWithHologram) {
          grave.markerPending = false;
          grave.markerPlaced = true;
          syncGraveHologram(grave);
          changed = true;
        }
      } catch {
        // Chunk still unloaded; keep pending
      }
    }
    pendingRetryCursor = (startIdx + batchSize) % pendingMarkers.length;
  } else {
    pendingRetryCursor = 0;
  }

  const placedGraves = [...graves.values()].filter((g) => !g.abandoned && g.markerPlaced);
  if (placedGraves.length > 0) {
    const maxHologramRefreshesPerSweep = 20;
    const batchSize = Math.min(maxHologramRefreshesPerSweep, placedGraves.length);
    const startIdx = hologramRefreshCursor % placedGraves.length;
    for (let offset = 0; offset < batchSize; offset++) {
      syncGraveHologram(placedGraves[(startIdx + offset) % placedGraves.length]!);
    }
    hologramRefreshCursor = (startIdx + batchSize) % placedGraves.length;
  } else {
    hologramRefreshCursor = 0;
  }

  pruneStaleGraveHolograms();

  if (changed) {
    saveGraves();
  }
}

/** Initializes grave persistence and expiry cleanup loop. */
export function initializeGraves(): void {
  loadGraves();
  if (expiryIntervalId !== undefined) {
    clearTrackedInterval(expiryIntervalId);
  }
  expiryIntervalId = setTrackedInterval(pruneExpiredGraves, 600);
}

/**
 * Sends a helpful reminder to a respawning player if they have active graves.
 *
 * @param player Respawning player.
 */
export function notifyPlayerRespawnGrave(player: mc.Player): void {
  if (!getConfig().graves?.enabled || !player.isValid) {
    return;
  }
  const now = Date.now();
  const active = getPlayerGraves(player.id).filter((g) => g.expiresAt <= 0 || g.expiresAt > now);
  if (active.length === 0) {
    return;
  }
  const newest = active[0]!;
  player.sendMessage(
    `§e[Grave] §fYou have §b${active.length}§f active grave(s). Latest: §e${newest.x}, ${newest.y}, ${newest.z} §7[${formatDimensionLabel(newest.dimensionId)}]§f. Use §b/grave§f to view or collect.`,
  );
}

/** Clears in-memory graves (for tests). */
export function _clearGravesForTest(): void {
  graves.clear();
  gravesByCoord.clear();
  recentHurtSnapshots.clear();
}
