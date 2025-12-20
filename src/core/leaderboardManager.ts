import * as mc from '@minecraft/server';

import { getConfig } from './configManager.js';
import { debugLog, errorLog } from './logger.js';
import { clearTrackedInterval, setTrackedInterval } from './timerManager.js';

const leaderboardKey = 'exe:economyLeaderboard';

export interface LeaderboardEntry {
    playerId: string;
    name: string;
    balance: number;
}

let leaderboardCache: LeaderboardEntry[] = [];
let isLeaderboardDirty = false;
let saveIntervalId: number | null = null;

export function getLeaderboard(): LeaderboardEntry[] {
    return leaderboardCache;
}

function saveLeaderboardIfDirty() {
    if (!isLeaderboardDirty) return;
    try {
        mc.world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        isLeaderboardDirty = false;
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[LeaderboardManager] Failed to save leaderboard: ${stack}`);
    }
}

export function initializeLeaderboard() {
    try {
        const dataString = mc.world.getDynamicProperty(leaderboardKey) as string | undefined;
        if (dataString && typeof dataString === 'string') {
            leaderboardCache = JSON.parse(dataString) as LeaderboardEntry[];
            debugLog(`[LeaderboardManager] Loaded ${leaderboardCache.length} players into leaderboard cache.`);
        } else {
            leaderboardCache = [];
        }

        // Start periodic save loop (every 30 seconds)
        saveIntervalId = setTrackedInterval(saveLeaderboardIfDirty, 30 * 20);
    } catch (error: unknown) {
        const stack = error instanceof Error ? error.stack : String(error);
        errorLog(`[LeaderboardManager] Failed to load leaderboard from storage: ${stack}`);
        leaderboardCache = [];
    }
}

export function updateAndSaveLeaderboard(playerId: string, name: string, balance: number) {
    const config = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    const lowestBalanceOnBoard = leaderboardCache.length < cacheSize ? 0 : (leaderboardCache.at(-1)?.balance ?? 0);
    const existingIndex = leaderboardCache.findIndex((p) => p.playerId === playerId);
    const playerIsOnBoard = existingIndex !== -1;

    // Optimization: Skip if player is not on board AND their balance is too low to enter
    if (!playerIsOnBoard && balance <= lowestBalanceOnBoard) {
        return;
    }

    if (playerIsOnBoard) {
        const existingEntry = leaderboardCache[existingIndex];
        if (existingEntry && existingEntry.balance === balance) {
            return;
        } // No change in value
        leaderboardCache.splice(existingIndex, 1);
    }

    leaderboardCache.push({ playerId, name, balance });
    leaderboardCache = leaderboardCache.toSorted((a, b) => b.balance - a.balance);

    if (leaderboardCache.length > cacheSize) {
        leaderboardCache.length = cacheSize;
    }

    // Mark as dirty; the periodic loop will handle the save
    isLeaderboardDirty = true;
}

export function cleanupLeaderboardManager() {
    if (saveIntervalId !== null) {
        clearTrackedInterval(saveIntervalId);
        saveIntervalId = null;
    }
    // Attempt one final save before shutdown
    saveLeaderboardIfDirty();
    leaderboardCache = [];
    isLeaderboardDirty = false;
    debugLog('[LeaderboardManager] Cache cleared.');
}
