import { world } from '@minecraft/server';
import { kitsConfig as defaultKitsConfig } from './kitsConfig.js';
import { config as mainDefaultConfig } from '../config.js';
import { errorLog } from './errorLogger.js';
import { deepMerge } from './objectUtils.js';

const currentKitsConfigKey = 'exe:kitsConfig:current';
const lastLoadedKitsConfigKey = 'exe:kitsConfig:lastLoaded';

let currentKitsConfig = null;

/**
 * Loads the kits configuration from world dynamic properties.
 * This should be called once at startup from main.js.
 */
export function loadKitsConfig() {
    const newDefaultConfig = deepMerge({}, defaultKitsConfig);

    const userSavedConfigStr = world.getDynamicProperty(currentKitsConfigKey);
    const lastLoadedConfigStr = world.getDynamicProperty(lastLoadedKitsConfigKey);

    if (!userSavedConfigStr) {
        // Scenario: First-time initialization for the kits.
        currentKitsConfig = deepMerge({}, newDefaultConfig);
        errorLog('[KitsConfigManager] No saved kits config found. Initializing with default values.');
    } else {
        // Scenario: Subsequent startup. Load the user's saved config.
        let userSavedConfig;
        try {
            userSavedConfig = JSON.parse(userSavedConfigStr);
        } catch (e) {
            errorLog('[KitsConfigManager] Failed to parse user-saved kits config. It will be reset.', e);
            userSavedConfig = deepMerge({}, newDefaultConfig);
        }

        let lastLoadedMainConfig;
        try {
            lastLoadedMainConfig = lastLoadedConfigStr ? JSON.parse(lastLoadedConfigStr) : null;
        } catch {
            errorLog('[KitsConfigManager] Could not parse last loaded main config version.');
            lastLoadedMainConfig = null;
        }

        // The user's saved config is the source of truth.
        currentKitsConfig = userSavedConfig;

        // On addon update, we should merge in new kits from the default config
        // without overwriting existing, user-modified kits.
        if (!lastLoadedMainConfig || lastLoadedMainConfig.version !== mainDefaultConfig.version) {
            errorLog('[KitsConfigManager] Addon update detected. Merging new default kits into user config.');
            const mergedKitDefinitions = deepMerge(newDefaultConfig.kitDefinitions, userSavedConfig.kitDefinitions);
            currentKitsConfig.kitDefinitions = mergedKitDefinitions;
        }
    }

    const lastLoadedConfigToSave = { version: mainDefaultConfig.version };

    saveKitsConfig();

    try {
        world.setDynamicProperty(lastLoadedKitsConfigKey, JSON.stringify(lastLoadedConfigToSave));
    } catch (e) {
        errorLog('[KitsConfigManager] Failed to save last loaded kits config.', e);
    }
}

/**
 * Gets the currently active kits configuration.
 * @returns {object} The loaded kits configuration object.
 */
export function getKitsConfig() {
    if (!currentKitsConfig) {
        loadKitsConfig();
    }
    return currentKitsConfig;
}

/**
 * Saves the current kits config to its dynamic property.
 */
export function saveKitsConfig() {
    if (!currentKitsConfig) {
        errorLog('[KitsConfigManager] Attempted to save kits config before it was loaded.');
        return;
    }
    try {
        world.setDynamicProperty(currentKitsConfigKey, JSON.stringify(currentKitsConfig));
    } catch (e) {
        errorLog('[KitsConfigManager] Failed to save current kits config.', e);
    }
}
