import { getShopConfig, saveShopConfig } from './configurations.js';
import { debugLog } from './logger.js';
import { items } from './itemsConfig.js';

/**
 * Adds a new category to the shop.
 * @param {string} categoryName - The name for the new category.
 * @param {string} icon - The icon for the new category.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function addCategory(categoryName, icon) {
    const config = getShopConfig();
    if (config.categories[categoryName]) {
        return { success: false, message: `A category with the name '${categoryName}' already exists.` };
    }

    config.categories[categoryName] = {
        icon: icon || 'textures/ui/folder_glyph',
        items: {},
        subCategories: {}
    };

    saveShopConfig();
    debugLog(`[ShopAdminManager] Added new category: ${categoryName}`);
    return { success: true, message: `Successfully added category '${categoryName}'.` };
}

/**
 * Renames a category.
 * @param {string} oldCategoryName - The current name of the category.
 * @param {string} newCategoryName - The new name for the category.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function renameCategory(oldCategoryName, newCategoryName) {
    const config = getShopConfig();
    if (!config.categories[oldCategoryName]) {
        return { success: false, message: `Category '${oldCategoryName}' not found.` };
    }
    if (config.categories[newCategoryName]) {
        return { success: false, message: `A category with the name '${newCategoryName}' already exists.` };
    }

    config.categories[newCategoryName] = config.categories[oldCategoryName];
    delete config.categories[oldCategoryName];

    saveShopConfig();
    debugLog(`[ShopAdminManager] Renamed category from '${oldCategoryName}' to '${newCategoryName}'.`);
    return { success: true, message: `Successfully renamed category to '${newCategoryName}'.` };
}

/**
 * Deletes a category from the shop.
 * @param {string} categoryName - The name of the category to delete.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function deleteCategory(categoryName) {
    const config = getShopConfig();
    if (!config.categories[categoryName]) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    delete config.categories[categoryName];
    saveShopConfig();
    debugLog(`[ShopAdminManager] Deleted category: ${categoryName}`);
    return { success: true, message: `Successfully deleted category '${categoryName}'.` };
}

/**
 * Adds a new subcategory to a category.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} subCategoryName - The name for the new subcategory.
 * @param {string} icon - The icon for the new subcategory.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function addSubCategory(categoryName, subCategoryName, icon) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (category.subCategories[subCategoryName]) {
        return { success: false, message: `A subcategory with the name '${subCategoryName}' already exists in '${categoryName}'.` };
    }

    category.subCategories[subCategoryName] = {
        icon: icon || 'textures/ui/folder_glyph',
        items: {}
    };

    saveShopConfig();
    debugLog(`[ShopAdminManager] Added new subcategory '${subCategoryName}' to '${categoryName}'.`);
    return { success: true, message: `Successfully added subcategory '${subCategoryName}'.` };
}

/**
 * Renames a subcategory.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} oldSubCategoryName - The current name of the subcategory.
 * @param {string} newSubCategoryName - The new name for the subcategory.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function renameSubCategory(categoryName, oldSubCategoryName, newSubCategoryName) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!category.subCategories[oldSubCategoryName]) {
        return { success: false, message: `Subcategory '${oldSubCategoryName}' not found in '${categoryName}'.` };
    }
    if (category.subCategories[newSubCategoryName]) {
        return { success: false, message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.` };
    }

    category.subCategories[newSubCategoryName] = category.subCategories[oldSubCategoryName];
    delete category.subCategories[oldSubCategoryName];

    saveShopConfig();
    debugLog(`[ShopAdminManager] Renamed subcategory from '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`);
    return { success: true, message: `Successfully renamed subcategory to '${newSubCategoryName}'.` };
}

/**
 * Deletes a subcategory from a category.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} subCategoryName - The name of the subcategory to delete.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function deleteSubCategory(categoryName, subCategoryName) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!category.subCategories[subCategoryName]) {
        return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
    }

    delete category.subCategories[subCategoryName];
    saveShopConfig();
    debugLog(`[ShopAdminManager] Deleted subcategory '${subCategoryName}' from '${categoryName}'.`);
    return { success: true, message: `Successfully deleted subcategory '${subCategoryName}'.` };
}

/**
 * Adds or updates an item in the shop.
 * @param {string} categoryName - The name of the category.
 * @param {string|null} subCategoryName - The name of the subcategory, or null for the main category.
 * @param {string} itemId - The ID of the item to add/update.
 * @param {object} itemData - The data for the item (buyPrice, sellPrice, permissionLevel).
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function setItem(categoryName, subCategoryName, itemId, itemData) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer = category;
    if (subCategoryName) {
        targetContainer = category.subCategories[subCategoryName];
        if (!targetContainer) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
        }
    }

    targetContainer.items[itemId] = {
        buyPrice: itemData.buyPrice,
        sellPrice: itemData.sellPrice,
        permissionLevel: itemData.permissionLevel,
        icon: itemData.icon,
        displayName: itemData.displayName
    };

    saveShopConfig();
    debugLog(`[ShopAdminManager] Set item '${itemId}' in '${categoryName}/${subCategoryName || ''}'.`);
    return { success: true, message: `Successfully set item '${itemId}'.` };
}

/**
 * Adds a custom item to the in-memory items config.
 * @param {string} itemId - The unique ID for the new item.
 * @param {object} itemData - The data for the new item.
 * @returns {{success: boolean, message: string}}
 */
export function addCustomItemToConfig(itemId, itemData) {
    if (items[itemId]) {
        return { success: false, message: `An item with the ID '${itemId}' already exists.` };
    }
    items[itemId] = {
        itemId: itemData.itemId,
        icon: itemData.icon,
        buyPrice: itemData.buyPrice,
        sellPrice: itemData.sellPrice,
        displayName: itemData.displayName,
        category: 'Custom'
    };
    return { success: true, message: 'Custom item added to in-memory config.' };
}

/**
 * Removes an item from the shop.
 * @param {string} categoryName - The name of the category.
 * @param {string|null} subCategoryName - The name of the subcategory, or null for the main category.
 * @param {string} itemId - The ID of the item to remove.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function removeItem(categoryName, subCategoryName, itemId) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer = category;
    if (subCategoryName) {
        targetContainer = category.subCategories[subCategoryName];
        if (!targetContainer) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
        }
    }

    if (!targetContainer.items[itemId]) {
        return { success: false, message: `Item '${itemId}' not found.` };
    }

    delete targetContainer.items[itemId];
    saveShopConfig();
    debugLog(`[ShopAdminManager] Removed item '${itemId}' from '${categoryName}/${subCategoryName || ''}'.`);
    return { success: true, message: `Successfully removed item '${itemId}'.` };
}
