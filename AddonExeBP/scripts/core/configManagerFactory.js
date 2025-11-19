import * as mc from '@minecraft/server';
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

    const initialDefaultConfig = wrapperKey
        ? { [wrapperKey]: deepClone(defaultConfig) }
        : deepClone(defaultConfig);

    let currentConfig = deepClone(initialDefaultConfig);
    let lastLoadedConfig = null;

    function saveLastLoadedConfig() {
        try {
            mc.world.setDynamicProperty(lastLoadedKey, JSON.stringify(lastLoadedConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    function loadConfig(isMigration) {
        const newDefaultConfig = initialDefaultConfig;
        let isFirstInit = false;

        const userSavedConfigStr = mc.world.getDynamicProperty(key);
        const lastLoadedConfigStr = mc.world.getDynamicProperty(lastLoadedKey);

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

            if (!isMigration && lastLoadedConfigStr) {
                let lastLoadedConfigForMerge;
                try {
                    lastLoadedConfigForMerge = JSON.parse(lastLoadedConfigStr);
                } catch (e) {
                    errorLog(`[${name}ConfigManager] Failed to parse last-loaded config. Using default merge.`, e);
                    currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                }

                if (lastLoadedConfigForMerge) {
                    if (name === 'Main') {
                        currentConfig = reconcileConfig(newDefaultConfig, lastLoadedConfigForMerge, userSavedConfig);
                    } else if (name === 'Ranks') {
                        const mergedRanks = mergeRanks(
                            userSavedConfig.rankDefinitions,
                            newDefaultConfig.rankDefinitions,
                            lastLoadedConfigForMerge?.rankDefinitions || []
                        );
                        currentConfig = { ...userSavedConfig, rankDefinitions: mergedRanks };
                    } else if (name === 'Kits' || name === 'Shop') {
                        currentConfig = mergeObjectMaps(userSavedConfig, newDefaultConfig, lastLoadedConfigForMerge || {});
                    } else {
                        currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                    }
                }
            } else {
                if (!isMigration) debugLog(`[${name}ConfigManager] No last-loaded config found. Using default merge.`);
                currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
            }

            lastLoadedConfig = newDefaultConfig;
            saveLastLoadedConfig();
        }

        // Always overwrite ownerPlayerNames with the one from the file to ensure file-based control.
        if (name === 'Main') {
            currentConfig.ownerPlayerNames = newDefaultConfig.ownerPlayerNames;
        }

        saveConfig();
        return isFirstInit;
    }

    function getConfig() {
        return currentConfig;
    }

    function saveConfig() {
        try {
            mc.world.setDynamicProperty(key, JSON.stringify(currentConfig));
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
        // We pass `false` to indicate this is not a migration.
        // This ensures the user's saved settings are preserved and merged with any new defaults.
        loadConfig(false);
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateConfig(path, value) {
        setValueByPath(currentConfig, path, value);
        saveConfig();
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
        update: updateConfig,
        updateMultiple: updateMultipleConfig,
        reset: resetConfig
    };
}

export default createConfigManager;
