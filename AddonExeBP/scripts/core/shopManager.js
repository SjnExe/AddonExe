import { ItemStack, ItemTypes, EnchantmentTypes } from '@minecraft/server';
import { getOrCreatePlayer, incrementPlayerBalance } from './playerDataManager.js';
import { getShopConfig } from './configurations.js';
import { items as allItems } from './itemsConfig.js';
import { errorLog } from './logger.js';
import { formatCurrency } from './utils.js';

/**
 * Creates an ItemStack for a given item ID, handling enchantments.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount of items.
 * @returns {ItemStack | null}
 */
function createShopItemStack(itemInfo, quantity) {
    if (!itemInfo) {
        errorLog('[ShopManager] Could not find item info for creating item stack.');
        return null;
    }

    const itemType = ItemTypes.get(itemInfo.itemId);
    if (!itemType) {
        errorLog(`[ShopManager] Could not find item type for itemId: ${itemInfo.itemId}`);
        return null;
    }

    const itemStack = new ItemStack(itemType, quantity);

    // Handle enchantments
    if (itemInfo.enchantment) {
        try {
            const enchantable = itemStack.getComponent('minecraft:enchantable');
            if (enchantable) {
                enchantable.addEnchantment({
                    type: EnchantmentTypes.get(itemInfo.enchantment.id),
                    level: itemInfo.enchantment.level
                });
            }
        } catch (e) {
            errorLog(`[ShopManager] Failed to apply enchantment for ${itemInfo.itemId}:`, e);
        }
    }

    if (itemInfo.displayName) {
        itemStack.nameTag = `§r${itemInfo.displayName}`;
    }

    return itemStack;
}

/**
 * Handles a player's request to buy an item from the shop.
 * @param {import('@minecraft/server').Player} player The player buying the item.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount to buy.
 * @returns {{success: boolean, message: string}}
 */
function findShopItem(itemId) {
    const shopConfig = getShopConfig();
    for (const categoryName in shopConfig.categories) {
        const category = shopConfig.categories[categoryName];
        if (category.items[itemId]) {
            return { ...allItems[itemId], ...category.items[itemId] };
        }
        for (const subCategoryName in category.subCategories) {
            const subCategory = category.subCategories[subCategoryName];
            if (subCategory.items[itemId]) {
                return { ...allItems[itemId], ...subCategory.items[itemId] };
            }
        }
    }
    return null;
}

export function buyItem(player, itemId, quantity) {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!shopItem) {
        return { success: false, message: '§cThis item is not available in the shop.' };
    }

    const buyPrice = shopItem.buyPrice;
    if (buyPrice <= 0) {
        return { success: false, message: '§cThis item cannot be purchased.' };
    }

    const pData = getOrCreatePlayer(player);
    const initialCost = buyPrice * quantity;

    if (pData.balance < initialCost) {
        return { success: false, message: `§cInsufficient funds. You need §e${formatCurrency(initialCost)}§c to attempt this purchase.` };
    }

    const inventory = player.getComponent('inventory').container;
    const itemStackTemplate = createShopItemStack(shopItem, 1);

    if (!itemStackTemplate) {
        return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
    }

    // 1. Calculate true available space in inventory
    let spaceFound = 0;
    const maxStackSize = itemStackTemplate.maxAmount;

    if (maxStackSize > 1) { // Item is stackable
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) {
                spaceFound += maxStackSize;
            } else if (item.isStackableWith(itemStackTemplate)) {
                spaceFound += maxStackSize - item.amount;
            }
        }
    } else { // Item is not stackable
        // We assume emptySlotsCount exists. If not, this will need a manual loop.
        spaceFound = inventory.emptySlotsCount;
    }

    // 2. Validate and adjust quantity based on space
    if (spaceFound === 0) {
        return { success: false, message: '§cYou have no space for this item.' };
    }

    let finalQuantity = quantity;
    if (finalQuantity > spaceFound) {
        player.sendMessage(`§eNotice: You only have space for ${spaceFound}. Buying that amount instead.`);
        finalQuantity = spaceFound;
    }

    // 3. Recalculate cost and perform final transaction
    const finalCost = buyPrice * finalQuantity;
    if (pData.balance < finalCost) {
        // This can happen if the adjusted quantity is still too expensive, though unlikely if the initial check passed.
        return { success: false, message: `§cInsufficient funds. You need §e${formatCurrency(finalCost)}§c to buy ${finalQuantity}.` };
    }

    incrementPlayerBalance(player.id, -finalCost);

    // 4. Give items one by one to avoid stack bugs
    for (let i = 0; i < finalQuantity; i++) {
        const singleItemStack = createShopItemStack(shopItem, 1);
        if (singleItemStack) {
            inventory.addItem(singleItemStack);
        }
    }

    return { success: true, message: `§2Successfully purchased ${finalQuantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(finalCost)}§2.` };
}

/**
 * Handles a player's request to sell an item to the shop.
 * @param {import('@minecraft/server').Player} player The player selling the item.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount to sell.
 * @returns {{success: boolean, message: string}}
 */
export function sellItem(player, itemId, quantity) {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!shopItem) {
        return { success: false, message: '§cThis item cannot be sold to the shop.' };
    }

    const sellPrice = shopItem.sellPrice;
    if (sellPrice <= 0) {
        return { success: false, message: '§cThis item cannot be sold.' };
    }

    const inventory = player.getComponent('inventory').container;
    const itemType = ItemTypes.get(shopItem.itemId);
    if (!itemType) {
        return { success: false, message: '§cInternal server error: Item type not found.' };
    }

    // Check if player has enough items
    let count = 0;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && item.typeId === itemType.id) {
            // Note: This does not check for special names or enchantments.
            count += item.amount;
        }
    }

    if (count < quantity) {
        return { success: false, message: `§cYou do not have enough of this item. You only have ${count}.` };
    }

    // Remove items
    player.runCommand(`clear "${player.name}" ${shopItem.itemId.replace('minecraft:', '')} 0 ${quantity}`);

    // Success
    const totalGain = sellPrice * quantity;
    incrementPlayerBalance(player.id, totalGain);

    return { success: true, message: `§2Successfully sold ${quantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(totalGain)}§2.` };
}
