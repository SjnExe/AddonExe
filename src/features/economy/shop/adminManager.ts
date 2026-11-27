import * as configurations from '@core/config/configurations.js';
import { generateDisplayName, resolveIcon, sanitizeString, validateInput } from '@core/utils/index.js';
import { debugLog } from '@core/utils/logger.js';
import { ShopCategory, ShopSubCategory } from '@features/economy/shop/config.js';
import { items } from '@features/economy/shop/itemsConfig.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

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
  dailyBuyLimit?: number;
  dailySellLimit?: number;
  limitScope?: 'player' | 'global';
}

interface UpdateItemData {
  displayName: string;
  itemId: string;
  icon: string;
  buyPrice: number;
  sellPrice: number;
  permission: string;
  rankOverrides?: Record<string, { buy: number; sell: number }>;
  dailyBuyLimit?: number;
  dailySellLimit?: number;
  limitScope?: 'player' | 'global';
}

/**
 * Adds a new category to the shop.
 *
 * @param categoryName - The name for the new category.
 * @param icon - The icon for the new category.
 * @returns The result of the operation.
 */
export function addCategory(categoryName: string, icon: string): ActionResult {
  if (!validateInput(categoryName, 32)) {
    return { success: false, message: 'Category name is too long (max 32).' };
  }
  const safeName = sanitizeString(categoryName, true);

  const config = configurations.getShopConfig();
  const categories = config.categories;
  if (isDefined(categories[safeName])) {
    return { success: false, message: `A category with the name '${safeName}' already exists.` };
  }

  categories[safeName] = {
    icon: isNonEmptyString(icon) ? icon : '',
    items: {},
    subCategories: {},
  };

  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Added new category: ${categoryName}`);
  return { success: true, message: `Successfully added category '${categoryName}'.` };
}

/**
 * Edits a subcategory's name and icon.
 *
 * @param categoryName - The name of the parent category.
 * @param oldSubCategoryName - The current name of the subcategory.
 * @param newSubCategoryName - The new name for the subcategory.
 * @param newIcon - The new icon for the subcategory.
 * @returns The result of the operation.
 */
export function editSubCategory(
  categoryName: string,
  oldSubCategoryName: string,
  newSubCategoryName: string,
  newIcon: string,
): ActionResult {
  const config = configurations.getShopConfig();
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
      message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.`,
    };
  }

  const subCategoryData = category.subCategories[oldSubCategoryName];
  subCategoryData.icon = newIcon;

  if (oldSubCategoryName !== newSubCategoryName) {
    category.subCategories[newSubCategoryName] = subCategoryData;
    delete category.subCategories[oldSubCategoryName];
  }

  configurations.saveShopConfig(config);
  debugLog(
    `[ShopAdminManager] Edited subcategory '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`,
  );
  return { success: true, message: `Successfully edited subcategory '${newSubCategoryName}'.` };
}

/**
 * Edits a category's name and icon.
 *
 * @param oldCategoryName - The current name of the category.
 * @param newCategoryName - The new name for the category.
 * @param newIcon - The new icon for the category.
 * @returns The result of the operation.
 */
export function editCategory(oldCategoryName: string, newCategoryName: string, newIcon: string): ActionResult {
  const config = configurations.getShopConfig();
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

  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Edited category '${oldCategoryName}' to '${newCategoryName}'.`);
  return { success: true, message: `Successfully edited category '${newCategoryName}'.` };
}

/**
 * Renames a category.
 *
 * @param oldCategoryName - The current name of the category.
 * @param newCategoryName - The new name for the category.
 * @returns The result of the operation.
 */
export function renameCategory(oldCategoryName: string, newCategoryName: string): ActionResult {
  const config = configurations.getShopConfig();
  const categories = config.categories;
  if (!isDefined(categories[oldCategoryName])) {
    return { success: false, message: `Category '${oldCategoryName}' not found.` };
  }
  if (isDefined(categories[newCategoryName])) {
    return { success: false, message: `A category with the name '${newCategoryName}' already exists.` };
  }

  categories[newCategoryName] = categories[oldCategoryName];
  delete categories[oldCategoryName];

  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Renamed category from '${oldCategoryName}' to '${newCategoryName}'.`);
  return { success: true, message: `Successfully renamed category to '${newCategoryName}'.` };
}

