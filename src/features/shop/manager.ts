import { ItemComponentTypes } from '@minecraft/server';

import * as mc from '@minecraft/server';

import { getShopConfig } from '@core/configurations.js';
import { errorLog } from '@core/logger.js';
import { getPlayerRanks } from '@core/permissionEngine.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/playerDataManager.js';
import { formatCurrency } from '@core/utils.js';
import { items as allItems } from '@features/shop/itemsConfig.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

export interface ItemInfo {
    itemId: string;
    displayName?: string;
    enchantment?: { id: string; level: number };
    buyPrice?: number;
    sellPrice?: number;
    rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
}

interface ShopTransactionResult {
    success: boolean;
    message: string;
}

/**
 * Creates an ItemStack for a given item ID, handling enchantments.
 * @param itemInfo The item info object.
 * @param quantity The amount of items.
 * @returns The created ItemStack or undefined if failed.
 */
function createShopItemStack(itemInfo: ItemInfo, quantity: number): mc.ItemStack | undefined {
    if (!isDefined(itemInfo)) {
        errorLog('[ShopManager] Could not find item info for creating item stack.');
        return undefined;
    }

    const itemType = mc.ItemTypes.get(itemInfo.itemId);
    if (!isDefined(itemType)) {
        errorLog(`[ShopManager] Could not find item type for itemId: ${itemInfo.itemId}`);
        return undefined;
    }

    const itemStack = new mc.ItemStack(itemType, quantity);

    // Handle enchantments
    if (isDefined(itemInfo.enchantment)) {
        try {
            const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
            if (isDefined(enchantable)) {
                enchantable.addEnchantment({
                    type: mc.EnchantmentTypes.get(itemInfo.enchantment.id)!,
                    level: itemInfo.enchantment.level
                });
            }
        } catch (error) {
            errorLog(`[ShopManager] Failed to apply enchantment for ${itemInfo.itemId}:`, error);
        }
    }

    if (isNonEmptyString(itemInfo.displayName)) {
        itemStack.nameTag = `§r${itemInfo.displayName}`;
    }

    return itemStack;
}

/**
 * Finds a shop item definition by its ID.
 * @param itemId The item ID to look up.
 * @returns The item definition or undefined if not found.
 */
export function findShopItem(itemId: string): ItemInfo | undefined {
    const shopConfig = getShopConfig();
    const categories = shopConfig.categories;
    const items = allItems as Record<string, ItemInfo>;

    for (const categoryName in categories) {
        const category = categories[categoryName];
        if (!isDefined(category)) continue;
        if (isDefined(category.items) && isDefined(category.items[itemId])) {
            return { ...items[itemId], ...category.items[itemId], itemId: itemId };
        }
        if (isDefined(category.subCategories)) {
            for (const subCategoryName in category.subCategories) {
                const subCategory = category.subCategories[subCategoryName];
                if (isDefined(subCategory) && isDefined(subCategory.items) && isDefined(subCategory.items[itemId])) {
                    return { ...items[itemId], ...subCategory.items[itemId], itemId: itemId };
                }
            }
        }
    }
    return undefined;
}

/**
 * Calculates the dynamic price of an item based on the player's ranks and item overrides.
 * @param player The player to calculate the price for.
 * @param shopItem The shop item definition.
 * @param type Whether we are calculating 'buy' or 'sell' price.
 * @returns The calculated price, rounded to 2 decimal places.
 */
