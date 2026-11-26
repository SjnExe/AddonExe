import { getConfig } from '@core/config/configManager.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import * as mc from '@minecraft/server';
import { MinecraftEntityTypes } from '@minecraft/vanilla-data';

const carriedEntities = new Map<string, mc.Entity>();
let carryIntervalId: number | undefined;

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
  if (
    target.typeId === MinecraftEntityTypes.Player ||
    target.typeId === 'exe:seat' ||
    target.typeId === 'exe:floating_text'
  ) {
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
    if (target.isValid) {
      carriedEntities.set(player.id, target);
      player.sendMessage('§aPicked up entity! Sneak-interact again to drop.');
    }
  });
  return true;
}

function tickCarriedEntities(): void {
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
    if (!player || !entity.isValid || player.dimension.id !== entity.dimension.id) {
      carriedEntities.delete(playerId);
      continue;
    }
    const dir = player.getViewDirection();
    const targetLoc = {
      x: player.location.x + dir.x * 1.4,
      y: player.location.y + 1.1,
      z: player.location.z + dir.z * 1.4,
    };
    try {
      entity.teleport(targetLoc, { dimension: player.dimension });
    } catch {
      carriedEntities.delete(playerId);
    }
  }
}

/** Initializes the Pick Up & Carry update loop. */
export function initializeCarrySystem(): void {
  if (carryIntervalId !== undefined) {
    clearTrackedInterval(carryIntervalId);
  }
  carryIntervalId = setTrackedInterval(tickCarriedEntities, 2);
}
