import { getConfig } from '@core/config/configManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { getChestShopAt } from '@features/economy/chestShop/manager.js';
import { getGraveAt } from '@features/essentials/graves/manager.js';
import {
  canBypassLandClaim,
  canPlayerModify,
  getEnforcedClaimAt,
  isClaimOwnerOrTrusted,
} from '@features/essentials/protection/landclaim/manager.js';
import { getPlayerTeamId } from '@features/social/team/manager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

/** Persisted lock record for a protected container block. */
export interface ContainerLockRecord {
  key: string;
  ownerId: string;
  ownerName: string;
  trustedIds: string[];
  isPublic?: boolean;
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

const lockableBlockTypes = new Set<string>([
  MinecraftBlockTypes.Chest,
  MinecraftBlockTypes.TrappedChest,
  MinecraftBlockTypes.Barrel,
  MinecraftBlockTypes.BlackShulkerBox,
  MinecraftBlockTypes.BlueShulkerBox,
  MinecraftBlockTypes.BrownShulkerBox,
  MinecraftBlockTypes.CyanShulkerBox,
  MinecraftBlockTypes.GrayShulkerBox,
  MinecraftBlockTypes.GreenShulkerBox,
  MinecraftBlockTypes.LightBlueShulkerBox,
  MinecraftBlockTypes.LightGrayShulkerBox,
  MinecraftBlockTypes.LimeShulkerBox,
  MinecraftBlockTypes.MagentaShulkerBox,
  MinecraftBlockTypes.OrangeShulkerBox,
  MinecraftBlockTypes.PinkShulkerBox,
  MinecraftBlockTypes.PurpleShulkerBox,
  MinecraftBlockTypes.RedShulkerBox,
  MinecraftBlockTypes.UndyedShulkerBox,
  MinecraftBlockTypes.WhiteShulkerBox,
  MinecraftBlockTypes.YellowShulkerBox,
]);

const storage = new StorageManager('exe:containerLocks:v1');
let locks = new Map<string, ContainerLockRecord>();

function lockKey(dimensionId: string, loc: mc.Vector3): string {
  return `${dimensionId}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

/** Loads persisted container locks from dynamic properties. */
export function loadContainerLocks(): void {
  try {
    const parsed = storage.load<[string, ContainerLockRecord][]>();
    locks = parsed ? new Map(parsed) : new Map();
    debugLog(`[ContainerLock] Loaded ${locks.size} locked containers.`);
  } catch (err) {
    errorLog(`[ContainerLock] Failed to load locks: ${String(err)}`);
    locks = new Map();
  }
}

/**
 * Saves container locks to dynamic properties.
 *
 * @returns True if saved successfully.
 */
export function saveContainerLocks(): boolean {
  try {
    return storage.save([...locks.entries()]);
  } catch (err) {
    errorLog(`[ContainerLock] Failed to save locks: ${String(err)}`);
    return false;
  }
}

/**
 * Checks if a block type can be locked.
 *
 * @param blockTypeId Block type identifier.
 * @returns True if the block is a supported container.
 */
export function isLockableContainer(blockTypeId: string): boolean {
  return lockableBlockTypes.has(blockTypeId);
}

/**
 * Gets a lock record at a block coordinate (or adjacent double-chest half), if any.
 *
 * @param dimensionId Dimension identifier.
 * @param location Block coordinate.
 * @returns Lock record or undefined.
 */
export function getContainerLockAt(dimensionId: string, location: mc.Vector3): ContainerLockRecord | undefined {
  if (locks.size === 0) {
    return undefined;
  }
  const direct = locks.get(lockKey(dimensionId, location));
  if (direct) {
    return direct;
  }
  try {
    const dim = mc.world.getDimension(dimensionId);
    const blk = dim.getBlock(location);
    if (blk && (blk.typeId === MinecraftBlockTypes.Chest || blk.typeId === MinecraftBlockTypes.TrappedChest)) {
      const inv = blk.getComponent(mc.BlockComponentTypes?.Inventory ?? 'minecraft:inventory') as
        mc.BlockInventoryComponent | undefined;
      // Only a paired double chest (54 slots) can share an adjacent block's lock
      if (inv?.container && inv.container.size <= 27) {
        return undefined;
      }
      const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
      ];
      for (const off of offsets) {
        const adjLoc = { x: location.x + off.x, y: location.y, z: location.z + off.z };
        const adjLock = locks.get(lockKey(dimensionId, adjLoc));
        if (adjLock) {
          const adjBlk = dim.getBlock(adjLoc);
          if (adjBlk && adjBlk.typeId === blk.typeId) {
            return adjLock;
          }
        }
      }
    }
  } catch {
    // Ignore unloaded chunk or mock errors
  }
  return undefined;
}

/**
 * Checks if a player can access/break a locked container.
 *
 * @param lock Container lock record.
 * @param player Player attempting access.
 * @returns True if authorized.
 */
export function canAccessLockedContainer(lock: ContainerLockRecord, player: mc.Player, isBreak = false): boolean {
  if (lock.ownerId === player.id || hasPermission(player, 'group.admin')) {
    return true;
  }
  if (isBreak) {
    return false;
  }
  if (lock.isPublic || lock.trustedIds.includes(player.id)) {
    return true;
  }
  if (getConfig().containerLocking?.allowTeamAccess) {
    const ownerTeamId = getPlayerTeamId(lock.ownerId);
    const playerTeamId = getPlayerTeamId(player.id);
    if (isDefined(ownerTeamId) && isDefined(playerTeamId) && ownerTeamId === playerTeamId) {
      return true;
    }
  }
  return false;
}

/**
 * Counts how many containers a player currently has locked.
 *
 * @param playerId Player identifier.
 * @returns Number of locked containers owned by the player.
 */
export function getPlayerLockCount(playerId: string): number {
  let count = 0;
  for (const rec of locks.values()) {
    if (rec.ownerId === playerId) {
      count++;
    }
  }
  return count;
}

/**
 * Locks a container at the given location for the player.
 *
 * @param player Player locking the container.
 * @param block Target container block.
 * @returns Result with success flag and message.
 */
export function lockContainer(player: mc.Player, block: mc.Block): { success: boolean; message: string } {
  if (!getConfig().containerLocking?.enabled) {
    return { success: false, message: '§cContainer locking is currently disabled.' };
  }
  if (!isLockableContainer(block.typeId)) {
    return { success: false, message: '§cLook at a Chest, Barrel, or Shulker Box to lock it.' };
  }
  if (isDefined(getGraveAt(block.dimension.id, block.location))) {
    return { success: false, message: '§cYou cannot lock a grave.' };
  }
  if (isDefined(getChestShopAt(block.dimension.id, block.location))) {
    return { success: false, message: '§cYou cannot lock a chest shop.' };
  }
  const claim = getEnforcedClaimAt(block.location, block.dimension.id);
  if (isDefined(claim) && !isClaimOwnerOrTrusted(claim, player) && !canBypassLandClaim(player)) {
    return { success: false, message: '§cYou cannot lock containers inside another player claim.' };
  }
  if (!canPlayerModify(player, block.location, block.dimension.id, 'container')) {
    return { success: false, message: '§cYou cannot lock containers inside another player claim.' };
  }
  const key = lockKey(block.dimension.id, block.location);
  const existing = getContainerLockAt(block.dimension.id, block.location);
  if (existing) {
    if (existing.ownerId === player.id) {
      return { success: false, message: '§eThis container is already locked by you.' };
    }
    return { success: false, message: `§cThis container is already locked by §e${existing.ownerName}§c.` };
  }

  const maxLocks = Math.max(1, Number(getConfig().containerLocking?.maxLocksPerPlayer ?? 20));
  if (!hasPermission(player, 'group.admin') && getPlayerLockCount(player.id) >= maxLocks) {
    return { success: false, message: `§cYou reached the maximum of §e${maxLocks}§c locked containers.` };
  }

  locks.set(key, {
    key,
    ownerId: player.id,
    ownerName: player.name,
    trustedIds: [],
    dimensionId: block.dimension.id,
    x: Math.floor(block.location.x),
    y: Math.floor(block.location.y),
    z: Math.floor(block.location.z),
  });
  if (!saveContainerLocks()) {
    locks.delete(key);
    return { success: false, message: '§cFailed to save container lock.' };
  }
  return { success: true, message: '§aContainer locked!' };
}

/**
 * Unlocks a container at the given location.
 *
 * @param player Player requesting unlock.
 * @param dimensionId Dimension identifier.
 * @param location Block coordinate.
 * @returns Result with success flag and message.
 */
export function unlockContainer(
  player: mc.Player,
  dimensionId: string,
  location: mc.Vector3,
): { success: boolean; message: string } {
  const existing = getContainerLockAt(dimensionId, location);
  if (!existing) {
    return { success: false, message: '§7This container is not locked.' };
  }
  if (existing.ownerId !== player.id && !hasPermission(player, 'group.admin')) {
    return { success: false, message: `§cOnly §e${existing.ownerName}§c or an admin can unlock this container.` };
  }
  locks.delete(existing.key);
  saveContainerLocks();
  return { success: true, message: '§aContainer unlocked.' };
}

/**
 * Removes a lock when a locked container is broken by its owner/admin.
 *
 * @param dimensionId Dimension identifier.
 * @param location Block coordinate.
 */
export function removeContainerLockOnBreak(dimensionId: string, location: mc.Vector3): void {
  const existing = getContainerLockAt(dimensionId, location);
  if (existing && locks.delete(existing.key)) {
    saveContainerLocks();
  }
}

/**
 * Trusts or untrusts another player ID on a locked container.
 *
 * @param owner Container owner or admin.
 * @param dimensionId Dimension identifier.
 * @param location Block coordinate.
 * @param targetId Target player ID.
 * @param targetName Target player name.
 * @param shouldTrust Explicit true to trust, false to untrust, or undefined to toggle.
 * @returns Result with success flag and message.
 */
export function toggleContainerTrust(
  owner: mc.Player,
  dimensionId: string,
  location: mc.Vector3,
  targetId: string,
  targetName: string,
  shouldTrust?: boolean,
): { success: boolean; message: string } {
  const existing = getContainerLockAt(dimensionId, location);
  if (!existing) {
    return { success: false, message: '§cThis container is not locked.' };
  }
  if (existing.ownerId !== owner.id && !hasPermission(owner, 'group.admin')) {
    return { success: false, message: '§cOnly the container owner can manage trusted players.' };
  }
  const idx = existing.trustedIds.indexOf(targetId);
  const currentlyTrusted = idx >= 0;

  if (shouldTrust === true) {
    if (currentlyTrusted) {
      return { success: false, message: `§e${targetName} is already trusted on this container.` };
    }
    existing.trustedIds.push(targetId);
    saveContainerLocks();
    return { success: true, message: `§aTrusted §f${targetName}§a on this container.` };
  }
  if (shouldTrust === false) {
    if (!currentlyTrusted) {
      return { success: false, message: `§7${targetName} is not trusted on this container.` };
    }
    existing.trustedIds.splice(idx, 1);
    saveContainerLocks();
    return { success: true, message: `§eRemoved §f${targetName}§e from this container.` };
  }

  if (currentlyTrusted) {
    existing.trustedIds.splice(idx, 1);
    saveContainerLocks();
    return { success: true, message: `§eRemoved §f${targetName}§e from this container.` };
  }
  existing.trustedIds.push(targetId);
  saveContainerLocks();
  return { success: true, message: `§aTrusted §f${targetName}§a on this container.` };
}

/**
 * Returns all container lock records owned by `playerId`.
 *
 * @param playerId Owner player identifier.
 * @returns Array of owned container lock records.
 */
export function getPlayerLocks(playerId: string): ContainerLockRecord[] {
  const result: ContainerLockRecord[] = [];
  for (const rec of locks.values()) {
    if (rec.ownerId === playerId) {
      result.push(rec);
    }
  }
  return result;
}

/**
 * Toggles public access on a locked container (only owner or admin can toggle/break).
 *
 * @param player Requesting player.
 * @param dimensionId Dimension identifier.
 * @param location Block coordinate.
 * @returns Result with success flag and message.
 */
export function toggleContainerPublic(
  player: mc.Player,
  dimensionId: string,
  location: mc.Vector3,
): { success: boolean; message: string } {
  const existing = getContainerLockAt(dimensionId, location);
  if (!existing) {
    return { success: false, message: '§cThis container is not locked.' };
  }
  if (existing.ownerId !== player.id && !hasPermission(player, 'group.admin')) {
    return { success: false, message: '§cOnly the container owner can change public access.' };
  }
  existing.isPublic = !existing.isPublic;
  saveContainerLocks();
  return {
    success: true,
    message: existing.isPublic
      ? '§aContainer set to §ePUBLIC§a (anyone can open, only you can break).'
      : '§eContainer set to §cPRIVATE§e.',
  };
}

/** Initializes container lock persistence and optional auto-lock-on-place listener. */
export function initializeContainerLocks(): void {
  loadContainerLocks();
  if (mc.world?.afterEvents?.playerPlaceBlock) {
    mc.world.afterEvents.playerPlaceBlock.subscribe((event) => {
      const cfg = getConfig().containerLocking;
      if (!cfg?.enabled || !cfg.autoLockOnPlace) {
        return;
      }
      const { player, block } = event;
      if (!player.isValid || !isLockableContainer(block.typeId)) {
        return;
      }
      const res = lockContainer(player, block);
      if (res.success) {
        player.onScreenDisplay.setActionBar('§aContainer auto-locked.');
      }
    });
  }
}

/** Clears in-memory container locks (for tests). */
export function _clearContainerLocksForTest(): void {
  locks.clear();
}
