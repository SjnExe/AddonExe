import { getEconomyConfig } from '@core/config/configurations.js';
import { recordEscrow, releaseEscrow } from '@core/data/escrowManager.js';
import { serializeItem } from '@core/data/itemSerializer.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import {
  getOrCreatePlayer,
  getPlayer,
  incrementPlayerBalance,
  incrementPlayerBalanceWithDelta,
  loadPlayerData,
  updatePlayerData,
} from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { calculateTaxWithPolicy, formatCurrency } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import { recordLedgerTransaction } from '@features/economy/ledger/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { generateId } from '@lib/id.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';

/** Escrowed player buy order for clean items. */
export interface BuyOrder {
  id: string;
  buyerId: string;
  buyerName: string;
  itemTypeId: string;
  itemDisplayName: string;
  unitPrice: number;
  originalQuantity: number;
  remainingQuantity: number;
  createdAt: number;
  expiresAt: number;
  pendingPersistence?: boolean;
}

/** Result returned by buy order creation, fulfillment, or cancellation operations. */
export interface OrderActionResult {
  success: boolean;
  message: string;
  order?: BuyOrder;
}

const storage = new StorageManager('exe:buyOrders');
const activeOrders = new Map<string, BuyOrder>();
let nextOrderExpiryAt = Number.POSITIVE_INFINITY;
const maxExpiryBatchSize = 20;

