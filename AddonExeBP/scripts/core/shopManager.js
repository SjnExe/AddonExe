import { ItemStack, ItemTypes } from '@minecraft/server';
import * as economyManager from './economyManager.js';
import { getShopConfig } from './shopConfigManager.js';
import { items as allItems } from './itemsConfig.js';
import { errorLog } from './errorLogger.js';

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

    const initialCost = buyPrice * quantity;
    const playerBalance = economyManager.getBalance(player.id);

    if (playerBalance < initialCost) {
        return { success: false, message: `§cInsufficient funds. You need §e$${initialCost.toFixed(2)}§c to attempt this purchase.` };
    }

    const inventory = player.getComponent('inventory').container;
    const itemStackTemplate = createShopItemStack(itemId, 1);

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
    if (playerBalance < finalCost) {
        // This can happen if the adjusted quantity is still too expensive, though unlikely if the initial check passed.
        return { success: false, message: `§cInsufficient funds. You need §e$${finalCost.toFixed(2)}§c to buy ${finalQuantity}.` };
    }

    economyManager.removeBalance(player.id, finalCost);

    // 4. Give items one by one to avoid stack bugs
    for (let i = 0; i < finalQuantity; i++) {
        const singleItemStack = createShopItemStack(itemId, 1);
        if (singleItemStack) {
            inventory.addItem(singleItemStack);
        }
    }

    return { success: true, message: `§aSuccessfully purchased ${finalQuantity}x ${masterItem.displayName ?? itemId} for §e$${finalCost.toFixed(2)}§a.` };
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
    player.runCommand(`clear "${player.name}" ${masterItem.icon.replace('minecraft:', '')} 0 ${quantity}`);

    // Success
    const totalGain = sellPrice * quantity;
    economyManager.addBalance(player.id, totalGain);

    return { success: true, message: `§aSuccessfully sold ${quantity}x ${masterItem.displayName ?? itemId} for §e$${totalGain.toFixed(2)}§a.` };
}
