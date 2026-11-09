import { isDefined } from '@lib/guards.js';

/** Recognized causes of legitimate transient gameplay anomalies that warrant temporary check exemptions. */
export type GraceReason =
  | 'teleport'
  | 'respawn'
  | 'dimension_change'
  | 'damage'
  | 'knockback'
  | 'vehicle'
  | 'glide'
  | 'riptide'
  | 'bounce'
  | 'join';

// Map<PlayerID, Map<GraceReason, ExpirationTimestamp>>
const playerGraceMap = new Map<string, Map<GraceReason, number>>();

/**
 * Grants a temporary grace period to a player for a specific anomalous event (e.g. explosion knockback, teleportation).
 *
 * @param playerId The target player's unique identifier.
 * @param reason The cause of the temporary grace window.
 * @param durationMs Duration in milliseconds for which the grace window remains active.
 */
export function addGrace(playerId: string, reason: GraceReason, durationMs: number): void {
  if (durationMs <= 0) {
    return;
  }
  let playerReasons = playerGraceMap.get(playerId);
  if (!isDefined(playerReasons)) {
    playerReasons = new Map<GraceReason, number>();
    playerGraceMap.set(playerId, playerReasons);
  }
  const expiry = Date.now() + durationMs;
  const currentExpiry = playerReasons.get(reason) ?? 0;
  if (expiry > currentExpiry) {
    playerReasons.set(reason, expiry);
  }
}

/**
 * Checks whether a player currently has an active grace window.
 *
 * @param playerId The target player's unique identifier.
 * @param reason Specific grace reason or array of reasons to verify. If omitted, checks if any grace window is active.
 * @returns True if at least one matching grace window has not expired.
 */
export function hasGrace(playerId: string, reason?: GraceReason | readonly GraceReason[]): boolean {
  const playerReasons = playerGraceMap.get(playerId);
  if (!isDefined(playerReasons) || playerReasons.size === 0) {
    return false;
  }
  const now = Date.now();

  if (isDefined(reason)) {
    const reasonsToCheck: readonly GraceReason[] = typeof reason === 'string' ? [reason] : reason;
    for (const r of reasonsToCheck) {
      const expiry = playerReasons.get(r);
      if (isDefined(expiry) && expiry > now) {
        return true;
      }
    }
    return false;
  }

  // Any active grace
  for (const expiry of playerReasons.values()) {
    if (expiry > now) {
      return true;
    }
  }
  return false;
}

/**
 * Retrieves the remaining milliseconds of an active grace window.
 *
 * @param playerId The target player's unique identifier.
 * @param reason The specific grace reason to inspect.
 * @returns Milliseconds remaining before expiration, or 0 if inactive.
 */
export function getRemainingGrace(playerId: string, reason: GraceReason): number {
  const playerReasons = playerGraceMap.get(playerId);
  if (!isDefined(playerReasons)) {
    return 0;
  }
  const expiry = playerReasons.get(reason);
  if (!isDefined(expiry)) {
    return 0;
  }
  const remaining = expiry - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Records combat damage / knockback grace for a player (default 2500ms).
 *
 * @param playerId The target player's unique identifier.
 * @param durationMs Custom duration in milliseconds (defaults to 2500ms).
 */
export function recordPlayerDamageGrace(playerId: string, durationMs: number = 2500): void {
  addGrace(playerId, 'damage', durationMs);
  addGrace(playerId, 'knockback', durationMs);
}

/**
 * Records teleportation grace for a player (default 3000ms).
 *
 * @param playerId The target player's unique identifier.
 * @param durationMs Custom duration in milliseconds (defaults to 3000ms).
 */
export function recordPlayerTeleportGrace(playerId: string, durationMs: number = 3000): void {
  addGrace(playerId, 'teleport', durationMs);
}

/**
 * Records physical bounce grace (slime block, bed, wind charge) for a player (default 2500ms).
 *
 * @param playerId The target player's unique identifier.
 * @param durationMs Custom duration in milliseconds (defaults to 2500ms).
 */
export function recordPlayerBounceGrace(playerId: string, durationMs: number = 2500): void {
  addGrace(playerId, 'bounce', durationMs);
}

/**
 * Records vehicle mount / dismount grace for a player (default 2000ms).
 *
 * @param playerId The target player's unique identifier.
 * @param durationMs Custom duration in milliseconds (defaults to 2000ms).
 */
export function recordPlayerVehicleGrace(playerId: string, durationMs: number = 2000): void {
  addGrace(playerId, 'vehicle', durationMs);
}

/**
 * Clears all cached grace timers for a player upon departure.
 *
 * @param playerId The target player's unique identifier.
 */
export function clearPlayerGrace(playerId: string): void {
  playerGraceMap.delete(playerId);
}

/** Clears all grace maps across all players for unit test isolation. */
export function _resetGraceManagerForTest(): void {
  playerGraceMap.clear();
}
