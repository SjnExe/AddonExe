import * as mc from '@minecraft/server';

const playerCache = new Map<string, mc.Player>();

export function initializePlayerCache(): void {
    for (const player of mc.world.getAllPlayers()) {
        playerCache.set(player.id, player);
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
}

export function removePlayerFromCache(playerId: string): void {
    playerCache.delete(playerId);
}

export function getAllPlayersFromCache(): mc.Player[] {
    return Array.from(playerCache.values());
}

export function findPlayerByName(name: string): mc.Player | undefined {
    const lowerCaseName = name.toLowerCase();
    for (const player of playerCache.values()) {
        if (player.name.toLowerCase() === lowerCaseName) {
            return player;
        }
    }
    return undefined;
}
