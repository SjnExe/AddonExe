import * as mc from '@minecraft/server';

const playerCache = new Map<string, mc.Player>();
const playerNameCache = new Map<string, mc.Player>();

export function initializePlayerCache(): void {
    // Clear cache first to ensure no stale data on re-init
    playerCache.clear();
    playerNameCache.clear();
    for (const player of mc.world.getAllPlayers()) {
        playerCache.set(player.id, player);
        playerNameCache.set((player.name || "").toLowerCase(), player);
    }

    mc.world.afterEvents.playerSpawn.subscribe((event) => {
        const { player } = event;
        addPlayerToCache(player);
    });

    mc.world.afterEvents.playerLeave.subscribe((event) => {
        const { playerId } = event;
        removePlayerFromCache(playerId);
    });
}

export function getPlayerFromCache(playerId: string): mc.Player | undefined {
    return playerCache.get(playerId);
}

export function addPlayerToCache(player: mc.Player): void {
    playerCache.set(player.id, player);
    playerNameCache.set((player.name || "").toLowerCase(), player);
}

export function removePlayerFromCache(playerId: string): void {
    const player = playerCache.get(playerId);
    if (player) {
        playerNameCache.delete((player.name || "").toLowerCase());
        playerCache.delete(playerId);
    }
}

export function getAllPlayersFromCache(): mc.Player[] {
    return [...playerCache.values()];
}

export function getPlayerCount(): number {
    return playerCache.size;
}

export function findPlayerByName(name: string): mc.Player | undefined {
    return playerNameCache.get(name.toLowerCase());
}
