import { getEconomyConfig, getShopConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { getPlayerRanks, hasPermission } from '@core/permissions/permissionEngine.js';
import { formatCurrency } from '@core/utils/index.js';
import { errorLog } from '@core/utils/logger.js';
import { items as allItems } from '@features/economy/shop/itemsConfig.js';
import {
  calculateInventorySpaceForItem,
  countMatchingInventoryItems,
  resolveTradeItemMetadata,
} from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';

/** Resolved shop item configuration and pricing metadata. */
export interface ItemInfo {
  itemId: string;
  displayName?: string;
  permission?: string;
  enchantment?: { id: string; level: number };
  buyPrice?: number;
  sellPrice?: number;
  rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
  dailyBuyLimit?: number;
  dailySellLimit?: number;
  limitScope?: 'player' | 'global';
}

let currentLimitDayKey = '';
const dailyShopUsage = new Map<string, number>();

function getTodayLimitKey(): string {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== currentLimitDayKey) {
    currentLimitDayKey = day;
    dailyShopUsage.clear();
  }
  return day;
}

export function getPlayerShopLimitMultiplier(player: mc.Player): number {
  const ranks = getPlayerRanks(player);
  let best = 1;
  for (const r of ranks) {
    if (isDefined(r.shopLimitMultiplier) && r.shopLimitMultiplier > best) {
      best = r.shopLimitMultiplier;
    }
  }
  return best;
}

export function getRemainingDailyShopQuota(
  player: mc.Player,
  itemKey: string,
  shopItem: ItemInfo,
  mode: 'buy' | 'sell',
): number {
  const baseLimit = mode === 'buy' ? Number(shopItem.dailyBuyLimit ?? 0) : Number(shopItem.dailySellLimit ?? 0);
  if (!baseLimit || baseLimit <= 0) {
    return Infinity;
  }
  getTodayLimitKey();
  const isGlobal = shopItem.limitScope === 'global';
  const effectiveMax = isGlobal ? Math.floor(baseLimit) : Math.floor(baseLimit * getPlayerShopLimitMultiplier(player));
  const mapKey = isGlobal ? `global:${mode}:${itemKey}` : `${player.id}:${mode}:${itemKey}`;
  const used = dailyShopUsage.get(mapKey) ?? 0;
  return Math.max(0, effectiveMax - used);
}

function recordDailyShopUsage(
  player: mc.Player,
  itemKey: string,
  shopItem: ItemInfo,
  mode: 'buy' | 'sell',
  amount: number,
): void {
  const baseLimit = mode === 'buy' ? Number(shopItem.dailyBuyLimit ?? 0) : Number(shopItem.dailySellLimit ?? 0);
  if (!baseLimit || baseLimit <= 0 || amount <= 0) {
    return;
  }
  getTodayLimitKey();
  const isGlobal = shopItem.limitScope === 'global';
  const mapKey = isGlobal ? `global:${mode}:${itemKey}` : `${player.id}:${mode}:${itemKey}`;
  dailyShopUsage.set(mapKey, (dailyShopUsage.get(mapKey) ?? 0) + amount);
}

interface ShopTransactionResult {
  success: boolean;
  message: string;
}

/**
 * Creates an ItemStack for a given item ID, handling enchantments.
 *
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
          level: itemInfo.enchantment.level,
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
 *
 * @param itemId The item ID to look up.
 * @returns The item definition or undefined if not found.
 */
let cachedItemByKeyMap: Map<string, ItemInfo> | undefined;
let cachedItemByTypeIdMap: Map<string, { itemKey: string; shopItem: ItemInfo }[]> | undefined;
let cachedReverseSellMap: Map<string, { itemKey: string; shopItem: ItemInfo }[]> | undefined;

export function invalidateShopLookupCache(): void {
  cachedItemByKeyMap = undefined;
  cachedItemByTypeIdMap = undefined;
  cachedReverseSellMap = undefined;
  dailyShopUsage.clear();
}

