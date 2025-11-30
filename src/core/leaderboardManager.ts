import * as mc from '@minecraft/server';

import { getConfig } from './configManager.js';
import { debugLog, errorLog } from './logger.js';
import { setTrackedTimeout } from './timerManager.js';

const leaderboardKey = 'exe:economyLeaderboard';

export interface LeaderboardEntry {
    playerId: string;
    name: string;
    balance: number;
}

let leaderboardCache: LeaderboardEntry[] = [];
let isLeaderboardDirty = false;
let isSaveOnCooldown = false;

export function getLeaderboard(): LeaderboardEntry[] {
    return leaderboardCache;
}

export function initializeLeaderboard() {
    try {
        const dataString = mc.world.getDynamicProperty(leaderboardKey) as string | undefined;
        if (dataString && typeof dataString === 'string') {
            leaderboardCache = JSON.parse(dataString);
            debugLog(`[LeaderboardManager] Loaded ${leaderboardCache.length} players into leaderboard cache.`);
            return;
        }
    } catch (e: unknown) {
        const stack = e instanceof Error ? e.stack : String(e);
        errorLog(`[LeaderboardManager] Failed to load leaderboard from storage: ${stack}`);
    }
    leaderboardCache = [];
}

function triggerLeaderboardSave() {
    if (isSaveOnCooldown) {
        isLeaderboardDirty = true;
        return;
    }
    try {
        mc.world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        isLeaderboardDirty = false;
        isSaveOnCooldown = true;
        setTrackedTimeout(() => {
            isSaveOnCooldown = false;
            if (isLeaderboardDirty) {
                triggerLeaderboardSave();
            }
        }, 30 * 20);
    } catch (e: unknown) {
        const stack = e instanceof Error ? e.stack : String(e);
        errorLog(`[LeaderboardManager] Failed to save leaderboard: ${stack}`);
    }
}

export function updateAndSaveLeaderboard(playerId: string, name: string, balance: number) {
    const config = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    const lowestBalanceOnBoard =
        leaderboardCache.length < cacheSize ? 0 : (leaderboardCache[leaderboardCache.length - 1]?.balance ?? 0);
    const existingIndex = leaderboardCache.findIndex((p) => p.playerId === playerId);
    const playerIsOnBoard = existingIndex !== -1;

    // Optimization: Skip if player is not on board AND their balance is too low to enter
    if (!playerIsOnBoard && balance <= lowestBalanceOnBoard) {
        return;
    }

    if (playerIsOnBoard) {
        if (leaderboardCache[existingIndex].balance === balance) {
            return;
        } // No change in value
        leaderboardCache.splice(existingIndex, 1);
    }

    leaderboardCache.push({ playerId, name, balance });
    leaderboardCache.sort((a, b) => b.balance - a.balance);

    if (leaderboardCache.length > cacheSize) {
        leaderboardCache.length = cacheSize;
    }
    triggerLeaderboardSave();
}

export function cleanupLeaderboardManager() {
    leaderboardCache = [];
    isLeaderboardDirty = false;
    isSaveOnCooldown = false;
    debugLog('[LeaderboardManager] Cache cleared.');
}
