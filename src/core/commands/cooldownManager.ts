import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

/**
 * In-memory map storing expiration timestamps in milliseconds per player and command. Map<playerId, Map<commandName,
 * expirationTimestampMs>>
 */
const cooldowns = new Map<string, Map<string, number>>();

/**
 * Assigns an active cooldown duration to a player for a specific command.
 *
 * @param playerId Unique player identifier.
 * @param commandName Name of the command.
 * @param durationSeconds Cooldown duration in seconds.
 */
export function setCommandCooldown(playerId: string, commandName: string, durationSeconds: number): void {
  if (durationSeconds <= 0) {
    return;
  }
  let playerMap = cooldowns.get(playerId);
  if (!playerMap) {
    playerMap = new Map<string, number>();
    cooldowns.set(playerId, playerMap);
  } else {
    // Prune expired commands for this player to prevent stale key accumulation
    const now = Date.now();
    for (const [cmd, exp] of playerMap.entries()) {
      if (exp <= now) {
        playerMap.delete(cmd);
      }
    }
  }
  const expiry = Date.now() + durationSeconds * 1000;
  playerMap.set(commandName.toLowerCase(), expiry);
}

/**
 * Computes the remaining cooldown in seconds for a player on a given command. Returns 0 if no active cooldown exists or
 * if it has expired.
 *
 * @param playerId Unique player identifier.
 * @param commandName Name of the command.
 * @returns Remaining cooldown duration in seconds (floored), or 0.
 */
export function getRemainingCommandCooldown(playerId: string, commandName: string): number {
  const playerMap = cooldowns.get(playerId);
  if (!playerMap) {
    return 0;
  }
  const expiry = playerMap.get(commandName.toLowerCase());
  if (!isDefined(expiry)) {
    return 0;
  }
  const diff = expiry - Date.now();
  if (diff <= 0) {
    playerMap.delete(commandName.toLowerCase());
    if (playerMap.size === 0) {
      cooldowns.delete(playerId);
    }
    return 0;
  }
  return Math.ceil(diff / 1000);
}

/**
 * Clears active cooldowns for a player. If commandName is provided, clears only that command; otherwise clears all
 * active cooldowns for the player.
 *
 * @param playerId Unique player identifier.
 * @param commandName Optional specific command name.
 */
export function clearCommandCooldown(playerId: string, commandName?: string): void {
  if (isDefined(commandName)) {
    const playerMap = cooldowns.get(playerId);
    if (playerMap) {
      playerMap.delete(commandName.toLowerCase());
      if (playerMap.size === 0) {
        cooldowns.delete(playerId);
      }
    }
  } else {
    cooldowns.delete(playerId);
  }
}

/**
 * Evaluates whether a player is permitted to bypass command cooldowns.
 *
 * @param player Player executing the command.
 * @returns True if the player possesses the bypass permission.
 */
export function canBypassCommandCooldown(player: mc.Player): boolean {
  if (!player.isValid) {
    return false;
  }
  return hasPermission(player, 'cmd.cooldown.bypass');
}

/** Sweeps and purges expired command cooldown entries across all players to keep memory bounded. */
export function cleanupExpiredCooldowns(): void {
  const now = Date.now();
  for (const [playerId, playerMap] of cooldowns.entries()) {
    for (const [cmd, expiry] of playerMap.entries()) {
      if (expiry <= now) {
        playerMap.delete(cmd);
      }
    }
    if (playerMap.size === 0) {
      cooldowns.delete(playerId);
    }
  }
}

/** Clears all cached cooldown records for isolated test execution. */
export function resetAllCooldownsForTest(): void {
  cooldowns.clear();
}
