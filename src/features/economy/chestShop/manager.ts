import { getEconomyConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer, getPlayer, incrementPlayerBalance, loadPlayerData } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { resolveTradeItemDisplayName } from '@features/economy/tradeUtils.js';
import { getGraveAt } from '@features/essentials/graves/manager.js';
import { getContainerLockAt } from '@features/essentials/protection/containerLockManager.js';
import { canPlayerModify } from '@features/essentials/protection/landclaim/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, ItemComponentTypes } from '@minecraft/server';
import { MinecraftBlockTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';

/** Trade direction for a player chest shop. */
export type ChestShopMode = 'buy' | 'sell';

/** Persisted record for a player-owned chest shop. */
export interface ChestShopRecord {
  key: string;
  ownerId: string;
  ownerName: string;
  mode: ChestShopMode;
  itemTypeId: string;
  amount: number;
  price: number;
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

const storage = new StorageManager('exe:chestShops:v1');
let shops = new Map<string, ChestShopRecord>();

function shopKey(dimensionId: string, loc: mc.Vector3): string {
  return `${dimensionId}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
}

/** Loads persisted player chest shops from dynamic properties. */
export function loadChestShops(): void {
  const loaded = storage.load<[string, ChestShopRecord][]>();
  shops = loaded ? new Map(loaded) : new Map();
  debugLog(`[ChestShop] Loaded ${shops.size} chest shops.`);
}

function saveChestShops(): boolean {
  try {
    return storage.save([...shops.entries()]);
  } catch (err) {
    errorLog(`[ChestShop] Failed to save chest shops: ${String(err)}`);
    return false;
  }
}

/**
 * Returns all chest shops owned by `playerId`.
 *
 * @param playerId Owner player identifier.
 * @returns Array of owned chest shop records.
 */
export function getPlayerChestShops(playerId: string): ChestShopRecord[] {
  const result: ChestShopRecord[] = [];
  for (const s of shops.values()) {
    if (s.ownerId === playerId) {
      result.push(s);
    }
  }
  return result;
}

/**
 * Gets a chest shop at a block coordinate (or adjacent double-chest half), if any.
 *
 * @param dimensionId Dimension identifier.
 * @param loc Block coordinate.
 * @returns Matching chest shop record or undefined.
 */
export function getChestShopAt(dimensionId: string, loc: mc.Vector3): ChestShopRecord | undefined {
  if (shops.size === 0) {
    return undefined;
  }
  const direct = shops.get(shopKey(dimensionId, loc));
  if (direct) {
    return direct;
  }
  try {
    const dim = mc.world.getDimension(dimensionId);
    const blk = dim.getBlock(loc);
    if (blk && (blk.typeId === MinecraftBlockTypes.Chest || blk.typeId === MinecraftBlockTypes.TrappedChest)) {
      const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
      ];
      for (const off of offsets) {
        const adjLoc = { x: loc.x + off.x, y: loc.y, z: loc.z + off.z };
        const adjShop = shops.get(shopKey(dimensionId, adjLoc));
        if (adjShop) {
          const adjBlk = dim.getBlock(adjLoc);
          if (adjBlk && adjBlk.typeId === blk.typeId) {
            return adjShop;
          }
        }
      }
    }
  } catch {
    // Ignore unloaded chunk or mock errors
  }
  return undefined;
}

function isShopChest(typeId: string): boolean {
  return (
    typeId === MinecraftBlockTypes.Chest ||
    typeId === MinecraftBlockTypes.TrappedChest ||
    typeId === MinecraftBlockTypes.Barrel
  );
}

/**
 * Creates a chest shop on the targeted container using the player's held item.
 *
 * @param player Shop owner.
 * @param block Target container block.
 * @param mode Trade direction (`buy` or `sell`).
 * @param price Price per transaction.
 * @param amount Item stack size per transaction.
 * @returns Result with success flag and user-facing message.
 */
export function createChestShop(
  player: mc.Player,
  block: mc.Block,
  mode: ChestShopMode,
  price: number,
  amount: number,
): { success: boolean; message: string } {
  const cfg = getEconomyConfig().chestShop;
  if (!isFeatureActive('eco') || !cfg?.enabled) {
    return { success: false, message: '§cPlayer Chest Shops are currently disabled.' };
  }
  if (!isShopChest(block.typeId)) {
    return { success: false, message: '§cLook at a Chest, Trapped Chest, or Barrel.' };
  }
  if (isDefined(getGraveAt(block.dimension.id, block.location))) {
    return { success: false, message: '§cCannot create a Chest Shop on a grave.' };
  }
  if (isDefined(getContainerLockAt(block.dimension.id, block.location))) {
    return { success: false, message: '§cUnlock the container before creating a Chest Shop.' };
  }
  if (!canPlayerModify(player, block.location, block.dimension.id, 'container')) {
    return { success: false, message: '§cYou cannot create a Chest Shop inside another player claim.' };
  }
  if (isDefined(getChestShopAt(block.dimension.id, block.location))) {
    return { success: false, message: '§cThis container already has a Chest Shop.' };
  }

  let owned = 0;
  for (const s of shops.values()) {
    if (s.ownerId === player.id) {
      owned++;
    }
  }
  const maxShops = Math.max(1, Number(cfg.maxShopsPerPlayer ?? 10));
  if (!hasPermission(player, 'group.admin') && owned >= maxShops) {
    return { success: false, message: `§cYou reached the limit of §e${maxShops}§c chest shops.` };
  }

  const inv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  const held = inv?.container?.getItem(player.selectedSlotIndex);
  if (!isDefined(held)) {
    return { success: false, message: '§cHold the item you want this shop to trade.' };
  }
  if (!isPlainChestShopItem(held)) {
    return {
      success: false,
      message: '§cChest Shops only support plain, undamaged, unenchanted items without custom names or inventories.',
    };
  }

  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: '§cPrice and amount must be valid positive numbers.' };
  }
  const maxStack = Math.max(1, held.maxAmount || 64);
  const cleanPrice = Math.max(1, Math.floor(price));
  const cleanAmount = Math.max(1, Math.min(maxStack, Math.floor(amount)));
  const key = shopKey(block.dimension.id, block.location);

  shops.set(key, {
    key,
    ownerId: player.id,
    ownerName: player.name,
    mode,
    itemTypeId: held.typeId,
    amount: cleanAmount,
    price: cleanPrice,
    dimensionId: block.dimension.id,
    x: Math.floor(block.location.x),
    y: Math.floor(block.location.y),
    z: Math.floor(block.location.z),
  });
  if (!saveChestShops()) {
    shops.delete(key);
    return { success: false, message: '§cFailed to save Chest Shop.' };
  }
  const label = resolveTradeItemDisplayName(held.typeId);
  return {
    success: true,
    message: `§aCreated Chest Shop: §e${mode.toUpperCase()} ${cleanAmount}x ${label}§a for §2${formatCurrency(cleanPrice)}§a.`,
  };
}

/**
 * Removes a chest shop if the player is the owner or an admin.
 *
 * @param player Player requesting removal.
 * @param dimensionId Dimension identifier.
 * @param loc Container coordinate.
 * @returns Result with success flag and message.
 */
export function removeChestShop(
  player: mc.Player,
  dimensionId: string,
  loc: mc.Vector3,
): { success: boolean; message: string } {
  const shop = getChestShopAt(dimensionId, loc);
  if (!shop) {
    return { success: false, message: '§7No chest shop here.' };
  }
  if (shop.ownerId !== player.id && !hasPermission(player, 'group.admin')) {
    return { success: false, message: `§cOnly §e${shop.ownerName}§c or an admin can remove this shop.` };
  }
  shops.delete(shop.key);
  if (!saveChestShops()) {
    shops.set(shop.key, shop);
    return { success: false, message: '§cFailed to remove Chest Shop.' };
  }
  return { success: true, message: '§aChest Shop removed.' };
}

/**
 * Removes a chest shop when the underlying block is broken.
 *
 * @param dimensionId Dimension identifier.
 * @param loc Container coordinate.
 */
export function removeChestShopOnBreak(dimensionId: string, loc: mc.Vector3): void {
  const shop = getChestShopAt(dimensionId, loc);
  if (shop && shops.delete(shop.key)) {
    saveChestShops();
  }
}

function isPlainChestShopItem(item: mc.ItemStack): boolean {
  if (isNonEmptyString(item.nameTag)) {
    return false;
  }
  if (typeof item.getLore === 'function' && item.getLore().length > 0) {
    return false;
  }
  if (typeof item.getCanDestroy === 'function' && item.getCanDestroy().length > 0) {
    return false;
  }
  if (typeof item.getCanPlaceOn === 'function' && item.getCanPlaceOn().length > 0) {
    return false;
  }
  try {
    const durability = item.getComponent(ItemComponentTypes.Durability) as mc.ItemDurabilityComponent | undefined;
    if (isDefined(durability) && durability.damage > 0) {
      return false;
    }
    const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as mc.ItemEnchantableComponent | undefined;
    if (isDefined(enchantable) && enchantable.getEnchantments().length > 0) {
      return false;
    }
    if (isDefined(item.getComponent(ItemComponentTypes.Inventory))) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function canContainerFit(container: mc.Container, itemTypeId: string, needed: number): boolean {
  const probe = new mc.ItemStack(itemTypeId, 1);
  const maxStack = Math.max(1, probe.maxAmount || 64);
  let capacity = 0;
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (!isDefined(it)) {
      capacity += maxStack;
    } else if (
      it.typeId === itemTypeId &&
      it.amount < maxStack &&
      (typeof it.isStackableWith === 'function' ? it.isStackableWith(probe) : !isNonEmptyString(it.nameTag))
    ) {
      capacity += maxStack - it.amount;
    }
    if (capacity >= needed) {
      return true;
    }
  }
  return false;
}

interface StagedSlotTake {
  slot: number;
  item: mc.ItemStack;
  originalAmount: number;
}

function restoreStagedSlotTakes(container: mc.Container, staged: StagedSlotTake[]): boolean {
  let allRestored = true;
  for (const entry of staged) {
    try {
      entry.item.amount = entry.originalAmount;
      container.setItem(entry.slot, entry.item);
    } catch {
      allRestored = false;
    }
  }
  return allRestored;
}

function takePlainItemsStaged(
  container: mc.Container,
  itemTypeId: string,
  amount: number,
): { ok: boolean; staged: StagedSlotTake[]; allRestored: boolean } {
  const staged: StagedSlotTake[] = [];
  let toTake = amount;
  try {
    for (let i = 0; i < container.size && toTake > 0; i++) {
      const it = container.getItem(i);
      if (it?.typeId === itemTypeId && isPlainChestShopItem(it)) {
        const originalAmount = it.amount;
        const take = Math.min(originalAmount, toTake);
        toTake -= take;
        staged.push({ slot: i, item: it, originalAmount });
        if (originalAmount - take <= 0) {
          container.setItem(i, undefined);
        } else {
          it.amount = originalAmount - take;
          container.setItem(i, it);
        }
      }
    }
    if (toTake > 0) {
      const allRestored = restoreStagedSlotTakes(container, staged);
      return { ok: false, staged, allRestored };
    }
    return { ok: true, staged, allRestored: true };
  } catch {
    const allRestored = restoreStagedSlotTakes(container, staged);
    return { ok: false, staged, allRestored };
  }
}

function executeChestShopTrade(player: mc.Player, block: mc.Block, shop: ChestShopRecord): void {
  const econCfg = getEconomyConfig();
  if (!isFeatureActive('eco') || !econCfg.chestShop?.enabled) {
    player.sendMessage('§cPlayer Chest Shops are currently disabled.');
    return;
  }
  const chestInv = block.getComponent(mc.BlockComponentTypes?.Inventory ?? 'minecraft:inventory') as
    mc.BlockInventoryComponent | undefined;
  const playerInv = player.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined;
  if (!chestInv?.container || !playerInv?.container) {
    return;
  }

  const chest = chestInv.container;
  const pCont = playerInv.container;
  const label = resolveTradeItemDisplayName(shop.itemTypeId);
  const maxBalance = Number(econCfg.maxBalance ?? 1_000_000_000);
  const minBalance = Math.max(0, Number(econCfg.minBalance ?? 0));

  if (shop.mode === 'buy') {
    const buyerBalance = getOrCreatePlayer(player).balance;
    if (buyerBalance < shop.price || buyerBalance - shop.price < minBalance) {
      player.sendMessage(`§cYou need §e${formatCurrency(shop.price)}§c.`);
      return;
    }
    const ownerData = getPlayer(shop.ownerId) ?? loadPlayerData(shop.ownerId);
    if (!ownerData || ownerData.balance + shop.price > maxBalance) {
      player.sendMessage(`§cShop owner §e${shop.ownerName}§c has reached the maximum balance limit.`);
      return;
    }
    if (!canContainerFit(pCont, shop.itemTypeId, shop.amount)) {
      player.sendMessage('§cYour inventory does not have enough space.');
      return;
    }
    let stock = 0;
    for (let i = 0; i < chest.size; i++) {
      const it = chest.getItem(i);
      if (it?.typeId === shop.itemTypeId && isPlainChestShopItem(it)) {
        stock += it.amount;
      }
    }
    if (stock < shop.amount) {
      player.sendMessage('§cThis chest shop is out of stock.');
      const onlineOwner = mc.world.getAllPlayers().find((p) => p.id === shop.ownerId && p.isValid);
      if (onlineOwner) {
        onlineOwner.sendMessage(
          `§e[ChestShop] §fYour shop at §e${shop.x}, ${shop.y}, ${shop.z}§f is out of §b${label}§f!`,
        );
      }
      return;
    }
    if (!incrementPlayerBalance(player.id, -shop.price)) {
      player.sendMessage('§cFailed to deduct funds. Please try again.');
      return;
    }
    const taken = takePlainItemsStaged(chest, shop.itemTypeId, shop.amount);
    if (!taken.ok) {
      const refunded = incrementPlayerBalance(player.id, shop.price);
      player.sendMessage(
        taken.allRestored && refunded
          ? '§cChest shop trade failed. Your funds were refunded.'
          : '§cChest shop trade failed and recovery was incomplete. Contact staff.',
      );
      return;
    }

    let deliveredAmount = 0;
    let deliveryFailed = false;
    try {
      const leftover = pCont.addItem(new mc.ItemStack(shop.itemTypeId, shop.amount));
      if (isDefined(leftover)) {
        deliveredAmount = Math.max(0, shop.amount - leftover.amount);
        deliveryFailed = true;
      } else {
        deliveredAmount = shop.amount;
      }
    } catch {
      deliveryFailed = true;
    }

    if (deliveryFailed) {
      const removedOk = deliveredAmount > 0 ? takePlainItemsStaged(pCont, shop.itemTypeId, deliveredAmount).ok : true;
      const chestRestored = restoreStagedSlotTakes(chest, taken.staged);
      const refunded = incrementPlayerBalance(player.id, shop.price);
      player.sendMessage(
        removedOk && chestRestored && refunded
          ? '§cYour inventory could not accept the items. Trade cancelled.'
          : '§cTrade failed and rollback was incomplete. Contact staff.',
      );
      return;
    }

    if (!incrementPlayerBalance(shop.ownerId, shop.price)) {
      const removedOk = takePlainItemsStaged(pCont, shop.itemTypeId, shop.amount).ok;
      const chestRestored = restoreStagedSlotTakes(chest, taken.staged);
      const refunded = incrementPlayerBalance(player.id, shop.price);
      player.sendMessage(
        removedOk && chestRestored && refunded
          ? `§cShop owner §e${shop.ownerName}§c could not receive payment. Trade cancelled.`
          : '§cOwner credit failed and rollback was incomplete. Contact staff.',
      );
      return;
    }
    playSound(player, 'random.orb');
    player.sendMessage(`§aBought §e${shop.amount}x ${label}§a for §2${formatCurrency(shop.price)}§a!`);
  } else {
    let playerHas = 0;
    for (let i = 0; i < pCont.size; i++) {
      const it = pCont.getItem(i);
      if (it?.typeId === shop.itemTypeId && isPlainChestShopItem(it)) {
        playerHas += it.amount;
      }
    }
    if (playerHas < shop.amount) {
      player.sendMessage(`§cYou need §e${shop.amount}x ${label}§c (undamaged, unenchanted) to sell.`);
      return;
    }
    const sellerData = getOrCreatePlayer(player);
    if (sellerData.balance + shop.price > maxBalance) {
      player.sendMessage('§cYou have reached the maximum balance limit.');
      return;
    }
    const ownerData = getPlayer(shop.ownerId) ?? loadPlayerData(shop.ownerId);
    if (!ownerData || ownerData.balance < shop.price || ownerData.balance - shop.price < minBalance) {
      player.sendMessage(`§cShop owner §e${shop.ownerName}§c does not have enough funds.`);
      return;
    }
    if (!canContainerFit(chest, shop.itemTypeId, shop.amount)) {
      player.sendMessage('§cThis shop chest is full.');
      return;
    }
    if (!incrementPlayerBalance(shop.ownerId, -shop.price)) {
      player.sendMessage(`§cShop owner §e${shop.ownerName}§c does not have enough funds.`);
      return;
    }

    const takenFromPlayer = takePlainItemsStaged(pCont, shop.itemTypeId, shop.amount);
    if (!takenFromPlayer.ok) {
      const ownerRefunded = incrementPlayerBalance(shop.ownerId, shop.price);
      player.sendMessage(
        takenFromPlayer.allRestored && ownerRefunded
          ? '§cChest shop sale failed. Trade cancelled.'
          : '§cChest shop sale failed and rollback was incomplete. Contact staff.',
      );
      return;
    }

    let depositedAmount = 0;
    let depositFailed = false;
    try {
      const leftover = chest.addItem(new mc.ItemStack(shop.itemTypeId, shop.amount));
      if (isDefined(leftover)) {
        depositedAmount = Math.max(0, shop.amount - leftover.amount);
        depositFailed = true;
      } else {
        depositedAmount = shop.amount;
      }
    } catch {
      depositFailed = true;
    }

    if (depositFailed) {
      const chestClean = depositedAmount > 0 ? takePlainItemsStaged(chest, shop.itemTypeId, depositedAmount).ok : true;
      const playerRestored = restoreStagedSlotTakes(pCont, takenFromPlayer.staged);
      const ownerRefunded = incrementPlayerBalance(shop.ownerId, shop.price);
      player.sendMessage(
        chestClean && playerRestored && ownerRefunded
          ? '§cThis shop chest is full. Trade cancelled.'
          : '§cChest shop deposit failed and rollback was incomplete. Contact staff.',
      );
      return;
    }

    if (!incrementPlayerBalance(player.id, shop.price)) {
      const chestClean = takePlainItemsStaged(chest, shop.itemTypeId, shop.amount).ok;
      const playerRestored = restoreStagedSlotTakes(pCont, takenFromPlayer.staged);
      const ownerRefunded = incrementPlayerBalance(shop.ownerId, shop.price);
      player.sendMessage(
        chestClean && playerRestored && ownerRefunded
          ? '§cFailed to credit your balance. Trade cancelled.'
          : '§cBalance credit failed and rollback was incomplete. Contact staff.',
      );
      return;
    }
    playSound(player, 'random.orb');
    player.sendMessage(`§aSold §e${shop.amount}x ${label}§a for §2${formatCurrency(shop.price)}§a!`);
  }
}

/**
 * Handles interaction with a Chest Shop container.
 *
 * @param event Block interaction before event.
 * @returns True if the interaction was intercepted by a chest shop.
 */
export function handleChestShopInteract(event: mc.PlayerInteractWithBlockBeforeEvent): boolean {
  const { player, block } = event;
  const shop = getChestShopAt(player.dimension.id, block.location);
  if (!shop) {
    return false;
  }
  if (!isFeatureActive('eco') || !getEconomyConfig().chestShop?.enabled) {
    if (shop.ownerId !== player.id && !hasPermission(player, 'group.admin')) {
      event.cancel = true;
      mc.system.run(() => {
        if (player.isValid) {
          player.sendMessage('§cPlayer Chest Shops are currently disabled.');
        }
      });
      return true;
    }
    return false;
  }
  if (shop.ownerId === player.id && player.isSneaking) {
    return false;
  }
  event.cancel = true;

  mc.system.run(async () => {
    if (!player.isValid || !block.isValid) {
      return;
    }
    const blockDimId = block.dimension.id;
    const blockLoc = { x: block.location.x, y: block.location.y, z: block.location.z };
    const latestShop = getChestShopAt(blockDimId, blockLoc);
    if (!latestShop) {
      return;
    }
    const label = resolveTradeItemDisplayName(latestShop.itemTypeId);
    const verb = latestShop.mode === 'buy' ? 'Buy' : 'Sell';
    const form = new ActionFormBuilder()
      .title(`${latestShop.ownerName}'s Chest Shop`)
      .body(`§7Action: §e${verb} ${latestShop.amount}x ${label}\n§7Price: §2${formatCurrency(latestShop.price)}`);
    form.button(`§l§2${verb} ${latestShop.amount}x ${label}`, 'textures/ui/trade_icon', async () => {
      if (!player.isValid || !block.isValid || player.dimension.id !== blockDimId) {
        return;
      }
      const dx = player.location.x - blockLoc.x;
      const dy = player.location.y - blockLoc.y;
      const dz = player.location.z - blockLoc.z;
      if (dx * dx + dy * dy + dz * dz > 100) {
        player.sendMessage('§cYou moved too far away from the chest shop.');
        return;
      }
      const confirmedShop = getChestShopAt(blockDimId, blockLoc);
      if (!confirmedShop) {
        player.sendMessage('§cThis chest shop no longer exists.');
        return;
      }
      if (
        confirmedShop.ownerId !== latestShop.ownerId ||
        confirmedShop.mode !== latestShop.mode ||
        confirmedShop.itemTypeId !== latestShop.itemTypeId ||
        confirmedShop.amount !== latestShop.amount ||
        confirmedShop.price !== latestShop.price
      ) {
        player.sendMessage('§cThis chest shop changed while the menu was open. Please try again.');
        return;
      }
      executeChestShopTrade(player, block, confirmedShop);
    });
    await form.show(player);
  });
  return true;
}
