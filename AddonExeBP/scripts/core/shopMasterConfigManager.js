import { items as defaultItemsConfig } from './itemsConfig.js';
import { shopCategoryIcons as defaultCategoryIcons, shopSubCategoryIcons as defaultSubCategoryIcons } from './shopCategoryConfig.js';
import { errorLog } from './errorLogger.js';

let loadedItemsConfig = null;
let loadedCategoryIcons = null;
let loadedSubCategoryIcons = null;

/**
 * Loads the static shop master configurations.
 * @param {boolean} forceReload - If true, re-imports the modules.
 */
export async function loadShopMasterConfigs(forceReload = false) {
    if (loadedItemsConfig && !forceReload) {
        return;
    }

    try {
        const itemsModule = await import('./itemsConfig.js');
        loadedItemsConfig = itemsModule.items;
        const categoryModule = await import('./shopCategoryConfig.js');
        loadedCategoryIcons = categoryModule.shopCategoryIcons;
        loadedSubCategoryIcons = categoryModule.shopSubCategoryIcons;
        // eslint-disable-next-line no-console
        console.log('[ShopMasterConfigManager] Successfully loaded/reloaded shop master configs.');
    } catch (e) {
        errorLog('[ShopMasterConfigManager] Failed to reload shop master configs. Using stale or default configs.', e);
        if (!loadedItemsConfig) {
            loadedItemsConfig = defaultItemsConfig;
            loadedCategoryIcons = defaultCategoryIcons;
            loadedSubCategoryIcons = defaultSubCategoryIcons;
        }
    }
}

export function getItemsConfig() {
    return loadedItemsConfig || defaultItemsConfig;
}

export function getCategoryIcons() {
    return loadedCategoryIcons || defaultCategoryIcons;
}

export function getSubCategoryIcons() {
    return loadedSubCategoryIcons || defaultSubCategoryIcons;
}