function ensureShopLookupCaches(): void {
  if (isDefined(cachedItemByKeyMap) && isDefined(cachedItemByTypeIdMap) && isDefined(cachedReverseSellMap)) {
    return;
  }

  const byKey = new Map<string, ItemInfo>();
  const byTypeId = new Map<string, { itemKey: string; shopItem: ItemInfo }[]>();
  const sellMap = new Map<string, { itemKey: string; shopItem: ItemInfo }[]>();

  const shopConfig = getShopConfig();
  const categories = shopConfig.categories;
  const items = allItems as Record<string, ItemInfo>;

  const registerEntry = (itemKey: string, rawEntry: unknown) => {
    if (byKey.has(itemKey)) {
      return;
    }
    const raw = { ...items[itemKey], ...(rawEntry as Record<string, unknown>) };
    const meta = resolveTradeItemMetadata(itemKey, raw);
    const resolved: ItemInfo = {
      ...raw,
      itemId: meta.itemId,
      displayName: meta.displayName,
      ...(isDefined(meta.enchantment) ? { enchantment: meta.enchantment } : {}),
    };
    byKey.set(itemKey, resolved);
    if (!isDefined(resolved.enchantment)) {
      const list = byTypeId.get(resolved.itemId) ?? [];
      list.push({ itemKey, shopItem: resolved });
      byTypeId.set(resolved.itemId, list);
    }
    if (isDefined(resolved.sellPrice) && resolved.sellPrice > 0 && !isDefined(resolved.enchantment)) {
      const candidates = sellMap.get(resolved.itemId) ?? [];
      candidates.push({ itemKey, shopItem: resolved });
      sellMap.set(resolved.itemId, candidates);
    }
  };

  for (const categoryName in categories) {
    const category = categories[categoryName];
    if (!isDefined(category)) {
      continue;
    }
    if (isDefined(category.items)) {
      for (const [k, v] of Object.entries(category.items)) {
        registerEntry(k, v);
      }
    }
    if (isDefined(category.subCategories)) {
      for (const subCategory of Object.values(category.subCategories)) {
        if (isDefined(subCategory?.items)) {
          for (const [k, v] of Object.entries(subCategory.items)) {
            registerEntry(k, v);
          }
        }
      }
    }
  }

  cachedItemByKeyMap = byKey;
  cachedItemByTypeIdMap = byTypeId;
  cachedReverseSellMap = sellMap;
}

export function findShopItem(itemKey: string): ItemInfo | undefined {
  ensureShopLookupCaches();
  return cachedItemByKeyMap?.get(itemKey);
}

/**
 * Finds the best matching shop listing for a given Minecraft item type ID.
 *
 * @param typeId Minecraft item type ID.
 * @param player Optional player used to prefer permitted/sellable listings.
 * @param mode Optional `'sell'` mode to prefer listings with positive sell price and remaining quota.
 * @returns Matching shop entry or undefined if not found.
 */
export function findShopItemByTypeId(
  typeId: string,
  player?: mc.Player,
  mode?: 'sell',
): { itemKey: string; shopItem: ItemInfo } | undefined {
  ensureShopLookupCaches();
  const candidates = cachedItemByTypeIdMap?.get(typeId);
  if (!isDefined(candidates) || candidates.length === 0) {
    return undefined;
  }
  if (!isDefined(player)) {
    return candidates[0];
  }
  const hasEntryPermission = (entry: { itemKey: string; shopItem: ItemInfo }) =>
    !isNonEmptyString(entry.shopItem.permission) || hasPermission(player, entry.shopItem.permission);

  if (mode === 'sell') {
    const sellCandidates = cachedReverseSellMap?.get(typeId) ?? candidates;
    const withQuota = sellCandidates.find((entry) => {
      if (!isDefined(entry.shopItem.sellPrice) || entry.shopItem.sellPrice <= 0 || !hasEntryPermission(entry)) {
        return false;
      }
      const unitPrice = getPlayerShopItemPrice(player, entry.shopItem, 'sell');
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return false;
      }
      return getRemainingDailyShopQuota(player, entry.itemKey, entry.shopItem, 'sell') > 0;
    });
    if (isDefined(withQuota)) {
      return withQuota;
    }
    const sellable = sellCandidates.find(
      (entry) => isDefined(entry.shopItem.sellPrice) && entry.shopItem.sellPrice > 0 && hasEntryPermission(entry),
    );
    return sellable ?? candidates[0];
  }

  return candidates.find(hasEntryPermission) ?? candidates[0];
}

