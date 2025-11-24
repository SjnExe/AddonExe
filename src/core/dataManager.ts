import { getAllPlayerData, savePlayerData, isNameIdMapDirty, saveNameIdMap } from './playerDataManager.js';
import { getConfig } from './configManager.js';
import * as mc from '@minecraft/server';
import { debugLog } from './logger.js';
import { setTrackedInterval } from './timerManager.js';

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
    if (isNameIdMapDirty) {
        saveNameIdMap(); // This function will log its own success
        anythingWasSaved = true;
    }

    // Save data for online players whose data is dirty
    const allPlayerData = getAllPlayerData();
    let savedPlayerCount = 0;
    for (const [playerId, playerData] of allPlayerData.entries()) {
        if (playerData.needsSave) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = getConfig();
    const autoSaveIntervalSeconds = config.data?.autoSaveIntervalSeconds ?? 300;

    if (autoSaveIntervalSeconds > 0) {
        const intervalTicks = autoSaveIntervalSeconds * 20; // 20 ticks/sec
        // Use the tracked interval to ensure it's cleaned up on reload
        setTrackedInterval(() => {
            debugLog('[DataManager] Auto-save triggered by interval.');
            const wasAnythingSaved = saveAllData({ log: false }); // Don't spam logs for auto-saves
            if (wasAnythingSaved) {
                debugLog('[Auto-Save] Server data has been saved.');
            }
        }, intervalTicks);
        debugLog(`[DataManager] Auto-save enabled. Interval: ${autoSaveIntervalSeconds} seconds.`);
    } else {
        debugLog('[DataManager] Auto-save is disabled.');
    }

    // Add a handler to save all data before the script shuts down
    mc.system.beforeEvents.watchdogTerminate.subscribe(event => {
        // eslint-disable-next-line no-console
        console.log('[DataManager] Watchdog termination detected. Attempting to save all data...');
        event.cancel = false; // This is a best-effort save, we don't want to prevent termination
        saveAllData({ log: true });
        // eslint-disable-next-line no-console
        console.log('[DataManager] Final save attempt complete.');
    });
}
