import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import { Dimension, ItemStack, Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configurations from '@core/config/configurations.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as claimService from '@core/events/protectionService.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import * as featureManager from '@core/services/featureManager.js';
import {
  createChestShop,
  getChestShopAt,
  getPlayerChestShops,
  removeChestShop,
} from '@features/economy/chestShop/manager.js';
import bottleCommand from '@features/economy/commands/bottle.js';
import sellCommand from '@features/economy/commands/sell.js';
import { getPlayerJob, setPlayerJob } from '@features/economy/jobs/manager.js';
import * as shopManager from '@features/economy/shop/manager.js';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

function attachMockInventory(player: any): any {
  const slots = new Array<any>(36).fill(undefined);
  const container = {
    size: 36,
    getItem: (i: number) => slots[i],
    setItem: (i: number, item: any) => {
      slots[i] = item;
    },
    addItem: (item: any) => {
      const idx = slots.findIndex((s) => s === undefined);
      if (idx === -1) {
        return item;
      }
      slots[idx] = item;
      return undefined;
    },
  };
  player.getComponent = (id: string) => (id === 'minecraft:inventory' ? { container } : undefined);
  return container;
}

describe('New Economy Subsystems (Jobs, ChestShop, Sell, Bottle)', () => {
  const spies: Array<ReturnType<typeof spyOn>> = [];

  afterEach(() => {
    while (spies.length > 0) {
      spies.pop()?.mockRestore();
    }
  });

  it('jobs manager assigns, reads, and clears player jobs', () => {
    expect(setPlayerJob('job-p1', 'miner')).toBe(true);
    expect(getPlayerJob('job-p1')).toBe('miner');
    expect(setPlayerJob('job-p1', undefined)).toBe(true);
    expect(getPlayerJob('job-p1')).toBeUndefined();
  });

  it('chestShop enforces disabled state, claim permission, creation, and owner-only removal', () => {
    const ecoSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
      chestShop: { enabled: false, maxShopsPerPlayer: 5 },
    } as any);
    const featSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    const permSpy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(false);
    const claimSpy = spyOn(claimService, 'canPlayerModify').mockReturnValue(true);
    spies.push(ecoSpy, featSpy, permSpy, claimSpy);

    const owner = new Player('cs-owner', 'ShopOwner') as any;
    const other = new Player('cs-other', 'OtherPlayer') as any;
    const dim = new Dimension(MinecraftDimensionTypes.Overworld);
    const chestBlock = {
      typeId: MinecraftBlockTypes.Chest,
      location: { x: 20, y: 64, z: 20 },
      dimension: dim,
    } as any;

    expect(createChestShop(owner, chestBlock, 'buy', 10, 1).success).toBe(false);

    ecoSpy.mockReturnValue({
      chestShop: { enabled: true, maxShopsPerPlayer: 5 },
    } as any);

    // Denied inside another player's claim
    claimSpy.mockReturnValue(false);
    expect(createChestShop(owner, chestBlock, 'buy', 10, 1).success).toBe(false);

    // Must hold trade item
    claimSpy.mockReturnValue(true);
    expect(createChestShop(owner, chestBlock, 'buy', 10, 1).success).toBe(false);

    // Hold item and create shop
    const inv = attachMockInventory(owner);
    inv.setItem(0, new ItemStack(MinecraftItemTypes.Diamond, 1));
    owner.selectedSlotIndex = 0;

    const created = createChestShop(owner, chestBlock, 'buy', 50, 2);
    expect(created.success).toBe(true);
    expect(getChestShopAt(dim.id, chestBlock.location)?.itemTypeId).toBe(MinecraftItemTypes.Diamond);
    expect(getPlayerChestShops(owner.id).length).toBe(1);

    // Non-owner cannot remove; owner can remove
    expect(removeChestShop(other, dim.id, chestBlock.location).success).toBe(false);
    expect(removeChestShop(owner, dim.id, chestBlock.location).success).toBe(true);
    expect(getChestShopAt(dim.id, chestBlock.location)).toBeUndefined();
  });

  it('/sell respects disabled config and sells held item or all sellable items', () => {
    const ecoSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
      sell: { enabled: false },
      maxBalance: 100000,
    } as any);
    const shopCfgSpy = spyOn(configurations, 'getShopConfig').mockReturnValue({
      enabled: true,
      categories: {
        ores: {
          items: {
            diamond: { sellPrice: 200 },
            emerald: { sellPrice: 12 },
          },
        },
      },
    } as any);
    const ranksSpy = spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]);
    const featSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    const getPlayerSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({ balance: 0 } as any);
    const incSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => true as any);
    spies.push(ecoSpy, shopCfgSpy, ranksSpy, featSpy, getPlayerSpy, incSpy);
    shopManager.invalidateShopLookupCache();

    try {
      const player = new Player('sell-p1', 'Seller') as any;
      const inv = attachMockInventory(player);
      inv.setItem(0, new ItemStack(MinecraftItemTypes.Diamond, 2));
      inv.setItem(1, new ItemStack(MinecraftItemTypes.Emerald, 1));
      player.selectedSlotIndex = 0;

      sellCommand.execute(player, {});
      expect(inv.getItem(0)?.typeId).toBe(MinecraftItemTypes.Diamond);
      expect(inv.getItem(0)?.amount).toBe(2);
      expect(incSpy).not.toHaveBeenCalled();

      ecoSpy.mockReturnValue({ sell: { enabled: true }, maxBalance: 100000 } as any);

      // Sell hand
      sellCommand.execute(player, {});
      expect(inv.getItem(0)).toBeUndefined();
      expect(inv.getItem(1)?.typeId).toBe(MinecraftItemTypes.Emerald);
      expect(incSpy).toHaveBeenCalledTimes(1);
      expect(incSpy).toHaveBeenNthCalledWith(1, 'sell-p1', 400);

      // Sell all
      sellCommand.execute(player, { scope: 'all' });
      expect(inv.getItem(1)).toBeUndefined();
      expect(incSpy).toHaveBeenCalledTimes(2);
      expect(incSpy).toHaveBeenNthCalledWith(2, 'sell-p1', 12);
    } finally {
      shopManager.invalidateShopLookupCache();
    }
  });

  it('/bottle converts XP levels when enabled and rejects insufficient levels', () => {
    const ecoSpy = spyOn(configurations, 'getEconomyConfig').mockReturnValue({
      bottle: { enabled: false },
    } as any);
    const featSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    spies.push(ecoSpy, featSpy);

    const player = new Player('bot-p1', 'Bottler') as any;
    const inv = attachMockInventory(player);
    player.level = 10;
    player.addLevels = (d: number) => {
      player.level += d;
    };

    bottleCommand.execute(player, { levels: 5 });
    expect(player.level).toBe(10);

    ecoSpy.mockReturnValue({ bottle: { enabled: true } } as any);
    bottleCommand.execute(player, { levels: 15 });
    expect(player.level).toBe(10);

    bottleCommand.execute(player, { levels: 4 });
    expect(player.level).toBe(6);
    expect(inv.getItem(0)?.typeId).toBe(MinecraftItemTypes.ExperienceBottle);
    expect(inv.getItem(0)?.amount).toBe(4);
  });
});