export function getPlayerInventoryShopItemCount(player: mc.Player, itemKey: string): number {
  const shopItem = findShopItem(itemKey);
  if (!isDefined(shopItem)) {
    return 0;
  }
  const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  if (!isDefined(inventoryComp?.container)) {
    return 0;
  }
  return countMatchingInventoryItems(inventoryComp.container, (stack) => isValidSellItem(stack, shopItem));
}

/**
 * Calculates the dynamic price of an item based on the player's ranks and item overrides.
 *
 * @param player The player to calculate the price for.
 * @param shopItem The shop item definition.
 * @param type Whether we are calculating 'buy' or 'sell' price.
 * @returns The calculated price, rounded to 2 decimal places.
 */
export function getPlayerShopItemPrice(player: mc.Player, shopItem: ItemInfo, type: 'buy' | 'sell'): number {
  const basePrice = type === 'buy' ? shopItem.buyPrice : shopItem.sellPrice;
  if (!isDefined(basePrice) || basePrice <= 0) {
    return basePrice ?? -1;
  }

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
      if (currentMultiplier < bestMultiplier) {
        bestMultiplier = currentMultiplier;
      }
    } else {
      if (currentMultiplier > bestMultiplier) {
        bestMultiplier = currentMultiplier;
      }
    }
  }

  const calculatedPrice = basePrice * bestMultiplier;
  return Math.round(calculatedPrice * 100) / 100;
}

/**
 * Handles a player's request to buy an item from the shop.
 *
 * @param player The player buying the item.
 * @param itemId The ID of the item from itemsConfig.js.
 * @param quantity The amount to buy.
 * @returns The result of the transaction.
 */
