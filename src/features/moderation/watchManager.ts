import { StorageManager } from '@core/storage/StorageManager.js';
import { isDefined } from '@lib/guards.js';

interface WatchRecord {
    id: string;
    name: string;
}

const storage = new StorageManager('exe:watchlist');
const watchedPlayers = new Map<string, string>();

export function initializeWatchManager() {
    const rawData = storage.load<WatchRecord[]>();
    if (isDefined(rawData)) {
        for (const record of rawData) {
            watchedPlayers.set(record.id, record.name);
        }
    }
}

export function saveWatchList() {
    const dataToSave: WatchRecord[] = [];
    for (const [id, name] of watchedPlayers) {
        dataToSave.push({ id, name });
    }
    storage.save(dataToSave);
}

export function toggleWatch(playerId: string, playerName: string): boolean {
    if (watchedPlayers.has(playerId)) {
        watchedPlayers.delete(playerId);
        saveWatchList();
        return false;
    } else {
        watchedPlayers.set(playerId, playerName);
        saveWatchList();
        return true;
    }
}

export function isWatched(playerId: string): boolean {
    return watchedPlayers.has(playerId);
}

export function getWatchedPlayers(): { id: string; name: string }[] {
    return Array.from(watchedPlayers.entries()).map(([id, name]) => ({ id, name }));
}
