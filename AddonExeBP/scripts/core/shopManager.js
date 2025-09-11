import { ItemStack, ItemTypes } from '@minecraft/server';
import * as economyManager from './economyManager.js';
import { getShopConfig } from './shopConfigManager.js';
import { items as allItems } from './itemsConfig.js';
import { errorLog } from './errorLogger.js';
import { debugLog } from './logger.js';

/**
 * Creates an ItemStack for a given item ID, handling enchantments.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount of items.
 * @returns {ItemStack | null}
 */
function createShopItemStack(itemId, quantity) {
    const itemInfo = allItems[itemId];
    if (!itemInfo) {
        errorLog(`[ShopManager] Could not find item info for ID: ${itemId}`);
        return null;
    }

    const itemType = ItemTypes.get(itemInfo.icon);
    if (!itemType) {
        errorLog(`[ShopManager] Could not find item type for icon: ${itemInfo.icon}`);
        return null;
    }

    const itemStack = new ItemStack(itemType, quantity);

    // Handle enchantments
    if (itemInfo.enchantment) {
        try {
            const enchantable = itemStack.getComponent('minecraft:enchantable');
            if (enchantable) {
                enchantable.addEnchantment({
                    type: itemInfo.enchantment.id,
                    level: itemInfo.enchantment.level
                });
            }
        } catch (e) {
            errorLog(`[ShopManager] Failed to apply enchantment for ${itemId}:`, e);
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
export function buyItem(player, itemId, quantity) {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopConfig = getShopConfig();
    const shopItem = shopConfig.items[itemId];
    const masterItem = allItems[itemId];

    if (!shopItem || !masterItem) {
        return { success: false, message: '§cThis item is not available in the shop.' };
    }

    const buyPrice = shopItem.buyPrice;
    if (buyPrice <= 0) {
        return { success: false, message: '§cThis item cannot be purchased.' };
    }

    // TODO: Re-enable when enchantment API is figured out.
    if (masterItem.enchantment) {
        return { success: false, message: '§cBuying enchanted books is temporarily disabled.' };
    }

    const totalCost = buyPrice * quantity;
    const playerBalance = economyManager.getBalance(player.id);

    if (playerBalance < totalCost) {
        return { success: false, message: `§cInsufficient funds. You need §e$${totalCost.toFixed(2)}§c.` };
    }

    const itemStack = createShopItemStack(itemId, quantity);
    if (!itemStack) {
        return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
    }

    debugLog(`[ShopManager] Attempting to give ${player.name} item ${itemId} with quantity ${itemStack.amount}`);
    const inventory = player.getComponent('inventory').container;

    // Due to bugs in the beta API's addItem, we will do a "dry run" to check for space first.
    const itemStackForTest = createShopItemStack(itemId, quantity);
    if (!itemStackForTest) {
        return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
    }

    const remainder = inventory.addItem(itemStackForTest);
    const amountAdded = quantity - (remainder?.amount ?? 0);

    // Immediately remove what was added to make this a check, not a final transaction.
    if (amountAdded > 0) {
        player.runCommandAsync(`clear "${player.name}" ${itemStackForTest.typeId.replace('minecraft:', '')} 0 ${amountAdded}`);
    }

    // If the full quantity was not "added" during the test, there isn't enough space.
    if (amountAdded < quantity) {
        return { success: false, message: '§cYour inventory does not have enough space for this purchase.' };
    }

    // If we are here, the test passed. Now do the real transaction.
    economyManager.removeBalance(player.id, totalCost);

    // Give the items again, this time for real.
    const finalItemStack = createShopItemStack(itemId, quantity);
    inventory.addItem(finalItemStack);

    return { success: true, message: `§aSuccessfully purchased ${quantity}x ${masterItem.displayName ?? itemId} for §e$${totalCost.toFixed(2)}§a.` };
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

    const shopConfig = getShopConfig();
    const shopItem = shopConfig.items[itemId];
    const masterItem = allItems[itemId];

    if (!shopItem || !masterItem) {
        return { success: false, message: '§cThis item cannot be sold to the shop.' };
    }

    const sellPrice = shopItem.sellPrice;
    if (sellPrice <= 0) {
        return { success: false, message: '§cThis item cannot be sold.' };
    }

    // For now, we will not support selling enchanted books due to complexity.
    if (masterItem.enchantment) {
        return { success: false, message: '§cSelling enchanted books is not supported at this time.' };
    }

    const inventory = player.getComponent('inventory').container;
    const itemType = ItemTypes.get(masterItem.icon);
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
    player.runCommandAsync(`clear "${player.name}" ${masterItem.icon.replace('minecraft:', '')} 0 ${quantity}`);

    // Success
    const totalGain = sellPrice * quantity;
    economyManager.addBalance(player.id, totalGain);

    return { success: true, message: `§aSuccessfully sold ${quantity}x ${masterItem.displayName ?? itemId} for §e$${totalGain.toFixed(2)}§a.` };
}
