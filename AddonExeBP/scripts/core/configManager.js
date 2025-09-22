import { world } from '@minecraft/server';
import { config as defaultConfig } from '../config.js';
import { errorLog } from './errorLogger.js';
import { deepClone, deepEqual, deepMerge, setValueByPath, reconcileConfig } from './objectUtils.js';
import { resetKitsConfig } from './kitsConfigManager.js';

const currentConfigKey = 'exe:config:current';
const lastLoadedConfigKey = 'exe:config:lastLoaded';

let currentConfig = null;
let lastLoadedConfig = null;

/**
 * Loads the addon's configurations from world dynamic properties.
 * This should only be called once at startup from main.js.
 * @returns {boolean} True if this is the first time the addon is being initialized.
 */
export function loadConfig() {
    const newDefaultConfig = deepMerge({}, defaultConfig);
    let isFirstInit = false;

    const userSavedConfigStr = world.getDynamicProperty(currentConfigKey);
    const oldDefaultConfigStr = world.getDynamicProperty(lastLoadedConfigKey);

    if (!userSavedConfigStr) {
        // Scenario: First-time initialization.
        isFirstInit = true;
        currentConfig = deepMerge({}, newDefaultConfig);
        errorLog('[ConfigManager] No saved config found. Initializing with default values.');
    } else {
        // Scenario: Subsequent startup. Load all configs.
        let userSavedConfig;
        let oldDefaultConfig;
        try {
            userSavedConfig = JSON.parse(userSavedConfigStr);
        } catch (e) {
            errorLog('[ConfigManager] Failed to parse user-saved config. It will be reset.', e);
            userSavedConfig = deepMerge({}, newDefaultConfig);
        }
        try {
            oldDefaultConfig = JSON.parse(oldDefaultConfigStr);
        } catch {
            errorLog('[ConfigManager] Could not parse last loaded config. Assuming it is the first load after an update.');
            oldDefaultConfig = null; // Treat as if the last version is unknown.
        }

        // Check for version change to determine which logic to use.
        if (!oldDefaultConfig || !deepEqual(oldDefaultConfig.version, newDefaultConfig.version)) {
            // Scenario: Addon has been updated (version is different).
            errorLog('[ConfigManager] Version mismatch detected. Migrating config.');
            // Preserve user's settings by merging them on top of the new defaults.
            currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
        } else {
            // Scenario: Same version, normal load.
            // Reconcile changes made directly to config.js file as per user's logic.
            currentConfig = reconcileConfig(newDefaultConfig, oldDefaultConfig, userSavedConfig);
        }
    }

    // After all logic, the 'last loaded' config must be updated to the new default structure
    // for the *next* startup's comparison.
    lastLoadedConfig = deepMerge({}, newDefaultConfig);

    saveCurrentConfig();
    saveLastLoadedConfig();

    return isFirstInit;
}

/**
 * Gets the currently active configuration.
 * @returns {object} The loaded configuration object.
 */
export function getConfig() {
    return currentConfig || defaultConfig;
}

/**
 * Saves the current config to its dynamic property.
 */
function saveCurrentConfig() {
    try {
        world.setDynamicProperty(currentConfigKey, JSON.stringify(currentConfig));
    } catch (e) {
        errorLog('[ConfigManager] Failed to save current config.', e);
    }
}

/**
 * Saves the last loaded config to its dynamic property.
 */
function saveLastLoadedConfig() {
    try {
        world.setDynamicProperty(lastLoadedConfigKey, JSON.stringify(lastLoadedConfig));
    } catch (e) {
        errorLog('[ConfigManager] Failed to save last loaded config.', e);
    }
}

/**
 * Updates a specific key in the configuration and saves it.
 * @param {string} key The configuration key to update.
 * @param {*} value The new value for the key.
 */
export function updateConfig(key, value) {
    if (!currentConfig) {
        loadConfig();
    }
    currentConfig[key] = value;
    saveCurrentConfig();
}

/**
 * Reloads the configuration based on the user's specified logic.
 */
export function reloadConfig() {
    // eslint-disable-next-line no-console
    console.log('[ConfigManager] Reloading configuration...');
    const newDefaultConfig = deepMerge({}, defaultConfig);

    // Reconcile the new file defaults with the last-known defaults and the current user settings.
    currentConfig = reconcileConfig(newDefaultConfig, lastLoadedConfig, currentConfig);

    // Update the last loaded config to the new default structure for the next comparison.
    lastLoadedConfig = deepMerge({}, newDefaultConfig);

    saveCurrentConfig();
    saveLastLoadedConfig();
    // eslint-disable-next-line no-console
    console.log('[ConfigManager] Configuration reloaded and reconciled.');
}

/**
 * Updates multiple keys in the configuration using path notation and saves once.
 * @param {Object.<string, any>} updates An object where keys are dot-notation paths and values are the new values.
 */
export function updateMultipleConfig(updates) {
    if (!currentConfig) {
        loadConfig();
    }
    for (const path in updates) {
        setValueByPath(currentConfig, path, updates[path]);
    }
    saveCurrentConfig();
}

/**
 * Resets a section of the configuration to its default values.
 * @param {string} sectionKey The key of the config section to reset (e.g., 'tpa', 'homes'). Use 'all' to reset everything.
 * @returns {{success: boolean, message: string}}
 */
export function resetConfigSection(sectionKey) {
    if (!currentConfig) {
        loadConfig();
    }

    if (sectionKey === 'all') {
        currentConfig = deepClone(defaultConfig);
        saveCurrentConfig();
        resetKitsConfig();
        return { success: true, message: 'All configuration settings have been reset to default.' };
    }

    if (sectionKey === 'kits') {
        resetKitsConfig();
        return { success: true, message: 'The \'kits\' configuration section has been reset to default.' };
    }

    if (Object.prototype.hasOwnProperty.call(defaultConfig, sectionKey)) {
        currentConfig[sectionKey] = deepClone(defaultConfig[sectionKey]);
        saveCurrentConfig();
        return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
    } else {
        return { success: false, message: `Configuration section '${sectionKey}' not found.` };
    }
}