export function buyItem(player: mc.Player, itemId: string, quantity: number): ShopTransactionResult {
  if (quantity !== -1 && (!Number.isInteger(quantity) || quantity <= 0)) {
    return { success: false, message: '§cQuantity must be a positive integer.' };
  }

  const shopItem = findShopItem(itemId);

  if (!isDefined(shopItem)) {
    return { success: false, message: '§cThis item is not available in the shop.' };
  }

  if (isNonEmptyString(shopItem.permission) && !hasPermission(player, shopItem.permission)) {
    return { success: false, message: '§cYou do not have permission to purchase this item.' };
  }

  const buyPrice = getPlayerShopItemPrice(player, shopItem, 'buy');
  if (!isDefined(buyPrice) || buyPrice <= 0) {
    return { success: false, message: '§cThis item cannot be purchased.' };
  }

  const pData = getOrCreatePlayer(player);
  if (pData.balance < 0) {
    return { success: false, message: '§cYou cannot purchase items while your balance is negative.' };
  }

  const remainingBuyQuota = getRemainingDailyShopQuota(player, itemId, shopItem, 'buy');
  if (remainingBuyQuota <= 0) {
    return {
      success: false,
      message: `§cDaily buy limit reached for ${shopItem.displayName ?? itemId}. Try again tomorrow!`,
    };
  }

  let targetQuantity = quantity;

  // Handle Buy Max (-1)
  if (targetQuantity === -1) {
    const maxAffordable = Math.floor(pData.balance / buyPrice);
    if (maxAffordable <= 0) {
      return { success: false, message: '§cInsufficient funds to buy any items.' };
    }
    targetQuantity = Math.min(maxAffordable, remainingBuyQuota);
  } else if (targetQuantity > remainingBuyQuota) {
    targetQuantity = remainingBuyQuota;
    player.sendMessage(`§eNotice: Capped purchase to your remaining daily buy limit (${remainingBuyQuota}).`);
  }

  const initialCost = buyPrice * targetQuantity;

  if (pData.balance < initialCost) {
    return {
      success: false,
      message: `§cInsufficient funds. You need §e${formatCurrency(initialCost)}§c to attempt this purchase.`,
    };
  }

  const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent;
  if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
    return { success: false, message: '§cCould not access inventory.' };
  }
  const inventory = inventoryComp.container;
  const itemStackTemplate = createShopItemStack(shopItem, 1);

  if (!isDefined(itemStackTemplate)) {
    return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
  }

  // 1. Calculate true available space in inventory
  const spaceFound = calculateInventorySpaceForItem(inventory, itemStackTemplate);

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
      message: `§cInsufficient funds. You need §e${formatCurrency(finalCost)}§c to buy ${finalQuantity}.`,
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
    const delivered = finalQuantity - failedCount;
    if (delivered > 0) {
      recordDailyShopUsage(player, itemId, shopItem, 'buy', delivered);
    }
    const refund = failedCount * buyPrice;
    incrementPlayerBalance(player.id, refund);
    return {
      success: true,
      message: `§2Purchased ${delivered}x ${shopItem.displayName ?? itemId}. Refunded §e${formatCurrency(refund)}§2 for ${failedCount} items that didn't fit.`,
    };
  }

  recordDailyShopUsage(player, itemId, shopItem, 'buy', finalQuantity - failedCount);
  return {
    success: true,
    message: `§2Successfully purchased ${finalQuantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(finalCost)}§2.`,
  };
}

function hasStoredInventoryContents(item: mc.ItemStack): boolean {
  const invComp = item.getComponent(ItemComponentTypes.Inventory) as mc.ItemInventoryComponent | undefined;
  return isDefined(invComp?.container) && invComp.container.emptySlotsCount < invComp.container.size;
}

/**
 * Checks if an item from the player's inventory is valid to be sold as a specific shop item.
 *
 * @param item The item stack from inventory.
 * @param shopItem The shop definition.
 * @returns True if the item matches and is valid for sale.
 */
function isValidSellItem(item: mc.ItemStack, shopItem: ItemInfo): boolean {
  if (item.typeId !== shopItem.itemId) {
    return false;
  }

  // Exploit Prevention: Skip damaged or enchanted items unless explicitly allowed
  const durability = item.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent;
  if (isDefined(durability) && durability.damage > 0) {
    return false;
  }

  if (hasStoredInventoryContents(item)) {
    return false;
  }

  const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent;
  const enchants = isDefined(enchantable) ? enchantable.getEnchantments() : [];
  if (!isDefined(shopItem.enchantment)) {
    if (enchants.length > 0) {
      return false;
    }
  } else {
    const req = shopItem.enchantment;
    const hasRequired = enchants.some((e) => e.type.id === req.id && e.level >= req.level);
    if (!hasRequired) {
      return false;
    }
  }

  return true;
}

/**
 * Handles a player's request to sell an item to the shop.
 *
 * @param player The player selling the item.
 * @param itemId The ID of the item from itemsConfig.js.
 * @param quantity The amount to sell.
 * @returns The result of the transaction.
 */
