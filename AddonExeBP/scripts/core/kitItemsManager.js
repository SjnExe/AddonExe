import { getKitsConfig, saveKitsConfig } from './configurations.js';
import { errorLog } from './logger.js';
import { debugLog } from './logger.js';
import { ItemStack } from '@minecraft/server';

const MAX_KIT_SLOTS = 36;

/**
 * Adds an item to a kit.
 * @param {string} kitName - The name of the kit.
 * @param {object} itemInfo - The item to add.
 * @param {string} itemInfo.typeId - The item's type ID.
 * @param {number} itemInfo.amount - The amount of the item.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function addItemToKit(kitName, itemInfo) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    if (kit.items.length >= MAX_KIT_SLOTS) {
        return { success: false, message: `Kit '${kitName}' is full. Cannot add more items.` };
    }

    try {
        // Use an item stack to validate the item and get its max stack size
        const itemStack = new ItemStack(itemInfo.typeId, 1);
        const maxAmount = itemStack.maxAmount;

        if (itemInfo.amount > maxAmount) {
            itemInfo.amount = maxAmount;
            debugLog(`[KitItemsManager] Item amount for ${itemInfo.typeId} in kit ${kitName} exceeded max stack size. Capping at ${maxAmount}.`);
        }

        if (itemInfo.amount <= 0) {
            return { success: false, message: 'Item amount must be greater than 0.' };
        }

        kit.items.push(itemInfo);
        saveKitsConfig();
        debugLog(`[KitItemsManager] Added item ${itemInfo.typeId} x${itemInfo.amount} to kit ${kitName}`);
        return { success: true, message: 'Item added successfully.' };
    } catch (e) {
        errorLog(`[KitItemsManager] Failed to add item to kit: ${e.stack}`);
        return { success: false, message: `Invalid item type ID: ${itemInfo.typeId}` };
    }
}

/**
 * Removes an item from a kit by its index.
 * @param {string} kitName - The name of the kit.
 * @param {number} itemIndex - The index of the item to remove.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function removeItemFromKit(kitName, itemIndex) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    if (itemIndex < 0 || itemIndex >= kit.items.length) {
        return { success: false, message: 'Invalid item index.' };
    }

    kit.items.splice(itemIndex, 1);
    saveKitsConfig();
    debugLog(`[KitItemsManager] Removed item at index ${itemIndex} from kit ${kitName}`);
    return { success: true, message: 'Item removed successfully.' };
}

/**
 * Updates an item in a kit.
 * @param {string} kitName - The name of the kit.
 * @param {number} itemIndex - The index of the item to update.
 * @param {object} newItemInfo - The new item info.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
export function updateItemInKit(kitName, itemIndex, newItemInfo) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    if (itemIndex < 0 || itemIndex >= kit.items.length) {
        return { success: false, message: 'Invalid item index.' };
    }

    if (newItemInfo.amount <= 0) {
        // If amount is 0 or less, remove the item
        return removeItemFromKit(kitName, itemIndex);
    }

    try {
        const itemStack = new ItemStack(newItemInfo.typeId, 1);
        const maxAmount = itemStack.maxAmount;

        if (newItemInfo.amount > maxAmount) {
            newItemInfo.amount = maxAmount;
            debugLog(`[KitItemsManager] Item amount for ${newItemInfo.typeId} in kit ${kitName} exceeded max stack size. Capping at ${maxAmount}.`);
        }

        kit.items[itemIndex] = newItemInfo;
        saveKitsConfig();
        debugLog(`[KitItemsManager] Updated item at index ${itemIndex} in kit ${kitName}`);
        return { success: true, message: 'Item updated successfully.' };
    } catch (e) {
        errorLog(`[KitItemsManager] Failed to update item in kit: ${e.stack}`);
        return { success: false, message: `Invalid item type ID: ${newItemInfo.typeId}` };
    }
}
