import { world } from '@minecraft/server';
import { deepMerge, deepClone, setValueByPath, mergeRanks, mergeObjectMaps } from './objectUtils.js';
import { errorLog, debugLog } from './logger.js';

/**
 * Creates a configuration manager for a specific configuration type.
 * This version uses synchronous initialization to prevent race conditions.
 * @param {string} key The dynamic property key for this configuration.
 * @param {object | Array} defaultConfig The default configuration object, imported directly.
 * @param {string} name The name of the configuration for logging purposes.
 * @param {string | null} wrapperKey If provided, the default config data will be wrapped in an object with this key.
 * @returns {object} An object with methods to manage the configuration.
 */
function createConfigManager(key, defaultConfig, name, wrapperKey = null) {
    const lastLoadedKey = `${key}:last_loaded`;

    // The wrapperKey logic is handled here during initialization. This ensures that configs
    // like 'ranks', which are stored as an array in their file, are correctly structured
    // as an object (e.g., { rankDefinitions: [...] }) from the very beginning.
    const initialDefaultConfig = wrapperKey
        ? { [wrapperKey]: deepClone(defaultConfig) }
        : deepClone(defaultConfig);

    // Initialize currentConfig with a deep clone of the default.
    // This is the core of the fix: `currentConfig` is never null.
    let currentConfig = deepClone(initialDefaultConfig);
    let lastLoadedConfig = null;

    function saveLastLoadedConfig() {
        try {
            world.setDynamicProperty(lastLoadedKey, JSON.stringify(lastLoadedConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    function loadConfig(isMigration) {
        const newDefaultConfig = initialDefaultConfig;
        let isFirstInit = false;

        const userSavedConfigStr = world.getDynamicProperty(key);
        const lastLoadedConfigStr = world.getDynamicProperty(lastLoadedKey);

        if (!userSavedConfigStr) {
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            lastLoadedConfig = newDefaultConfig;
            errorLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            saveLastLoadedConfig();
        } else {
            let userSavedConfig;
            try {
                userSavedConfig = JSON.parse(userSavedConfigStr);
            } catch (e) {
                errorLog(`[${name}ConfigManager] Failed to parse user-saved config. It will be reset.`, e);
                userSavedConfig = newDefaultConfig;
            }

            if (name === 'Main' && userSavedConfig.spawnLocation && typeof userSavedConfig.spawnLocation === 'object') {
                debugLog(`[${name}ConfigManager] Migrating legacy spawnLocation to spawn.spawnLocation.`);
                if (!userSavedConfig.spawn) {userSavedConfig.spawn = {};}
                if (!userSavedConfig.spawn.spawnLocation) {
                    userSavedConfig.spawn.spawnLocation = deepClone(userSavedConfig.spawnLocation);
                }
                delete userSavedConfig.spawnLocation;
            }

            currentConfig = deepMerge(newDefaultConfig, userSavedConfig);

            if (!isMigration && lastLoadedConfigStr) {
                try {
                    lastLoadedConfig = JSON.parse(lastLoadedConfigStr);

                    if (name === 'Ranks') {
                        const mergedRanks = mergeRanks(
                            userSavedConfig.rankDefinitions,
                            newDefaultConfig.rankDefinitions,
                            lastLoadedConfig?.rankDefinitions || []
                        );
                        currentConfig = { ...userSavedConfig, rankDefinitions: mergedRanks };
                    } else if (name === 'Kits' || name === 'Shop') {
                        currentConfig = mergeObjectMaps(userSavedConfig, newDefaultConfig, lastLoadedConfig || {});
                    }
                } catch (e) {
                    errorLog(`[${name}ConfigManager] Failed to parse last-loaded config. Using default merge.`, e);
                }
            } else if (!isMigration) {
                debugLog(`[${name}ConfigManager] No last-loaded config found. Using default merge.`);
            }

            lastLoadedConfig = newDefaultConfig;
            saveLastLoadedConfig();
        }

        saveConfig();
        return isFirstInit;
    }

    function getConfig() {
        return currentConfig;
    }

    function saveConfig() {
        try {
            world.setDynamicProperty(key, JSON.stringify(currentConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save current config.`, e);
        }
    }

    function setConfig(newConfig) {
        currentConfig = newConfig;
        saveConfig();
    }

    function reloadConfig() {
        debugLog(`[${name}ConfigManager] Reloading configuration...`);
        loadConfig(false);
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateMultipleConfig(updates) {
        for (const path in updates) {
            setValueByPath(currentConfig, path, updates[path]);
        }
        saveConfig();
    }

    function resetConfig() {
        currentConfig = initialDefaultConfig;
        lastLoadedConfig = initialDefaultConfig;
        saveConfig();
        saveLastLoadedConfig();
        debugLog(`[${name}ConfigManager] Configuration has been reset to default.`);
    }

    return {
        load: loadConfig,
        get: getConfig,
        save: saveConfig,
        set: setConfig,
        reload: reloadConfig,
        updateMultiple: updateMultipleConfig,
        reset: resetConfig
    };
}

export default createConfigManager;