function recomputeNextOrderExpiry(): void {
  let earliest = Number.POSITIVE_INFINITY;
  for (const order of activeOrders.values()) {
    if (order.expiresAt < earliest) {
      earliest = order.expiresAt;
    }
  }
  nextOrderExpiryAt = earliest;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatItemDisplayName(typeId: string): string {
  const bare = typeId.includes(':') ? (typeId.split(':')[1] ?? typeId) : typeId;
  return bare
    .split('_')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getOrdersConfig() {
  return getEconomyConfig().orders;
}

function isOrdersFeatureEnabled(): boolean {
  return isFeatureActive('eco') && getOrdersConfig()?.enabled === true;
}

/**
 * Checks whether an item stack is clean (undamaged, unrenamed, no custom lore, no enchantments) for buy-order
 * fulfillment.
 *
 * @param item ItemStack to inspect.
 * @returns True if the item is clean and eligible for generic buy orders.
 */
export function isCleanOrderItem(item: mc.ItemStack): boolean {
  if (!isDefined(item) || item.amount <= 0) {
    return false;
  }
  if (isNonEmptyString(item.nameTag)) {
    return false;
  }
  try {
    if (typeof item.getLore === 'function' && item.getLore().length > 0) {
      return false;
    }
    const durability = item.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
    if (isDefined(durability) && durability.damage > 0) {
      return false;
    }
    const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
    if (isDefined(enchantable) && enchantable.getEnchantments().length > 0) {
      return false;
    }
    const invComp = item.getComponent(ItemComponentTypes.Inventory) as mc.ItemInventoryComponent | undefined;
    if (isDefined(invComp?.container) && invComp.container.emptySlotsCount < invComp.container.size) {
      return false;
    }
    if (typeof item.getDynamicPropertyIds === 'function' && item.getDynamicPropertyIds().length > 0) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

/** Loads persisted buy orders into memory and starts the expiry sweep interval. */
export function initializeBuyOrders(): void {
  loadBuyOrders();
  setTrackedInterval(() => {
    pruneExpiredOrders();
  }, 1200);
}

/** Loads buy orders from dynamic storage into memory. */
export function loadBuyOrders(): void {
  try {
    activeOrders.clear();
    const loaded = storage.load<BuyOrder[]>();
    if (Array.isArray(loaded)) {
      for (const order of loaded) {
        if (isDefined(order) && isNonEmptyString(order.id) && order.remainingQuantity > 0) {
          activeOrders.set(order.id, order);
        }
      }
      recomputeNextOrderExpiry();
      debugLog(`[BuyOrders] Loaded ${activeOrders.size} active buy orders.`);
    }
  } catch (error: unknown) {
    errorLog(`[BuyOrders] Failed to load orders: ${error instanceof Error ? error.message : String(error)}`);
    activeOrders.clear();
  }
}

function saveOrdersWithStatus(): 'saved' | 'rolled_back' | 'indeterminate' {
  try {
    return storage.saveWithStatus([...activeOrders.values()]);
  } catch (error: unknown) {
    errorLog(`[BuyOrders] Failed to save orders: ${error instanceof Error ? error.message : String(error)}`);
    return 'indeterminate';
  }
}

/**
 * Saves active buy orders to dynamic storage.
 *
 * @returns True if saving succeeded, false otherwise.
 */
export function saveBuyOrders(): boolean {
  return saveOrdersWithStatus() === 'saved';
}

function settleOrderRefund(
  order: BuyOrder,
  category: 'buy_order_cancel' | 'buy_order_expire',
  reason: string,
  description: string,
): { ok: boolean; creditedAmount: number; remainder: number } {
  const refund = roundCurrency(order.remainingQuantity * order.unitPrice);
  const receiptKey = `order-refund:${order.id}:${order.remainingQuantity}`;

  if (refund > 0) {
    recordEscrow({
      id: receiptKey,
      playerId: order.buyerId,
      money: refund,
      reason,
      timestamp: Date.now(),
    });
  }

  activeOrders.delete(order.id);
  recomputeNextOrderExpiry();
  const saveStatus = saveOrdersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      activeOrders.set(order.id, order);
      recomputeNextOrderExpiry();
      if (refund > 0) {
        releaseEscrow(receiptKey);
      }
    }
    errorLog(`[BuyOrders] Failed to persist order removal for ${order.id} (${saveStatus}).`);
    return { ok: false, creditedAmount: 0, remainder: refund };
  }

  if (refund <= 0) {
    return { ok: true, creditedAmount: 0, remainder: 0 };
  }

  const creditRes = incrementPlayerBalanceWithDelta(order.buyerId, refund, receiptKey);
  if (!creditRes.success) {
    errorLog(`[BuyOrders] Failed to refund order ${order.id} for buyer ${order.buyerId} (${refund}).`);
    return { ok: false, creditedAmount: 0, remainder: refund };
  }

  const creditedAmount = Math.max(0, roundCurrency(creditRes.appliedDelta));
  const remainder = Math.max(0, roundCurrency(refund - creditedAmount));
  if (remainder <= 0) {
    releaseEscrow(receiptKey);
  } else {
    recordEscrow({
      id: receiptKey,
      playerId: order.buyerId,
      money: remainder,
      reason: `${reason}_overflow`,
      timestamp: Date.now(),
    });
  }

  if (creditedAmount > 0) {
    recordLedgerTransaction({
      playerId: order.buyerId,
      type: 'escrow',
      category,
      amount: creditedAmount,
      description,
    });
  }

  return { ok: true, creditedAmount, remainder };
}

/**
 * Refunds and removes any expired buy orders in bounded batches.
 *
 * @param nowMs Current timestamp in milliseconds.
 * @returns Number of expired orders pruned.
 */
export function pruneExpiredOrders(nowMs = Date.now()): number {
  if (nowMs < nextOrderExpiryAt) {
    return 0;
  }

  const expired: BuyOrder[] = [];
  for (const order of activeOrders.values()) {
    if (nowMs >= order.expiresAt) {
      expired.push(order);
      if (expired.length >= maxExpiryBatchSize) {
        break;
      }
    }
  }
  if (expired.length === 0) {
    recomputeNextOrderExpiry();
    return 0;
  }

  let pruned = 0;
  for (const order of expired) {
    const settled = settleOrderRefund(
      order,
      'buy_order_expire',
      'buy_order_expire_refund',
      `Expired buy order refund (${order.remainingQuantity}x ${order.itemDisplayName})`,
    );
    if (settled.ok) {
      pruned++;
    }
  }
  recomputeNextOrderExpiry();
  return pruned;
}

/**
 * Returns active buy orders sorted newest-first, optionally filtered by buyer or search query.
 *
 * @param options Optional filter options.
 * @returns Array of active buy orders.
 */
export function getBuyOrders(options?: { buyerId?: string; query?: string }): BuyOrder[] {
  pruneExpiredOrders();
  const normalizedQuery = options?.query?.trim().toLowerCase();
  const result: BuyOrder[] = [];

  for (const order of activeOrders.values()) {
    if (isNonEmptyString(options?.buyerId) && order.buyerId !== options.buyerId) {
      continue;
    }
    if (isNonEmptyString(normalizedQuery)) {
      const hay = `${order.itemTypeId.toLowerCase()} ${order.itemDisplayName.toLowerCase()} ${order.buyerName.toLowerCase()}`;
      if (!hay.includes(normalizedQuery)) {
        continue;
      }
    }
    result.push({ ...order });
  }

  result.sort((a, b) => b.createdAt - a.createdAt);
  return result;
}

/**
 * Creates an escrowed buy order for clean items.
 *
 * @param buyer Buyer player.
 * @param itemTypeId Minecraft item type ID (e.g. `minecraft:diamond`).
 * @param quantity Integer quantity to buy.
 * @param unitPrice Price offered per item.
 * @returns Result indicating success or failure.
 */
export function createBuyOrder(
  buyer: mc.Player,
  itemTypeId: string,
  quantity: number,
  unitPrice: number,
): OrderActionResult {
  if (!isOrdersFeatureEnabled()) {
    return { success: false, message: '§cBuy Orders are currently disabled.' };
  }

  const ecoCfg = getEconomyConfig();
  const cfg = ecoCfg.orders!;
  pruneExpiredOrders();

  const normalizedTypeId = itemTypeId.trim().toLowerCase();
  if (!isNonEmptyString(normalizedTypeId) || normalizedTypeId === MinecraftBlockTypes.Air) {
    return { success: false, message: '§cInvalid item type ID.' };
  }
  if (cfg.blockedItemIds.includes(normalizedTypeId)) {
    return { success: false, message: '§cThat item cannot be requested on Buy Orders.' };
  }
  if (typeof mc.ItemTypes?.get === 'function' && !isDefined(mc.ItemTypes.get(normalizedTypeId))) {
    return { success: false, message: `§cUnknown Minecraft item ID: "${normalizedTypeId}".` };
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > cfg.maxOrderQuantity) {
    return {
      success: false,
      message: `§cQuantity must be a whole number between 1 and ${cfg.maxOrderQuantity}.`,
    };
  }
  if (!Number.isFinite(unitPrice) || unitPrice < cfg.minUnitPrice) {
    return {
      success: false,
      message: `§cUnit price must be at least ${formatCurrency(cfg.minUnitPrice)}.`,
    };
  }

  const roundedUnitPrice = roundCurrency(unitPrice);
  const totalEscrow = roundCurrency(quantity * roundedUnitPrice);
  const listingFee = roundCurrency(Math.max(0, cfg.listingFee));
  const totalCharge = roundCurrency(totalEscrow + listingFee);

  if (
    !Number.isFinite(totalEscrow) ||
    !Number.isFinite(totalCharge) ||
    totalEscrow <= 0 ||
    totalCharge > ecoCfg.maxBalance
  ) {
    return { success: false, message: '§cOrder total exceeds economy limits.' };
  }

  let buyerActiveCount = 0;
  for (const existing of activeOrders.values()) {
    if (existing.buyerId === buyer.id) {
      buyerActiveCount++;
    }
  }
  if (buyerActiveCount >= cfg.maxOrdersPerPlayer) {
    return {
      success: false,
      message: `§cYou already have the maximum of ${cfg.maxOrdersPerPlayer} active buy orders.`,
    };
  }

  const buyerData = getOrCreatePlayer(buyer);
  if (buyerData.balance < totalCharge || roundCurrency(buyerData.balance - totalCharge) < ecoCfg.minBalance) {
    return {
      success: false,
      message: `§cInsufficient funds. Need ${formatCurrency(totalCharge)} (Escrow: ${formatCurrency(totalEscrow)} + Fee: ${formatCurrency(listingFee)}).`,
    };
  }

  const now = Date.now();
  const order: BuyOrder = {
    id: generateId(),
    buyerId: buyer.id,
    buyerName: buyer.name,
    itemTypeId: normalizedTypeId,
    itemDisplayName: formatItemDisplayName(normalizedTypeId),
    unitPrice: roundedUnitPrice,
    originalQuantity: quantity,
    remainingQuantity: quantity,
    createdAt: now,
    expiresAt: now + cfg.defaultDurationSeconds * 1000,
  };

  if (!incrementPlayerBalance(buyer.id, -totalCharge, `order-create:${order.id}`)) {
    return { success: false, message: '§cFailed to escrow funds for buy order.' };
  }

  activeOrders.set(order.id, order);
  recomputeNextOrderExpiry();
  const saveStatus = saveOrdersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      activeOrders.delete(order.id);
      recomputeNextOrderExpiry();
      incrementPlayerBalance(buyer.id, totalCharge, `order-create-rollback:${order.id}`);
      return { success: false, message: '§cFailed to save buy order. Funds were refunded.' };
    }
    order.pendingPersistence = true;
    errorLog(`[BuyOrders] Indeterminate save state while creating order ${order.id} for ${buyer.id}.`);
    return {
      success: false,
      message: '§cOrder persistence status was uncertain; kept pending state to protect your funds.',
    };
  }

  recordLedgerTransaction({
    playerId: buyer.id,
    type: 'escrow',
    category: 'buy_order_escrow',
    amount: totalEscrow,
    description: `Escrowed buy order: ${quantity}x ${order.itemDisplayName}`,
  });
  if (listingFee > 0) {
    recordLedgerTransaction({
      playerId: buyer.id,
      type: 'sink',
      category: 'buy_order_fee',
      amount: listingFee,
      description: `Buy order listing fee (${order.itemDisplayName})`,
    });
  }

  return {
    success: true,
    message: `§aCreated buy order for §f${quantity}x ${order.itemDisplayName} §aat ${formatCurrency(roundedUnitPrice)} each (Escrow: ${formatCurrency(totalEscrow)}).`,
    order: { ...order },
  };
}