export function sellItem(player: mc.Player, itemId: string, quantity: number): ShopTransactionResult {
  if (quantity !== -1 && (!Number.isInteger(quantity) || quantity <= 0)) {
    return { success: false, message: '§cQuantity must be a positive integer.' };
  }

  const shopItem = findShopItem(itemId);

  if (!isDefined(shopItem)) {
    return { success: false, message: '§cThis item cannot be sold to the shop.' };
  }

  if (isNonEmptyString(shopItem.permission) && !hasPermission(player, shopItem.permission)) {
    return { success: false, message: '§cYou do not have permission to sell this item.' };
  }

  const sellPrice = getPlayerShopItemPrice(player, shopItem, 'sell');
  if (!isDefined(sellPrice) || sellPrice <= 0) {
    return { success: false, message: '§cThis item cannot be sold.' };
  }

  const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent;
  if (!isDefined(inventoryComp) || !isDefined(inventoryComp.container)) {
    return { success: false, message: '§cCould not access inventory.' };
  }
  const inventory = inventoryComp.container;
  if (isDefined(mc.ItemTypes) && !isDefined(mc.ItemTypes.get(shopItem.itemId))) {
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

  const remainingSellQuota = getRemainingDailyShopQuota(player, itemId, shopItem, 'sell');
  if (remainingSellQuota <= 0) {
    return {
      success: false,
      message: `§cDaily sell limit reached for ${shopItem.displayName ?? itemId}. Higher ranks unlock larger daily limits!`,
    };
  }

  let targetQuantity = quantity;
  if (targetQuantity === -1) {
    targetQuantity = Math.min(count, remainingSellQuota);
  } else if (targetQuantity > remainingSellQuota) {
    targetQuantity = remainingSellQuota;
    player.sendMessage(`§eNotice: Capped sale to your remaining daily sell limit (${remainingSellQuota}).`);
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
    if (remaining <= 0) {
      break;
    }
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
  recordDailyShopUsage(player, itemId, shopItem, 'sell', targetQuantity);
  const totalGain = Math.round(sellPrice * targetQuantity * 100) / 100;
  incrementPlayerBalance(player.id, totalGain);

  return {
    success: true,
    message: `§2Successfully sold ${targetQuantity}x ${shopItem.displayName ?? itemId} for §e${formatCurrency(totalGain)}§2.`,
  };
}

/** Summary of sellable items and payout calculated for a sell-all preview. */
export interface SellAllPreview {
  totalItems: number;
  distinctTypes: number;
  totalPayout: number;
  breakdown: { itemKey: string; displayName: string; count: number; payout: number }[];
  overflowed?: boolean;
}

function buildReverseSellMap(): Map<string, { itemKey: string; shopItem: ItemInfo }[]> {
  ensureShopLookupCaches();
  return cachedReverseSellMap ?? new Map();
}

function isSellableStackConditionMet(stack: mc.ItemStack): boolean {
  const durability = stack.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
  if (isDefined(durability) && durability.damage > 0) {
    return false;
  }
  if (hasStoredInventoryContents(stack)) {
    return false;
  }
  const enchantable = stack.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
  if (isDefined(enchantable) && enchantable.getEnchantments().length > 0) {
    return false;
  }
  return true;
}

interface PlannedSellAll {
  preview: SellAllPreview;
  soldByItemKey: Map<string, { shopItem: ItemInfo; count: number }>;
  slotMutations: { slotIndex: number; originalAmount: number; remainingAmount: number; stack: mc.ItemStack }[];
  overflowed: boolean;
}

function planSellAllInventory(player: mc.Player, container: mc.Container): PlannedSellAll {
  const sellMap = buildReverseSellMap();
  const remainingQuotas = new Map<string, number>();
  const soldByItemKey = new Map<string, { shopItem: ItemInfo; count: number; payout: number }>();
  const soldTypeIds = new Set<string>();
  const slotMutations: { slotIndex: number; originalAmount: number; remainingAmount: number; stack: mc.ItemStack }[] =
    [];
  let totalItems = 0;
  let totalPayout = 0;
  let overflowed = false;

  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (!isDefined(stack)) {
      continue;
    }
    const candidates = sellMap.get(stack.typeId);
    if (!isDefined(candidates) || candidates.length === 0 || !isSellableStackConditionMet(stack)) {
      continue;
    }

    let remaining = stack.amount;
    for (const candidate of candidates) {
      if (remaining <= 0) {
        break;
      }
      const cachedQuota = remainingQuotas.get(candidate.itemKey);
      if (isDefined(cachedQuota) && cachedQuota <= 0) {
        continue;
      }
      if (isNonEmptyString(candidate.shopItem.permission) && !hasPermission(player, candidate.shopItem.permission)) {
        continue;
      }
      const unitPrice = getPlayerShopItemPrice(player, candidate.shopItem, 'sell');
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        continue;
      }
      const quota = isDefined(cachedQuota)
        ? cachedQuota
        : getRemainingDailyShopQuota(player, candidate.itemKey, candidate.shopItem, 'sell');
      remainingQuotas.set(candidate.itemKey, quota);
      if (quota <= 0) {
        continue;
      }

      const toSell = Math.min(remaining, quota);
      const payout = Math.round(unitPrice * toSell * 100) / 100;
      const nextTotalPayout = Math.round((totalPayout + payout) * 100) / 100;
      if (!Number.isFinite(payout) || payout <= 0 || !Number.isFinite(nextTotalPayout)) {
        overflowed = true;
        break;
      }

      remainingQuotas.set(candidate.itemKey, quota - toSell);
      remaining -= toSell;
      totalItems += toSell;
      totalPayout = nextTotalPayout;
      soldTypeIds.add(stack.typeId);

      const existing = soldByItemKey.get(candidate.itemKey);
      if (isDefined(existing)) {
        existing.count += toSell;
        existing.payout = Math.round((existing.payout + payout) * 100) / 100;
      } else {
        soldByItemKey.set(candidate.itemKey, {
          shopItem: candidate.shopItem,
          count: toSell,
          payout,
        });
      }
    }

    if (overflowed) {
      break;
    }
    if (remaining < stack.amount) {
      slotMutations.push({
        slotIndex: i,
        originalAmount: stack.amount,
        remainingAmount: remaining,
        stack,
      });
    }
  }

  const breakdown = [...soldByItemKey.entries()].map(([itemKey, entry]) => ({
    itemKey,
    displayName: entry.shopItem.displayName ?? itemKey,
    count: entry.count,
    payout: entry.payout,
  }));

  return {
    preview: {
      totalItems,
      distinctTypes: soldTypeIds.size,
      totalPayout,
      breakdown,
    },
    soldByItemKey,
    slotMutations,
    overflowed,
  };
}

