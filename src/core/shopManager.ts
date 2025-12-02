import * as mc from '@minecraft/server';

import { getShopConfig } from './configurations.js';
import { items as allItems } from './itemsConfig.default.js';
import { errorLog } from './logger.js';
import { getOrCreatePlayer, incrementPlayerBalance } from './playerDataManager.js';
import { formatCurrency } from './utils.js';

interface ItemInfo {
    itemId: string;
    displayName?: string;
    enchantment?: { id: string; level: number };
    buyPrice?: number;
    sellPrice?: number;
}

interface ShopTransactionResult {
    success: boolean;
    message: string;
}

/**
 * Creates an ItemStack for a given item ID, handling enchantments.
 * @param itemInfo The item info object.
 * @param quantity The amount of items.
 * @returns The created ItemStack or null if failed.
 */
function createShopItemStack(itemInfo: ItemInfo, quantity: number): mc.ItemStack | null {
    if (!itemInfo) {
        errorLog('[ShopManager] Could not find item info for creating item stack.');
        return null;
    }

    const itemType = mc.ItemTypes.get(itemInfo.itemId);
    if (!itemType) {
        errorLog(`[ShopManager] Could not find item type for itemId: ${itemInfo.itemId}`);
        return null;
    }

    const itemStack = new mc.ItemStack(itemType, quantity);

    // Handle enchantments
    if (itemInfo.enchantment) {
        try {
            const enchantable = itemStack.getComponent('minecraft:enchantable');
            if (enchantable) {
                enchantable.addEnchantment({
                    type: mc.EnchantmentTypes.get(itemInfo.enchantment.id)!,
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
 * Finds a shop item definition by its ID.
 * @param itemId The item ID to look up.
 * @returns The item definition or null if not found.
 */
function findShopItem(itemId: string): ItemInfo | null {
    const shopConfig = getShopConfig();
    const categories = shopConfig.categories;
    const items = allItems as Record<string, ItemInfo>;

    for (const categoryName in categories) {
        const category = categories[categoryName];
        if (category.items && category.items[itemId]) {
            return { ...items[itemId], ...category.items[itemId] };
        }
        if (category.subCategories) {
            for (const subCategoryName in category.subCategories) {
                const subCategory = category.subCategories[subCategoryName];
                if (subCategory.items && subCategory.items[itemId]) {
                    return { ...items[itemId], ...subCategory.items[itemId] };
                }
            }
        }
    }
    return null;
}

/**
 * Handles a player's request to buy an item from the shop.
 * @param player The player buying the item.
 * @param itemId The ID of the item from itemsConfig.js.
 * @param quantity The amount to buy.
 * @returns The result of the transaction.
 */
export function buyItem(player: mc.Player, itemId: string, quantity: number): ShopTransactionResult {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!shopItem) {
        return { success: false, message: '§cThis item is not available in the shop.' };
    }

    const buyPrice = shopItem.buyPrice;
    if (buyPrice === undefined || buyPrice <= 0) {
        return { success: false, message: '§cThis item cannot be purchased.' };
    }

    const pData = getOrCreatePlayer(player);
    const initialCost = buyPrice * quantity;

    if (pData.balance < 0) {
        return { success: false, message: '§cYou cannot purchase items while your balance is negative.' };
    }

    if (pData.balance < initialCost) {
        return {
            success: false,
            message: `§cInsufficient funds. You need §e${formatCurrency(initialCost)}§c to attempt this purchase.`
        };
    }

    const inventoryComp = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!inventoryComp || !inventoryComp.container) {
        return { success: false, message: '§cCould not access inventory.' };
    }
    const inventory = inventoryComp.container;
    const itemStackTemplate = createShopItemStack(shopItem, 1);

    if (!itemStackTemplate) {
        return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
    }

    // 1. Calculate true available space in inventory
    let spaceFound = 0;
    const maxStackSize = itemStackTemplate.maxAmount;

    if (maxStackSize > 1) {
        // Item is stackable
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) {
                spaceFound += maxStackSize;
            } else if (item.isStackableWith(itemStackTemplate)) {
                spaceFound += maxStackSize - item.amount;
            }
        }
    } else {
        // Item is not stackable
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
        return {
            success: false,
            message: `§cInsufficient funds. You need §e${formatCurrency(finalCost)}§c to buy ${finalQuantity}.`
        };
    }

    incrementPlayerBalance(player.id, -finalCost);

    // 4. Give items in stacks
    let remaining = finalQuantity;
    while (remaining > 0) {
        const amount = Math.min(remaining, itemStackTemplate.maxAmount);
        const stack = createShopItemStack(shopItem, amount);
        if (stack) {
            inventory.addItem(stack);
        }
        remaining -= amount;
    }

    return {
        success: true,
        message: `§2Successfully purchased ${finalQuantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(finalCost)}§2.`
    };
}

/**
 * Handles a player's request to sell an item to the shop.
 * @param player The player selling the item.
 * @param itemId The ID of the item from itemsConfig.js.
 * @param quantity The amount to sell.
 * @returns The result of the transaction.
 */
export function sellItem(player: mc.Player, itemId: string, quantity: number): ShopTransactionResult {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!shopItem) {
        return { success: false, message: '§cThis item cannot be sold to the shop.' };
    }

    const sellPrice = shopItem.sellPrice;
    if (sellPrice === undefined || sellPrice <= 0) {
        return { success: false, message: '§cThis item cannot be sold.' };
    }

    const inventoryComp = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!inventoryComp || !inventoryComp.container) {
        return { success: false, message: '§cCould not access inventory.' };
    }
    const inventory = inventoryComp.container;
    const itemType = mc.ItemTypes.get(shopItem.itemId);
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
    let remaining = quantity;
    for (let i = 0; i < inventory.size; i++) {
        if (remaining <= 0) break;
        const item = inventory.getItem(i);
        if (item && item.typeId === itemType.id) {
            if (item.amount <= remaining) {
                remaining -= item.amount;
                inventory.setItem(i, undefined);
            } else {
                item.amount -= remaining;
                remaining = 0;
                inventory.setItem(i, item);
            }
        }
    }

    // Success
    const totalGain = sellPrice * quantity;
    incrementPlayerBalance(player.id, totalGain);

    return {
        success: true,
        message: `§2Successfully sold ${quantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(totalGain)}§2.`
    };
}
