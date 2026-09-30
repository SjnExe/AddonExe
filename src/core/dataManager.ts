import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { debugLog, infoLog } from '@core/logger.js';
import { getAllPlayerData, isNameIdMapDirty, loadNameIdMap, saveNameIdMap, savePlayerData } from '@core/playerDataManager.js';
import { clearTrackedInterval, setTrackedInterval, setTrackedJob } from '@core/timerManager.js';
import { initializeLeaderboard } from '@features/economy/leaderboardManager.js';
import { isDefined } from '@lib/guards.js';

let autoSaveIntervalId: number | undefined;
const loadDataHandlers: Array<() => void> = [];
const saveDataHandlers: Array<() => void> = [];

export function restartAutoSave() {
    if (autoSaveIntervalId !== undefined) {
        clearTrackedInterval(autoSaveIntervalId);
        autoSaveIntervalId = undefined;
    }

    const config = getConfig();
    const autoSaveIntervalSeconds = (isDefined(config.data) ? config.data.autoSaveIntervalSeconds : undefined) ?? 300;

    if (autoSaveIntervalSeconds > 0) {
        const intervalTicks = autoSaveIntervalSeconds * 20; // 20 ticks/sec
        autoSaveIntervalId = setTrackedInterval(() => {
            setTrackedJob(saveAllDataJob({ log: false }));
        }, intervalTicks);
        debugLog(`[DataManager] Auto-save started. Interval: ${autoSaveIntervalSeconds}s`);
    } else {
        debugLog('[DataManager] Auto-save is disabled.');
    }
}

/**
 * Saves all "dirty" data to world properties.
 * This includes player data flagged with `needsSave` and the name-to-ID map if it has changed.
 * @param options
 * @param options.log - Whether to log the save event.
 * @returns True if any data was saved, false otherwise.
 */
export function saveAllData(options: { log?: boolean } = {}): boolean {
    const { log = true } = options;
    if (log) {
        debugLog('[DataManager] Starting data sync...');
    }

    let anythingWasSaved = false;

    // Save the player name-to-ID map if it's dirty
    if (isNameIdMapDirty === true) {
        saveNameIdMap(); // This function will log its own success
        anythingWasSaved = true;
    }

    // Save data for online players whose data is dirty
    const allPlayerData = getAllPlayerData();
    let savedPlayerCount = 0;
    for (const [playerId, playerData] of allPlayerData.entries()) {
        if (playerData.needsSave === true) {
            savePlayerData(playerId);
            savedPlayerCount++;
        }
    }

    if (savedPlayerCount > 0) {
        anythingWasSaved = true;
        if (log) {
            debugLog(`[DataManager] Saved data for ${savedPlayerCount} modified players.`);
        }
    }

    // Reports are saved immediately by the reportManager, so they are not needed here.
    for (const handler of saveDataHandlers) {
        handler();
    }

    if (log && anythingWasSaved) {
        debugLog('[DataManager] Data sync complete.');
    } else if (log) {
        debugLog('[DataManager] Data sync finished, no changes to save.');
    }
    return anythingWasSaved;
}

/**
 * Generator version of saveAllData for background processing across ticks via system.runJob.
 * Saves dirty name-to-ID map and modified player data incrementally without causing tick lag spikes.
 * @param options
 * @param options.log - Whether to log the save event.
 */
export function* saveAllDataJob(options: { log?: boolean } = {}): Generator<void, void, void> {
    const { log = true } = options;
    if (log) {
        debugLog('[DataManager] Starting background data sync job...');
    }

    let anythingWasSaved = false;

    if (isNameIdMapDirty === true) {
        saveNameIdMap();
        anythingWasSaved = true;
        yield;
    }

    const allPlayerData = getAllPlayerData();
    let savedPlayerCount = 0;
    for (const [playerId, playerData] of allPlayerData.entries()) {
        if (playerData.needsSave === true) {
            savePlayerData(playerId);
            savedPlayerCount++;
            yield;
        }
    }

    if (savedPlayerCount > 0) {
        anythingWasSaved = true;
        if (log) {
            debugLog(`[DataManager] Saved data for ${savedPlayerCount} modified players.`);
        }
    }

    for (const handler of saveDataHandlers) {
        handler();
    }
    yield;

    if (log && anythingWasSaved) {
        debugLog('[DataManager] Background data sync complete.');
    } else if (log) {
        debugLog('[DataManager] Background data sync finished, no changes to save.');
    }
}

/**
 * Initializes the data manager, including setting up the auto-saver.
 */
export function initializeDataManager() {
    restartAutoSave();

    // Add a handler to save all data before the script shuts down
    mc.system.beforeEvents.shutdown.subscribe(() => {
        infoLog('[DataManager] Shutdown detected. Attempting to save all data...');
        saveAllData({ log: true });
        infoLog('[DataManager] Final save attempt complete.');
    });
}

export function loadPersistentData() {
    loadNameIdMap();
    initializeLeaderboard();
    for (const handler of loadDataHandlers) {
        handler();
    }
}

export function registerDataLoader(handler: () => void) {
    loadDataHandlers.push(handler);
}

export function registerDataSaver(handler: () => void) {
    saveDataHandlers.push(handler);
}

export const dataManager = {
    initializeDataManager,
    restartAutoSave,
    saveAllData,
    saveAllDataJob,
    registerDataLoader,
    registerDataSaver
};
