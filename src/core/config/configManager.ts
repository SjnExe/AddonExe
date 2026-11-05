import * as factoryModule from '@core/config/configManagerFactory.js';
import { ConfigManager } from '@core/config/configManagerFactory.js';
import { deepClone } from '@core/utils/objectUtils.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

import defaultConfig, { type config as Config } from '../../config.js';

let mainConfigManager: ConfigManager<typeof Config>;
const updateCallbacks: ((config: typeof Config) => void)[] = [];

/**
 * Registers a listener to be notified when the main server configuration changes.
 *
 * @param callback Callback receiving the updated configuration object.
 */
export function onConfigUpdated(callback: (config: typeof Config) => void): void {
  updateCallbacks.push(callback);
}

function notifyCallbacks(): void {
  if (isDefined(mainConfigManager)) {
    const config = mainConfigManager.get();
    for (const cb of updateCallbacks) {
      cb(config);
    }
  }
}

/**
 * Initializes the primary configuration manager and asynchronously triggers subsystem loads.
 *
 * @param isMigration Whether this initialization runs as part of a SemVer migration step.
 */
export async function initializeConfigManager(isMigration: boolean): Promise<void> {
  mainConfigManager = factoryModule.default('exe:config:current', defaultConfig, 'Main');
  mainConfigManager.load(isMigration);

  const configs = await import('@core/config/configurations.js');

  await Promise.all([
    configs.loadWorldProtectionConfig(isMigration),
    configs.loadShopConfig(isMigration),
    configs.loadRanksConfig(isMigration),
    configs.loadEconomyConfig(isMigration),
    configs.loadXrayConfig(isMigration),
    configs.loadTeamConfig(isMigration),
    configs.loadFriendConfig(isMigration),
    configs.loadSidebarConfig(isMigration),
    configs.loadAuctionHouseConfig(isMigration),
    configs.loadDailyRewardsConfig(isMigration),
    configs.loadLandClaimConfig(isMigration),
    configs.loadGamesConfig(isMigration),
    configs.loadWordleConfig(isMigration),
    Promise.resolve().then(() => configs.loadAnticheatConfig(isMigration)),
  ]);
}

export const getConfig = () => {
  if (!isDefined(mainConfigManager)) {
    throw new Error('[ConfigManager] Config manager not initialized.');
  }
  return mainConfigManager.get();
};

export const updateConfig = (key: string, value: unknown) => {
  if (isDefined(mainConfigManager)) {
    mainConfigManager.update(key, value);
    notifyCallbacks();
  }
};

export const reloadConfig = () => {
  if (isDefined(mainConfigManager)) {
    mainConfigManager.reload();
  }
};

/** Clears or resets the main config manager for test isolation. */
export function _clearMainConfigManagerForTest(): void {
  if (isDefined(mainConfigManager) && typeof mainConfigManager.set === 'function') {
    try {
      mainConfigManager.set(deepClone(defaultConfig));
    } catch {
      // Ignore if mock instance does not support set
    }
  }
}

/**
 * Updates multiple configuration keys at once in the main config manager and notifies listeners.
 *
 * @param updates A dictionary of config keys and their updated values.
 */
export const updateMultipleConfig = (updates: Record<string, unknown>) => {
  if (isDefined(mainConfigManager)) {
    mainConfigManager.updateMultiple(updates);
    notifyCallbacks();
  }
};

/**
 * Resets a configuration section or all configuration data back to default values.
 *
 * @param sectionKey The identifier of the configuration section to reset, or 'all'.
 * @param player Optional player entity requesting the configuration reset.
 * @returns An object indicating whether the reset succeeded and an accompanying user message.
 */
export async function resetConfigSection(
  sectionKey: string,
  player?: mc.Player,
): Promise<{ success: boolean; message: string }> {
  const { configResetRegistry, configResetCallbacks } = await import('@core/config/configurations.js');

  if (sectionKey === 'all') {
    const resetPromises = [mainConfigManager.reset()];
    for (const config of Object.values(configResetRegistry)) {
      resetPromises.push(config.reset());
    }
    await Promise.all(resetPromises);
    notifyCallbacks();

    for (const key in configResetCallbacks) {
      const cb = configResetCallbacks[key];
      if (isDefined(cb)) {
        cb(player);
      }
    }
    for (const key in configResetRegistry) {
      const entry = configResetRegistry[key];
      if (isDefined(entry) && isDefined(entry.postResetCallback)) {
        entry.postResetCallback(player);
      }
    }

    return {
      success: true,
      message: 'All configuration settings have been reset to default and systems reloaded.',
    };
  }

  if (isDefined(configResetRegistry[sectionKey])) {
    await configResetRegistry[sectionKey].reset();
    if (isDefined(configResetRegistry[sectionKey].postResetCallback)) {
      configResetRegistry[sectionKey].postResetCallback(player);
    }
    return { success: true, message: `${configResetRegistry[sectionKey].message} and reloaded.` };
  }

  try {
    const configRecord = defaultConfig as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(configRecord, sectionKey)) {
      updateConfig(sectionKey, deepClone(configRecord[sectionKey]));

      if (isDefined(configResetCallbacks[sectionKey])) {
        configResetCallbacks[sectionKey](player);
        return {
          success: true,
          message: `The '${sectionKey}' configuration has been reset and the system reloaded.`,
        };
      }

      return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
    }
    return { success: false, message: `Configuration section '${sectionKey}' not found.` };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to reset configuration section. Error: ${errorMessage}` };
  }
}

export { type config as Config } from '../../config.js';
