import * as mc from '@minecraft/server';

import { getShopConfig, saveShopConfig } from '@core/configurations.js';
import { debugLog } from '@core/logger.js';
import { generateDisplayName, resolveIcon, sanitizeString, validateInput } from '@core/utils.js';
import { items } from '@features/shop/itemsConfig.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

import { ShopCategory, ShopSubCategory } from '@features/shop/shopConfig.js';

interface ActionResult {
    success: boolean;
    message: string;
    itemId?: string;
}

interface ItemData {
    itemId: string;
    icon: string;
    displayName: string;
    buyPrice: number;
    sellPrice: number;
    permission?: string;
    category?: string;
    rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
}

interface UpdateItemData {
    displayName: string;
    itemId: string;
    icon: string;
    buyPrice: number;
    sellPrice: number;
    permission: string;
    rankOverrides?: Record<string, { buy: number; sell: number }>;
}

/**
 * Adds a new category to the shop.
 * @param categoryName - The name for the new category.
 * @param icon - The icon for the new category.
 * @returns The result of the operation.
 */
export function addCategory(categoryName: string, icon: string): ActionResult {
    if (!validateInput(categoryName, 32)) {
        return { success: false, message: 'Category name is too long (max 32).' };
    }
    const safeName = sanitizeString(categoryName, true);

    const config = getShopConfig();
    const categories = config.categories;
    if (isDefined(categories[safeName])) {
        return { success: false, message: `A category with the name '${safeName}' already exists.` };
    }

    categories[safeName] = {
        icon: isNonEmptyString(icon) ? icon : '',
        items: {},
        subCategories: {}
    };

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Added new category: ${categoryName}`);
    return { success: true, message: `Successfully added category '${categoryName}'.` };
}

/**
 * Edits a subcategory's name and icon.
 * @param categoryName - The name of the parent category.
 * @param oldSubCategoryName - The current name of the subcategory.
 * @param newSubCategoryName - The new name for the subcategory.
 * @param newIcon - The new icon for the subcategory.
 * @returns The result of the operation.
 */
export function editSubCategory(categoryName: string, oldSubCategoryName: string, newSubCategoryName: string, newIcon: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!isDefined(category.subCategories[oldSubCategoryName])) {
        return { success: false, message: `Subcategory '${oldSubCategoryName}' not found in '${categoryName}'.` };
    }
    if (oldSubCategoryName !== newSubCategoryName && isDefined(category.subCategories[newSubCategoryName])) {
        return {
            success: false,
            message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.`
        };
    }

    const subCategoryData = category.subCategories[oldSubCategoryName];
    subCategoryData.icon = newIcon;

    if (oldSubCategoryName !== newSubCategoryName) {
        category.subCategories[newSubCategoryName] = subCategoryData;
        delete category.subCategories[oldSubCategoryName];
    }

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Edited subcategory '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`);
    return { success: true, message: `Successfully edited subcategory '${newSubCategoryName}'.` };
}

/**
 * Edits a category's name and icon.
 * @param oldCategoryName - The current name of the category.
 * @param newCategoryName - The new name for the category.
 * @param newIcon - The new icon for the category.
 * @returns The result of the operation.
 */
export function editCategory(oldCategoryName: string, newCategoryName: string, newIcon: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    if (!isDefined(categories[oldCategoryName])) {
        return { success: false, message: `Category '${oldCategoryName}' not found.` };
    }
    if (oldCategoryName !== newCategoryName && isDefined(categories[newCategoryName])) {
        return { success: false, message: `A category with the name '${newCategoryName}' already exists.` };
    }

    const categoryData = categories[oldCategoryName];
    categoryData.icon = newIcon;

    if (oldCategoryName !== newCategoryName) {
        categories[newCategoryName] = categoryData;
        delete categories[oldCategoryName];
    }

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Edited category '${oldCategoryName}' to '${newCategoryName}'.`);
    return { success: true, message: `Successfully edited category '${newCategoryName}'.` };
}

/**
 * Renames a category.
 * @param oldCategoryName - The current name of the category.
 * @param newCategoryName - The new name for the category.
 * @returns The result of the operation.
 */
export function renameCategory(oldCategoryName: string, newCategoryName: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    if (!isDefined(categories[oldCategoryName])) {
        return { success: false, message: `Category '${oldCategoryName}' not found.` };
    }
    if (isDefined(categories[newCategoryName])) {
        return { success: false, message: `A category with the name '${newCategoryName}' already exists.` };
    }

    categories[newCategoryName] = categories[oldCategoryName];
    delete categories[oldCategoryName];

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Renamed category from '${oldCategoryName}' to '${newCategoryName}'.`);
    return { success: true, message: `Successfully renamed category to '${newCategoryName}'.` };
}

