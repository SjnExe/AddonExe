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
import { Vector3Utils } from '@minecraft/math';
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
        // Approximate distance check (squared)
        const distSq = Vector3Utils.distance(player.location, executor.location) ** 2;

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

export function reinitializeOnlinePlayers() {
  const players = getAllPlayersFromCache();
  for (const player of players) {
    handlePlayerJoin(player);
  }
}