/**
 * Previews all sellable items in a player's inventory, respecting permissions and daily sell limits.
 *
 * @param player The player whose inventory is previewed.
 * @returns Breakdown and totals of sellable items.
 */
export function previewSellAllInventory(player: mc.Player): SellAllPreview {
  const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const container = inventoryComp?.container;
  if (!isDefined(container)) {
    return { totalItems: 0, distinctTypes: 0, totalPayout: 0, breakdown: [] };
  }
  const plan = planSellAllInventory(player, container);
  if (plan.overflowed) {
    return { totalItems: 0, distinctTypes: 0, totalPayout: 0, breakdown: [], overflowed: true };
  }
  return plan.preview;
}

function doBreakdownsMatch(
  expected: { itemKey: string; count: number }[],
  actual: { itemKey: string; count: number }[],
): boolean {
  const expectedMap = new Map<string, number>();
  for (const entry of expected) {
    expectedMap.set(entry.itemKey, (expectedMap.get(entry.itemKey) ?? 0) + entry.count);
  }
  const actualMap = new Map<string, number>();
  for (const entry of actual) {
    actualMap.set(entry.itemKey, (actualMap.get(entry.itemKey) ?? 0) + entry.count);
  }
  if (expectedMap.size !== actualMap.size) {
    return false;
  }
  for (const [key, count] of expectedMap) {
    if (actualMap.get(key) !== count) {
      return false;
    }
  }
  return true;
}

