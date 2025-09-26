import { world } from '@minecraft/server';
import { deepMerge, deepClone, setValueByPath } from './objectUtils.js';
import { errorLog } from './errorLogger.js';
import { debugLog } from './logger.js';

/**
 * Creates a configuration manager for a specific configuration type.
 * @param {string} key The dynamic property key for this configuration.
 * @param {string} configPath The path to the configuration module (e.g., '../config.js').
 * @param {string} name The name of the configuration for logging purposes.
 * @param {string} configKey The name of the exported config object within the module (e.g., 'config').
 * @param {string | null} wrapperKey If provided, the imported config data will be wrapped in an object with this key.
 * @returns {object} An object with methods to manage the configuration.
 */
function createConfigManager(key, configPath, name, configKey, wrapperKey = null) {
    const lastLoadedKey = `${key}:last_loaded`;
    let currentConfig = null;
    let lastLoadedConfig = null;

    async function _getDefaultConfig() {
        try {
            // Removed cache-busting query as it can be unreliable in this environment.
            const module = await import(configPath);
            if (!module[configKey]) {
                throw new Error(`Config key '${configKey}' not found in module ${configPath}`);
            }

            const configData = deepClone(module[configKey]);

            // If a wrapper key is provided, wrap the imported data in an object.
            // This is used for configs like 'ranks' which are stored as an array but need to be in an object.
            if (wrapperKey) {
                return { [wrapperKey]: configData };
            }

            return configData;
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to dynamically import config from ${configPath}.`, e);
            return {}; // Return empty object on failure to prevent crashes.
        }
    }

    function saveLastLoadedConfig() {
        try {
            world.setDynamicProperty(lastLoadedKey, JSON.stringify(lastLoadedConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    async function loadConfig(isMigration) {
        const newDefaultConfig = await _getDefaultConfig();
        let isFirstInit = false;

        const userSavedConfigStr = world.getDynamicProperty(key);
        const lastLoadedConfigStr = world.getDynamicProperty(lastLoadedKey);

        if (!userSavedConfigStr) {
            // Scenario 1: First Initialization
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            lastLoadedConfig = newDefaultConfig;
            errorLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            saveLastLoadedConfig();
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
                lastLoadedConfig = newDefaultConfig;
                saveLastLoadedConfig();
            } else {
                // Scenario 3: Standard Load / Reload
                if (!lastLoadedConfigStr) {
                    errorLog(`[${name}ConfigManager] No last-loaded config found. Treating as migration.`);
                    currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                    lastLoadedConfig = newDefaultConfig;
                } else {
                    try {
                        lastLoadedConfig = JSON.parse(lastLoadedConfigStr);
                    } catch (e) {
                        errorLog(`[${name}ConfigManager] Failed to parse last-loaded config. It will be reset.`, e);
                        lastLoadedConfig = newDefaultConfig;
                    }

                    const mergedConfig = deepClone(userSavedConfig);

                    function applyFileChanges(path, fileObj, lastLoadedObj) {
                        if (!fileObj || typeof fileObj !== 'object') {return;}
                        for (const objKey in fileObj) {
                            if (!Object.prototype.hasOwnProperty.call(fileObj, objKey)) {continue;}

                            const currentPath = path ? `${path}.${objKey}` : objKey;
                            const fileValue = fileObj[objKey];
                            const lastLoadedValue = (lastLoadedObj && typeof lastLoadedObj === 'object') ? lastLoadedObj[objKey] : undefined;

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
                    lastLoadedConfig = newDefaultConfig;
                }
                saveLastLoadedConfig();
            }
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

    function updateConfig(updateKey, value) {
        updateMultipleConfig({ [updateKey]: value });
    }

    function setConfig(newConfig) {
        currentConfig = newConfig;
        saveConfig();
    }

    async function reloadConfig() {
        debugLog(`[${name}ConfigManager] Reloading configuration...`);
        await loadConfig(false);
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateMultipleConfig(updates) {
        if (!currentConfig) {
            errorLog(`[${name}ConfigManager] Attempted to update config before it was loaded.`);
            return;
        }
        for (const path in updates) {
            setValueByPath(currentConfig, path, updates[path]);
        }
        saveConfig();
    }

    async function resetConfig() {
        const defaultConfig = await _getDefaultConfig();
        currentConfig = defaultConfig;
        lastLoadedConfig = defaultConfig;
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