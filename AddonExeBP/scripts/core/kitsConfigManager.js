import { world } from '@minecraft/server';
import { kitsConfig as defaultKitsConfig } from './kitsConfig.js';
import { errorLog } from './errorLogger.js';
import { debugLog } from './logger.js';
import { deepMerge, deepClone } from './objectUtils.js';

const currentKitsConfigKey = 'exe:kitsConfig:current';

let currentKitsConfig = null;

/**
 * Loads the kits configuration from world dynamic properties.
 * This should be called once at startup from main.js.
 */
export function loadKitsConfig(isMigration) {
    const newDefaultConfig = deepMerge({}, defaultKitsConfig);

    const userSavedConfigStr = world.getDynamicProperty(currentKitsConfigKey);

    if (!userSavedConfigStr) {
        currentKitsConfig = newDefaultConfig;
        errorLog('[KitsConfigManager] No saved kits config found. Initializing with default values.');
    } else {
        let userSavedConfig;
        try {
            userSavedConfig = JSON.parse(userSavedConfigStr);
        } catch (e) {
            errorLog('[KitsConfigManager] Failed to parse user-saved kits config. It will be reset.', e);
            userSavedConfig = newDefaultConfig;
        }

        currentKitsConfig = userSavedConfig;

        if (isMigration) {
            errorLog('[KitsConfigManager] Addon update detected. Merging new default kits into user config.');
            const userKits = userSavedConfig.kitDefinitions || {};
            const defaultKits = newDefaultConfig.kitDefinitions || {};
            for (const kitName in defaultKits) {
                if (!Object.prototype.hasOwnProperty.call(userKits, kitName)) {
                    userKits[kitName] = defaultKits[kitName];
                    debugLog(`[KitsConfigManager] Added new default kit: ${kitName}`);
                }
            }
            currentKitsConfig.kitDefinitions = userKits;
        }
    }

    saveKitsConfig();
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

/**
 * Resets the kits configuration to its default values.
 */
export function resetKitsConfig() {
    currentKitsConfig = deepClone(defaultKitsConfig);
    saveKitsConfig();
    debugLog('[KitsConfigManager] Kits configuration has been reset to default.');
}
