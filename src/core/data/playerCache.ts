import * as mc from '@minecraft/server';

const playerCache = new Map<string, mc.Player>();
const playerNameCache = new Map<string, mc.Player>();
const playerIdToName = new Map<string, string>();
let cachedPlayerList: mc.Player[] = [];

function refreshCachedPlayerList(): void {
  cachedPlayerList = [...playerCache.values()].filter((p) => p.isValid !== false);
}

let isInitialized = false;

/** Initializes the in-memory player cache and registers spawn/leave event subscriptions. */
export function initializePlayerCache(): void {
  // Clear cache first to ensure no stale data on re-init
  playerCache.clear();
  playerNameCache.clear();
  playerIdToName.clear();
  for (const player of mc.world.getAllPlayers?.() ?? []) {
    if (player.isValid !== false) {
      try {
        const id = player.id;
        const name = player.name;
        const lowerName = (name || '').toLowerCase();
        playerCache.set(id, player);
        if (lowerName) {
          playerNameCache.set(lowerName, player);
          playerIdToName.set(id, lowerName);
        }
      } catch {
        // Player became invalid during iteration
      }
    }
  }
  refreshCachedPlayerList();

  if (!isInitialized) {
    isInitialized = true;
    mc.world.afterEvents.playerSpawn.subscribe((event) => {
      const { player } = event;
      addPlayerToCache(player);
    });

    mc.world.afterEvents.playerLeave.subscribe((event) => {
      const { playerId } = event;
      removePlayerFromCache(playerId);
    });
  }
}

/** Clears all player cache maps and cached lists for test isolation and reloads. */
export function clearPlayerCache(): void {
  playerCache.clear();
  playerNameCache.clear();
  playerIdToName.clear();
  cachedPlayerList = [];
}

/**
 * Retrieves a cached player by their unique entity ID if currently valid.
 *
 * @param playerId The entity identifier of the player.
 * @returns The Player reference if online and valid, otherwise undefined.
 */
export function getPlayerFromCache(playerId: string): mc.Player | undefined {
  const player = playerCache.get(playerId);
  if (player && player.isValid === false) {
    removePlayerFromCache(playerId);
    return undefined;
  }
  return player;
}

/**
 * Adds an active player to the in-memory lookup caches.
 *
 * @param player The active Minecraft player instance to cache.
 */
export function addPlayerToCache(player: mc.Player): void {
  if (player.isValid === false) {
    return;
  }
  try {
    const id = player.id;
    const name = player.name;
    const lowerName = (name || '').toLowerCase();
    playerCache.set(id, player);
    if (lowerName) {
      playerNameCache.set(lowerName, player);
      playerIdToName.set(id, lowerName);
    }
    refreshCachedPlayerList();
  } catch {
    // Player disconnected or invalidated concurrently
  }
}

/**
 * Removes a player from all cache lookups without accessing invalid player properties.
 *
 * @param playerId The entity identifier of the leaving player.
 */
export function removePlayerFromCache(playerId: string): void {
  const lowerName = playerIdToName.get(playerId);
  if (lowerName) {
    playerNameCache.delete(lowerName);
    playerIdToName.delete(playerId);
  }
  playerCache.delete(playerId);
  refreshCachedPlayerList();
}

/**
 * Retrieves all currently cached and valid online players.
 *
 * @returns Array of active mc.Player references.
 */
export function getAllPlayersFromCache(): mc.Player[] {
  return cachedPlayerList;
}

/**
 * Gets the total count of currently cached players.
 *
 * @returns Total number of entries in the active player cache.
 */
export function getPlayerCount(): number {
  return playerCache.size;
}

/**
 * Finds an online player by their case-insensitive display name.
 *
 * @param name The player name to resolve.
 * @returns The matching mc.Player reference if valid, otherwise undefined.
 */
export function findPlayerByName(name: string): mc.Player | undefined {
  const lower = name.toLowerCase();
  const player = playerNameCache.get(lower);
  if (!player) {
    return undefined;
  }
  if (player.isValid === false) {
    for (const [id, cached] of playerCache) {
      if (cached === player) {
        removePlayerFromCache(id);
        break;
      }
    }
    return undefined;
  }
  return player;
}
