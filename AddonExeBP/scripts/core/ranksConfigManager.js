import { ranksConfig as defaultRanksConfig } from './ranksConfig.js';
import { errorLog } from './errorLogger.js';

let loadedRanksConfig = null;

/**
 * Loads the ranks configuration.
 * @param {boolean} forceReload - If true, re-imports the module.
 */
export async function loadRanksConfig(forceReload = false) {
    if (loadedRanksConfig && !forceReload) {
        return;
    }

    try {
        const module = await import('./ranksConfig.js?v=' + Date.now());
        loadedRanksConfig = module.ranksConfig;
        // eslint-disable-next-line no-console
        console.log('[RanksConfigManager] Successfully loaded/reloaded ranksConfig.js');
    } catch (e) {
        errorLog('[RanksConfigManager] Failed to reload ranksConfig.js. Using stale or default config.', e);
        if (!loadedRanksConfig) {
            loadedRanksConfig = defaultRanksConfig;
        }
    }
}

/**
 * Gets the currently loaded ranks configuration.
 * @returns {object}
 */
export function getRanksConfig() {
    if (!loadedRanksConfig) {
        // This should not happen in normal flow as main.js will call loadRanksConfig at startup.
        errorLog('[RanksConfigManager] getRanksConfig called before config was loaded!');
        return defaultRanksConfig;
    }
    return loadedRanksConfig;
}
