import { getConfig } from '@core/config/configManager.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

const carriedEntities = new Map<string, mc.Entity>();
let carryIntervalId: number | undefined;

const maxCarryDistanceSq = 64;
const blockedCarryTypes = new Set<string>([
  MinecraftEntityTypes.Player,
  MinecraftEntityTypes.ArmorStand,
  MinecraftEntityTypes.Npc,
  MinecraftEntityTypes.EnderDragon,
  MinecraftEntityTypes.Wither,
  MinecraftEntityTypes.Warden,
  MinecraftEntityTypes.ElderGuardian,
  'exe:seat',
  'exe:floating_text',
]);

function isCarryableEntity(player: mc.Player, target: mc.Entity): boolean {
  if (blockedCarryTypes.has(target.typeId)) {
    return false;
  }
  try {
    // Require Health component to exclude falling_block, item, xp_orb, tnt, projectiles, boats, minecarts, etc.
    if (!target.hasComponent(EntityComponentTypes.Health)) {
      return false;
    }
    const tameComp = target.getComponent(EntityComponentTypes.IsTamed) as mc.EntityIsTamedComponent | undefined;
    if (tameComp?.tamedToPlayerId && tameComp.tamedToPlayerId !== player.id && !hasPermission(player, 'group.admin')) {
      return false;
    }
  } catch {
    return false;
  }
  const flags = getProtectionFlags(target.location, target.dimension.id);
  if (flags.preventEntityInteraction && !hasPermission(player, 'group.mod')) {
    return false;
  }
  return true;
}

function isPlayerRiding(player: mc.Player): boolean {
  try {
    const riding = player.getComponent(EntityComponentTypes.Riding) as mc.EntityRidingComponent | undefined;
    return Boolean(riding?.entityRidingOn?.isValid);
  } catch {
    return false;
  }
}

function hasRiders(entity: mc.Entity): boolean {
  try {
    const rideable = entity.getComponent(EntityComponentTypes.Rideable) as mc.EntityRideableComponent | undefined;
    return (rideable?.getRiders().length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Handles sneak-interacting with a mob to pick it up or drop it when `survivalQoL.carry.enabled` is true.
 *
 * @param event Player interact with entity before event.
 * @returns True if a carry pick-up/drop occurred.
 */
export function handleCarryEntityInteract(event: mc.PlayerInteractWithEntityBeforeEvent): boolean {
  if (!getConfig().survivalQoL?.carry?.enabled) {
    return false;
  }
  const { player, target } = event;
  if (!player.isValid || !target.isValid || !player.isSneaking) {
    return false;
  }
  if (isPlayerRiding(player) || hasRiders(target)) {
    return false;
  }
  if (!carriedEntities.has(player.id) && !isCarryableEntity(player, target)) {
    return false;
  }

  event.cancel = true;
  mc.system.run(() => {
    if (!player.isValid) {
      return;
    }
    if (carriedEntities.has(player.id)) {
      carriedEntities.delete(player.id);
      player.sendMessage('§eDropped carried entity.');
      return;
    }
    if (target.isValid && !isPlayerRiding(player) && !hasRiders(target) && isCarryableEntity(player, target)) {
      carriedEntities.set(player.id, target);
      player.sendMessage('§aPicked up entity! Sneak-interact again to drop.');
    }
  });
  return true;
}

/** Updates positions of all currently carried entities, dropping mounts if ridden. */
export function tickCarriedEntities(): void {
  if (!getConfig().survivalQoL?.carry?.enabled) {
    carriedEntities.clear();
    return;
  }
  if (carriedEntities.size === 0) {
    return;
  }
  const onlineById = new Map<string, mc.Player>();
  for (const p of mc.world.getAllPlayers()) {
    if (p.isValid) {
      onlineById.set(p.id, p);
    }
  }
  for (const [playerId, entity] of carriedEntities) {
    const player = onlineById.get(playerId);
    if (
      !player ||
      !entity.isValid ||
      player.dimension.id !== entity.dimension.id ||
      isPlayerRiding(player) ||
      hasRiders(entity)
    ) {
      carriedEntities.delete(playerId);
      continue;
    }
    const playerLoc = player.location;
    const entityLoc = entity.location;
    const dx = playerLoc.x - entityLoc.x;
    const dy = playerLoc.y - entityLoc.y;
    const dz = playerLoc.z - entityLoc.z;
    if (dx * dx + dy * dy + dz * dz > maxCarryDistanceSq) {
      carriedEntities.delete(playerId);
      continue;
    }
    const dir = player.getViewDirection();
    const targetLoc = {
      x: playerLoc.x + dir.x * 1.4,
      y: playerLoc.y + 1.1,
      z: playerLoc.z + dir.z * 1.4,
    };
    try {
      entity.teleport(targetLoc, { dimension: player.dimension });
    } catch {
      carriedEntities.delete(playerId);
    }
  }
}

/** Clears carried entity state (for tests). */
export function _clearCarriedEntitiesForTest(): void {
  carriedEntities.clear();
}

/** Initializes the Pick Up & Carry update loop. */
export function initializeCarrySystem(): void {
  if (carryIntervalId !== undefined) {
    clearTrackedInterval(carryIntervalId);
  }
  carryIntervalId = setTrackedInterval(tickCarriedEntities, 2);
}
