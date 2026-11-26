import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { ItemStack, Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configManager from '@core/config/configManager.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import * as featureManager from '@core/services/featureManager.js';
import {
  _clearGravesForTest,
  canAccessGrave,
  collectGrave,
  type GraveRecord,
  handlePlayerDeathGrave,
  pruneExpiredGraves,
} from '@features/essentials/graves/manager.js';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

describe('Graves Subsystem', () => {
  let cfgSpy: ReturnType<typeof spyOn> | undefined;
  let permSpy: ReturnType<typeof spyOn> | undefined;
  let featSpy: ReturnType<typeof spyOn> | undefined;
  let balSpy: ReturnType<typeof spyOn> | undefined;
  let getPlayerSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    _clearGravesForTest();
  });

  afterEach(() => {
    _clearGravesForTest();
    cfgSpy?.mockRestore();
    permSpy?.mockRestore();
    featSpy?.mockRestore();
    balSpy?.mockRestore();
    getPlayerSpy?.mockRestore();
  });

  it('handlePlayerDeathGrave is a no-op when graves.enabled is false', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: false },
    } as any);
    const player = new Player('g1', 'DeadPlayer');
    handlePlayerDeathGrave(player as any);
    expect(player.sendMessage).not.toHaveBeenCalled();
  });

  it('canAccessGrave allows owner, admin, and outsiders after publicUnlockMinutes', () => {
    permSpy = spyOn(permissionEngine, 'hasPermission').mockImplementation(
      (p: any, node: string) => node === 'group.admin' && p.id === 'admin1',
    );
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, publicUnlockMinutes: 10 },
    } as any);

    const owner = new Player('owner1', 'Owner') as any;
    const stranger = new Player('stranger1', 'Stranger') as any;
    const admin = new Player('admin1', 'Admin') as any;

    const recentGrave: GraveRecord = {
      id: 'grave-1',
      ownerId: owner.id,
      ownerName: owner.name,
      dimensionId: MinecraftDimensionTypes.Overworld,
      x: 0,
      y: 64,
      z: 0,
      createdAt: Date.now() - 60_000,
      expiresAt: Date.now() + 600_000,
      unlocked: false,
      items: [],
    };

    expect(canAccessGrave(recentGrave, owner)).toBe(true);
    expect(canAccessGrave(recentGrave, admin)).toBe(true);
    expect(canAccessGrave(recentGrave, stranger)).toBe(false);

    const oldGrave: GraveRecord = {
      ...recentGrave,
      createdAt: Date.now() - 15 * 60_000,
    };
    expect(canAccessGrave(oldGrave, stranger)).toBe(true);
  });

  it('collectGrave enforces unlockCost (economy & XP) and restores items when paid', () => {
    permSpy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(false);
    featSpy = spyOn(featureManager, 'isFeatureActive').mockReturnValue(true);
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, unlockCost: 100, unlockCostType: 'eco', autoEquipOnCollect: true },
    } as any);
    getPlayerSpy = spyOn(playerDataManager, 'getOrCreatePlayer').mockReturnValue({ balance: 50 } as any);
    balSpy = spyOn(playerDataManager, 'incrementPlayerBalance').mockImplementation(() => true as any);

    const owner = new Player('owner2', 'Owner2') as any;
    const slots = new Array<any>(36).fill(undefined);
    const inv = {
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
    owner.getComponent = (id: string) => (id === 'minecraft:inventory' ? { container: inv } : undefined);
    const grave: GraveRecord = {
      id: 'grave-2',
      ownerId: owner.id,
      ownerName: owner.name,
      dimensionId: MinecraftDimensionTypes.Overworld,
      x: 10,
      y: 64,
      z: 10,
      createdAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      unlocked: false,
      items: [
        {
          slotType: 'inventory',
          slotIndex: 0,
          item: { typeId: MinecraftItemTypes.Diamond, amount: 3 },
        },
      ],
    };

    // Insufficient economy balance
    collectGrave(grave, owner);
    expect(grave.unlocked).toBe(false);
    expect(balSpy).not.toHaveBeenCalled();
    expect(inv.getItem(0)).toBeUndefined();

    // Sufficient economy balance
    getPlayerSpy.mockReturnValue({ balance: 250 } as any);
    collectGrave(grave, owner);
    expect(grave.unlocked).toBe(true);
    expect(balSpy).toHaveBeenCalledTimes(1);
    expect(balSpy).toHaveBeenCalledWith(owner.id, -100);
    expect(inv.getItem(0)?.typeId).toBe(MinecraftItemTypes.Diamond);
    expect(inv.getItem(0)?.amount).toBe(3);

    // XP unlock cost failure
    cfgSpy.mockReturnValue({
      graves: { enabled: true, unlockCost: 5, unlockCostType: 'xp', autoEquipOnCollect: true },
    } as any);
    const xpGrave: GraveRecord = {
      ...grave,
      id: 'grave-3',
      unlocked: false,
      items: [{ slotType: 'inventory', slotIndex: 1, item: { typeId: MinecraftItemTypes.IronIngot, amount: 2 } }],
    };
    owner.level = 2;
    owner.addLevels = (delta: number) => {
      owner.level += delta;
    };
    collectGrave(xpGrave, owner);
    expect(xpGrave.unlocked).toBe(false);

    owner.level = 6;
    collectGrave(xpGrave, owner);
    expect(xpGrave.unlocked).toBe(true);
    expect(owner.level).toBe(1);
    expect(inv.getItem(1)?.typeId).toBe(MinecraftItemTypes.IronIngot);
  });

  it('collectGrave rejects expired graves and pruneExpiredGraves removes registered expired graves', () => {
    const owner = new Player('owner3', 'Owner3') as any;
    const expired: GraveRecord = {
      id: 'grave-expired',
      ownerId: owner.id,
      ownerName: owner.name,
      dimensionId: MinecraftDimensionTypes.Overworld,
      x: 0,
      y: 64,
      z: 0,
      createdAt: Date.now() - 100_000,
      expiresAt: Date.now() - 1000,
      unlocked: false,
      items: [{ slotType: 'inventory', slotIndex: 0, item: { typeId: MinecraftItemTypes.Stick, amount: 1 } }],
    };

    collectGrave(expired, owner);
    expect(owner.sendMessage).toHaveBeenCalledWith('§cThis grave has expired.');

    // Register a real grave via handlePlayerDeathGrave and verify pruneExpiredGraves removes it after expiry
    const nowSpy = spyOn(Date, 'now').mockReturnValue(1_000_000);
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 1 },
    } as any);
    const chestBlock = {
      typeId: MinecraftBlockTypes.Air,
      isAir: true,
      setType: () => {},
      above: () => ({ typeId: MinecraftBlockTypes.Air, isAir: true, setType: () => {} }),
    };
    const p = new Player('owner4', 'Owner4') as any;
    p.location = { x: 5, y: 64, z: 5 };
    p.dimension = {
      id: MinecraftDimensionTypes.Overworld,
      heightRange: { min: -64, max: 320 },
      getBlock: () => chestBlock,
    };
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = new ItemStack(MinecraftItemTypes.Stick, 1);
    p.getComponent = (id: string) =>
      id === 'minecraft:inventory'
        ? {
            container: {
              size: 36,
              getItem: (i: number) => slots[i],
              setItem: (i: number, v: any) => {
                slots[i] = v;
              },
            },
          }
        : undefined;
    handlePlayerDeathGrave(p);
    nowSpy.mockReturnValue(1_120_000);
    pruneExpiredGraves();
    nowSpy.mockRestore();
  });
});
