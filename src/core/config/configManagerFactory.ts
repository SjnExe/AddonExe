import { StorageManager } from '@core/data/storageManager.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { deepClone, deepMerge, setValueByPath } from '@core/utils/objectUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

export interface ConfigManager<T = unknown> {
    load: (isMigration?: boolean) => boolean;
    get: () => T;
    save: () => void;
    set: (newConfig: T) => void;
    reload: () => void;
    update: (pathStr: string, value: unknown) => void;
    updateMultiple: (updates: Record<string, unknown>) => void;
    reset: () => Promise<void>;
}

export default function createConfigManager<T>(key: string, defaultConfig: T, name: string, wrapperKey: string | undefined = undefined): ConfigManager<T> {
    const initialDefaultConfig = (isNonEmptyString(wrapperKey) ? { [wrapperKey]: deepClone(defaultConfig) } : deepClone(defaultConfig)) as T;
    const configStorage = new StorageManager(key);

    let currentConfig = deepClone(initialDefaultConfig);

    function loadConfig(_isMigration = false): boolean {
        debugLog(`[${name}ConfigManager] Loading configuration...`);
        const freshDefaults = deepClone(initialDefaultConfig);
        const savedConfig = configStorage.load<Record<string, unknown>>();

        if (isDefined(savedConfig)) {
            if (name === 'Main' && isDefined(savedConfig.spawnLocation) && typeof savedConfig.spawnLocation === 'object') {
                if (!isDefined(savedConfig.spawn)) {
                    savedConfig.spawn = {};
                }
                const spawn = savedConfig.spawn as Record<string, unknown>;
                if (!isDefined(spawn.spawnLocation)) {
                    spawn.spawnLocation = deepClone(savedConfig.spawnLocation);
                }
                delete savedConfig.spawnLocation;
            }

            currentConfig = deepMerge(freshDefaults, savedConfig) as T;
            saveConfig();
            return false;
        }

        currentConfig = freshDefaults;
        saveConfig();
        return true;
    }

    function getConfig(): T {
        return currentConfig;
    }

    function saveConfig(): void {
        try {
            configStorage.save(currentConfig);
        } catch (error) {
            errorLog(`[${name}ConfigManager] Failed to save config.`, error);
        }
    }

    function setConfig(newConfig: T): void {
        currentConfig = newConfig;
        saveConfig();
    }

    function reloadConfig(): void {
        loadConfig(false);
    }

    function updateConfig(pathStr: string, value: unknown): void {
        setValueByPath(currentConfig, pathStr, value);
        saveConfig();
    }

    function updateMultipleConfig(updates: Record<string, unknown>): void {
        for (const pathStr in updates) {
            setValueByPath(currentConfig, pathStr, updates[pathStr]);
        }
        saveConfig();
    }

    function resetConfig(): Promise<void> {
        currentConfig = deepClone(initialDefaultConfig);
        saveConfig();
        debugLog(`[${name}ConfigManager] Configuration reset to default.`);
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
