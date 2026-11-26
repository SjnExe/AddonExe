import { getConfig } from '@core/config/configManager.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';

const activeSeats = new Map<string, mc.Entity>();
let seatCleanupIntervalId: number | undefined;

/**
 * Seats `player` onto a temporary invisible `exe:seat` entity at `seatLocation`.
 *
 * @param player Player to seat.
 * @param seatLocation World coordinate for the seat.
 * @returns True if seated successfully.
 */
export function seatPlayerAt(player: mc.Player, seatLocation: mc.Vector3): boolean {
  if (!player.isValid) {
    return false;
  }
  const existing = activeSeats.get(player.id);
  if (existing && existing.isValid) {
    try {
      existing.remove();
    } catch {
      // Ignore
    }
    activeSeats.delete(player.id);
  }

  try {
    const seat = player.dimension.spawnEntity('exe:seat' as unknown as mc.EntityType, seatLocation);
    const rideable = seat.getComponent(EntityComponentTypes.Rideable) as mc.EntityRideableComponent | undefined;
    if (!rideable || !rideable.addRider(player)) {
      seat.remove();
      return false;
    }
    activeSeats.set(player.id, seat);
    return true;
  } catch {
    return false;
  }
}

/**
 * Handles right-clicking stairs or slabs with an empty hand to sit when `survivalQoL.sit.enabled` is true.
 *
 * @param event Block interaction after event.
 */
export function handleSitBlockInteract(event: mc.PlayerInteractWithBlockAfterEvent): void {
  if (!getConfig().survivalQoL?.sit?.enabled) {
    return;
  }
  const { player, block, itemStack } = event;
  if (!player.isValid || player.isSneaking || isDefined(itemStack)) {
    return;
  }
  const id = block.typeId.toLowerCase();
  if (!id.includes('stairs') && !id.includes('slab')) {
    return;
  }
  const yOffset = id.includes('slab') ? 0.3 : 0.45;
  seatPlayerAt(player, {
    x: block.location.x + 0.5,
    y: block.location.y + yOffset,
    z: block.location.z + 0.5,
  });
}

function cleanupEmptySeats(): void {
  for (const [playerId, seat] of activeSeats) {
    if (!seat.isValid) {
      activeSeats.delete(playerId);
      continue;
    }
    const rideable = seat.getComponent(EntityComponentTypes.Rideable) as mc.EntityRideableComponent | undefined;
    const riders = rideable?.getRiders() ?? [];
    if (riders.length === 0) {
      try {
        seat.remove();
      } catch {
        // Ignore
      }
      activeSeats.delete(playerId);
    }
  }
}

/** Initializes periodic cleanup of empty `exe:seat` entities. */
export function initializeSitSystem(): void {
  if (seatCleanupIntervalId !== undefined) {
    clearTrackedInterval(seatCleanupIntervalId);
  }
  seatCleanupIntervalId = setTrackedInterval(cleanupEmptySeats, 10);
}