/**
 * Deletes a category from the shop.
 * @param categoryName - The name of the category to delete.
 * @returns The result of the operation.
 */
export function deleteCategory(categoryName: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    if (!isDefined(categories[categoryName])) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    delete categories[categoryName];
    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Deleted category: ${categoryName}`);
    return { success: true, message: `Successfully deleted category '${categoryName}'.` };
}

/**
 * Adds a new subcategory to a category.
 * @param categoryName - The name of the parent category.
 * @param subCategoryName - The name for the new subcategory.
 * @param icon - The icon for the new subcategory.
 * @returns The result of the operation.
 */
export function addSubCategory(categoryName: string, subCategoryName: string, icon: string): ActionResult {
    if (!validateInput(subCategoryName, 32)) {
        return { success: false, message: 'Subcategory name is too long (max 32).' };
    }
    const safeName = sanitizeString(subCategoryName, true);

    const config = getShopConfig();
    const categories = config.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (isDefined(category.subCategories[safeName])) {
        return {
            success: false,
            message: `A subcategory with the name '${safeName}' already exists in '${categoryName}'.`
        };
    }

    category.subCategories[safeName] = {
        icon: isNonEmptyString(icon) ? icon : '',
        items: {}
    };

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Added new subcategory '${subCategoryName}' to '${categoryName}'.`);
    return { success: true, message: `Successfully added subcategory '${subCategoryName}'.` };
}

/**
 * Renames a subcategory.
 * @param categoryName - The name of the parent category.
 * @param oldSubCategoryName - The current name of the subcategory.
 * @param newSubCategoryName - The new name for the subcategory.
 * @returns The result of the operation.
 */
export function renameSubCategory(categoryName: string, oldSubCategoryName: string, newSubCategoryName: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!isDefined(category.subCategories[oldSubCategoryName])) {
        return { success: false, message: `Subcategory '${oldSubCategoryName}' not found in '${categoryName}'.` };
    }
    if (isDefined(category.subCategories[newSubCategoryName])) {
        return {
            success: false,
            message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.`
        };
    }

    category.subCategories[newSubCategoryName] = category.subCategories[oldSubCategoryName];
    delete category.subCategories[oldSubCategoryName];

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Renamed subcategory from '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`);
    return { success: true, message: `Successfully renamed subcategory to '${newSubCategoryName}'.` };
}

/**
 * Deletes a subcategory from a category.
 * @param categoryName - The name of the parent category.
 * @param subCategoryName - The name of the subcategory to delete.
 * @returns The result of the operation.
 */
