import { world } from '@minecraft/server';
import { deepMerge, deepClone, setValueByPath } from './objectUtils.js';
import { errorLog } from './errorLogger.js';
import { debugLog } from './logger.js';

/**
 * Creates a configuration manager for a specific configuration type.
 * @param {string} key The dynamic property key for this configuration.
 * @param {object} defaultConfig The default configuration object.
 * @param {string} name The name of the configuration for logging purposes.
 * @returns {object} An object with methods to manage the configuration.
 */
function createConfigManager(key, defaultConfig, name) {
    let currentConfig = null;

    function loadConfig(isMigration) {
        const newDefaultConfig = deepMerge({}, defaultConfig);
        let isFirstInit = false;

        const userSavedConfigStr = world.getDynamicProperty(key);

        if (!userSavedConfigStr) {
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            errorLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
        } else {
            let userSavedConfig;
            try {
                userSavedConfig = JSON.parse(userSavedConfigStr);
            } catch (e) {
                errorLog(`[${name}ConfigManager] Failed to parse user-saved config. It will be reset.`, e);
                userSavedConfig = newDefaultConfig;
            }

            if (isMigration) {
                errorLog(`[${name}ConfigManager] Version mismatch detected. Migrating config.`);
                currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
            } else {
                currentConfig = userSavedConfig;
            }
        }

        saveConfig();
        return isFirstInit;
    }

    function getConfig() {
        return currentConfig || defaultConfig;
    }

    function saveConfig() {
        try {
            world.setDynamicProperty(key, JSON.stringify(currentConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save current config.`, e);
        }
    }

    function updateConfig(updateKey, value) {
        if (!currentConfig) {
            loadConfig(false);
        }
        currentConfig[updateKey] = value;
        saveConfig();
    }

    function setConfig(newConfig) {
        currentConfig = newConfig;
        saveConfig();
    }

    function reloadConfig() {
        debugLog(`[${name}ConfigManager] Reloading configuration...`);
        const newDefaultConfig = deepMerge({}, defaultConfig);
        currentConfig = deepMerge(newDefaultConfig, currentConfig);
        saveConfig();
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateMultipleConfig(updates) {
        if (!currentConfig) {
            loadConfig(false);
        }
        for (const path in updates) {
            setValueByPath(currentConfig, path, updates[path]);
        }
        saveConfig();
    }

    function resetConfig() {
        currentConfig = deepClone(defaultConfig);
        saveConfig();
        debugLog(`[${name}ConfigManager] Configuration has been reset to default.`);
    }

    return {
        load: loadConfig,
        get: getConfig,
        save: saveConfig,
        set: setConfig,
        update: updateConfig,
        reload: reloadConfig,
        updateMultiple: updateMultipleConfig,
        reset: resetConfig
    };
}

export default createConfigManager;