/**
 * Deletes a category from the shop.
 *
 * @param categoryName - The name of the category to delete.
 * @returns The result of the operation.
 */
export function deleteCategory(categoryName: string): ActionResult {
  const config = configurations.getShopConfig();
  const categories = config.categories;
  if (!isDefined(categories[categoryName])) {
    return { success: false, message: `Category '${categoryName}' not found.` };
  }

  delete categories[categoryName];
  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Deleted category: ${categoryName}`);
  return { success: true, message: `Successfully deleted category '${categoryName}'.` };
}

/**
 * Adds a new subcategory to a category.
 *
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

  const config = configurations.getShopConfig();
  const categories = config.categories;
  const category = categories[categoryName];
  if (!isDefined(category)) {
    return { success: false, message: `Category '${categoryName}' not found.` };
  }
  if (isDefined(category.subCategories[safeName])) {
    return {
      success: false,
      message: `A subcategory with the name '${safeName}' already exists in '${categoryName}'.`,
    };
  }

  category.subCategories[safeName] = {
    icon: isNonEmptyString(icon) ? icon : '',
    items: {},
  };

  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Added new subcategory '${subCategoryName}' to '${categoryName}'.`);
  return { success: true, message: `Successfully added subcategory '${subCategoryName}'.` };
}

/**
 * Renames a subcategory.
 *
 * @param categoryName - The name of the parent category.
 * @param oldSubCategoryName - The current name of the subcategory.
 * @param newSubCategoryName - The new name for the subcategory.
 * @returns The result of the operation.
 */
export function renameSubCategory(
  categoryName: string,
  oldSubCategoryName: string,
  newSubCategoryName: string,
): ActionResult {
  const config = configurations.getShopConfig();
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
      message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.`,
    };
  }

  category.subCategories[newSubCategoryName] = category.subCategories[oldSubCategoryName];
  delete category.subCategories[oldSubCategoryName];

  configurations.saveShopConfig(config);
  debugLog(
    `[ShopAdminManager] Renamed subcategory from '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`,
  );
  return { success: true, message: `Successfully renamed subcategory to '${newSubCategoryName}'.` };
}

/**
 * Deletes a subcategory from a category.
 *
 * @param categoryName - The name of the parent category.
 * @param subCategoryName - The name of the subcategory to delete.
 * @returns The result of the operation.
 */
