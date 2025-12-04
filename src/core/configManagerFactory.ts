import * as mc from '@minecraft/server';

import { errorLog, debugLog } from './logger.js';
import { deepMerge, deepClone, setValueByPath, mergeRanks, mergeObjectMaps, reconcileConfig } from './objectUtils.js';

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

    let currentConfig = deepClone(initialDefaultConfig);
    let lastLoadedConfig: T | null = null;

    function saveLastLoadedConfig() {
        try {
            mc.world.setDynamicProperty(lastLoadedKey, JSON.stringify(lastLoadedConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    function loadConfig(isMigration: boolean): boolean {
        debugLog(`[${name}ConfigManager] Starting to load config. Is migration: ${isMigration}`);
        const newDefaultConfig = initialDefaultConfig;
        let isFirstInit = false;

        const userSavedConfigStr = mc.world.getDynamicProperty(key) as string | undefined;
        const lastLoadedConfigStr = mc.world.getDynamicProperty(lastLoadedKey) as string | undefined;

        if (!userSavedConfigStr) {
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            lastLoadedConfig = newDefaultConfig;
            errorLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            saveLastLoadedConfig();
        } else {
            let userSavedConfig: Record<string, unknown>;
            try {
                userSavedConfig = JSON.parse(userSavedConfigStr) as Record<string, unknown>;
            } catch (e) {
                errorLog(`[${name}ConfigManager] Failed to parse user-saved config. It will be reset.`, e);
                userSavedConfig = newDefaultConfig as unknown as Record<string, unknown>;
            }

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

            if (!isMigration && lastLoadedConfigStr) {
                let lastLoadedConfigForMerge: Record<string, unknown> | null;
                try {
                    lastLoadedConfigForMerge = JSON.parse(lastLoadedConfigStr) as Record<string, unknown>;
                } catch (e) {
                    errorLog(`[${name}ConfigManager] Failed to parse last-loaded config. Using default merge.`, e);
                    lastLoadedConfigForMerge = null; // Fallback
                }

                if (lastLoadedConfigForMerge) {
                    debugLog(`[${name}ConfigManager] Found last-loaded config. Proceeding with reconciliation.`);
                    if (name === 'Main') {
                        currentConfig = reconcileConfig(
                            newDefaultConfig as unknown as Record<string, unknown>,
                            lastLoadedConfigForMerge,
                            userSavedConfig
                        ) as unknown as T;
                    } else if (name === 'Ranks') {
                        const mergedRanks = mergeRanks(
                            userSavedConfig.rankDefinitions as Record<string, unknown>[],
                            (newDefaultConfig as unknown as { rankDefinitions: Record<string, unknown>[] })
                                .rankDefinitions,
                            (lastLoadedConfigForMerge.rankDefinitions as Record<string, unknown>[]) || []
                        );
                        currentConfig = { ...userSavedConfig, rankDefinitions: mergedRanks } as unknown as T;
                    } else if (name === 'Kits' || name === 'Shop') {
                        currentConfig = mergeObjectMaps(
                            userSavedConfig,
                            newDefaultConfig as unknown as Record<string, unknown>,
                            lastLoadedConfigForMerge || {}
                        ) as unknown as T;
                    } else {
                        currentConfig = deepMerge(newDefaultConfig, userSavedConfig) as T;
                    }
                } else {
                    debugLog(
                        `[${name}ConfigManager] Last-loaded config was unparsable. Falling back to default merge.`
                    );
                    currentConfig = deepMerge(newDefaultConfig, userSavedConfig) as T;
                }
            } else {
                if (!isMigration) {
                    debugLog(`[${name}ConfigManager] No last-loaded config found. Using default merge.`);
                }
                currentConfig = deepMerge(newDefaultConfig, userSavedConfig) as T;
            }

            lastLoadedConfig = newDefaultConfig;
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
            mc.world.setDynamicProperty(key, JSON.stringify(currentConfig));
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setValueByPath(currentConfig as any, path, value);
        saveConfig();
    }

    function updateMultipleConfig(updates: Record<string, unknown>) {
        for (const path in updates) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setValueByPath(currentConfig as any, path, updates[path]);
        }
        saveConfig();
    }

    function resetConfig(): Promise<void> {
        currentConfig = initialDefaultConfig;
        lastLoadedConfig = initialDefaultConfig;
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
