import { afterEach, beforeEach, describe, expect, it, setSystemTime, spyOn } from 'bun:test';

import { ItemStack, Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configurations from '@core/config/configurations.js';
import * as playerManager from '@core/data/playerDataManager.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import * as featureManager from '@core/services/featureManager.js';
import {
  applyGlobalPriceMultiplier,
  findItemLocation,
  moveShopItem,
  quickUpdateItemPrices,
  resetShopToDefaults,
  updateShopItem,
} from '@features/economy/shop/adminManager.js';
import shopCommands from '@features/economy/shop/commands/shop.js';
import { shopConfig } from '@features/economy/shop/config.js';
import * as shopManager from '@features/economy/shop/manager.js';
import {
  executeSellAllInventory,
  findBestShopMatchByQuery,
  findShopItem,
  getPlayerSellableInventoryItems,
  getPlayerShopPerkSummary,
  getRemainingDailyShopQuota,
  getShopCatalogEntries,
  invalidateShopLookupCache,
  previewSellAllInventory,
} from '@features/economy/shop/manager.js';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import * as uiComponents from '@ui/components.js';

describe('Shop Refactor - Preset Balance, Admin Tools, Catalog & Commands', () => {
  const spies: Array<ReturnType<typeof spyOn>> = [];

  afterEach(() => {
    while (spies.length > 0) {
      spies.pop()?.mockRestore();
    }
    invalidateShopLookupCache();
  });

  describe('Default Shop Preset & Anti-Arbitrage Invariants', () => {
    it('ensures every item has valid pricing and sellPrice is strictly less than buyPrice', () => {
      const allEntries: { key: string; buyPrice: number; sellPrice: number; itemId?: string }[] = [];
      for (const cat of Object.values(shopConfig.categories)) {
        for (const [key, item] of Object.entries(cat.items)) {
          allEntries.push({ key, ...item });
        }
        for (const sub of Object.values(cat.subCategories)) {
          for (const [key, item] of Object.entries(sub.items)) {
            allEntries.push({ key, ...item });
          }
        }
      }

      expect(allEntries.length).toBeGreaterThan(100);
      for (const item of allEntries) {
        expect(item.buyPrice === -1 || item.buyPrice > 0).toBe(true);
        expect(item.sellPrice === -1 || item.sellPrice > 0).toBe(true);
        expect(item.buyPrice > 0 || item.sellPrice > 0).toBe(true);
        if (item.buyPrice > 0 && item.sellPrice > 0) {
          expect(item.sellPrice).toBeLessThan(item.buyPrice);
        }
        if (item.itemId) {
          expect(item.itemId.startsWith('minecraft:')).toBe(true);
        }
      }
    });

    it('prevents crafting arbitrage on wood planks and netherite gear', () => {
      const wood = shopConfig.categories['Wood & Logs']!.subCategories['Oak Wood']!.items;
      expect(wood.oakPlanks!.sellPrice * 4).toBeLessThan(wood.oakLog!.buyPrice);

      const ores = shopConfig.categories['Ores & Minerals']!.items;
      const armor = shopConfig.categories.Armor!.subCategories.Diamond!.items;
      const netheriteArmor = shopConfig.categories.Armor!.subCategories.Netherite!.items;
      expect(netheriteArmor.netheriteChestplate!.sellPrice).toBeLessThan(
        armor.diamondChestplate!.buyPrice + ores.netheriteIngot!.buyPrice,
      );
      expect(ores.netheriteIngot!.sellPrice).toBeLessThan(
        ores.netheriteScrap!.buyPrice * 4 + ores.goldIngot!.buyPrice * 4,
      );
    });
  });

  describe('Shop Manager Catalog & Perk Helpers', () => {
    let mockCfg: typeof shopConfig;

    beforeEach(() => {
      mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(
        spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([
          { id: 'vip', shopMultiplier: { buy: 0.85, sell: 1.15 }, shopLimitMultiplier: 1.5 } as any,
        ]),
      );
      invalidateShopLookupCache();
    });

    it('enforces bi-directional catalog bijection and filters by query and mode', () => {
      const player = new Player('cat-p1', 'CatalogTester') as any;
      const configuredKeys: string[] = [];
      for (const cat of Object.values(mockCfg.categories)) {
        for (const key of Object.keys(cat.items)) {
          configuredKeys.push(key);
        }
        for (const sub of Object.values(cat.subCategories)) {
          for (const key of Object.keys(sub.items)) {
            configuredKeys.push(key);
          }
        }
      }
      const configuredKeySet = new Set(configuredKeys);
      expect(configuredKeySet.size).toBe(configuredKeys.length);

      const fullCatalog = getShopCatalogEntries(player, { includeDisabled: true });
      const catalogKeys = fullCatalog.map((entry) => entry.itemKey);
      const catalogKeySet = new Set(catalogKeys);
      expect(catalogKeySet.size).toBe(catalogKeys.length);
      expect(catalogKeySet).toEqual(configuredKeySet);
      for (const entry of fullCatalog) {
        expect(entry.shopItem).toBe(findShopItem(entry.itemKey)!);
      }

      const allDiamonds = getShopCatalogEntries(player, { query: 'diamond' });
      expect(allDiamonds.length).toBeGreaterThan(3);

      const sellOnlyBooks = getShopCatalogEntries(player, { query: 'mending', mode: 'sell' });
      expect(sellOnlyBooks.length).toBe(0);

      const buyBooks = getShopCatalogEntries(player, { query: 'mending', mode: 'buy' });
      expect(buyBooks.length).toBe(1);
      expect(buyBooks[0]?.itemKey).toBe('enchantMending');
    });

    it('resolves exact matches via findBestShopMatchByQuery including space-to-snake queries', () => {
      const player = new Player('cat-p2', 'QueryTester') as any;
      const match = findBestShopMatchByQuery('diamond', player, 'buy');
      expect(match?.itemKey).toBe('diamond');

      const bySpace = findBestShopMatchByQuery('diamond sword', player, 'buy');
      expect(bySpace?.itemKey).toBe('diamondSword');

      const turtleHelmet = findBestShopMatchByQuery('turtle helmet', player, 'buy');
      expect(turtleHelmet?.itemKey).toBe('turtleHelmet');
    });

    it('computes player rank perk summary and sellable inventory items', () => {
      const player = new Player('cat-p3', 'InvTester') as any;
      const perks = getPlayerShopPerkSummary(player);
      expect(perks).toEqual({ buyMultiplier: 0.85, sellMultiplier: 1.15, limitMultiplier: 1.5 });

      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Diamond, 4);
      slots[1] = new ItemStack(MinecraftItemTypes.Emerald, 10);
      const container = {
        size: 36,
        getItem: (i: number) => slots[i],
      };
      player.getComponent = (id: string) => (id === 'minecraft:inventory' ? { container } : undefined);

      const sellable = getPlayerSellableInventoryItems(player);
      expect(sellable.length).toBe(2);
      expect(sellable[0]?.itemKey).toBe('diamond');
      expect(sellable[0]?.sellableCount).toBe(4);
    });
  });

  describe('Shop Admin Manager Power Tools', () => {
    let mockCfg: typeof shopConfig;
    let saveSpy: ReturnType<typeof spyOn>;
    let resetSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      saveSpy = spyOn(configurations, 'saveShopConfig').mockImplementation(() => undefined);
      resetSpy = spyOn(configurations, 'resetShopConfig').mockImplementation(() => undefined);
      spies.push(saveSpy, resetSpy);
    });

    it('quickUpdateItemPrices updates prices and limits in-place', () => {
      const res = quickUpdateItemPrices('Ores & Minerals', undefined, 'diamond', 450, 140, 10, 64);
      expect(res.success).toBe(true);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.buyPrice).toBe(450);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.sellPrice).toBe(140);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.dailyBuyLimit).toBe(10);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.dailySellLimit).toBe(64);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(mockCfg);

      const overflowRes = quickUpdateItemPrices('Ores & Minerals', undefined, 'diamond', 1e308, 140);
      expect(overflowRes.success).toBe(false);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.buyPrice).toBe(450);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      const partialRes = quickUpdateItemPrices('Ores & Minerals', undefined, 'diamond', undefined, 160);
      expect(partialRes.success).toBe(true);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.buyPrice).toBe(450);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.sellPrice).toBe(160);
      expect(saveSpy).toHaveBeenCalledTimes(2);
    });

    it('moveShopItem moves an item and findItemLocation locates it', () => {
      const beforeLoc = findItemLocation('diamond');
      expect(beforeLoc).toEqual({ categoryName: 'Ores & Minerals' });

      const moved = moveShopItem('Ores & Minerals', undefined, 'diamond', 'Special Items', undefined);
      expect(moved.success).toBe(true);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond).toBeUndefined();
      expect(mockCfg.categories['Special Items']!.items.diamond).toBeDefined();
      expect(findItemLocation('diamond')).toEqual({ categoryName: 'Special Items' });
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(mockCfg);
    });

    it('applyGlobalPriceMultiplier scales positive prices, skips -1, and rejects Infinity overflow atomically', () => {
      const res = applyGlobalPriceMultiplier(1.2, 0.5, 'Special Items');
      expect(res.success).toBe(true);
      expect(res.updatedCount).toBeGreaterThan(0);
      expect(mockCfg.categories['Special Items']!.items.elytra!.buyPrice).toBe(18_000);
      expect(mockCfg.categories['Special Items']!.items.elytra!.sellPrice).toBe(-1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(mockCfg);

      const beforeBuy = mockCfg.categories['Special Items']!.items.elytra!.buyPrice;
      const overflowRes = applyGlobalPriceMultiplier(1e308, 1, 'Special Items');
      expect(overflowRes.success).toBe(false);
      expect(overflowRes.updatedCount).toBe(0);
      expect(mockCfg.categories['Special Items']!.items.elytra!.buyPrice).toBe(beforeBuy);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('updateShopItem preserves existing shop key when itemId differs from key', () => {
      const res = updateShopItem('Ores & Minerals', undefined, 'diamond', {
        itemId: MinecraftItemTypes.Diamond,
        buyPrice: 410,
        sellPrice: 120,
        permission: 'ui.panel.member',
        icon: '',
        displayName: 'Diamond',
      });
      expect(res.success).toBe(true);
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond).toBeDefined();
      expect(mockCfg.categories['Ores & Minerals']!.items[MinecraftItemTypes.Diamond]).toBeUndefined();
      expect(mockCfg.categories['Ores & Minerals']!.items.diamond!.buyPrice).toBe(410);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(mockCfg);
    });

    it('resetShopToDefaults invokes resetShopConfig', () => {
      const res = resetShopToDefaults();
      expect(res.success).toBe(true);
      expect(resetSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid prices and multipliers', () => {
      expect(quickUpdateItemPrices('Ores & Minerals', undefined, 'diamond', Number.NaN, 100).success).toBe(false);
      expect(
        quickUpdateItemPrices('Ores & Minerals', undefined, 'diamond', Number.POSITIVE_INFINITY, 100).success,
      ).toBe(false);
      expect(quickUpdateItemPrices('Ores & Minerals', undefined, 'diamond', -5, 100).success).toBe(false);
      expect(applyGlobalPriceMultiplier(0, 1).success).toBe(false);
      expect(applyGlobalPriceMultiplier(Number.NaN, 1).success).toBe(false);
      expect(applyGlobalPriceMultiplier(1, Number.POSITIVE_INFINITY).success).toBe(false);
    });
  });

  describe('Shop Commands (/addshop, /buy, /sellhand) & Sellable Inventory', () => {
    it('/addshop accepts -1 to disable buy or sell price and sets daily limits', () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(configurations, 'saveShopConfig').mockImplementation(() => undefined));
      spies.push(spyOn(featureManager, 'isFeatureActive').mockReturnValue(true));

      const admin = new Player('admin-1', 'Admin') as any;
      const messages: string[] = [];
      admin.sendMessage = (m: string) => messages.push(m);
      const held = new ItemStack(MinecraftItemTypes.Apple, 1);
      admin.getComponent = () => ({
        getEquipment: () => held,
      });

      const addShopCmd = shopCommands.find((c) => c.name === 'addshop')!;
      addShopCmd.execute(admin, {
        category: 'Food',
        buyPrice: '-1',
        sellPrice: '5',
        dailySellLimit: 64,
      });

      const addedEntry = Object.values(mockCfg.categories.Food!.items).find(
        (i) => i.sellPrice === 5 && i.buyPrice === -1,
      );
      expect(addedEntry).toBeDefined();
      expect(addedEntry?.dailySellLimit).toBe(64);
      expect(messages.some((m) => m.includes('Successfully added'))).toBe(true);
    });

    it('/buy purchases directly when item and amount are specified and rejects malformed quantities', async () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(featureManager, 'isFeatureActive').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]));
      const buySpy = spyOn(shopManager, 'buyItem').mockReturnValue({
        success: true,
        message: '§2Successfully purchased 2x Diamond for §e$1,000§2.',
      });
      spies.push(buySpy);
      invalidateShopLookupCache();

      const buyer = new Player('buyer-1', 'Buyer') as any;
      const messages: string[] = [];
      buyer.sendMessage = (m: string) => messages.push(m);

      const buyCmd = shopCommands.find((c) => c.name === 'buy')!;
      await buyCmd.execute(buyer, { item: 'diamond', amount: '2' });

      expect(buySpy).toHaveBeenCalledWith(buyer, 'diamond', 2);
      expect(messages.some((m) => m.includes('Successfully purchased 2x'))).toBe(true);

      await buyCmd.execute(buyer, { item: 'diamond', amount: '10abc' });
      await buyCmd.execute(buyer, { item: 'diamond', amount: '0' });
      expect(buySpy).toHaveBeenCalledTimes(1);
      expect(messages.filter((m) => m.includes('positive integer')).length).toBe(2);
    });

    it('/sellhand rejects malformed quantities like "10abc" or "0"', () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(featureManager, 'isFeatureActive').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]));
      const sellSpy = spyOn(shopManager, 'sellItem').mockReturnValue({ success: true, message: 'ok' });
      spies.push(sellSpy);
      invalidateShopLookupCache();

      const seller = new Player('seller-1', 'Seller') as any;
      const messages: string[] = [];
      seller.sendMessage = (m: string) => messages.push(m);
      const held = new ItemStack(MinecraftItemTypes.Diamond, 4);
      seller.getComponent = () => ({
        getEquipment: () => held,
      });

      const sellHandCmd = shopCommands.find((c) => c.name === 'sellhand')!;
      sellHandCmd.execute(seller, { amount: '10abc' });
      sellHandCmd.execute(seller, { amount: '0' });

      expect(sellSpy).not.toHaveBeenCalled();
      expect(messages.filter((m) => m.includes('positive integer')).length).toBe(2);
    });

    it('getPlayerSellableInventoryItems excludes items requiring missing permission', () => {
      const mockCfg = structuredClone(shopConfig);
      mockCfg.categories['Ores & Minerals']!.items.diamond!.permission = 'shop.vip.diamond';
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]));
      spies.push(
        spyOn(permissionEngine, 'hasPermission').mockImplementation((_p, perm) => perm !== 'shop.vip.diamond'),
      );
      invalidateShopLookupCache();

      const player = new Player('inv-1', 'InvPlayer') as any;
      const diamondStack = new ItemStack(MinecraftItemTypes.Diamond, 3);
      player.getComponent = () => ({
        container: {
          size: 1,
          getItem: (i: number) => (i === 0 ? diamondStack : undefined),
        },
      });

      const sellables = shopManager.getPlayerSellableInventoryItems(player);
      expect(sellables.some((s) => s.itemKey === 'diamond')).toBe(false);
    });

    it('/sellhand rejects damaged/enchanted held items instead of selling reserve inventory stacks', () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(featureManager, 'isFeatureActive').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]));
      const sellSpy = spyOn(shopManager, 'sellItem').mockReturnValue({ success: true, message: 'ok' });
      spies.push(sellSpy);
      invalidateShopLookupCache();

      const seller = new Player('seller-2', 'DamagedSeller') as any;
      const messages: string[] = [];
      seller.sendMessage = (m: string) => messages.push(m);
      const damagedHeld = new ItemStack(MinecraftItemTypes.Diamond, 1);
      (damagedHeld as any).getComponent = (id: string) => (id === 'minecraft:durability' ? { damage: 5 } : undefined);
      seller.getComponent = () => ({
        getEquipment: () => damagedHeld,
      });

      const sellHandCmd = shopCommands.find((c) => c.name === 'sellhand')!;
      sellHandCmd.execute(seller, {});

      expect(sellSpy).not.toHaveBeenCalled();
      expect(messages.some((m) => m.includes('held item cannot be sold'))).toBe(true);
    });

    it('moveShopItem and updateShopItem reject invalid containers and key collisions without mutating config', () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      const saveSpy = spyOn(configurations, 'saveShopConfig').mockImplementation(() => undefined);
      spies.push(saveSpy);

      expect(moveShopItem('Ores & Minerals', undefined, 'diamond', 'Ores & Minerals', undefined).success).toBe(false);
      expect(moveShopItem('Ores & Minerals', undefined, 'diamond', 'MissingCategory', undefined).success).toBe(false);
      mockCfg.categories['Special Items']!.items.diamond = structuredClone(
        mockCfg.categories['Ores & Minerals']!.items.diamond!,
      );
      expect(moveShopItem('Ores & Minerals', undefined, 'diamond', 'Special Items', undefined).success).toBe(false);

      mockCfg.categories['Ores & Minerals']!.items.legacyA = {
        buyPrice: 10,
        sellPrice: 5,
        permission: 'ui.panel.member',
      };
      mockCfg.categories['Ores & Minerals']!.items.legacyB = {
        buyPrice: 20,
        sellPrice: 10,
        permission: 'ui.panel.member',
      };
      const collisionRes = updateShopItem('Ores & Minerals', undefined, 'legacyA', {
        itemId: 'legacyB',
        buyPrice: 15,
        sellPrice: 7,
        displayName: 'Legacy',
        icon: '',
        permission: 'ui.panel.member',
      });
      expect(collisionRes.success).toBe(false);
      expect(mockCfg.categories['Ores & Minerals']!.items.legacyA!.buyPrice).toBe(10);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('enforces daily quotas for player vs global scope and rank limit multipliers', () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(
        spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([{ id: 'vip', shopLimitMultiplier: 2 } as any]),
      );
      invalidateShopLookupCache();

      const p1 = new Player('q-1', 'QuotaOne') as any;
      const p2 = new Player('q-2', 'QuotaTwo') as any;

      const playerScoped = { ...mockCfg.categories['Ores & Minerals']!.items.diamond!, dailyBuyLimit: 10 };
      expect(getRemainingDailyShopQuota(p1, 'diamond', playerScoped, 'buy')).toBe(20);

      const globalScoped = {
        ...mockCfg.categories['Ores & Minerals']!.items.diamond!,
        dailyBuyLimit: 10,
        limitScope: 'global' as const,
      };
      expect(getRemainingDailyShopQuota(p1, 'diamond', globalScoped, 'buy')).toBe(10);
      expect(getRemainingDailyShopQuota(p2, 'diamond', globalScoped, 'buy')).toBe(10);
    });

    it('previewSellAllInventory & executeSellAllInventory guard quotes, maxBalance, and rollback on failure', () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]));
      spies.push(spyOn(configurations, 'getEconomyConfig').mockReturnValue({ maxBalance: 10_000 } as any));
      const pData = { balance: 100 };
      spies.push(spyOn(playerManager, 'getOrCreatePlayer').mockReturnValue(pData as any));
      invalidateShopLookupCache();

      const player = new Player('sa-1', 'SellAllTester') as any;
      const slots: Array<ItemStack | undefined> = [new ItemStack(MinecraftItemTypes.Diamond, 2)];
      const setItemCalls: Array<{ slot: number; item: unknown }> = [];
      const container = {
        size: 1,
        getItem: (i: number) => slots[i],
        setItem: (i: number, item?: ItemStack) => {
          setItemCalls.push({ slot: i, item });
          slots[i] = item;
        },
      };
      player.getComponent = () => ({ container });

      const preview = previewSellAllInventory(player);
      expect(preview.totalItems).toBe(2);
      expect(preview.totalPayout).toBeGreaterThan(0);

      const balSpy = spyOn(playerManager, 'incrementPlayerBalance').mockReturnValue(false);
      spies.push(balSpy);

      const mismatch = executeSellAllInventory(player, {
        totalItems: 1,
        totalPayout: preview.totalPayout,
      });
      expect(mismatch.success).toBe(false);
      expect(mismatch.quoteChanged).toBe(true);
      expect(slots[0]?.amount).toBe(2);
      expect(setItemCalls).toHaveLength(0);
      expect(balSpy).not.toHaveBeenCalled();

      pData.balance = 9999;
      const overflow = executeSellAllInventory(player, {
        totalItems: preview.totalItems,
        totalPayout: preview.totalPayout,
        breakdown: preview.breakdown,
      });
      expect(overflow.success).toBe(false);
      expect(overflow.message).toContain('maximum balance');
      expect(slots[0]?.amount).toBe(2);
      expect(setItemCalls).toHaveLength(0);
      expect(balSpy).not.toHaveBeenCalled();

      pData.balance = 100;
      const preRollbackCalls = setItemCalls.length;
      expect(preRollbackCalls).toBe(0);
      const rollbackRes = executeSellAllInventory(player, {
        totalItems: preview.totalItems,
        totalPayout: preview.totalPayout,
        breakdown: preview.breakdown,
      });
      expect(rollbackRes.success).toBe(false);
      expect(rollbackRes.message).toContain('Sale cancelled');
      expect(slots[0]?.amount).toBe(2);
      expect(setItemCalls).toHaveLength(2);
      expect(setItemCalls[0]).toEqual({ slot: 0, item: undefined });
      expect(setItemCalls[1]?.slot).toBe(0);
      expect(setItemCalls[1]?.item).toEqual(expect.objectContaining({ typeId: MinecraftItemTypes.Diamond, amount: 2 }));
    });

    it('/sellall confirm rejects missing and expired quotes and succeeds for unexpired quotes', async () => {
      const mockCfg = structuredClone(shopConfig);
      spies.push(spyOn(configurations, 'getShopConfig').mockImplementation(() => mockCfg));
      spies.push(spyOn(featureManager, 'isFeatureActive').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'hasPermission').mockReturnValue(true));
      spies.push(spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]));
      spies.push(
        spyOn(configurations, 'getEconomyConfig').mockReturnValue({ maxBalance: 100_000, currencySymbol: '$' } as any),
      );
      spies.push(
        spyOn(playerManager, 'getOrCreatePlayer').mockReturnValue({
          id: 'sa-cmd-1',
          name: 'SellAllCmd',
          balance: 100,
        } as any),
      );
      spies.push(spyOn(playerManager, 'incrementPlayerBalance').mockReturnValue(true));
      spies.push(spyOn(uiComponents, 'showConfirmationDialog').mockResolvedValue(undefined as any));
      const execSpy = spyOn(shopManager, 'executeSellAllInventory');
      spies.push(execSpy);
      invalidateShopLookupCache();

      const seller = new Player('sa-cmd-1', 'SellAllCmd') as any;
      const messages: string[] = [];
      seller.sendMessage = (m: string) => messages.push(m);
      const slots: (ItemStack | undefined)[] = [new ItemStack(MinecraftItemTypes.Diamond, 2)];
      seller.getComponent = () => ({
        container: {
          size: 1,
          getItem: (i: number) => slots[i],
          setItem: (i: number, item?: ItemStack) => {
            slots[i] = item;
          },
        },
      });

      const sellAllCmd = shopCommands.find((c) => c.name === 'sellall')!;

      // 1. Missing quote rejected
      await sellAllCmd.execute(seller, { action: 'confirm' });
      expect(execSpy).not.toHaveBeenCalled();
      expect(messages.some((m) => m.includes('expired or was not found'))).toBe(true);

      // 2. Expired quote rejected
      setSystemTime(new Date(1_000_000));
      try {
        await sellAllCmd.execute(seller, {});
        setSystemTime(new Date(1_031_000));
        messages.length = 0;
        await sellAllCmd.execute(seller, { action: 'confirm' });
        expect(execSpy).not.toHaveBeenCalled();
        expect(messages.some((m) => m.includes('expired or was not found'))).toBe(true);

        // 3. Valid unexpired quote executes once
        await sellAllCmd.execute(seller, {});
        setSystemTime(new Date(1_036_000));
        await sellAllCmd.execute(seller, { action: 'confirm' });
        expect(execSpy).toHaveBeenCalledTimes(1);
      } finally {
        setSystemTime();
      }
    });
  });
});