export function deleteSubCategory(categoryName: string, subCategoryName: string): ActionResult {
  const config = configurations.getShopConfig();
  const categories = config.categories;
  const category = categories[categoryName];
  if (!isDefined(category)) {
    return { success: false, message: `Category '${categoryName}' not found.` };
  }
  if (!isDefined(category.subCategories[subCategoryName])) {
    return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
  }

  delete category.subCategories[subCategoryName];
  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Deleted subcategory '${subCategoryName}' from '${categoryName}'.`);
  return { success: true, message: `Successfully deleted subcategory '${subCategoryName}'.` };
}

function generateUniqueItemId(baseId: string): string {
  const allExistingIds = new Set(Object.keys(items));
  const shopConfig = configurations.getShopConfig();
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
  const existingItem = Object.values(items as Record<string, ItemData>).find(
    (item) => item.itemId === itemStack.typeId,
  );
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
 * Adds an item from a player's hand to the shop. Generates a unique ID and adds it to both the master item config and
 * the shop config.
 *
 * @param itemStack The item stack from the player's hand.
 * @param categoryName The category to add the item to.
 * @param subCategoryName The subcategory to add the item to (optional).
 * @param buyPrice The buying price of the item.
 * @param sellPrice The selling price of the item.
 * @returns The result of the operation.
 */
export function addShopItemFromHand(
  itemStack: mc.ItemStack,
  categoryName: string,
  subCategoryName: string | undefined,
  buyPrice: number,
  sellPrice: number,
): ActionResult {
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
    sellPrice: sellPrice,
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
    itemId: itemStack.typeId,
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
 *
 * @param categoryName - The name of the category.
 * @param subCategoryName - The name of the subcategory, or undefined for the main category.
 * @param itemId - The ID of the item to add/update.
 * @param itemData - The data for the item (buyPrice, sellPrice, permission).
 * @returns The result of the operation.
 */
export function setItem(
  categoryName: string,
  subCategoryName: string | undefined,
  itemId: string,
  itemData: ItemData,
): ActionResult {
  const config = configurations.getShopConfig();
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

  for (const [catName, cat] of Object.entries(categories)) {
    if (!isDefined(cat)) {
      continue;
    }
    if (cat !== targetContainer && isDefined(cat.items?.[itemId])) {
      return { success: false, message: `Item ID '${itemId}' already exists in category '${catName}'.` };
    }
    if (isDefined(cat.subCategories)) {
      for (const [subName, sub] of Object.entries(cat.subCategories)) {
        if (isDefined(sub) && sub !== targetContainer && isDefined(sub.items?.[itemId])) {
          return {
            success: false,
            message: `Item ID '${itemId}' already exists in '${catName}/${subName}'.`,
          };
        }
      }
    }
  }

  targetContainer.items[itemId] = {
    buyPrice: itemData.buyPrice,
    sellPrice: itemData.sellPrice,
    permission: itemData.permission ?? 'ui.panel.member',
    icon: itemData.icon,
    displayName: itemData.displayName,
    ...(isNonEmptyString(itemData.itemId) && itemData.itemId !== itemId ? { itemId: itemData.itemId } : {}),
    ...(isDefined(itemData.rankMultiplierOverrides)
      ? { rankMultiplierOverrides: itemData.rankMultiplierOverrides }
      : {}),
    ...(isDefined(itemData.dailyBuyLimit) && itemData.dailyBuyLimit > 0
      ? { dailyBuyLimit: itemData.dailyBuyLimit }
      : {}),
    ...(isDefined(itemData.dailySellLimit) && itemData.dailySellLimit > 0
      ? { dailySellLimit: itemData.dailySellLimit }
      : {}),
    ...(isDefined(itemData.limitScope) ? { limitScope: itemData.limitScope } : {}),
  };

  configurations.saveShopConfig(config);
  debugLog(`[ShopAdminManager] Set item '${itemId}' in '${categoryName}/${subCategoryName ?? ''}'.`);
  return { success: true, message: `Successfully set item '${itemId}'.` };
}

/**
 * Adds a custom item to the in-memory items config.
 *
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
    category: 'Custom',
  };
  return { success: true, message: 'Custom item added to in-memory config.' };
}

/**
 * Removes an item from the shop.
 *
 * @param categoryName - The name of the category.
 * @param subCategoryName - The name of the subcategory, or undefined for the main category.
 * @param itemId - The ID of the item to remove.
 * @returns The result of the operation.
 */
export function removeItem(categoryName: string, subCategoryName: string | undefined, itemId: string): ActionResult {
  const config = configurations.getShopConfig();
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
  configurations.saveShopConfig(config);
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
      sellPrice: newData.sellPrice,
    });
  }
}

/**
 * Updates a shop item's details in both the shop config and the master item list.
 *
 * @param categoryName The category of the item.
 * @param subCategoryName The subcategory of the item.
 * @param itemId The ID of the item to update.
 * @param newData The new data for the item.
 * @returns The result of the operation.
 */
export function updateShopItem(
  categoryName: string,
  subCategoryName: string | undefined,
  itemId: string,
  newData: UpdateItemData,
): ActionResult {
  // 1. Validate the shop-specific configuration (shop.json) before mutating any state
  const shopConfig = configurations.getShopConfig();
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

  const existingItemData = targetContainer.items[itemId];
  const hasSeparateItemId = isNonEmptyString(existingItemData.itemId);
  const canRenameKey = !hasSeparateItemId && isNonEmptyString(newData.itemId) && newData.itemId !== itemId;
  if (canRenameKey && isDefined(targetContainer.items[newData.itemId])) {
    return { success: false, message: `Item '${newData.itemId}' already exists in this container.` };
  }

  // 2. Update the master item list (items.js)
  updateMasterItemList(itemId, newData);

  const targetKey = canRenameKey ? newData.itemId : itemId;
  if (itemId !== targetKey) {
    delete targetContainer.items[itemId];
  }

  targetContainer.items[targetKey] = {
    ...existingItemData,
    ...(hasSeparateItemId && isNonEmptyString(newData.itemId) ? { itemId: newData.itemId } : {}),
    buyPrice: newData.buyPrice,
    sellPrice: newData.sellPrice,
    permission: newData.permission,
    icon: newData.icon,
    displayName: newData.displayName,
  };

  if (isDefined(newData.rankOverrides)) {
    targetContainer.items[targetKey].rankMultiplierOverrides = newData.rankOverrides;
  } else {
    delete targetContainer.items[targetKey].rankMultiplierOverrides;
  }

  if (isDefined(newData.dailyBuyLimit) && newData.dailyBuyLimit > 0) {
    targetContainer.items[targetKey].dailyBuyLimit = newData.dailyBuyLimit;
  } else {
    delete targetContainer.items[targetKey].dailyBuyLimit;
  }

  if (isDefined(newData.dailySellLimit) && newData.dailySellLimit > 0) {
    targetContainer.items[targetKey].dailySellLimit = newData.dailySellLimit;
  } else {
    delete targetContainer.items[targetKey].dailySellLimit;
  }

  if (isDefined(newData.limitScope)) {
    targetContainer.items[targetKey].limitScope = newData.limitScope;
  }

  configurations.saveShopConfig(shopConfig);
  debugLog(`[ShopAdminManager] Updated item '${targetKey}' in shop and master list.`);
  return { success: true, message: `Successfully updated item '${targetKey}'.` };
}

/**
 * Locates the category and optional subcategory containing `itemKey`.
 *
 * @param itemKey Shop item key.
 * @returns Location object or undefined if not found.
 */
export function findItemLocation(itemKey: string): { categoryName: string; subCategoryName?: string } | undefined {
  const shopConfig = configurations.getShopConfig();
  for (const [categoryName, category] of Object.entries(shopConfig.categories ?? {})) {
    if (!isDefined(category)) {
      continue;
    }
    if (isDefined(category.items?.[itemKey])) {
      return { categoryName };
    }
    for (const [subCategoryName, subCat] of Object.entries(category.subCategories ?? {})) {
      if (isDefined(subCat?.items?.[itemKey])) {
        return { categoryName, subCategoryName };
      }
    }
  }
  return undefined;
}

function normalizeShopPrice(price: number): number | undefined {
  if (!Number.isFinite(price) || (price < 0 && price !== -1)) {
    return undefined;
  }
  if (price === -1) {
    return -1;
  }
  const rounded = Math.round(price * 100) / 100;
  return Number.isFinite(rounded) ? rounded : undefined;
}

/**
 * Quickly updates buy/sell prices and optional daily limits for an existing shop item.
 *
 * @param categoryName Category name.
 * @param subCategoryName Subcategory name (optional).
 * @param itemKey Item key.
 * @param buyPrice New buy price (-1 or 0 to disable, undefined to keep existing).
 * @param sellPrice New sell price (-1 or 0 to disable, undefined to keep existing).
 * @param dailyBuyLimit Optional daily buy limit (0 for unlimited, undefined to keep existing).
 * @param dailySellLimit Optional daily sell limit (0 for unlimited, undefined to keep existing).
 * @returns Operation result.
 */
export function quickUpdateItemPrices(
  categoryName: string,
  subCategoryName: string | undefined,
  itemKey: string,
  buyPrice?: number,
  sellPrice?: number,
  dailyBuyLimit?: number,
  dailySellLimit?: number,
): ActionResult {
  const nextBuyPrice = isDefined(buyPrice) ? normalizeShopPrice(buyPrice) : undefined;
  if (isDefined(buyPrice) && !isDefined(nextBuyPrice)) {
    return { success: false, message: 'Prices must be finite numbers >= 0, or -1 to disable.' };
  }

  const nextSellPrice = isDefined(sellPrice) ? normalizeShopPrice(sellPrice) : undefined;
  if (isDefined(sellPrice) && !isDefined(nextSellPrice)) {
    return { success: false, message: 'Prices must be finite numbers >= 0, or -1 to disable.' };
  }

  if (isDefined(dailyBuyLimit) && (!Number.isFinite(dailyBuyLimit) || dailyBuyLimit < 0)) {
    return { success: false, message: 'Daily buy limit must be a non-negative number.' };
  }
  if (isDefined(dailySellLimit) && (!Number.isFinite(dailySellLimit) || dailySellLimit < 0)) {
    return { success: false, message: 'Daily sell limit must be a non-negative number.' };
  }

  const shopConfig = configurations.getShopConfig();
  const category = shopConfig.categories[categoryName];
  if (!isDefined(category)) {
    return { success: false, message: `Category '${categoryName}' not found.` };
  }

  const targetContainer = isNonEmptyString(subCategoryName) ? category.subCategories[subCategoryName] : category;
  if (!isDefined(targetContainer)) {
    return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
  }

  const item = targetContainer.items[itemKey];
  if (!isDefined(item)) {
    return { success: false, message: `Item '${itemKey}' not found.` };
  }

  if (
    !isDefined(nextBuyPrice) &&
    !isDefined(nextSellPrice) &&
    !isDefined(dailyBuyLimit) &&
    !isDefined(dailySellLimit)
  ) {
    return { success: true, message: `No changes made for '${item.displayName ?? itemKey}'.` };
  }

  if (isDefined(nextBuyPrice)) {
    item.buyPrice = nextBuyPrice;
  }
  if (isDefined(nextSellPrice)) {
    item.sellPrice = nextSellPrice;
  }

  if (isDefined(dailyBuyLimit)) {
    if (dailyBuyLimit > 0) {
      item.dailyBuyLimit = Math.floor(dailyBuyLimit);
    } else {
      delete item.dailyBuyLimit;
    }
  }
  if (isDefined(dailySellLimit)) {
    if (dailySellLimit > 0) {
      item.dailySellLimit = Math.floor(dailySellLimit);
    } else {
      delete item.dailySellLimit;
    }
  }

  configurations.saveShopConfig(shopConfig);
  debugLog(`[ShopAdminManager] Quick-updated prices for '${itemKey}' (B:${item.buyPrice}, S:${item.sellPrice}).`);
  return { success: true, message: `Updated prices for '${item.displayName ?? itemKey}'.` };
}

/**
 * Moves a shop item from one category/subcategory to another.
 *
 * @param fromCategory Source category.
 * @param fromSubCategory Source subcategory (optional).
 * @param itemKey Item key to move.
 * @param toCategory Destination category.
 * @param toSubCategory Destination subcategory (optional).
 * @returns Operation result.
 */
export function moveShopItem(
  fromCategory: string,
  fromSubCategory: string | undefined,
  itemKey: string,
  toCategory: string,
  toSubCategory: string | undefined,
): ActionResult {
  const shopConfig = configurations.getShopConfig();
  const srcCat = shopConfig.categories[fromCategory];
  const dstCat = shopConfig.categories[toCategory];
  if (!isDefined(srcCat)) {
    return { success: false, message: `Source category '${fromCategory}' not found.` };
  }
  if (!isDefined(dstCat)) {
    return { success: false, message: `Destination category '${toCategory}' not found.` };
  }

  const srcContainer = isNonEmptyString(fromSubCategory) ? srcCat.subCategories[fromSubCategory] : srcCat;
  const dstContainer = isNonEmptyString(toSubCategory) ? dstCat.subCategories[toSubCategory] : dstCat;
  if (!isDefined(srcContainer) || !isDefined(dstContainer)) {
    return { success: false, message: 'Source or destination subcategory not found.' };
  }
  if (srcContainer === dstContainer) {
    return { success: false, message: 'Item is already in that location.' };
  }

  const item = srcContainer.items[itemKey];
  if (!isDefined(item)) {
    return { success: false, message: `Item '${itemKey}' not found.` };
  }
  if (isDefined(dstContainer.items[itemKey])) {
    return { success: false, message: `Item '${itemKey}' already exists in destination.` };
  }

  dstContainer.items[itemKey] = item;
  delete srcContainer.items[itemKey];
  configurations.saveShopConfig(shopConfig);
  debugLog(`[ShopAdminManager] Moved '${itemKey}' to '${toCategory}/${toSubCategory ?? ''}'.`);
  return {
    success: true,
    message: `Moved '${item.displayName ?? itemKey}' to ${toCategory}${toSubCategory ? ` > ${toSubCategory}` : ''}.`,
  };
}

/**
 * Scales buy and/or sell prices by a multiplier globally or for a single category.
 *
 * @param buyMultiplier Multiplier for positive buy prices (e.g. 1.1 = +10%).
 * @param sellMultiplier Multiplier for positive sell prices (e.g. 0.9 = -10%).
 * @param categoryName Optional category name to limit scaling.
 * @returns Operation result with count of updated items.
 */
export function applyGlobalPriceMultiplier(
  buyMultiplier: number,
  sellMultiplier: number,
  categoryName?: string,
): ActionResult & { updatedCount: number } {
  if (
    !Number.isFinite(buyMultiplier) ||
    buyMultiplier <= 0 ||
    !Number.isFinite(sellMultiplier) ||
    sellMultiplier <= 0
  ) {
    return { success: false, message: 'Multipliers must be positive numbers.', updatedCount: 0 };
  }

  const shopConfig = configurations.getShopConfig();
  const targetCategories = isNonEmptyString(categoryName)
    ? isDefined(shopConfig.categories[categoryName])
      ? [shopConfig.categories[categoryName]]
      : []
    : Object.values(shopConfig.categories ?? {});

  if (targetCategories.length === 0) {
    return { success: false, message: 'No matching categories found.', updatedCount: 0 };
  }

  const stagedUpdates: {
    item: { buyPrice: number; sellPrice: number };
    nextBuy?: number;
    nextSell?: number;
  }[] = [];

  const stageMap = (itemMap: Record<string, { buyPrice: number; sellPrice: number }>): boolean => {
    for (const item of Object.values(itemMap ?? {})) {
      if (!isDefined(item)) {
        continue;
      }
      let nextBuy: number | undefined;
      let nextSell: number | undefined;
      if (item.buyPrice > 0 && buyMultiplier !== 1) {
        const scaled = Math.max(0.25, Math.round(item.buyPrice * buyMultiplier * 100) / 100);
        if (!Number.isFinite(scaled)) {
          return false;
        }
        nextBuy = scaled;
      }
      if (item.sellPrice > 0 && sellMultiplier !== 1) {
        const scaled = Math.max(0.25, Math.round(item.sellPrice * sellMultiplier * 100) / 100);
        if (!Number.isFinite(scaled)) {
          return false;
        }
        nextSell = scaled;
      }
      if (isDefined(nextBuy) || isDefined(nextSell)) {
        stagedUpdates.push({ item, nextBuy, nextSell });
      }
    }
    return true;
  };

  for (const cat of targetCategories) {
    if (!isDefined(cat)) {
      continue;
    }
    if (!stageMap(cat.items)) {
      return { success: false, message: 'Scaled price exceeds numeric limits.', updatedCount: 0 };
    }
    for (const sub of Object.values(cat.subCategories ?? {})) {
      if (isDefined(sub) && !stageMap(sub.items)) {
        return { success: false, message: 'Scaled price exceeds numeric limits.', updatedCount: 0 };
      }
    }
  }

  for (const update of stagedUpdates) {
    if (isDefined(update.nextBuy)) {
      update.item.buyPrice = update.nextBuy;
    }
    if (isDefined(update.nextSell)) {
      update.item.sellPrice = update.nextSell;
    }
  }

  const updatedCount = stagedUpdates.length;

  configurations.saveShopConfig(shopConfig);
  debugLog(
    `[ShopAdminManager] Scaled prices for ${updatedCount} items (buy x${buyMultiplier}, sell x${sellMultiplier}).`,
  );
  return {
    success: true,
    updatedCount,
    message: `Updated prices for ${updatedCount} items.`,
  };
}

/**
 * Resets the shop configuration to the built-in default preset.
 *
 * @returns Operation result.
 */
export function resetShopToDefaults(): ActionResult {
  configurations.resetShopConfig();
  debugLog('[ShopAdminManager] Reset shop configuration to default preset.');
  return { success: true, message: 'Shop configuration reset to default preset.' };
}
