import * as configManager from '@core/config/configManager.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { Kit } from '@features/economy/kit/adminManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';

const maxKitSlots = 36;

export interface EnchantmentInfo {
  id: string;
  level: number;
}

export interface ItemInfo {
  typeId: string;
  amount: number;
  nameTag?: string;
  lore?: string[];
  enchantments?: EnchantmentInfo[];
}

interface ActionResult {
  success: boolean;
  message: string;
}

/**
 * Adds an item to a kit.
 *
 * @param kitName - The name of the kit.
 * @param itemInfo - The item to add.
 * @returns The result of the operation.
 */
function validateAndClampKitItem(kitName: string, itemInfo: ItemInfo): ActionResult | null {
  try {
    const itemStack = new mc.ItemStack(itemInfo.typeId, 1);
    const maxAmount = itemStack.maxAmount;
    if (itemInfo.amount > maxAmount) {
      itemInfo.amount = maxAmount;
      debugLog(
        `[KitItemsManager] Item amount for ${itemInfo.typeId} in kit ${kitName} exceeded max stack size. Capping at ${maxAmount}.`,
      );
    }
    return null;
  } catch (error: unknown) {
    errorLog(
      `[KitItemsManager] Failed to validate item in kit: ${error instanceof Error ? error.stack : String(error)}`,
    );
    return { success: false, message: `Invalid item type ID: ${itemInfo.typeId}` };
  }
}

export function addItemToKit(kitName: string, itemInfo: ItemInfo): ActionResult {
  const config = configManager.getConfig();
  const kitDefinitions = config.kits.kitDefinitions as Record<string, Kit>;
  const kit = kitDefinitions[kitName];

  if (!isDefined(kit)) {
    return { success: false, message: `Kit '${kitName}' not found.` };
  }

  if (kit.items.length >= maxKitSlots) {
    return { success: false, message: `Kit '${kitName}' is full. Cannot add more items.` };
  }

  if (itemInfo.amount <= 0) {
    return { success: false, message: 'Item amount must be greater than 0.' };
  }

  const validationError = validateAndClampKitItem(kitName, itemInfo);
  if (validationError) {
    return validationError;
  }

  kit.items.push(itemInfo);
  configManager.updateMultipleConfig({
    'kits.kitDefinitions': kitDefinitions,
  });
  debugLog(`[KitItemsManager] Added item ${itemInfo.typeId} x${itemInfo.amount} to kit ${kitName}`);
  return { success: true, message: 'Item added successfully.' };
}

/** Adds the item currently held by the player to a kit. Preserves Name, Lore, and Enchantments. */
export function addItemFromHandToKit(kitName: string, player: mc.Player): ActionResult {
  const inventory = (player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent).container;
  if (!isDefined(inventory)) {
    return { success: false, message: 'Could not access inventory.' };
  }

  const item = inventory.getItem(player.selectedSlotIndex);
  if (!isDefined(item)) {
    return { success: false, message: 'You are not holding an item.' };
  }

  const enchantments: EnchantmentInfo[] = [];
  const enchantComp = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
  if (isDefined(enchantComp)) {
    const enchants = enchantComp.getEnchantments();
    for (const ench of enchants) {
      enchantments.push({ id: ench.type.id, level: ench.level });
    }
  }

  const itemInfo: ItemInfo = {
    typeId: item.typeId,
    amount: item.amount,
    lore: item.getLore(),
    ...(isNonEmptyString(item.nameTag) ? { nameTag: item.nameTag } : {}),
    ...(enchantments.length > 0 ? { enchantments } : {}),
  };

  return addItemToKit(kitName, itemInfo);
}

/**
 * Removes an item from a kit by its index.
 *
 * @param kitName - The name of the kit.
 * @param itemIndex - The index of the item to remove.
 * @returns The result of the operation.
 */
export function removeItemFromKit(kitName: string, itemIndex: number): ActionResult {
  const config = configManager.getConfig();
  const kitDefinitions = config.kits.kitDefinitions as Record<string, Kit>;
  const kit = kitDefinitions[kitName];

  if (!isDefined(kit)) {
    return { success: false, message: `Kit '${kitName}' not found.` };
  }

  if (itemIndex < 0 || itemIndex >= kit.items.length) {
    return { success: false, message: 'Invalid item index.' };
  }

  kit.items.splice(itemIndex, 1);
  configManager.updateMultipleConfig({
    'kits.kitDefinitions': kitDefinitions,
  });
  debugLog(`[KitItemsManager] Removed item at index ${itemIndex} from kit ${kitName}`);
  return { success: true, message: 'Item removed successfully.' };
}

/**
 * Updates an item in a kit.
 *
 * @param kitName - The name of the kit.
 * @param itemIndex - The index of the item to update.
 * @param newItemInfo - The new item info.
 * @returns The result of the operation.
 */
export function updateItemInKit(kitName: string, itemIndex: number, newItemInfo: ItemInfo): ActionResult {
  const config = configManager.getConfig();
  const kitDefinitions = config.kits.kitDefinitions as Record<string, Kit>;
  const kit = kitDefinitions[kitName];

  if (!isDefined(kit)) {
    return { success: false, message: `Kit '${kitName}' not found.` };
  }

  if (itemIndex < 0 || itemIndex >= kit.items.length) {
    return { success: false, message: 'Invalid item index.' };
  }

  if (newItemInfo.amount <= 0) {
    // If amount is 0 or less, remove the item
    return removeItemFromKit(kitName, itemIndex);
  }

  const validationError = validateAndClampKitItem(kitName, newItemInfo);
  if (validationError) {
    return validationError;
  }

  kit.items[itemIndex] = newItemInfo;
  configManager.updateMultipleConfig({
    'kits.kitDefinitions': kitDefinitions,
  });
  debugLog(`[KitItemsManager] Updated item at index ${itemIndex} in kit ${kitName}`);
  return { success: true, message: 'Item updated successfully.' };
}