/**
 * Sells all eligible items in a player's inventory while enforcing permissions, balance limits, and daily sell limits.
 *
 * @param player The player selling their inventory.
 * @param expectedQuote Optional previously confirmed quote to guard against mid-confirmation price/quota shifts.
 * @returns The transaction result.
 */
export function executeSellAllInventory(
  player: mc.Player,
  expectedQuote?: { totalItems: number; totalPayout: number; breakdown?: { itemKey: string; count: number }[] },
): ShopTransactionResult & { quoteChanged?: boolean; updatedPreview?: SellAllPreview } {
  const inventoryComp = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const container = inventoryComp?.container;
  if (!isDefined(container)) {
    return { success: false, message: '§cCould not access inventory.' };
  }

  const plan = planSellAllInventory(player, container);
  if (plan.overflowed) {
    return { success: false, message: '§cSale payout exceeds supported numeric limits.' };
  }
  const { totalItems, totalPayout } = plan.preview;
  if (totalItems === 0 || totalPayout <= 0) {
    return { success: false, message: '§cYou have no sellable items in your inventory (or daily limits reached).' };
  }

  if (
    isDefined(expectedQuote) &&
    (totalItems !== expectedQuote.totalItems ||
      Math.abs(totalPayout - expectedQuote.totalPayout) > 0.001 ||
      (isDefined(expectedQuote.breakdown) && !doBreakdownsMatch(expectedQuote.breakdown, plan.preview.breakdown)))
  ) {
    return {
      success: false,
      quoteChanged: true,
      updatedPreview: plan.preview,
      message: `§e[Shop] Sale quote changed (now §f${totalItems}§e items for §a${formatCurrency(totalPayout)}§e). Please review and confirm again.`,
    };
  }

  const pData = getOrCreatePlayer(player);
  const { maxBalance } = getEconomyConfig();
  const currentBal = Number.isFinite(Number(pData.balance)) ? Number(pData.balance) : 0;
  const projectedBalance = Number.parseFloat((currentBal + totalPayout).toFixed(2));
  if (Number.isFinite(maxBalance) && projectedBalance > maxBalance) {
    return {
      success: false,
      message: `§cCannot sell all: payout of §e${formatCurrency(totalPayout)}§c would exceed the maximum balance of §e${formatCurrency(maxBalance)}§c.`,
    };
  }

  const restoreMutations = (mutations: typeof plan.slotMutations): boolean => {
    let allRestored = true;
    for (const mutation of mutations) {
      try {
        mutation.stack.amount = mutation.originalAmount;
        container.setItem(mutation.slotIndex, mutation.stack);
      } catch {
        allRestored = false;
      }
    }
    return allRestored;
  };

  const appliedMutations: typeof plan.slotMutations = [];
  try {
    for (const mutation of plan.slotMutations) {
      if (mutation.remainingAmount <= 0) {
        container.setItem(mutation.slotIndex, undefined);
      } else {
        mutation.stack.amount = mutation.remainingAmount;
        container.setItem(mutation.slotIndex, mutation.stack);
      }
      appliedMutations.push(mutation);
    }
  } catch {
    const allRestored = restoreMutations(appliedMutations);
    return {
      success: false,
      message: allRestored
        ? '§cFailed to update inventory. Sale cancelled.'
        : '§cInventory update failed and rollback was incomplete. Please check your inventory.',
    };
  }

  if (!incrementPlayerBalance(player.id, totalPayout)) {
    const allRestored = restoreMutations(appliedMutations);
    return {
      success: false,
      message: allRestored
        ? '§cFailed to credit balance. Sale cancelled.'
        : '§cFailed to credit balance and inventory rollback was incomplete. Please check your inventory.',
    };
  }

  for (const [itemKey, sold] of plan.soldByItemKey) {
    recordDailyShopUsage(player, itemKey, sold.shopItem, 'sell', sold.count);
  }

  return {
    success: true,
    message: `§2Successfully sold §e${totalItems}§2 items from your inventory for §a${formatCurrency(totalPayout)}§2!`,
  };
}