export function deleteSubCategory(categoryName: string, subCategoryName: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!isDefined(category.subCategories[subCategoryName])) {
        return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
    }

    delete category.subCategories[subCategoryName];
    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Deleted subcategory '${subCategoryName}' from '${categoryName}'.`);
    return { success: true, message: `Successfully deleted subcategory '${subCategoryName}'.` };
}

function generateUniqueItemId(baseId: string): string {
    const allExistingIds = new Set(Object.keys(items));
    const shopConfig = getShopConfig();
    if (isDefined(shopConfig) && isDefined(shopConfig.categories)) {
        for (const category of Object.values(shopConfig.categories)) {
            if (isDefined(category.items)) {
                for (const itemId of Object.keys(category.items)) {
                    allExistingIds.add(itemId);
                }
            }
            if (isDefined(category.subCategories)) {
                for (const subCategory of Object.values(category.subCategories)) {
                    if (isDefined(subCategory.items)) {
                        for (const itemId of Object.keys(subCategory.items)) {
                            allExistingIds.add(itemId);
                        }
                    }
                }
            }
        }
    }

    let i = 1;
    let newId = `${baseId}_${i}`;
    while (allExistingIds.has(newId)) {
        i++;
        newId = `${baseId}_${i}`;
    }
    return newId;
}

function resolveItemMetadata(itemStack: mc.ItemStack): { icon: string; displayName: string } {
    let displayName = itemStack.nameTag;
    let icon;

    // Priority 1: Check existing items config
    const existingItem = Object.values(items as Record<string, ItemData>).find((item) => item.itemId === itemStack.typeId);
    if (isDefined(existingItem)) {
        icon = existingItem.icon;
        displayName = isNonEmptyString(displayName) ? displayName : existingItem.displayName;
    }

    // Priority 2: Use auto-resolution for icon
    if (!isNonEmptyString(icon)) {
        icon = resolveIcon(itemStack.typeId);
    }
    if (!isNonEmptyString(displayName)) {
        displayName = generateDisplayName(itemStack.typeId);
    }

    return { icon: icon || '', displayName: displayName || '' };
}

/**
 * Adds an item from a player's hand to the shop.
 * Generates a unique ID and adds it to both the master item config and the shop config.
 * @param itemStack The item stack from the player's hand.
 * @param categoryName The category to add the item to.
 * @param subCategoryName The subcategory to add the item to (optional).
 * @param buyPrice The buying price of the item.
 * @param sellPrice The selling price of the item.
 * @returns The result of the operation.
 */
export function addShopItemFromHand(itemStack: mc.ItemStack, categoryName: string, subCategoryName: string | undefined, buyPrice: number, sellPrice: number): ActionResult {
    if (!isDefined(itemStack)) {
        return { success: false, message: "You aren't holding anything." };
    }

    const baseId = itemStack.typeId.replace(/^minecraft:/, '');
    const newId = generateUniqueItemId(baseId);
    const { icon, displayName } = resolveItemMetadata(itemStack);

    // 3. Add to master item list (in memory)
    const newItemConfig = {
        itemId: itemStack.typeId,
        icon: icon,
        displayName: displayName,
        buyPrice: buyPrice,
        sellPrice: sellPrice
    };
    addCustomItemToConfig(newId, newItemConfig);
    debugLog(`[ShopAdminManager] Added new custom item '${newId}' to master list.`);

    // 4. Add to shop category/subcategory
    const shopItemData = {
        buyPrice,
        sellPrice,
        permission: 'ui.panel.member', // Default to everyone
        icon: icon,
        displayName: displayName,
        itemId: newId
    };

    const setResult = setItem(categoryName, subCategoryName, newId, shopItemData);

    if (setResult.success) {
        return { success: true, message: `Successfully added '${displayName}' to the shop.`, itemId: newId };
    } else {
        // Rollback the addition to the master list if adding to shop fails
        delete (items as Record<string, unknown>)[newId];
        return { success: false, message: `Failed to add item to shop: ${setResult.message}` };
    }
}

/**
 * Adds or updates an item in the shop.
 * @param categoryName - The name of the category.
 * @param subCategoryName - The name of the subcategory, or undefined for the main category.
 * @param itemId - The ID of the item to add/update.
 * @param itemData - The data for the item (buyPrice, sellPrice, permission).
 * @returns The result of the operation.
 */
export function setItem(categoryName: string, subCategoryName: string | undefined, itemId: string, itemData: ItemData): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer: ShopCategory | ShopSubCategory = category;
    if (isNonEmptyString(subCategoryName)) {
        const subCat = category.subCategories[subCategoryName];
        if (!isDefined(subCat)) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
        }
        targetContainer = subCat;
    }

    targetContainer.items[itemId] = {
        buyPrice: itemData.buyPrice,
        sellPrice: itemData.sellPrice,
        permission: itemData.permission ?? 'ui.panel.member',
        icon: itemData.icon,
        displayName: itemData.displayName
    };

    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Set item '${itemId}' in '${categoryName}/${subCategoryName ?? ''}'.`);
    return { success: true, message: `Successfully set item '${itemId}'.` };
}

/**
 * Adds a custom item to the in-memory items config.
 * @param itemId - The unique ID for the new item.
 * @param itemData - The data for the new item.
 * @returns The result of the operation.
 */
