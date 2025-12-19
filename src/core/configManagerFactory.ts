import { debugLog, errorLog } from './logger.js';
import { deepClone, deepMerge, mergeObjectMaps, mergeRanks, reconcileConfig, setValueByPath } from './objectUtils.js';
import { StorageManager } from './storage/StorageManager.js';

/**
 * Creates a configuration manager for a specific configuration type.
 * This version uses synchronous initialization to prevent race conditions.
 * @param key The dynamic property key for this configuration.
 * @param defaultConfig The default configuration object, imported directly.
 * @param name The name of the configuration for logging purposes.
 * @param wrapperKey If provided, the default config data will be wrapped in an object with this key.
 * @returns An object with methods to manage the configuration.
 */
export interface ConfigManager<T = unknown> {
    load: (isMigration: boolean) => boolean;
    get: () => T;
    save: () => void;
    set: (newConfig: T) => void;
    reload: () => void;
    update: (path: string, value: unknown) => void;
    updateMultiple: (updates: Record<string, unknown>) => void;
    reset: () => Promise<void>;
}

export default function createConfigManager<T>(
    key: string,
    defaultConfig: T,
    name: string,
    wrapperKey: string | null = null
): ConfigManager<T> {
    const lastLoadedKey = `${key}:last_loaded`;

    const initialDefaultConfig = (
        wrapperKey ? { [wrapperKey]: deepClone(defaultConfig) } : deepClone(defaultConfig)
    ) as T;

    // Initialize Storage Managers for sharding support
    const configStorage = new StorageManager(key);
    const lastLoadedStorage = new StorageManager(lastLoadedKey);

    let currentConfig = deepClone(initialDefaultConfig);
    let lastLoadedConfig: T | null = null;

    function saveLastLoadedConfig() {
        try {
            lastLoadedStorage.save(lastLoadedConfig);
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    function loadConfig(isMigration: boolean): boolean {
        debugLog(`[${name}ConfigManager] Starting to load config. Is migration: ${isMigration}`);
        const newDefaultConfig = initialDefaultConfig;
        let isFirstInit = false;

        // StorageManager automatically handles legacy single-property fallback
        const userSavedConfigLoaded = configStorage.load<Record<string, unknown>>();
        const lastLoadedConfigLoaded = lastLoadedStorage.load<Record<string, unknown>>();

        if (userSavedConfigLoaded) {
            // StorageManager returns the parsed object, no need to JSON.parse
            const userSavedConfig = userSavedConfigLoaded;

            if (name === 'Main' && userSavedConfig.spawnLocation && typeof userSavedConfig.spawnLocation === 'object') {
                debugLog(`[${name}ConfigManager] Migrating legacy spawnLocation to spawn.spawnLocation.`);
                if (!userSavedConfig.spawn) {
                    userSavedConfig.spawn = {};
                }
                const spawn = userSavedConfig.spawn as Record<string, unknown>;
                if (!spawn.spawnLocation) {
                    spawn.spawnLocation = deepClone(userSavedConfig.spawnLocation);
                }
                delete userSavedConfig.spawnLocation;
            }

            if (!isMigration && lastLoadedConfigLoaded) {
                const lastLoadedConfigForMerge = lastLoadedConfigLoaded;
                debugLog(`[${name}ConfigManager] Found last-loaded config. Proceeding with reconciliation.`);

                switch (name) {
                    case 'Main': {
                        currentConfig = reconcileConfig(
                            newDefaultConfig as unknown as Record<string, unknown>,
                            lastLoadedConfigForMerge,
                            userSavedConfig
                        ) as unknown as T;

                        break;
                    }
                    case 'Ranks': {
                        const mergedRanks = mergeRanks(
                            userSavedConfig.rankDefinitions as Record<string, unknown>[],
                            (newDefaultConfig as unknown as { rankDefinitions: Record<string, unknown>[] })
                                .rankDefinitions,
                            (lastLoadedConfigForMerge.rankDefinitions as Record<string, unknown>[]) || []
                        );
                        currentConfig = { ...userSavedConfig, rankDefinitions: mergedRanks } as unknown as T;

                        break;
                    }
                    case 'Kits':
                    case 'Shop': {
                        currentConfig = mergeObjectMaps(
                            userSavedConfig,
                            newDefaultConfig as unknown as Record<string, unknown>,
                            lastLoadedConfigForMerge || {}
                        ) as unknown as T;

                        break;
                    }
                    default: {
                        currentConfig = deepMerge(newDefaultConfig, userSavedConfig) as T;
                    }
                }
            } else {
                if (!isMigration) {
                    debugLog(`[${name}ConfigManager] No last-loaded config found (or migration). Using default merge.`);
                }
                currentConfig = deepMerge(newDefaultConfig, userSavedConfig) as T;
            }

            lastLoadedConfig = newDefaultConfig;
            saveLastLoadedConfig();
        } else {
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            lastLoadedConfig = newDefaultConfig;
            // Use infoLog instead of errorLog for initial setup to avoid confusing users
            if (name === 'Main') {
                debugLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            } else {
                debugLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            }
            saveLastLoadedConfig();
        }

        saveConfig();
        debugLog(`[${name}ConfigManager] Config loading finished.`);
        return isFirstInit;
    }

    function getConfig(): T {
        return currentConfig;
    }

    function saveConfig() {
        try {
            configStorage.save(currentConfig);
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save current config.`, e);
        }
    }

    function setConfig(newConfig: T) {
        currentConfig = newConfig;
        saveConfig();
    }

    function reloadConfig() {
        debugLog(`[${name}ConfigManager] Reloading configuration...`);
        loadConfig(false);
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateConfig(path: string, value: unknown) {
        setValueByPath(currentConfig as unknown as Record<string, unknown>, path, value);
        saveConfig();
    }

    function updateMultipleConfig(updates: Record<string, unknown>) {
        for (const path in updates) {
            setValueByPath(currentConfig as unknown as Record<string, unknown>, path, updates[path]);
        }
        saveConfig();
    }

    function resetConfig(): Promise<void> {
        currentConfig = initialDefaultConfig;
        lastLoadedConfig = initialDefaultConfig;
        // save() handles sharding automatically
        saveConfig();
        saveLastLoadedConfig();
        debugLog(`[${name}ConfigManager] Configuration has been reset to default.`);
        return Promise.resolve();
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
