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
 * Edits a subcategory's name and icon.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} oldSubCategoryName - The current name of the subcategory.
 * @param {string} newSubCategoryName - The new name for the subcategory.
 * @param {string} newIcon - The new icon for the subcategory.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function editSubCategory(categoryName, oldSubCategoryName, newSubCategoryName, newIcon) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!category.subCategories[oldSubCategoryName]) {
        return { success: false, message: `Subcategory '${oldSubCategoryName}' not found in '${categoryName}'.` };
    }
    if (oldSubCategoryName !== newSubCategoryName && category.subCategories[newSubCategoryName]) {
        return { success: false, message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.` };
    }

    const subCategoryData = category.subCategories[oldSubCategoryName];
    subCategoryData.icon = newIcon;

    if (oldSubCategoryName !== newSubCategoryName) {
        category.subCategories[newSubCategoryName] = subCategoryData;
        delete category.subCategories[oldSubCategoryName];
    }

    saveShopConfig();
    debugLog(`[ShopAdminManager] Edited subcategory '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`);
    return { success: true, message: `Successfully edited subcategory '${newSubCategoryName}'.` };
}

/**
 * Edits a category's name and icon.
 * @param {string} oldCategoryName - The current name of the category.
 * @param {string} newCategoryName - The new name for the category.
 * @param {string} newIcon - The new icon for the category.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function editCategory(oldCategoryName, newCategoryName, newIcon) {
    const config = getShopConfig();
    if (!config.categories[oldCategoryName]) {
        return { success: false, message: `Category '${oldCategoryName}' not found.` };
    }
    if (oldCategoryName !== newCategoryName && config.categories[newCategoryName]) {
        return { success: false, message: `A category with the name '${newCategoryName}' already exists.` };
    }

    const categoryData = config.categories[oldCategoryName];
    categoryData.icon = newIcon;

    if (oldCategoryName !== newCategoryName) {
        config.categories[newCategoryName] = categoryData;
        delete config.categories[oldCategoryName];
    }

    saveShopConfig();
    debugLog(`[ShopAdminManager] Edited category '${oldCategoryName}' to '${newCategoryName}'.`);
    return { success: true, message: `Successfully edited category '${newCategoryName}'.` };
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
 * Adds an item from a player's hand to the shop.
 * Generates a unique ID and adds it to both the master item config and the shop config.
 * @param {import('@minecraft/server').ItemStack} itemStack The item stack from the player's hand.
 * @param {string} categoryName The category to add the item to.
 * @param {string|null} subCategoryName The subcategory to add the item to (optional).
 * @param {number} buyPrice The buying price of the item.
 * @param {number} sellPrice The selling price of the item.
 * @returns {{success: boolean, message: string, itemId?: string}} The result of the operation.
 */
export function addShopItemFromHand(itemStack, categoryName, subCategoryName, buyPrice, sellPrice) {
    if (!itemStack) {
        return { success: false, message: "You aren't holding anything." };
    }

    // 1. Generate a unique ID
    const baseId = itemStack.typeId.replace('minecraft:', '');
    let i = 1;
    let newId = `${baseId}_${i}`;
    while (items[newId]) {
        i++;
        newId = `${baseId}_${i}`;
    }

    // 2. Add to master item list (in memory)
    const newItemConfig = {
        itemId: itemStack.typeId,
        icon: `textures/items/${baseId}`, // Default icon path
        displayName: itemStack.nameTag || `item.${itemStack.typeId.replace(':', '.')}.name`,
        buyPrice: buyPrice,
        sellPrice: sellPrice
    };
    addCustomItemToConfig(newId, newItemConfig);
    debugLog(`[ShopAdminManager] Added new custom item '${newId}' to master list.`);

    // 3. Add to shop category/subcategory
    const shopItemData = {
        buyPrice,
        sellPrice,
        permissionLevel: 1024, // Default to everyone
        icon: newItemConfig.icon,
        displayName: newItemConfig.displayName
    };

    const setResult = setItem(categoryName, subCategoryName, newId, shopItemData);

    if (setResult.success) {
        return { success: true, message: `Successfully added '${newId}' to the shop.`, itemId: newId };
    } else {
        // Rollback the addition to the master list if adding to shop fails
        delete items[newId];
        return { success: false, message: `Failed to add item to shop: ${setResult.message}` };
    }
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

/**
 * Updates a shop item's details in both the shop config and the master item list.
 * @param {string} categoryName The category of the item.
 * @param {string|null} subCategoryName The subcategory of the item.
 * @param {string} itemId The ID of the item to update.
 * @param {object} newData The new data for the item.
 * @returns {{success: boolean, message: string}} The result of the operation.
 */
export function updateShopItem(categoryName, subCategoryName, itemId, newData) {
    // 1. Update the master item list (items.js)
    if (items[itemId]) {
        items[itemId].displayName = newData.displayName;
        items[itemId].itemId = newData.minecraftId;
        items[itemId].icon = newData.icon;
    } else {
        // This case should ideally not happen if the item was added correctly
        addCustomItemToConfig(itemId, {
            displayName: newData.displayName,
            itemId: newData.minecraftId,
            icon: newData.icon,
            buyPrice: newData.buyPrice,
            sellPrice: newData.sellPrice
        });
    }

    // 2. Update the shop-specific configuration (shop.json)
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer = category;
    if (subCategoryName) {
        targetContainer = category.subCategories[subCategoryName];
        if (!targetContainer) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found.` };
        }
    }

    if (!targetContainer.items[itemId]) {
        return { success: false, message: `Item '${itemId}' not found in shop config.` };
    }

    // Update shop-specific properties
    targetContainer.items[itemId].buyPrice = newData.buyPrice;
    targetContainer.items[itemId].sellPrice = newData.sellPrice;
    targetContainer.items[itemId].permissionLevel = newData.permissionLevel;
    // Also update denormalized data like icon and displayName for consistency
    targetContainer.items[itemId].icon = newData.icon;
    targetContainer.items[itemId].displayName = newData.displayName;

    saveShopConfig();
    debugLog(`[ShopAdminManager] Updated item '${itemId}' in shop and master list.`);
    return { success: true, message: `Successfully updated item '${itemId}'.` };
}
