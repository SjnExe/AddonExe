import { world } from '@minecraft/server';
import { shopConfig as defaultShopConfig } from './shopConfig.js';
import { config as mainDefaultConfig } from '../config.js'; // Import main config
import { errorLog } from './errorLogger.js';
import { deepMerge } from './objectUtils.js';

const currentShopConfigKey = 'exe:shopConfig:current';
const lastLoadedShopConfigKey = 'exe:shopConfig:lastLoaded';

let currentShopConfig = null;

/**
 * Loads the shop configuration from world dynamic properties.
 * This should be called once at startup from main.js.
 */
export function loadShopConfig(isMigration) {
    const newDefaultConfig = deepMerge({}, defaultShopConfig);

    const userSavedConfigStr = world.getDynamicProperty(currentShopConfigKey);

    if (!userSavedConfigStr) {
        currentShopConfig = newDefaultConfig;
        errorLog('[ShopConfigManager] No saved shop config found. Initializing with default values.');
    } else {
        let userSavedConfig;
        try {
            userSavedConfig = JSON.parse(userSavedConfigStr);
        } catch (e) {
            errorLog('[ShopConfigManager] Failed to parse user-saved shop config. It will be reset.', e);
            userSavedConfig = newDefaultConfig;
        }

        if (isMigration && !userSavedConfig.categories) {
            errorLog('[ShopConfigManager] Old shop config format detected. Resetting to new default format.');
            currentShopConfig = newDefaultConfig;
        } else {
            currentShopConfig = userSavedConfig;
        }

        if (isMigration) {
            errorLog('[ShopConfigManager] Addon update detected based on main config version. Preserving existing shop settings.');
        }
    }

    saveShopConfig();
}

/**
 * Gets the currently active shop configuration.
 * @returns {object} The loaded shop configuration object.
 */
export function getShopConfig() {
    // If it's not loaded for some reason, load it.
    if (!currentShopConfig) {
        loadShopConfig();
    }
    return currentShopConfig;
}

/**
 * Saves the current shop config to its dynamic property.
 */
export function saveShopConfig() {
    if (!currentShopConfig) {
        errorLog('[ShopConfigManager] Attempted to save shop config before it was loaded.');
        return;
    }
    try {
        world.setDynamicProperty(currentShopConfigKey, JSON.stringify(currentShopConfig));
    } catch (e) {
        errorLog('[ShopConfigManager] Failed to save current shop config.', e);
    }
}

/**
 * Resets the shop configuration to its default values.
 */
export function resetShopConfig() {
    currentShopConfig = deepMerge({}, defaultShopConfig);
    saveShopConfig();
    errorLog('[ShopConfigManager] Shop config has been reset to default.');
}
