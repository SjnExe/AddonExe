import { findPlayerByName, getAllPlayersFromCache } from '@core/data/playerCache.js';
import {
  getOrCreatePlayer,
  getPlayer,
  getPlayerIdByName,
  getPlayerNameById,
  loadPlayerData,
  type PlayerData,
} from '@core/data/playerDataManager.js';
import { handlePlayerJoin } from '@core/events/playerSpawn.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export function resolveTarget(input: string, executor: mc.Player): mc.Player[] {
  if (!input) {
    return [];
  }

  const lowerInput = input.toLowerCase();

  // 1. Selector Support (@s, @p, @a, @r)
  if (input.startsWith('@')) {
    // @s: Self
    if (lowerInput === '@s') {
      return [executor];
    }

    // @p: Nearest player (excluding self?) - Vanilla includes self usually.
    // Documentation memory says "@p excludes the executing player" in this codebase.
    if (lowerInput === '@p') {
      // Manual distance check to find nearest other
      let nearest: mc.Player | undefined;
      let minDist = Number.MAX_VALUE;
      const allPlayers = getAllPlayersFromCache();

      for (const player of allPlayers) {
        if (player.id === executor.id) {
          continue;
        }
        // Direct squared distance check without sqrt overhead
        const pLoc = player.location;
        const eLoc = executor.location;
        const dx = pLoc.x - eLoc.x;
        const dy = pLoc.y - eLoc.y;
        const dz = pLoc.z - eLoc.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < minDist) {
          minDist = distSq;
          nearest = player;
        }
      }
      return nearest ? [nearest] : [];
    }

    // @a: All players
    if (lowerInput === '@a') {
      return getAllPlayersFromCache();
    }

    // @r: Random player
    if (lowerInput === '@r') {
      const all = getAllPlayersFromCache();
      if (all.length === 0) {
        return [];
      }
      const randomIndex = Math.floor(Math.random() * all.length);
      const random = all[randomIndex];
      return isDefined(random) ? [random] : [];
    }
  }

  // 2. Exact Name Match
  const exactMatch = findPlayerByName(lowerInput);
  if (exactMatch) {
    return [exactMatch];
  }

  // 3. Quoted Name Match (handling "Name With Spaces")
  const cleanInput = input.replaceAll('"', '');
  const quotedMatch = findPlayerByName(cleanInput);
  // ensure exact case match like the previous implementation
  if (quotedMatch && quotedMatch.name === cleanInput) {
    return [quotedMatch];
  }

  // 4. Partial Name Match
  const allPlayers = getAllPlayersFromCache();
  const partialMatches = allPlayers.filter((p) => p.name.toLowerCase().includes(lowerInput));
  if (partialMatches.length > 0) {
    return partialMatches;
  }

  return [];
}

/**
 * Validates that a player object is still valid and online.
 *
 * @param player
 */
export function isValidPlayer(player: mc.Player): boolean {
  if (!isDefined(player)) {
    return false;
  }
  try {
    return player.isValid;
  } catch {
    return false;
  }
}

/** Gets a clean name for display, checking vanish status. */
export function getSafeDisplayName(player: mc.Player, observer?: mc.Player): string {
  const pData = getPlayer(player.id);
  if (isDefined(pData) && pData.isVanished) {
    // Check if observer can see vanished players
    if (observer) {
      if (hasPermission(observer, 'group.mod')) {
        return `§7[V] ${player.name}§r`;
      }
    }
    return '§kUnknown§r'; // Obfuscated for non-staff
  }
  return player.name;
}

export interface ResolvedPlayerRecord {
  player?: mc.Player;
  playerId: string;
  playerName: string;
  pData?: PlayerData;
  isOnline: boolean;
}

/** Resolves an online or offline player by name or selector into a unified record. */
export function resolvePlayerRecord(input: string, executor?: mc.Player): ResolvedPlayerRecord | undefined {
  if (!input || input.trim().length === 0) {
    return undefined;
  }
  const clean = input.trim();
  const onlineMatch = executor ? resolveTarget(clean, executor)[0] : findPlayerByName(clean);
  if (isDefined(onlineMatch)) {
    return {
      player: onlineMatch,
      playerId: onlineMatch.id,
      playerName: onlineMatch.name,
      pData: getPlayer(onlineMatch.id) ?? getOrCreatePlayer(onlineMatch),
      isOnline: true,
    };
  }

  const offlineId = getPlayerIdByName(clean);
  if (isDefined(offlineId)) {
    const pData = getPlayer(offlineId) ?? loadPlayerData(offlineId);
    const displayName = getPlayerNameById(offlineId) ?? pData?.name ?? clean;
    return {
      playerId: offlineId,
      playerName: displayName,
      ...(isDefined(pData) ? { pData } : {}),
      isOnline: false,
    };
  }

  return undefined;
}

export interface SingleTargetOptions {
  allowSelf?: boolean;
  disallowMassSelectors?: boolean;
  selfErrorMessage?: string;
}

export interface SingleTargetResult {
  player?: mc.Player;
  error?: string;
}

/**
 * Resolves a single online target from user/command input with standard validation (checking emptiness, mass selectors,
 * zero/multiple matches, and self targeting).
 */
export function resolveSingleOnlineTarget(
  input: unknown,
  executor: mc.Player,
  options: SingleTargetOptions = {},
): SingleTargetResult {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return { error: '§cPlease specify a player.' };
  }

  const clean = input.trim();
  const lower = clean.toLowerCase();

  if (options.disallowMassSelectors !== false && (lower.startsWith('@a') || lower.startsWith('@e'))) {
    return { error: '§cSelectors @a and @e are disabled for this command.' };
  }

  const targets = resolveTarget(clean, executor);
  if (!isDefined(targets) || targets.length === 0) {
    return { error: '§cPlayer not found.' };
  }
  if (targets.length > 1) {
    return { error: '§cMultiple players found. Please be more specific.' };
  }

  const targetPlayer = targets[0]!;
  if (options.allowSelf !== true && targetPlayer.id === executor.id) {
    return { error: options.selfErrorMessage ?? '§cYou cannot target yourself.' };
  }

  return { player: targetPlayer };
}

export function reinitializeOnlinePlayers() {
  const players = getAllPlayersFromCache();
  for (const player of players) {
    handlePlayerJoin(player);
  }
}
