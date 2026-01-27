import * as mc from '@minecraft/server';

import { isDefined } from '@lib/guards.js';
import { getConfig } from './configManager.js';
import { debugLog, infoLog } from './logger.js';
import { getAllPlayerData, isNameIdMapDirty, saveNameIdMap, savePlayerData } from './playerDataManager.js';
import { clearTrackedInterval, setTrackedInterval } from './timerManager.js';

let autoSaveIntervalId: number | undefined;

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
            // debugLog('[DataManager] Auto-save triggered by interval.');
            const wasAnythingSaved = saveAllData({ log: false }); // Don't spam logs for auto-saves
            if (wasAnythingSaved) {
                debugLog('[Auto-Save] Server data has been saved.');
            }
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

    if (log && anythingWasSaved) {
        debugLog('[DataManager] Data sync complete.');
    } else if (log) {
        debugLog('[DataManager] Data sync finished, no changes to save.');
    }
    return anythingWasSaved;
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
