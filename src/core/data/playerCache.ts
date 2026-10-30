import * as mc from '@minecraft/server';

const playerCache = new Map<string, mc.Player>();
const playerNameCache = new Map<string, mc.Player>();
let cachedPlayerList: mc.Player[] = [];

function refreshCachedPlayerList(): void {
  cachedPlayerList = [...playerCache.values()];
}

let isInitialized = false;

export function initializePlayerCache(): void {
  // Clear cache first to ensure no stale data on re-init
  playerCache.clear();
  playerNameCache.clear();
  for (const player of mc.world.getAllPlayers?.() ?? []) {
    playerCache.set(player.id, player);
    playerNameCache.set((player.name || '').toLowerCase(), player);
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

export function clearPlayerCache(): void {
  playerCache.clear();
  playerNameCache.clear();
  cachedPlayerList = [];
}

export function getPlayerFromCache(playerId: string): mc.Player | undefined {
  return playerCache.get(playerId);
}

export function addPlayerToCache(player: mc.Player): void {
  playerCache.set(player.id, player);
  playerNameCache.set((player.name || '').toLowerCase(), player);
  refreshCachedPlayerList();
}

export function removePlayerFromCache(playerId: string): void {
  const player = playerCache.get(playerId);
  if (player) {
    playerNameCache.delete((player.name || '').toLowerCase());
    playerCache.delete(playerId);
    refreshCachedPlayerList();
  }
}

export function getAllPlayersFromCache(): mc.Player[] {
  return cachedPlayerList;
}

export function getPlayerCount(): number {
  return playerCache.size;
}

export function findPlayerByName(name: string): mc.Player | undefined {
  return playerNameCache.get(name.toLowerCase());
}