export function addCustomItemToConfig(itemId: string, itemData: ItemData): ActionResult {
    if (isDefined((items as Record<string, unknown>)[itemId])) {
        return { success: false, message: `An item with the ID '${itemId}' already exists.` };
    }
    (items as Record<string, unknown>)[itemId] = {
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
 * @param categoryName - The name of the category.
 * @param subCategoryName - The name of the subcategory, or undefined for the main category.
 * @param itemId - The ID of the item to remove.
 * @returns The result of the operation.
 */
export function removeItem(categoryName: string, subCategoryName: string | undefined, itemId: string): ActionResult {
    const config = getShopConfig();
    const categories = config.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer: ShopCategory | ShopSubCategory = category;
    if (isNonEmptyString(subCategoryName)) {
        const subCat = category.subCategories[subCategoryName];
        if (!isDefined(subCat)) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
        }
        targetContainer = subCat;
    }

    if (!isDefined(targetContainer.items[itemId])) {
        return { success: false, message: `Item '${itemId}' not found.` };
    }

    delete targetContainer.items[itemId];
    saveShopConfig(config);
    debugLog(`[ShopAdminManager] Removed item '${itemId}' from '${categoryName}/${subCategoryName ?? ''}'.`);
    return { success: true, message: `Successfully removed item '${itemId}'.` };
}

function updateMasterItemList(itemId: string, newData: UpdateItemData) {
    const itemsRecord = items as Record<string, ItemData>;
    if (isDefined(itemsRecord[itemId])) {
        itemsRecord[itemId].displayName = newData.displayName;
        itemsRecord[itemId].itemId = newData.itemId;
        itemsRecord[itemId].icon = newData.icon;
        if (isDefined(newData.rankOverrides)) {
            itemsRecord[itemId].rankMultiplierOverrides = newData.rankOverrides;
        } else {
            delete itemsRecord[itemId].rankMultiplierOverrides;
        }
    } else {
        addCustomItemToConfig(itemId, {
            displayName: newData.displayName,
            itemId: newData.itemId,
            icon: newData.icon,
            buyPrice: newData.buyPrice,
            sellPrice: newData.sellPrice
        });
    }
}

/**
 * Updates a shop item's details in both the shop config and the master item list.
 * @param categoryName The category of the item.
 * @param subCategoryName The subcategory of the item.
 * @param itemId The ID of the item to update.
 * @param newData The new data for the item.
 * @returns The result of the operation.
 */
export function updateShopItem(categoryName: string, subCategoryName: string | undefined, itemId: string, newData: UpdateItemData): ActionResult {
    // 1. Update the master item list (items.js)
    updateMasterItemList(itemId, newData);

    // 2. Update the shop-specific configuration (shop.json)
    const shopConfig = getShopConfig();
    const categories = shopConfig.categories;
    const category = categories[categoryName];
    if (!isDefined(category)) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer: ShopCategory | ShopSubCategory = category;
    if (isNonEmptyString(subCategoryName)) {
        const subCat = category.subCategories[subCategoryName];
        if (!isDefined(subCat)) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found.` };
        }
        targetContainer = subCat;
    }

    if (!isDefined(targetContainer.items[itemId])) {
        return { success: false, message: `Item '${itemId}' not found in shop config.` };
    }

    // Update shop-specific properties
    targetContainer.items[itemId].buyPrice = newData.buyPrice;
    targetContainer.items[itemId].sellPrice = newData.sellPrice;
    targetContainer.items[itemId].permission = newData.permission;

    if (isDefined(newData.rankOverrides)) {
        targetContainer.items[itemId].rankMultiplierOverrides = newData.rankOverrides;
    } else {
        delete targetContainer.items[itemId].rankMultiplierOverrides;
    }

    // Also update denormalized data like icon and displayName for consistency
    targetContainer.items[itemId].icon = newData.icon;
    targetContainer.items[itemId].displayName = newData.displayName;

    saveShopConfig(shopConfig);
    debugLog(`[ShopAdminManager] Updated item '${itemId}' in shop and master list.`);
    return { success: true, message: `Successfully updated item '${itemId}'.` };
}