function deliverOrderedItemsToBuyer(buyerId: string, itemTypeId: string, quantity: number): boolean {
  let maxStackSize = 64;
  try {
    const sample = new mc.ItemStack(itemTypeId, 1);
    if (sample.maxAmount > 0) {
      maxStackSize = sample.maxAmount;
    }
  } catch {
    maxStackSize = 64;
  }

  const buyer = getPlayerFromCache(buyerId);
  const validBuyer = isDefined(buyer) && buyer.isValid ? buyer : undefined;
  let inv: mc.Container | undefined;
  try {
    inv = (validBuyer?.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
      ?.container;
  } catch {
    inv = undefined;
  }

  let remaining = quantity;
  const mailboxItems: ReturnType<typeof serializeItem>[] = [];

  while (remaining > 0) {
    const chunk = Math.min(remaining, maxStackSize);
    remaining -= chunk;
    const stack = new mc.ItemStack(itemTypeId, chunk);
    if (isDefined(inv) && inv.emptySlotsCount > 0) {
      const leftover = inv.addItem(stack);
      if (isDefined(leftover)) {
        mailboxItems.push(serializeItem(leftover));
      }
    } else {
      mailboxItems.push(serializeItem(stack));
    }
  }

  if (mailboxItems.length > 0) {
    const saved = updatePlayerData(buyerId, (d) => {
      (d.mailbox ??= []).push(...mailboxItems);
    });
    if (!saved) {
      errorLog(`[BuyOrders] Failed to write ${mailboxItems.length} item stack(s) to mailbox for buyer ${buyerId}.`);
      return false;
    }
    validBuyer?.sendMessage('§e[Orders] Delivered items to your Collection Bin (/ah collect).');
  }

  return true;
}

/**
 * Fulfills part or all of an active buy order using clean matching items from the seller's inventory.
 *
 * @param seller Seller player delivering items.
 * @param orderId Target buy order ID.
 * @param requestedQuantity Optional maximum quantity to sell.
 * @returns Result indicating success or failure.
 */
export function fulfillBuyOrder(seller: mc.Player, orderId: string, requestedQuantity?: number): OrderActionResult {
  if (!isOrdersFeatureEnabled()) {
    return { success: false, message: '§cBuy Orders are currently disabled.' };
  }

  const ecoCfg = getEconomyConfig();
  const cfg = ecoCfg.orders!;
  pruneExpiredOrders();

  const order = activeOrders.get(orderId);
  if (!isDefined(order) || order.pendingPersistence === true || Date.now() >= order.expiresAt) {
    return { success: false, message: '§cBuy order not found or already completed.' };
  }
  if (order.buyerId === seller.id) {
    return { success: false, message: '§cYou cannot fulfill your own buy order.' };
  }
  const sellerData = getPlayer(seller.id) ?? loadPlayerData(seller.id);
  if (!isDefined(sellerData)) {
    return { success: false, message: '§cCould not load your player economy profile.' };
  }
  if (isDefined(requestedQuantity) && (!Number.isInteger(requestedQuantity) || requestedQuantity < 1)) {
    return { success: false, message: '§cQuantity to sell must be a positive whole number.' };
  }

  let container: mc.Container | undefined;
  try {
    container = (seller.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
      ?.container;
  } catch {
    container = undefined;
  }
  if (!isDefined(container)) {
    return { success: false, message: '§cCould not access your inventory.' };
  }

  const cleanSlots: { slotIndex: number; amount: number }[] = [];
  let availableClean = 0;
  for (let i = 0; i < container.size; i++) {
    const stack = container.getItem(i);
    if (isDefined(stack) && stack.typeId === order.itemTypeId && isCleanOrderItem(stack)) {
      cleanSlots.push({ slotIndex: i, amount: stack.amount });
      availableClean += stack.amount;
    }
  }

  if (availableClean <= 0) {
    return {
      success: false,
      message: `§cYou have no clean ${order.itemDisplayName} to sell (damaged, renamed, or enchanted items are rejected).`,
    };
  }

  const fillQty = Math.min(requestedQuantity ?? availableClean, availableClean, order.remainingQuantity);
  if (fillQty <= 0) {
    return { success: false, message: '§cNothing available to fulfill.' };
  }

  // Reserve order quantity before mutating inventory
  order.remainingQuantity -= fillQty;

  let toRemove = fillQty;
  let actuallyRemoved = 0;
  const slotBackups: { slotIndex: number; originalStack: mc.ItemStack }[] = [];
  for (const slot of cleanSlots) {
    if (toRemove <= 0) {
      break;
    }
    const stack = container.getItem(slot.slotIndex);
    if (!isDefined(stack) || stack.typeId !== order.itemTypeId || !isCleanOrderItem(stack)) {
      continue;
    }
    const backup = typeof stack.clone === 'function' ? stack.clone() : new mc.ItemStack(stack.typeId, stack.amount);
    slotBackups.push({ slotIndex: slot.slotIndex, originalStack: backup });
    const take = Math.min(toRemove, stack.amount);
    if (take >= stack.amount) {
      container.setItem(slot.slotIndex, undefined);
    } else {
      stack.amount -= take;
      container.setItem(slot.slotIndex, stack);
    }
    toRemove -= take;
    actuallyRemoved += take;
  }

  if (actuallyRemoved !== fillQty) {
    for (const backup of slotBackups) {
      container.setItem(backup.slotIndex, backup.originalStack);
    }
    order.remainingQuantity += fillQty;
    return { success: false, message: '§cInventory changed during transaction. Please try again.' };
  }

  const wasCompleted = order.remainingQuantity <= 0;
  if (wasCompleted) {
    activeOrders.delete(order.id);
  }
  const saveStatus = saveOrdersWithStatus();
  if (saveStatus !== 'saved') {
    if (saveStatus === 'rolled_back') {
      for (const backup of slotBackups) {
        container.setItem(backup.slotIndex, backup.originalStack);
      }
      order.remainingQuantity += fillQty;
      if (wasCompleted) {
        activeOrders.set(order.id, order);
      }
      return { success: false, message: '§cFailed to persist buy order update. Items were restored.' };
    }
    errorLog(`[BuyOrders] Indeterminate save state for order ${order.id} during fulfillment by seller ${seller.id}.`);
    return { success: false, message: '§cOrder persistence was uncertain. Please contact an administrator.' };
  }

  const gross = roundCurrency(fillQty * order.unitPrice);
  const { tax, netAmount } = calculateTaxWithPolicy(gross, {
    ratePercent: cfg.taxRatePercent,
    minTax: 0,
    maxTax: cfg.maxTax,
  });
  const payout = roundCurrency(Math.max(0, netAmount));
  const payoutEscrowId = `order-fill:${order.id}:${generateId()}`;
  if (payout > 0) {
    recordEscrow({
      id: payoutEscrowId,
      playerId: seller.id,
      money: payout,
      reason: 'buy_order_fill_payout',
      timestamp: Date.now(),
    });
  }

  const delivered = deliverOrderedItemsToBuyer(order.buyerId, order.itemTypeId, fillQty);
  if (!delivered) {
    errorLog(
      `[BuyOrders] Failed to deliver ${fillQty}x ${order.itemTypeId} for order ${order.id} to buyer ${order.buyerId}.`,
    );
    return {
      success: false,
      message: '§cFailed to deliver items to buyer mailbox. Payout queued for administrator review.',
    };
  }

  const payRes = incrementPlayerBalanceWithDelta(seller.id, payout);
  if (!payRes.success) {
    errorLog(`[BuyOrders] Failed to pay seller ${seller.id} (${payout}) for order ${order.id}.`);
    return {
      success: false,
      message: '§cFailed to credit your sale payout; payout was queued for recovery.',
    };
  }
  if (payout > 0) {
    const unpaid = Math.max(0, roundCurrency(payout - payRes.appliedDelta));
    if (unpaid <= 0) {
      releaseEscrow(payoutEscrowId);
    } else {
      recordEscrow({
        id: payoutEscrowId,
        playerId: seller.id,
        money: unpaid,
        reason: 'buy_order_fill_payout_overflow',
        timestamp: Date.now(),
      });
    }
  }

  recordLedgerTransaction({
    playerId: seller.id,
    type: 'transfer',
    category: 'buy_order_fill',
    amount: payout,
    description: `Fulfilled ${fillQty}x ${order.itemDisplayName} for ${order.buyerName}`,
  });
  if (tax > 0) {
    recordLedgerTransaction({
      playerId: seller.id,
      type: 'tax',
      category: 'buy_order_tax',
      amount: tax,
      description: `Buy order market tax (${order.itemDisplayName})`,
    });
  }

  const buyer = getPlayerFromCache(order.buyerId);
  if (isDefined(buyer) && buyer.isValid) {
    buyer.sendMessage(
      `§a[Orders] §f${seller.name} §afulfilled §f${fillQty}x ${order.itemDisplayName} §aof your buy order.`,
    );
  }

  return {
    success: true,
    message: `§aSold §f${fillQty}x ${order.itemDisplayName} §afor §e${formatCurrency(payout)}${tax > 0 ? ` §7(Tax: ${formatCurrency(tax)})` : ''}.`,
    order: { ...order },
  };
}

/**
 * Cancels an active buy order and refunds the remaining escrowed funds to the buyer.
 *
 * @param actorId Player ID requesting cancellation.
 * @param orderId Buy order ID.
 * @param isAdmin Whether an administrator is cancelling on the buyer's behalf.
 * @returns Result indicating success or failure.
 */
export function cancelBuyOrder(actorId: string, orderId: string, isAdmin = false): OrderActionResult {
  pruneExpiredOrders();
  const order = activeOrders.get(orderId);
  if (!isDefined(order)) {
    return { success: false, message: '§cBuy order not found.' };
  }
  if (!isAdmin && order.buyerId !== actorId) {
    return { success: false, message: '§cYou can only cancel your own buy orders.' };
  }

  const settled = settleOrderRefund(
    order,
    'buy_order_cancel',
    'buy_order_cancel_refund',
    `Cancelled buy order (${order.remainingQuantity}x ${order.itemDisplayName})`,
  );
  if (!settled.ok) {
    return {
      success: false,
      message: '§cFailed to complete cancellation refund; any pending refund is queued for recovery.',
    };
  }

  if (settled.remainder > 0) {
    return {
      success: true,
      message: `§aCancelled buy order for §f${order.itemDisplayName}§a. Credited §e${formatCurrency(settled.creditedAmount)} §7(${formatCurrency(settled.remainder)} queued for recovery due to wallet cap).`,
      order: { ...order },
    };
  }

  return {
    success: true,
    message: `§aCancelled buy order for §f${order.itemDisplayName} §aand refunded §e${formatCurrency(settled.creditedAmount)}§a.`,
    order: { ...order },
  };
}
