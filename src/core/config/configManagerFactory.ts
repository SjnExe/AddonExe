import { StorageManager } from '@core/data/storageManager.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { deepClone, deepMerge, setValueByPath } from '@core/utils/objectUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

/** Configuration subsystem manager providing getters, setters, persistence, and reset capabilities. */
export interface ConfigManager<T = unknown> {
  load: (isMigration?: boolean) => boolean;
  get: () => T;
  save: () => boolean;
  set: (newConfig: T) => boolean;
  reload: () => void;
  update: (pathStr: string, value: unknown) => void;
  updateMultiple: (updates: Record<string, unknown>) => boolean;
  reset: () => Promise<void>;
}

/**
 * Factory creating a scoped configuration manager backed by StorageManager persistence.
 *
 * @param key Dynamic property key identifier for storage persistence.
 * @param defaultConfig Default configuration template.
 * @param name Diagnostic identifier name for debug logging.
 * @param wrapperKey Optional nested root property wrapper key.
 * @returns ConfigManager instance managing the given configuration.
 */
export default function createConfigManager<T>(
  key: string,
  defaultConfig: T,
  name: string,
  wrapperKey: string | undefined = undefined,
): ConfigManager<T> {
  const initialDefaultConfig = (
    isNonEmptyString(wrapperKey) ? { [wrapperKey]: deepClone(defaultConfig) } : deepClone(defaultConfig)
  ) as T;
  const configStorage = new StorageManager(key);

  let currentConfig = deepClone(initialDefaultConfig);

  function loadConfig(_isMigration = false): boolean {
    debugLog(`[${name}ConfigManager] Loading configuration...`);
    const freshDefaults = deepClone(initialDefaultConfig);
    const savedConfig = configStorage.load<Record<string, unknown>>();

    if (isDefined(savedConfig)) {
      if (name === 'Main') {
        if (isDefined(savedConfig.spawnLocation) && typeof savedConfig.spawnLocation === 'object') {
          if (!isDefined(savedConfig.spawn)) {
            savedConfig.spawn = {};
          }
          const spawn = savedConfig.spawn as Record<string, unknown>;
          if (!isDefined(spawn.spawnLocation)) {
            spawn.spawnLocation = deepClone(savedConfig.spawnLocation);
          }
          delete savedConfig.spawnLocation;
        }

        const playerInfo = savedConfig.playerInfo as Record<string, unknown> | undefined;
        if (isDefined(playerInfo) && typeof playerInfo === 'object') {
          const customJoinLeave = playerInfo.customJoinLeave as Record<string, unknown> | undefined;
          if (isDefined(customJoinLeave) && typeof customJoinLeave === 'object') {
            if (customJoinLeave.joinMessage === '§e{playerName} joined the game') {
              customJoinLeave.joinMessage = '§e{playerName}§r joined the game';
            }
            if (customJoinLeave.leaveMessage === '§e{playerName} left the game') {
              customJoinLeave.leaveMessage = '§e{playerName}§r left the game';
            }
          }
          if (
            playerInfo.welcomeMessage ===
            'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.'
          ) {
            playerInfo.welcomeMessage =
              'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.§r';
          }
          if (playerInfo.deathCoordsMessage === '§7You died at {x}, {y}, {z} in {dimensionId}.') {
            playerInfo.deathCoordsMessage = '§7You died at {x}, {y}, {z} in {dimensionId}.§r';
          }
        }
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

  function saveConfig(): boolean {
    try {
      return configStorage.save(currentConfig);
    } catch (error) {
      errorLog(`[${name}ConfigManager] Failed to save config.`, error);
      return false;
    }
  }

  function setConfig(newConfig: T): boolean {
    try {
      const saved = configStorage.save(newConfig);
      if (saved) {
        currentConfig = newConfig;
        return true;
      }
      return false;
    } catch (error) {
      errorLog(`[${name}ConfigManager] Failed to save config.`, error);
      return false;
    }
  }

  function reloadConfig(): void {
    loadConfig(false);
  }

  function updateConfig(pathStr: string, value: unknown): void {
    setValueByPath(currentConfig, pathStr, value);
    saveConfig();
  }

  function updateMultipleConfig(updates: Record<string, unknown>): boolean {
    const candidate = deepClone(currentConfig);
    for (const pathStr of Object.keys(updates)) {
      setValueByPath(candidate as Record<string, unknown>, pathStr, updates[pathStr]);
    }
    return setConfig(candidate);
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
    reset: resetConfig,
  };
}
