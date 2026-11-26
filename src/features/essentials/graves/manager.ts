import { getConfig } from '@core/config/configManager.js';
import { getGameplayConfig } from '@core/config/configurations.js';
import { deserializeItem, type SerializedItem, serializeItem } from '@core/data/itemSerializer.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
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
}

const storage = new StorageManager('exe:graves:v1');
let graves = new Map<string, GraveRecord>();
let gravesByCoord = new Map<string, string>();
let expiryIntervalId: number | undefined;

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

/**
 * Captures a dying player's inventory into a protected grave when the graves feature is enabled.
 *
 * @param player The player who died.
 */
export function handlePlayerDeathGrave(player: mc.Player): void {
  const cfg = getConfig().graves;
  if (!cfg?.enabled || !player.isValid) {
    return;
  }
  if (getGameplayConfig().keepInventory) {
    return;
  }

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

  if (captured.length === 0) {
    return;
  }

  const dim = player.dimension;
  const loc = findSafeGraveLocation(dim, player.location);
  if (!loc) {
    return;
  }

  const now = Date.now();
  const expiryMinutes = Math.max(0, Number(cfg.expiryMinutes ?? 60));
  const expiresAt = expiryMinutes > 0 ? now + expiryMinutes * 60_000 : 0;
  const id = `grave_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const record: GraveRecord = {
    id,
    ownerId: player.id,
    ownerName: player.name,
    dimensionId: dim.id,
    x: loc.x,
    y: loc.y,
    z: loc.z,
    createdAt: now,
    expiresAt,
    items: captured,
    unlocked: (Number(cfg.unlockCost) || 0) <= 0,
  };

  graves.set(id, record);
  gravesByCoord.set(coordKey(dim.id, loc.x, loc.y, loc.z), id);
  if (!saveGraves()) {
    graves.delete(id);
    gravesByCoord.delete(coordKey(dim.id, loc.x, loc.y, loc.z));
    return;
  }

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

  // Place marker & clean up matching dropped item entities on next tick
  const deathOrigin = { ...player.location };
  mc.system.run(() => {
    const markerPlaced = placeGraveMarker(dim, loc);
    if (!markerPlaced) {
      return;
    }
    try {
      const droppedItems = dim.getEntities({
        location: deathOrigin,
        maxDistance: 4,
      });
      for (const ent of droppedItems) {
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
    if (player.isValid) {
      player.sendMessage(
        `§a[Grave] §fYour items were saved in a protected grave at §e${loc.x}, ${loc.y}, ${loc.z}§f. Use §b/grave§f to track it.`,
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

/**
 * Opens the `/grave` UI listing the player's active graves.
 *
 * @param player Target player.
 */
export async function showPlayerGravesPanel(player: mc.Player): Promise<void> {
  const list = getPlayerGraves(player.id);
  const cfg = getConfig().graves;
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
        if (cfg?.allowTeleport) {
          const tpCost = Math.max(0, Number(cfg.teleportCost ?? 0));
          const costTag = tpCost > 0 && isFeatureActive('eco') ? ` (${formatCurrency(tpCost)})` : '';
          detail.button(`§l§bTeleport to Grave${costTag}`, 'textures/items/ender_pearl', async () => {
            if (!player.isValid) {
              return;
            }
            const currentGrave = graves.get(g.id);
            if (!currentGrave || (currentGrave.expiresAt > 0 && Date.now() >= currentGrave.expiresAt)) {
              player.sendMessage('§cThis grave is no longer available.');
              return;
            }
            let charged = false;
            if (tpCost > 0 && isFeatureActive('eco') && !hasPermission(player, 'group.admin')) {
              if (getOrCreatePlayer(player).balance < tpCost) {
                player.sendMessage(`§cYou need §e${formatCurrency(tpCost)}§c to teleport to your grave.`);
                return;
              }
              incrementPlayerBalance(player.id, -tpCost);
              charged = true;
            }
            try {
              const dim = mc.world.getDimension(currentGrave.dimensionId);
              player.teleport(
                { x: currentGrave.x + 0.5, y: currentGrave.y + 1, z: currentGrave.z + 0.5 },
                { dimension: dim },
              );
              playSound(player, 'mob.endermen.portal');
            } catch {
              if (charged) {
                incrementPlayerBalance(player.id, tpCost);
              }
              player.sendMessage('§cCould not teleport to grave dimension.');
            }
          });
        }
        detail.addBackButton(async () => {
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
}
