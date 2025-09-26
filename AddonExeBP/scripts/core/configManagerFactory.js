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
    const lastLoadedKey = `${key}:last_loaded`;
    let currentConfig = null;
    let lastLoadedConfig = null;

    function saveLastLoadedConfig() {
        try {
            world.setDynamicProperty(lastLoadedKey, JSON.stringify(lastLoadedConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    function loadConfig(isMigration) {
        const newDefaultConfig = deepClone(defaultConfig);
        let isFirstInit = false;

        const userSavedConfigStr = world.getDynamicProperty(key);
        const lastLoadedConfigStr = world.getDynamicProperty(lastLoadedKey);

        if (!userSavedConfigStr) {
            // Scenario 1: First Initialization
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            lastLoadedConfig = newDefaultConfig;
            errorLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            saveLastLoadedConfig(); // Save the initial "last loaded" state
        } else {
            // Config exists, parse it
            let userSavedConfig;
            try {
                userSavedConfig = JSON.parse(userSavedConfigStr);
            } catch (e) {
                errorLog(`[${name}ConfigManager] Failed to parse user-saved config. It will be reset.`, e);
                userSavedConfig = newDefaultConfig;
            }

            if (isMigration) {
                // Scenario 2: Addon Update (Migration)
                errorLog(`[${name}ConfigManager] Version mismatch detected. Migrating config.`);
                currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                lastLoadedConfig = newDefaultConfig; // Post-migration, the file is the new source of truth
                saveLastLoadedConfig();
            } else {
                // Scenario 3: Standard Load / Reload
                if (!lastLoadedConfigStr) {
                    // Fallback for when lastLoaded doesn't exist yet (e.g., updating from an old version)
                    errorLog(`[${name}ConfigManager] No last-loaded config found. Treating as migration.`);
                    currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                    lastLoadedConfig = newDefaultConfig;
                } else {
                    try {
                        lastLoadedConfig = JSON.parse(lastLoadedConfigStr);
                    } catch (e) {
                        errorLog(`[${name}ConfigManager] Failed to parse last-loaded config. It will be reset.`, e);
                        lastLoadedConfig = newDefaultConfig; // Reset to default to be safe
                    }

                    // Start with a copy of the current in-game config
                    const mergedConfig = deepClone(userSavedConfig);

                    // Recursively compare file config with last loaded config
                    function applyFileChanges(path, fileObj, lastLoadedObj) {
                        if (!fileObj || typeof fileObj !== 'object') return;

                        for (const key in fileObj) {
                            if (!Object.prototype.hasOwnProperty.call(fileObj, key)) continue;

                            const currentPath = path ? `${path}.${key}` : key;
                            const fileValue = fileObj[key];
                            const lastLoadedValue = (lastLoadedObj && typeof lastLoadedObj === 'object') ? lastLoadedObj[key] : undefined;

                            if (typeof fileValue === 'object' && fileValue !== null && !Array.isArray(fileValue)) {
                                applyFileChanges(currentPath, fileValue, lastLoadedValue);
                            } else if (JSON.stringify(fileValue) !== JSON.stringify(lastLoadedValue)) {
                                debugLog(`[${name}ConfigManager] Config change detected for '${currentPath}'. Applying file value.`);
                                setValueByPath(mergedConfig, currentPath, fileValue);
                            }
                        }
                    }

                    applyFileChanges('', newDefaultConfig, lastLoadedConfig);
                    currentConfig = mergedConfig;
                    lastLoadedConfig = newDefaultConfig; // The file is now the last loaded reference
                }
                saveLastLoadedConfig();
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
        updateMultipleConfig({ [updateKey]: value });
    }

    function setConfig(newConfig) {
        currentConfig = newConfig;
        saveConfig();
    }

    function reloadConfig() {
        debugLog(`[${name}ConfigManager] Reloading configuration...`);
        loadConfig(false); // isMigration = false
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateMultipleConfig(updates) {
        for (const path in updates) {
            setValueByPath(currentConfig, path, updates[path]);
        }
        saveConfig();
    }

    function resetConfig() {
        currentConfig = deepClone(defaultConfig);
        lastLoadedConfig = deepClone(defaultConfig);
        saveConfig();
        saveLastLoadedConfig();
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