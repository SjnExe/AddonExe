import { getEconomyConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer, getPlayer, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { debugLog, errorLog } from '@core/utils/logger.js';
import { resolveTradeItemDisplayName } from '@features/economy/tradeUtils.js';
import { getGraveAt } from '@features/essentials/graves/manager.js';
import { getContainerLockAt } from '@features/essentials/protection/containerLockManager.js';
import { canPlayerModify } from '@features/essentials/protection/landclaim/manager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
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

function canContainerFit(container: mc.Container, itemTypeId: string, needed: number): boolean {
  const probe = new mc.ItemStack(itemTypeId, 1);
  const maxStack = Math.max(1, probe.maxAmount || 64);
  let capacity = 0;
  for (let i = 0; i < container.size; i++) {
    const it = container.getItem(i);
    if (!isDefined(it)) {
      capacity += maxStack;
    } else if (it.typeId === itemTypeId && it.amount < maxStack) {
      capacity += maxStack - it.amount;
    }
    if (capacity >= needed) {
      return true;
    }
  }
  return false;
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

  if (shop.mode === 'buy') {
    const buyerBalance = getOrCreatePlayer(player).balance;
    const minBalance = Math.max(0, Number(econCfg.minBalance ?? 0));
    if (buyerBalance < shop.price || buyerBalance - shop.price < minBalance) {
      player.sendMessage(`§cYou need §e${formatCurrency(shop.price)}§c.`);
      return;
    }
    const ownerData = getPlayer(shop.ownerId);
    if (ownerData && ownerData.balance + shop.price > maxBalance) {
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
      if (it?.typeId === shop.itemTypeId) {
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
    let toTake = shop.amount;
    for (let i = 0; i < chest.size && toTake > 0; i++) {
      const it = chest.getItem(i);
      if (it?.typeId === shop.itemTypeId) {
        const take = Math.min(it.amount, toTake);
        toTake -= take;
        if (it.amount - take <= 0) {
          chest.setItem(i, undefined);
        } else {
          it.amount -= take;
          chest.setItem(i, it);
        }
      }
    }
    pCont.addItem(new mc.ItemStack(shop.itemTypeId, shop.amount));
    incrementPlayerBalance(player.id, -shop.price);
    incrementPlayerBalance(shop.ownerId, shop.price);
    playSound(player, 'random.orb');
    player.sendMessage(`§aBought §e${shop.amount}x ${label}§a for §2${formatCurrency(shop.price)}§a!`);
  } else {
    let playerHas = 0;
    for (let i = 0; i < pCont.size; i++) {
      const it = pCont.getItem(i);
      if (it?.typeId === shop.itemTypeId) {
        playerHas += it.amount;
      }
    }
    if (playerHas < shop.amount) {
      player.sendMessage(`§cYou need §e${shop.amount}x ${label}§c to sell.`);
      return;
    }
    const sellerData = getOrCreatePlayer(player);
    if (sellerData.balance + shop.price > maxBalance) {
      player.sendMessage('§cYou have reached the maximum balance limit.');
      return;
    }
    const ownerData = getPlayer(shop.ownerId);
    if (!ownerData || ownerData.balance < shop.price) {
      player.sendMessage(`§cShop owner §e${shop.ownerName}§c does not have enough funds.`);
      return;
    }
    if (!canContainerFit(chest, shop.itemTypeId, shop.amount)) {
      player.sendMessage('§cThis shop chest is full.');
      return;
    }
    chest.addItem(new mc.ItemStack(shop.itemTypeId, shop.amount));
    let toTake = shop.amount;
    for (let i = 0; i < pCont.size && toTake > 0; i++) {
      const it = pCont.getItem(i);
      if (it?.typeId === shop.itemTypeId) {
        const take = Math.min(it.amount, toTake);
        toTake -= take;
        if (it.amount - take <= 0) {
          pCont.setItem(i, undefined);
        } else {
          it.amount -= take;
          pCont.setItem(i, it);
        }
      }
    }
    incrementPlayerBalance(shop.ownerId, -shop.price);
    incrementPlayerBalance(player.id, shop.price);
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
    if (!player.isValid) {
      return;
    }
    const latestShop = getChestShopAt(player.dimension.id, block.location);
    if (!latestShop) {
      return;
    }
    const label = resolveTradeItemDisplayName(latestShop.itemTypeId);
    const verb = latestShop.mode === 'buy' ? 'Buy' : 'Sell';
    const form = new ActionFormBuilder()
      .title(`${latestShop.ownerName}'s Chest Shop`)
      .body(`§7Action: §e${verb} ${latestShop.amount}x ${label}\n§7Price: §2${formatCurrency(latestShop.price)}`);
    form.button(`§l§2${verb} ${latestShop.amount}x ${label}`, 'textures/ui/trade_icon', async () => {
      if (!player.isValid) {
        return;
      }
      const confirmedShop = getChestShopAt(player.dimension.id, block.location);
      if (!confirmedShop) {
        player.sendMessage('§cThis chest shop no longer exists.');
        return;
      }
      executeChestShopTrade(player, block, confirmedShop);
    });
    await form.show(player);
  });
  return true;
}
