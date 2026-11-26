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
  getGraveAt,
  getPlayerGraves,
  getUnifiedDeathTeleportPolicy,
  type GraveRecord,
  handlePlayerDeathGrave,
  pruneExpiredGraves,
  snapshotPlayerInventoryForGrave,
} from '@features/essentials/graves/manager.js';
import { EntityComponentTypes, system } from '@minecraft/server';
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

  it('captures death-attributed dropped item entities and leaves unrelated drops untouched', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 60 },
    } as any);
    const chestBlock = {
      typeId: MinecraftBlockTypes.Air,
      isAir: true,
      setType: () => {},
    };

    const ownedDiamond = new ItemStack(MinecraftItemTypes.Diamond, 3);
    const strangerGold = new ItemStack(MinecraftItemTypes.GoldIngot, 5);
    let ownedRemoveCalls = 0;
    let strangerRemoveCalls = 0;
    const droppedOwned = {
      isValid: true,
      getComponent: (id: string) => (id === EntityComponentTypes.Item ? { itemStack: ownedDiamond } : undefined),
      remove: () => {
        ownedRemoveCalls++;
      },
    };
    const droppedStranger = {
      isValid: true,
      getComponent: (id: string) => (id === EntityComponentTypes.Item ? { itemStack: strangerGold } : undefined),
      remove: () => {
        strangerRemoveCalls++;
      },
    };

    const getEntitiesCalls: Array<{ location: unknown; maxDistance: number }> = [];
    let droppedAfterDeath = false;
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = ownedDiamond;
    const p = new Player('owner5', 'Owner5') as any;
    p.location = { x: 10, y: 64, z: 10 };
    p.dimension = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => chestBlock,
      getEntities: (opts: { location: unknown; maxDistance: number }) => {
        getEntitiesCalls.push(opts);
        return droppedAfterDeath ? [droppedOwned, droppedStranger] : [];
      },
    };
    p.getComponent = (id: string) =>
      id === EntityComponentTypes.Inventory
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

    // Snapshot while player still holds the diamond, then simulate death drops spawning before entityDie runs
    snapshotPlayerInventoryForGrave(p);
    slots[0] = undefined;
    droppedAfterDeath = true;

    handlePlayerDeathGrave(p);

    expect(getEntitiesCalls).toEqual([
      { location: { x: 10, y: 64, z: 10 }, maxDistance: 12 },
      { location: { x: 10, y: 64, z: 10 }, maxDistance: 6 },
    ]);
    const grave = getGraveAt(MinecraftDimensionTypes.Overworld, { x: 10, y: 64, z: 10 });
    expect(grave).toBeDefined();
    expect(grave?.items.length).toBe(1);
    expect(grave?.items[0]?.item.typeId).toBe(MinecraftItemTypes.Diamond);
    expect(grave?.items[0]?.item.amount).toBe(3);
    expect(ownedRemoveCalls).toBe(1);
    expect(strangerRemoveCalls).toBe(0);
  });

  it('captures dropped item entities that first appear on the next tick', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 60 },
    } as any);
    const chestBlock = { typeId: MinecraftBlockTypes.Air, isAir: true, isLiquid: false, setType: () => {} };
    let ownedRemoveCalls = 0;
    const ownedDiamond = new ItemStack(MinecraftItemTypes.Diamond, 2);
    const droppedOwned = {
      id: 'drop-next-tick',
      isValid: true,
      getComponent: () => ({ itemStack: new ItemStack(MinecraftItemTypes.Diamond, 2) }),
      remove: () => {
        ownedRemoveCalls++;
      },
    };
    let dropsSpawnedOnNextTick = false;
    const getEntitiesCalls: Array<{ location?: { x: number; y: number; z: number }; maxDistance?: number }> = [];
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = ownedDiamond;
    const p = new Player('owner-next', 'OwnerNext') as any;
    p.location = { x: 20, y: 64, z: 20 };
    p.dimension = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => chestBlock,
      getEntities: (opts?: { location?: { x: number; y: number; z: number }; maxDistance?: number }) => {
        getEntitiesCalls.push({ location: opts?.location, maxDistance: opts?.maxDistance });
        if (
          dropsSpawnedOnNextTick &&
          opts?.location?.x === 20 &&
          opts?.location?.y === 64 &&
          opts?.location?.z === 20 &&
          (opts?.maxDistance === 12 || opts?.maxDistance === 6)
        ) {
          return [droppedOwned];
        }
        return [];
      },
    };
    p.getComponent = (id: string) =>
      id === EntityComponentTypes.Inventory
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

    const sendMsgSpy = spyOn(p, 'sendMessage');
    const queued: Array<() => void> = [];
    const runSpy = spyOn(system, 'run').mockImplementation((cb: () => void) => {
      queued.push(cb);
      return queued.length;
    });
    try {
      snapshotPlayerInventoryForGrave(p);
      slots[0] = undefined;
      handlePlayerDeathGrave(p);

      expect(getPlayerGraves('owner-next')).toHaveLength(0);
      expect(queued).toHaveLength(1);

      dropsSpawnedOnNextTick = true;
      queued.shift()!();

      expect(getEntitiesCalls).toEqual([
        { location: { x: 20, y: 64, z: 20 }, maxDistance: 12 },
        { location: { x: 20, y: 64, z: 20 }, maxDistance: 6 },
        { location: { x: 20, y: 64, z: 20 }, maxDistance: 6 },
      ]);

      const ownerGravesAfterCapture = getPlayerGraves('owner-next');
      expect(ownerGravesAfterCapture).toHaveLength(1);
      expect(ownerGravesAfterCapture[0]?.items[0]?.item.typeId).toBe(MinecraftItemTypes.Diamond);
      expect(ownerGravesAfterCapture[0]?.items[0]?.item.amount).toBe(2);
      expect(ownedRemoveCalls).toBe(1);

      while (queued.length > 0) {
        queued.shift()!();
      }
    } finally {
      runSpy.mockRestore();
    }

    expect(sendMsgSpy.mock.calls.filter(([m]) => String(m).includes('saved in a protected grave'))).toHaveLength(1);
  });

  it('unifies /back and grave teleport cost to prevent cheaper bypasses', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, allowTeleport: true, teleportCost: 10 },
      back: { enabled: true, cost: 100, cooldownSeconds: 30, teleportWarmupSeconds: 3 },
    } as any);
    const policy = getUnifiedDeathTeleportPolicy();
    expect(policy.cost).toBe(100);
    expect(policy.cooldownSeconds).toBe(30);
    expect(policy.warmupSeconds).toBe(3);
    expect(policy.allowGraveTeleport).toBe(true);
  });
});
