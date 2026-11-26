import { getConfig } from '@core/config/configManager.js';
import { getGameplayConfig } from '@core/config/configurations.js';
import * as cooldownManager from '@core/data/cooldownManager.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
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
}

const storage = new StorageManager('exe:graves:v1');
let graves = new Map<string, GraveRecord>();
let gravesByCoord = new Map<string, string>();
let expiryIntervalId: number | undefined;
let pendingRetryCursor = 0;
const recentHurtSnapshots = new Map<
  string,
  { capturedAt: number; counts: Map<string, number>; preExistingEntityIds: Set<string> }
>();
const hurtSnapshotTtlMs = 5000;

function pruneExpiredHurtSnapshots(now = Date.now()): void {
  for (const [id, entry] of recentHurtSnapshots) {
    if (now - entry.capturedAt > hurtSnapshotTtlMs) {
      recentHurtSnapshots.delete(id);
    }
  }
}

/**
 * Snapshots a player's non-keepOnDeath inventory and equipment counts when taking damage so post-death dropped-entity
 * grave capture only attributes items the dying player actually owned.
 *
 * @param player The damaged player.
 */
export function snapshotPlayerInventoryForGrave(player: mc.Player): void {
  if (!getConfig().graves?.enabled || !player.isValid || getGameplayConfig().keepInventory) {
    return;
  }
  const counts = new Map<string, number>();
  try {
    const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    if (invComp?.container) {
      for (let i = 0; i < invComp.container.size; i++) {
        const item = invComp.container.getItem(i);
        if (isDefined(item) && !item.keepOnDeath) {
          counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + item.amount);
        }
      }
    }
    const eqComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
    if (eqComp) {
      const slots = [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet,
        EquipmentSlot.Offhand,
      ];
      for (const slot of slots) {
        const item = eqComp.getEquipment(slot);
        if (isDefined(item) && !item.keepOnDeath) {
          counts.set(item.typeId, (counts.get(item.typeId) ?? 0) + item.amount);
        }
      }
    }
  } catch {
    return;
  }

  if (recentHurtSnapshots.size > 16) {
    pruneExpiredHurtSnapshots();
  }
  if (counts.size > 0) {
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
    recentHurtSnapshots.set(player.id, { capturedAt: Date.now(), counts, preExistingEntityIds });
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

/** Loads persisted grave records from world dynamic properties. */
export function loadGraves(): void {
  try {
    const parsed = storage.load<[string, GraveRecord][]>();
    graves = parsed ? new Map(parsed) : new Map();
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

function findSafeGraveLocation(
  dimension: mc.Dimension,
  origin: mc.Vector3,
): { x: number; y: number; z: number } | undefined {
  const minY = dimension.id === MinecraftDimensionTypes.Overworld ? -63 : 1;
  const maxY = 319;
  const bx = Math.floor(origin.x);
  const by = Math.max(minY, Math.min(maxY, Math.floor(origin.y)));
  const bz = Math.floor(origin.z);

  const candidates = [
    { x: bx, y: by, z: bz },
    { x: bx, y: by + 1, z: bz },
    { x: bx, y: by + 2, z: bz },
    { x: bx + 1, y: by, z: bz },
    { x: bx - 1, y: by, z: bz },
    { x: bx, y: by, z: bz + 1 },
    { x: bx, y: by, z: bz - 1 },
  ];

  for (const c of candidates) {
    if (c.y < minY || c.y > maxY) {
      continue;
    }
    if (gravesByCoord.has(coordKey(dimension.id, c.x, c.y, c.z))) {
      continue;
    }
    try {
      const blk = dimension.getBlock(c);
      if (blk && (blk.isAir || blk.isLiquid || blk.typeId === MinecraftBlockTypes.Fire)) {
        return c;
      }
    } catch {
      return c;
    }
  }
  return undefined;
}

function placeGraveMarker(dimension: mc.Dimension, loc: { x: number; y: number; z: number }): boolean {
  try {
    const blk = dimension.getBlock(loc);
    if (blk && (blk.isAir || blk.isLiquid || blk.typeId === MinecraftBlockTypes.Fire)) {
      blk.setType(MinecraftBlockTypes.Chest);
      return true;
    }
  } catch {
    // Ignore unloaded chunk or mock errors
  }
  return false;
}

function removeGraveMarker(grave: GraveRecord): boolean {
  if (!grave.markerPlaced) {
    return true;
  }
  try {
    const dim = mc.world.getDimension(grave.dimensionId);
    const blk = dim.getBlock({ x: grave.x, y: grave.y, z: grave.z });
    if (!blk) {
      return false;
    }
    if (blk.typeId === MinecraftBlockTypes.Chest) {
      blk.setType(MinecraftBlockTypes.Air);
    }
    return true;
  } catch {
    return false;
  }
}

function deleteGrave(graveId: string): void {
  const grave = graves.get(graveId);
  if (!grave) {
    return;
  }
  removeGraveMarker(grave);
  graves.delete(graveId);
  gravesByCoord.delete(coordKey(grave.dimensionId, grave.x, grave.y, grave.z));
  saveGraves();
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
): void {
  if (captured.length === 0) {
    return;
  }

  const cfg = getConfig().graves;
  const loc = findSafeGraveLocation(dim, deathOrigin);
  if (!loc) {
    return;
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
  for (const ent of droppedEntities) {
    try {
      if (ent.isValid) {
        ent.remove();
      }
    } catch {
      // Ignore already-removed item entities
    }
  }

  // Place marker & clean up matching dropped item entities on next tick (inventory-capture path only)
  const notifyAndCleanup = () => {
    const currentRecord = graves.get(id);
    if (currentRecord && !currentRecord.markerPlaced && placeGraveMarker(dim, loc)) {
      currentRecord.markerPending = false;
      currentRecord.markerPlaced = true;
      saveGraves();
    }
    if (droppedEntities.length === 0) {
      try {
        const nearbyItems = dim.getEntities({
          location: deathOrigin,
          maxDistance: 6,
        });
        for (const ent of nearbyItems) {
          if (!ent.isValid) {
            continue;
          }
          const itemComp = ent.getComponent(EntityComponentTypes.Item) as mc.EntityItemComponent | undefined;
          if (itemComp?.itemStack && capturedTypeIds.has(itemComp.itemStack.typeId)) {
            ent.remove();
          }
        }
      } catch {
        // Ignore in unloaded chunks or mock environments
      }
    }
    if (player.isValid) {
      if (currentRecord?.markerPlaced) {
        player.sendMessage(
          `§a[Grave] §fYour items were saved in a protected grave at §e${loc.x}, ${loc.y}, ${loc.z}§f. Use §b/grave§f to track it.`,
        );
      } else {
        player.sendMessage(
          `§e[Grave] §fYour items were saved at §e${loc.x}, ${loc.y}, ${loc.z}§f, but the grave marker could not be placed yet. Use §b/grave§f to collect or retry once the chunk is loaded.`,
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
export function handlePlayerDeathGrave(player: mc.Player, onGraveCreated?: (graveId: string) => void): void {
  const cfg = getConfig().graves;
  if (!cfg?.enabled || !player.isValid) {
    return;
  }
  if (getGameplayConfig().keepInventory) {
    return;
  }

  const owner: OwnerSnapshot = { id: player.id, name: player.name };
  const snapshot = recentHurtSnapshots.get(owner.id);
  recentHurtSnapshots.delete(owner.id);

  const captured: GraveSlotEntry[] = [];
  const capturedTypeIds = new Set<string>();
  let invComp: mc.EntityInventoryComponent | undefined;
  let eqComp: mc.EntityEquippableComponent | undefined;
  try {
    invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
    eqComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  } catch {
    return;
  }

  if (invComp?.container) {
    for (let i = 0; i < invComp.container.size; i++) {
      const item = invComp.container.getItem(i);
      if (isDefined(item) && !item.keepOnDeath) {
        captured.push({ slotType: 'inventory', slotIndex: i, item: serializeItem(item) });
        capturedTypeIds.add(item.typeId);
      }
    }
  }

  if (eqComp) {
    const slots = [
      EquipmentSlot.Head,
      EquipmentSlot.Chest,
      EquipmentSlot.Legs,
      EquipmentSlot.Feet,
      EquipmentSlot.Offhand,
    ];
    for (const slot of slots) {
      const item = eqComp.getEquipment(slot);
      if (isDefined(item) && !item.keepOnDeath) {
        captured.push({ slotType: 'equipment', equipmentSlot: slot, item: serializeItem(item) });
        capturedTypeIds.add(item.typeId);
      }
    }
  }

  const dim = player.dimension;
  const deathOrigin = { ...player.location };

  if (captured.length > 0) {
    finalizeGraveCreation(
      owner,
      player,
      dim,
      deathOrigin,
      captured,
      capturedTypeIds,
      invComp,
      eqComp,
      [],
      onGraveCreated,
    );
    return;
  }

  if (!snapshot || Date.now() - snapshot.capturedAt > hurtSnapshotTtlMs || snapshot.counts.size === 0) {
    return;
  }

  // Bedrock entityDie fires after vanilla drops items on the ground; capture death-attributed item entities.
  const immediateDrops = captureDroppedItemEntities(dim, deathOrigin, snapshot.counts, snapshot.preExistingEntityIds);
  if (immediateDrops.captured.length > 0) {
    finalizeGraveCreation(
      owner,
      player,
      dim,
      deathOrigin,
      immediateDrops.captured,
      immediateDrops.typeIds,
      undefined,
      undefined,
      immediateDrops.entities,
      onGraveCreated,
    );
    return;
  }

  mc.system.run(() => {
    const nextTickDrops = captureDroppedItemEntities(dim, deathOrigin, snapshot.counts, snapshot.preExistingEntityIds);
    if (nextTickDrops.captured.length > 0) {
      finalizeGraveCreation(
        owner,
        player,
        dim,
        deathOrigin,
        nextTickDrops.captured,
        nextTickDrops.typeIds,
        undefined,
        undefined,
        nextTickDrops.entities,
        onGraveCreated,
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
  return id ? graves.get(id) : undefined;
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

  const invComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const eqComp = player.getComponent(EntityComponentTypes.Equippable) as mc.EntityEquippableComponent | undefined;
  const container = invComp?.container;
  if (!container) {
    return;
  }

  const autoEquip = getConfig().graves?.autoEquipOnCollect !== false;
  const remaining: GraveSlotEntry[] = [];

  for (const entry of grave.items) {
    const stack = deserializeItem(entry.item);
    if (!isDefined(stack)) {
      remaining.push(entry);
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
  const dimId = player.dimension.id;
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
    if (grave.ownerId === playerId) {
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
  if (!currentGrave || (currentGrave.expiresAt > 0 && Date.now() >= currentGrave.expiresAt)) {
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
    if (!freshGrave || (freshGrave.expiresAt > 0 && Date.now() >= freshGrave.expiresAt)) {
      player.sendMessage('§cThis grave is no longer available.');
      return false;
    }
    const freshDest = { x: freshGrave.x + 0.5, y: freshGrave.y + 1, z: freshGrave.z + 0.5 };
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
      const dim = mc.world.getDimension(freshGrave.dimensionId);
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
            placeGraveMarker(dim, { x: activeGrave.x, y: activeGrave.y, z: activeGrave.z })
          ) {
            activeGrave.markerPending = false;
            activeGrave.markerPlaced = true;
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
      return `§e#${idx + 1} §f(${g.x}, ${g.y}, ${g.z}) §7[${g.dimensionId.replace('minecraft:', '')}] - §b${g.items.length} items §8(${rem})`;
    });
    form.body(lines.join('\n'));
    list.forEach((g, idx) => {
      form.button(`§eGrave #${idx + 1} §7(${g.x}, ${g.y}, ${g.z})`, 'textures/blocks/chest_front', async () => {
        if (!player.isValid) {
          return;
        }
        const preview = g.items
          .slice(0, 8)
          .map((e) => `§7- §f${e.item.typeId.replace('minecraft:', '')} §8x${e.item.amount}`)
          .join('\n');
        const more = g.items.length > 8 ? `\n§8...and ${g.items.length - 8} more` : '';
        const detail = new ActionFormBuilder()
          .title(`Grave #${idx + 1}`)
          .body(
            `§7Location: §f${g.x}, ${g.y}, ${g.z} §8[${g.dimensionId.replace('minecraft:', '')}]\n\n§eItems:\n${preview}${more}`,
          );
        const canCollectFromUi =
          g.markerPending ||
          (player.dimension.id === g.dimensionId &&
            Math.hypot(player.location.x - g.x, player.location.y - g.y, player.location.z - g.z) <= 8);
        if (canCollectFromUi) {
          detail.button('§l§aCollect Grave Items', 'textures/blocks/chest_front', () => {
            if (!player.isValid) {
              return;
            }
            const current = graves.get(g.id);
            if (!current) {
              player.sendMessage('§cThis grave is no longer available.');
              return;
            }
            const stillEligible =
              Boolean(current.markerPending) ||
              (player.dimension.id === current.dimensionId &&
                Math.hypot(
                  player.location.x - current.x,
                  player.location.y - current.y,
                  player.location.z - current.z,
                ) <= 8);
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

/** Purges expired graves on a periodic interval (bounded per sweep). */
export function pruneExpiredGraves(): void {
  const now = Date.now();
  pruneExpiredHurtSnapshots(now);
  let changed = false;
  let removed = 0;
  for (const [id, grave] of graves) {
    if (removed >= 20) {
      break;
    }
    if (grave.expiresAt > 0 && now >= grave.expiresAt) {
      if (removeGraveMarker(grave)) {
        graves.delete(id);
        gravesByCoord.delete(coordKey(grave.dimensionId, grave.x, grave.y, grave.z));
        changed = true;
        removed++;
      }
    }
  }

  const pendingMarkers = [...graves.values()].filter((g) => g.markerPending && !g.markerPlaced);
  if (pendingMarkers.length > 0) {
    const maxPendingRetriesPerSweep = 10;
    const batchSize = Math.min(maxPendingRetriesPerSweep, pendingMarkers.length);
    const startIdx = pendingRetryCursor % pendingMarkers.length;
    for (let offset = 0; offset < batchSize; offset++) {
      const grave = pendingMarkers[(startIdx + offset) % pendingMarkers.length]!;
      try {
        const dim = mc.world.getDimension(grave.dimensionId);
        if (placeGraveMarker(dim, { x: grave.x, y: grave.y, z: grave.z })) {
          grave.markerPending = false;
          grave.markerPlaced = true;
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

/** Clears in-memory graves (for tests). */
export function _clearGravesForTest(): void {
  graves.clear();
  gravesByCoord.clear();
  recentHurtSnapshots.clear();
}