export function getPlayerShopItemPrice(player: mc.Player, shopItem: ItemInfo, type: 'buy' | 'sell'): number {
    const basePrice = type === 'buy' ? shopItem.buyPrice : shopItem.sellPrice;
    if (!isDefined(basePrice) || basePrice <= 0) return basePrice ?? -1;

    const ranks = getPlayerRanks(player);
    let bestMultiplier = 1;

    for (const rank of ranks) {
        let currentMultiplier = 1;

        // First check item-specific override for this rank
        if (isDefined(shopItem.rankMultiplierOverrides) && isDefined(shopItem.rankMultiplierOverrides[rank.id])) {
            currentMultiplier = shopItem.rankMultiplierOverrides[rank.id]![type];
        }
        // Fallback to global rank multiplier
        else if (isDefined(rank.shopMultiplier)) {
            currentMultiplier = rank.shopMultiplier[type];
        }

        // We want the lowest buy price (lowest multiplier) and highest sell price (highest multiplier)
        if (type === 'buy') {
            if (currentMultiplier < bestMultiplier) bestMultiplier = currentMultiplier;
        } else {
            if (currentMultiplier > bestMultiplier) bestMultiplier = currentMultiplier;
        }
    }

    const calculatedPrice = basePrice * bestMultiplier;
    return Math.round(calculatedPrice * 100) / 100;
}

/**
 * Calculates the actual available space in an inventory for a specific item stack.
 * @param inventory The inventory container.
 * @param itemStackTemplate The template item stack to check space for.
 * @returns The total count of items that can be added.
 */
function calculateInventorySpace(inventory: mc.Container, itemStackTemplate: mc.ItemStack): number {
    let spaceFound = 0;
    const maxStackSize = itemStackTemplate.maxAmount;

    if (maxStackSize > 1) {
        // Item is stackable
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!isDefined(item)) {
                spaceFound += maxStackSize;
            } else if (item.isStackableWith(itemStackTemplate)) {
                spaceFound += maxStackSize - item.amount;
            }
        }
    } else {
        // Item is not stackable
        spaceFound = inventory.emptySlotsCount;
    }
    return spaceFound;
}

/**
 * Handles a player's request to buy an item from the shop.
 * @param player The player buying the item.
 * @param itemId The ID of the item from itemsConfig.js.
 * @param quantity The amount to buy.
 * @returns The result of the transaction.
 */
export function buyItem(player: mc.Player, itemId: string, quantity: number): ShopTransactionResult {
    if (quantity <= 0 && quantity !== -1) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!isDefined(shopItem)) {
        return { success: false, message: '§cThis item is not available in the shop.' };
    }

    const buyPrice = getPlayerShopItemPrice(player, shopItem, 'buy');
    if (!isDefined(buyPrice) || buyPrice <= 0) {
        return { success: false, message: '§cThis item cannot be purchased.' };
    }

    const pData = getOrCreatePlayer(player);
    if (pData.balance < 0) {
        return { success: false, message: '§cYou cannot purchase items while your balance is negative.' };
    }

    let targetQuantity = quantity;

    // Handle Buy Max (-1)
    if (targetQuantity === -1) {
        const maxAffordable = Math.floor(pData.balance / buyPrice);
        if (maxAffordable <= 0) {
            return { success: false, message: '§cInsufficient funds to buy any items.' };
        }
        targetQuantity = maxAffordable;
    }

    const initialCost = buyPrice * targetQuantity;

    if (pData.balance < initialCost) {
        return {
            success: false,
            message: `§cInsufficient funds. You need §e${formatCurrency(initialCost)}§c to attempt this purchase.`
        };
    }

    const inventoryComp = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
        return { success: false, message: '§cCould not access inventory.' };
    }
    const inventory = inventoryComp.container;
    const itemStackTemplate = createShopItemStack(shopItem, 1);

    if (!isDefined(itemStackTemplate)) {
        return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
    }

    // 1. Calculate true available space in inventory
    const spaceFound = calculateInventorySpace(inventory, itemStackTemplate);

    // 2. Validate and adjust quantity based on space
    if (spaceFound === 0) {
        return { success: false, message: '§cYou have no space for this item.' };
    }

    let finalQuantity = targetQuantity;
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
    let failedCount = 0;

    while (remaining > 0) {
        const amount = Math.min(remaining, itemStackTemplate.maxAmount);
        const stack = createShopItemStack(shopItem, amount);
        if (isDefined(stack)) {
            const leftovers = inventory.addItem(stack);
            if (isDefined(leftovers)) {
                failedCount += leftovers.amount;
                // If we couldn't fit this stack, we likely can't fit the rest
                failedCount += remaining - amount;
                break;
            }
        } else {
            failedCount += amount; // Failed to create item
        }
        remaining -= amount;
    }

    if (failedCount > 0) {
        const refund = failedCount * buyPrice;
        incrementPlayerBalance(player.id, refund);
        return {
            success: true,
            message: `§2Purchased ${finalQuantity - failedCount}x ${shopItem.displayName ?? itemId}. Refunded §e${formatCurrency(refund)}§2 for ${failedCount} items that didn't fit.`
        };
    }

    return {
        success: true,
        message: `§2Successfully purchased ${finalQuantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(finalCost)}§2.`
    };
}

