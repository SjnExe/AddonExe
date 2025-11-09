import * as mc from '@minecraft/server';

const playerCache = new Map();

export function initializePlayerCache() {
    for (const player of mc.world.getAllPlayers()) {
        playerCache.set(player.id, player);
    }
}

export function getPlayerFromCache(playerId) {
    return playerCache.get(playerId);
}

export function addPlayerToCache(player) {
    playerCache.set(player.id, player);
}

export function removePlayerFromCache(playerId) {
    playerCache.delete(playerId);
}

export function getAllPlayersFromCache() {
    return Array.from(playerCache.values());
}

export function findPlayerByName(name) {
    const lowerCaseName = name.toLowerCase();
    for (const player of playerCache.values()) {
        if (player.name.toLowerCase() === lowerCaseName) {
            return player;
        }
    }
    return undefined;
}
