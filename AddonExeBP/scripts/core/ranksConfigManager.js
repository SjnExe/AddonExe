import { world } from '@minecraft/server';
import { rankDefinitions as defaultRanks } from './ranksConfig.js';
import { errorLog, debugLog } from './logger.js';
import { deepMerge } from './objectUtils.js';

const RANKS_CONFIG_KEY = 'exe:ranksConfig';

let currentRanksConfig = null;

/**
 * Loads the ranks configuration from world dynamic properties.
 * This should be called once at startup.
 * @param {boolean} isMigration - Indicates if this is a new version of the addon.
 */
export function loadRanksConfig(isMigration) {
    const newDefaultConfig = { rankDefinitions: deepMerge([], defaultRanks) };

    const userSavedConfigStr = world.getDynamicProperty(RANKS_CONFIG_KEY);

    if (!userSavedConfigStr) {
        currentRanksConfig = newDefaultConfig;
        debugLog('[RanksConfigManager] No saved ranks config found. Initializing with default values.');
    } else {
        let userSavedConfig;
        try {
            userSavedConfig = JSON.parse(userSavedConfigStr);
            // Basic validation to ensure it has the expected structure
            if (!userSavedConfig || !Array.isArray(userSavedConfig.rankDefinitions)) {
                throw new Error('Invalid or missing rankDefinitions array in saved config.');
            }
        } catch (e) {
            errorLog(`[RanksConfigManager] Failed to parse user-saved ranks config. It will be reset. Error: ${e.message}`);
            userSavedConfig = newDefaultConfig;
        }
        currentRanksConfig = userSavedConfig;

        if (isMigration) {
            debugLog('[RanksConfigManager] Addon update detected. Ranks config loaded.');
        }
    }
    saveRanksConfig();
}

/**
 * Gets the currently active ranks configuration.
 * @returns {{rankDefinitions: import('./ranksConfig.js').RankDefinition[]}}
 */
export function getRanksConfig() {
    if (!currentRanksConfig) {
        errorLog('[RanksConfigManager] Ranks config accessed before it was loaded. Loading now...');
        loadRanksConfig(false);
    }
    return currentRanksConfig;
}

/**
 * Saves the current ranks config to its dynamic property.
 */
export function saveRanksConfig() {
    if (!currentRanksConfig) {
        errorLog('[RanksConfigManager] Attempted to save ranks config before it was loaded.');
        return;
    }
    try {
        world.setDynamicProperty(RANKS_CONFIG_KEY, JSON.stringify(currentRanksConfig));
    } catch (e) {
        errorLog(`[RanksConfigManager] Failed to save current ranks config: ${e.stack}`);
    }
}

/**
 * Resets the ranks configuration to its default values.
 */
export function resetRanksConfig() {
    currentRanksConfig = { rankDefinitions: deepMerge([], defaultRanks) };
    saveRanksConfig();
    debugLog('[RanksConfigManager] Ranks config has been reset to default.');
}