/**
 * Checks if an item from the player's inventory is valid to be sold as a specific shop item.
 * @param item The item stack from inventory.
 * @param shopItem The shop definition.
 * @returns True if the item matches and is valid for sale.
 */
function isValidSellItem(item: mc.ItemStack, shopItem: ItemInfo): boolean {
    if (item.typeId !== shopItem.itemId) return false;

    // Exploit Prevention: Skip damaged or enchanted items unless explicitly allowed
    const durability = item.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent;
    if (isDefined(durability) && durability.damage > 0) {
        return false;
    }

    const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
    const hasEnchants = isDefined(enchantable) && enchantable.getEnchantments().length > 0;
    if (hasEnchants && !isDefined(shopItem.enchantment)) {
        return false;
    }

    return true;
}

/**
 * Handles a player's request to sell an item to the shop.
 * @param player The player selling the item.
 * @param itemId The ID of the item from itemsConfig.js.
 * @param quantity The amount to sell.
 * @returns The result of the transaction.
 */
export function sellItem(player: mc.Player, itemId: string, quantity: number): ShopTransactionResult {
    if (quantity <= 0 && quantity !== -1) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!isDefined(shopItem)) {
        return { success: false, message: '§cThis item cannot be sold to the shop.' };
    }

    const sellPrice = getPlayerShopItemPrice(player, shopItem, 'sell');
    if (!isDefined(sellPrice) || sellPrice <= 0) {
        return { success: false, message: '§cThis item cannot be sold.' };
    }

    const inventoryComp = player.getComponent('inventory') as mc.EntityInventoryComponent;
    if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
        return { success: false, message: '§cCould not access inventory.' };
    }
    const inventory = inventoryComp.container;
    const itemType = mc.ItemTypes.get(shopItem.itemId);
    if (!isDefined(itemType)) {
        return { success: false, message: '§cInternal server error: Item type not found.' };
    }

    // Check if player has enough items
    let count = 0;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (isDefined(item) && isValidSellItem(item, shopItem)) {
            count += item.amount;
        }
    }

    let targetQuantity = quantity;
    if (targetQuantity === -1) {
        targetQuantity = count;
    }

    if (targetQuantity === 0) {
        return { success: false, message: '§cYou have none of this item to sell.' };
    }

    if (count < targetQuantity) {
        return { success: false, message: `§cYou do not have enough of this item. You only have ${count}.` };
    }

    // Remove items
    let remaining = targetQuantity;
    for (let i = 0; i < inventory.size; i++) {
        if (remaining <= 0) break;
        const item = inventory.getItem(i);
        if (isDefined(item) && isValidSellItem(item, shopItem)) {
            if (item.amount <= remaining) {
                remaining -= item.amount;
                inventory.setItem(i);
            } else {
                item.amount -= remaining;
                remaining = 0;
                inventory.setItem(i, item);
            }
        }
    }

    // Success
    const totalGain = sellPrice * targetQuantity;
    incrementPlayerBalance(player.id, totalGain);

    return {
        success: true,
        message: `§2Successfully sold ${targetQuantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(totalGain)}§2.`
    };
}
