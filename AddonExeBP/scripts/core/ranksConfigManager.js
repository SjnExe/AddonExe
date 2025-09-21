import { rankDefinitions as defaultRankDefinitions } from './ranksConfig.js';
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
        const module = await import('./ranksConfig.js');
        loadedRanksConfig = { rankDefinitions: module.rankDefinitions };
        // eslint-disable-next-line no-console
        console.log('[RanksConfigManager] Successfully loaded/reloaded ranksConfig.js');
    } catch (e) {
        errorLog('[RanksConfigManager] Failed to reload ranksConfig.js. Using stale or default config.', e);
        if (!loadedRanksConfig) {
            loadedRanksConfig = { rankDefinitions: defaultRankDefinitions };
        }
    }
}

/**
 * Gets the currently loaded ranks configuration.
 * @returns {{rankDefinitions: import('./ranksConfig.js').RankDefinition[]}}
 */
export function getRanksConfig() {
    if (!loadedRanksConfig) {
        // This should not happen in normal flow as main.js will call loadRanksConfig at startup.
        errorLog('[RanksConfigManager] getRanksConfig called before config was loaded!');
        return { rankDefinitions: defaultRankDefinitions };
    }
    return loadedRanksConfig;
}
