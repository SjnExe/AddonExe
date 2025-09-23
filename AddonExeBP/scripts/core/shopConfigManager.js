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
export function loadShopConfig() {
    const newDefaultConfig = deepMerge({}, defaultShopConfig);

    const userSavedConfigStr = world.getDynamicProperty(currentShopConfigKey);
    const lastLoadedConfigStr = world.getDynamicProperty(lastLoadedShopConfigKey);

    if (!userSavedConfigStr) {
        // Scenario: First-time initialization for the shop.
        currentShopConfig = deepMerge({}, newDefaultConfig);
        errorLog('[ShopConfigManager] No saved shop config found. Initializing with default values.');
    } else {
        // Scenario: Subsequent startup. Load the user's saved config.
        let userSavedConfig;
        try {
            userSavedConfig = JSON.parse(userSavedConfigStr);
        } catch (e) {
            errorLog('[ShopConfigManager] Failed to parse user-saved shop config. It will be reset.', e);
            userSavedConfig = deepMerge({}, newDefaultConfig);
        }

        let lastLoadedMainConfig;
        try {
            // This might not exist on first load after this feature is added.
            lastLoadedMainConfig = lastLoadedConfigStr ? JSON.parse(lastLoadedConfigStr) : null;
        } catch {
            errorLog('[ShopConfigManager] Could not parse last loaded main config version.');
            lastLoadedMainConfig = null;
        }

        // The user's saved config is the source of truth.
        currentShopConfig = userSavedConfig;

        // Check for version change to see if the addon was updated, using the main config's version.
        if (!lastLoadedMainConfig || lastLoadedMainConfig.version !== mainDefaultConfig.version) {
            // Scenario: Addon has been updated.
            // We keep the user's config as is, preserving their shop setup.
            // The main purpose of this block is just to acknowledge the update.
            errorLog('[ShopConfigManager] Addon update detected based on main config version. Preserving existing shop settings.');
        }
    }

    // After all logic, the 'last loaded' config must be updated to the new default structure
    // for the *next* startup's comparison. This should store the main config version.
    const lastLoadedConfigToSave = { version: mainDefaultConfig.version };

    saveShopConfig();

    try {
        world.setDynamicProperty(lastLoadedShopConfigKey, JSON.stringify(lastLoadedConfigToSave));
    } catch (e) {
        errorLog('[ShopConfigManager] Failed to save last loaded shop config.', e);
    }
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
