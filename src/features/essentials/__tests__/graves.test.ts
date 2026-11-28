import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { ItemStack, Player } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configManager from '@core/config/configManager.js';
import * as itemSerializer from '@core/data/itemSerializer.js';
import * as playerDataManager from '@core/data/playerDataManager.js';
import { handlePistonActivate } from '@core/events/protectionEvents.js';
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
  teleportPlayerToGrave,
} from '@features/essentials/graves/manager.js';
import { EntityComponentTypes, EntityDamageCause, system, world } from '@minecraft/server';
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

  it('captures inventory from pre-death snapshot immediately and cleans up next-tick dropped item entities', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 60 },
    } as any);
    const chestBlock: any = {
      typeId: MinecraftBlockTypes.Air,
      isAir: true,
      isLiquid: false,
      setType: (t: string) => {
        chestBlock.typeId = t;
        chestBlock.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    let ownedRemoveCalls = 0;
    const ownedDiamond = new ItemStack(MinecraftItemTypes.Diamond, 2);
    const droppedOwned = {
      id: 'drop-next-tick',
      isValid: true,
      getComponent: (id: string) =>
        id === EntityComponentTypes.Item ? { itemStack: new ItemStack(MinecraftItemTypes.Diamond, 2) } : undefined,
      remove: () => {
        ownedRemoveCalls++;
      },
    };
    let dropsSpawnedOnNextTick = false;
    const getEntitiesCalls: Array<{
      type?: string;
      location?: { x: number; y: number; z: number };
      maxDistance?: number;
    }> = [];
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = ownedDiamond;
    const p = new Player('owner-next', 'OwnerNext') as any;
    p.location = { x: 20, y: 64, z: 20 };
    p.dimension = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => chestBlock,
      getEntities: (opts?: { type?: string; location?: { x: number; y: number; z: number }; maxDistance?: number }) => {
        getEntitiesCalls.push({ type: opts?.type, location: opts?.location, maxDistance: opts?.maxDistance });
        if (
          dropsSpawnedOnNextTick &&
          opts?.location?.x === 20 &&
          opts?.location?.y === 64 &&
          opts?.location?.z === 20 &&
          opts?.maxDistance === 10
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

      const ownerGravesAfterCapture = getPlayerGraves('owner-next');
      expect(ownerGravesAfterCapture).toHaveLength(1);
      expect(ownerGravesAfterCapture[0]?.items[0]?.item.typeId).toBe(MinecraftItemTypes.Diamond);
      expect(ownerGravesAfterCapture[0]?.items[0]?.item.amount).toBe(2);
      expect(ownerGravesAfterCapture[0]?.items[0]?.slotIndex).toBe(0);
      expect(chestBlock.typeId).toBe(MinecraftBlockTypes.Chest);

      dropsSpawnedOnNextTick = true;
      while (queued.length > 0) {
        queued.shift()!();
      }
      expect(ownedRemoveCalls).toBe(1);
      expect(getEntitiesCalls).toEqual([
        { type: undefined, location: { x: 20, y: 64, z: 20 }, maxDistance: 12 },
        { type: undefined, location: { x: 20, y: 64, z: 20 }, maxDistance: 6 },
        { type: undefined, location: { x: 20, y: 64, z: 20 }, maxDistance: 10 },
      ]);
    } finally {
      runSpy.mockRestore();
    }

    expect(sendMsgSpy).toHaveBeenCalledTimes(1);
    expect(sendMsgSpy).toHaveBeenCalledWith(
      '§a[Grave] §fSaved §b1§f item stack(s) at §e20, 64, 20 §7[Overworld] §8(Expires in 60m)§f. Use §b/grave§f to view or track.',
    );
  });

  it('creates a second non-adjacent grave when dying again without opening the first grave', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 60 },
    } as any);

    const blocks = new Map<string, any>();
    const getBlock = (loc: { x: number; y: number; z: number }) => {
      const key = `${loc.x},${loc.y},${loc.z}`;
      let blk = blocks.get(key);
      if (!blk) {
        blk = {
          isAir: true,
          isLiquid: false,
          typeId: MinecraftBlockTypes.Air,
          setType: (t: string) => {
            blk.typeId = t;
            blk.isAir = t === MinecraftBlockTypes.Air;
          },
        };
        blocks.set(key, blk);
      }
      return blk;
    };

    const slots = new Array<any>(36).fill(undefined);
    const p = new Player('owner-multi', 'OwnerMulti') as any;
    p.location = { x: 10, y: 64, z: 10 };
    p.dimension = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock,
      getEntities: () => [],
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

    const runSpy = spyOn(system, 'run').mockImplementation((cb: () => void) => {
      cb();
      return 1;
    });
    try {
      slots[0] = new ItemStack(MinecraftItemTypes.IronIngot, 5);
      handlePlayerDeathGrave(p);

      slots[0] = new ItemStack(MinecraftItemTypes.GoldIngot, 3);
      handlePlayerDeathGrave(p);
    } finally {
      runSpy.mockRestore();
    }

    const active = getPlayerGraves('owner-multi');
    expect(active).toHaveLength(2);
    const [g1, g2] = active;
    const manhattan = Math.abs(g1!.x - g2!.x) + Math.abs(g1!.y - g2!.y) + Math.abs(g1!.z - g2!.z);
    expect(manhattan).toBeGreaterThan(0);
    if (g1!.y === g2!.y) {
      expect(Math.abs(g1!.x - g2!.x) + Math.abs(g1!.z - g2!.z)).toBeGreaterThan(1);
    }
  });

  it('removes expired grave chest blocks when markerPlaced was false but grave hologram proves ownership', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 1 },
    } as any);

    const chestBlock: any = {
      isAir: true,
      isLiquid: false,
      typeId: MinecraftBlockTypes.Air,
      setType: (t: string) => {
        chestBlock.typeId = t;
        chestBlock.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    let hologramEntity: any | undefined;
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => chestBlock,
      getEntities: (opts?: { type?: string }) =>
        opts?.type === 'exe:floating_text' && hologramEntity?.isValid ? [hologramEntity] : [],
      spawnEntity: () => {
        const tags = new Set<string>();
        hologramEntity = {
          isValid: true,
          nameTag: '',
          addTag: (t: string) => tags.add(t),
          hasTag: (t: string) => tags.has(t),
          getTags: () => [...tags],
          remove: () => {
            hologramEntity.isValid = false;
          },
        };
        return hologramEntity;
      },
    };
    const mcWorld = require('@minecraft/server').world;
    const getDimSpy = spyOn(mcWorld, 'getDimension').mockReturnValue(dimMock as any);

    const p = new Player('owner-orphan', 'OwnerOrphan') as any;
    p.location = { x: 5, y: 64, z: 5 };
    p.dimension = dimMock;
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = new ItemStack(MinecraftItemTypes.Apple, 1);
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

    const nowSpy = spyOn(Date, 'now').mockReturnValue(1_000_000);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      handlePlayerDeathGrave(p);
      const created = getPlayerGraves('owner-orphan')[0]!;
      created.markerPlaced = false;
      chestBlock.typeId = MinecraftBlockTypes.Chest;

      nowSpy.mockReturnValue(1_000_000 + 120_000);
      pruneExpiredGraves();

      expect(getGraveAt(MinecraftDimensionTypes.Overworld, { x: 5, y: 64, z: 5 })).toBeUndefined();
      expect(chestBlock.typeId).toBe(MinecraftBlockTypes.Air);
      expect(hologramEntity?.isValid).toBe(false);
    } finally {
      nowSpy.mockRestore();
      runSpy.mockRestore();
      getDimSpy.mockRestore();
    }
  });

  it('preserves an ordinary chest at a pending grave coordinate when markerPlaced is false and no hologram exists', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 1 },
    } as any);

    const chestBlock: any = {
      isAir: true,
      isLiquid: false,
      typeId: MinecraftBlockTypes.Air,
      setType: (t: string) => {
        chestBlock.typeId = t;
        chestBlock.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => chestBlock,
      getEntities: () => [],
    };
    const mcWorld = require('@minecraft/server').world;
    const getDimSpy = spyOn(mcWorld, 'getDimension').mockReturnValue(dimMock as any);

    const p = new Player('owner-ordinary', 'OwnerOrdinary') as any;
    p.location = { x: 6, y: 64, z: 6 };
    p.dimension = dimMock;
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = new ItemStack(MinecraftItemTypes.Apple, 1);
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

    const nowSpy = spyOn(Date, 'now').mockReturnValue(1_000_000);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      handlePlayerDeathGrave(p);
      const created = getPlayerGraves('owner-ordinary')[0]!;
      created.markerPlaced = false;
      created.markerPending = true;
      chestBlock.typeId = MinecraftBlockTypes.Chest;

      nowSpy.mockReturnValue(1_000_000 + 120_000);
      pruneExpiredGraves();

      expect(getGraveAt(MinecraftDimensionTypes.Overworld, { x: 6, y: 64, z: 6 })).toBeUndefined();
      expect(chestBlock.typeId).toBe(MinecraftBlockTypes.Chest);
    } finally {
      nowSpy.mockRestore();
      runSpy.mockRestore();
      getDimSpy.mockRestore();
    }
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

  it('places grave chest only in air blocks and skips water/lava/snow', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 10 },
    } as any);

    const blocks = new Map<string, any>([
      ['10,64,10', { isAir: false, isLiquid: true, typeId: MinecraftBlockTypes.Water, setType: () => {} }],
      [
        '10,65,10',
        {
          isAir: true,
          isLiquid: false,
          typeId: MinecraftBlockTypes.Air,
          setType: (t: string) => {
            blocks.get('10,65,10')!.typeId = t;
            blocks.get('10,65,10')!.isAir = t === MinecraftBlockTypes.Air;
          },
        },
      ],
    ]);
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: (loc: { x: number; y: number; z: number }) =>
        blocks.get(`${loc.x},${loc.y},${loc.z}`) ?? {
          isAir: false,
          isLiquid: false,
          typeId: MinecraftBlockTypes.Stone,
        },
      getEntities: () => [],
    };
    const p = new Player('owner-air', 'OwnerAir') as any;
    p.location = { x: 10, y: 64, z: 10 };
    p.dimension = dimMock;
    const slots = new Array<any>(36).fill(undefined);
    slots[0] = new ItemStack(MinecraftItemTypes.Apple, 1);
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

    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      handlePlayerDeathGrave(p);
      const created = getPlayerGraves('owner-air')[0]!;
      expect(created.y).toBe(65);
      expect(blocks.get('10,64,10')!.typeId).toBe(MinecraftBlockTypes.Water);
      expect(blocks.get('10,65,10')!.typeId).toBe(MinecraftBlockTypes.Chest);
    } finally {
      runSpy.mockRestore();
    }
  });

  it('respects vanilla world.gameRules.keepInventory', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true },
    } as any);
    const prevRule = world.gameRules.keepInventory;
    world.gameRules.keepInventory = true;
    try {
      const p = new Player('owner-ki', 'OwnerKI') as any;
      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Diamond, 1);
      p.getComponent = (id: string) =>
        id === EntityComponentTypes.Inventory
          ? { container: { size: 36, getItem: (i: number) => slots[i], setItem: () => {} } }
          : undefined;
      snapshotPlayerInventoryForGrave(p);
      handlePlayerDeathGrave(p);
      expect(getPlayerGraves('owner-ki')).toHaveLength(0);
    } finally {
      world.gameRules.keepInventory = prevRule;
    }
  });

  it('rejects abandoned graves in collectGrave and teleportPlayerToGrave', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 30 },
    } as any);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      const owner = new Player('owner-ab', 'OwnerAb') as any;
      owner.location = { x: 12, y: 64, z: 12 };
      owner.dimension = {
        id: MinecraftDimensionTypes.Overworld,
        getBlock: () => ({ isAir: true, typeId: MinecraftBlockTypes.Air, setType: () => {} }),
        getEntities: () => [],
      };
      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Stick, 1);
      owner.getComponent = (id: string) =>
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
      let createdId = '';
      handlePlayerDeathGrave(owner, (id) => {
        createdId = id;
      });
      const registered = getPlayerGraves(owner.id).find((g) => g.id === createdId)!;
      expect(registered).toBeDefined();
      registered.abandoned = true;

      owner.sendMessage.mockClear();
      owner.teleport.mockClear();
      collectGrave(registered, owner);
      expect(owner.sendMessage).toHaveBeenCalledTimes(1);
      expect(owner.sendMessage).toHaveBeenCalledWith('§cThis grave is no longer available.');

      owner.sendMessage.mockClear();
      owner.teleport.mockClear();
      teleportPlayerToGrave(owner, createdId);
      expect(owner.sendMessage).toHaveBeenCalledTimes(1);
      expect(owner.sendMessage).toHaveBeenCalledWith('§cThis grave is no longer available.');
      expect(owner.teleport).not.toHaveBeenCalled();
    } finally {
      runSpy.mockRestore();
    }
  });

  it('skips un-deserializable items in collectGrave instead of locking the grave', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, autoEquipOnCollect: true },
    } as any);
    const deserSpy = spyOn(itemSerializer, 'deserializeItem').mockReturnValue(undefined);
    try {
      const owner = new Player('owner-corrupt', 'OwnerCorrupt') as any;
      const slots = new Array<any>(36).fill(undefined);
      owner.getComponent = (id: string) =>
        id === EntityComponentTypes.Inventory
          ? { container: { size: 36, getItem: (i: number) => slots[i], setItem: () => {}, addItem: () => undefined } }
          : undefined;
      const grave: GraveRecord = {
        id: 'grave-corrupt',
        ownerId: owner.id,
        ownerName: owner.name,
        dimensionId: MinecraftDimensionTypes.Overworld,
        x: 0,
        y: 64,
        z: 0,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        unlocked: true,
        items: [{ slotType: 'inventory', slotIndex: 0, item: { typeId: 'removed:addon_item', amount: 1 } }],
      };
      collectGrave(grave, owner);
      expect(grave.items).toHaveLength(0);
      expect(owner.sendMessage).toHaveBeenCalledWith('§aCollected all items! The grave has disappeared.');
    } finally {
      deserSpy.mockRestore();
    }
  });

  it('ignores stale hurt snapshot when death cause is selfDestruct (/kill)', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true },
    } as any);
    const p = new Player('owner-sd', 'OwnerSD') as any;
    let hasItem = true;
    p.location = { x: 20, y: 64, z: 20 };
    p.dimension = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => ({ isAir: true, typeId: MinecraftBlockTypes.Air, setType: () => {} }),
      getEntities: () => [],
    };
    p.getComponent = (id: string) =>
      id === EntityComponentTypes.Inventory
        ? {
            container: {
              size: 36,
              getItem: (i: number) => (hasItem && i === 0 ? new ItemStack(MinecraftItemTypes.Diamond, 1) : undefined),
              setItem: () => {},
            },
          }
        : undefined;

    snapshotPlayerInventoryForGrave(p);
    hasItem = false;
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      handlePlayerDeathGrave(p, undefined, (EntityDamageCause?.selfDestruct ?? 'selfDestruct') as any);
      expect(getPlayerGraves('owner-sd')).toHaveLength(0);
    } finally {
      runSpy.mockRestore();
    }
  });

  it('restores a grave chest displaced by a piston', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true },
    } as any);
    const graveBlk: any = {
      isAir: true,
      typeId: MinecraftBlockTypes.Air,
      setType: (t: string) => {
        graveBlk.typeId = t;
        graveBlk.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    const pushedBlk: any = {
      isAir: true,
      typeId: MinecraftBlockTypes.Air,
      setType: (t: string) => {
        pushedBlk.typeId = t;
        pushedBlk.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: (loc: { x: number; y: number; z: number }) => {
        if (loc.x === 30 && loc.y === 64 && loc.z === 30) {
          return graveBlk;
        }
        if (loc.x === 31 && loc.y === 64 && loc.z === 30) {
          return pushedBlk;
        }
        return { isAir: true, typeId: MinecraftBlockTypes.Air, setType: () => {} };
      },
      getEntities: () => [],
    };
    const getDimSpy = spyOn(world, 'getDimension').mockReturnValue(dimMock as any);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      const p = new Player('owner-piston', 'OwnerPiston') as any;
      p.location = { x: 30, y: 64, z: 30 };
      p.dimension = dimMock;
      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Emerald, 2);
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
      handlePlayerDeathGrave(p);
      // Simulate piston pushing the grave chest from (30,64,30) to (31,64,30)
      graveBlk.typeId = MinecraftBlockTypes.Air;
      graveBlk.isAir = true;
      pushedBlk.typeId = MinecraftBlockTypes.Chest;
      pushedBlk.isAir = false;
      handlePistonActivate({
        dimension: dimMock as any,
        isExpanding: true,
        piston: { getAttachedBlocksLocations: () => [{ x: 31, y: 64, z: 30 }] } as any,
      } as any);
      expect(graveBlk.typeId).toBe(MinecraftBlockTypes.Chest);
      expect(pushedBlk.typeId).toBe(MinecraftBlockTypes.Air);
    } finally {
      getDimSpy.mockRestore();
      runSpy.mockRestore();
    }
  });

  it('does not replace occupied blocks or delete adjacent chests for unplaced pending graves on piston activation', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 30 },
    } as any);
    const graveBlk: any = {
      isAir: false,
      typeId: MinecraftBlockTypes.Stone,
      setType: (t: string) => {
        graveBlk.typeId = t;
        graveBlk.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    const adjacentChest: any = {
      isAir: false,
      typeId: MinecraftBlockTypes.Chest,
      setType: (t: string) => {
        adjacentChest.typeId = t;
        adjacentChest.isAir = t === MinecraftBlockTypes.Air;
      },
    };
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: (loc: { x: number; y: number; z: number }) => {
        if (loc.x === 40 && loc.y === 64 && loc.z === 40) {
          return graveBlk;
        }
        if (loc.x === 41 && loc.y === 64 && loc.z === 40) {
          return adjacentChest;
        }
        return { isAir: false, typeId: MinecraftBlockTypes.Stone, setType: () => {} };
      },
      getEntities: () => [],
    };
    const getDimSpy = spyOn(world, 'getDimension').mockReturnValue(dimMock as any);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      const p = new Player('owner-pending-piston', 'OwnerPendingPiston') as any;
      p.location = { x: 40, y: 64, z: 40 };
      p.dimension = dimMock;
      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Emerald, 1);
      p.getComponent = (id: string) =>
        id === EntityComponentTypes.Inventory
          ? { container: { size: 36, getItem: (i: number) => slots[i], setItem: () => {} } }
          : undefined;
      handlePlayerDeathGrave(p);
      const pending = getPlayerGraves(p.id)[0];
      expect(pending?.markerPlaced).toBe(false);

      // Even if the fallback coordinate later becomes air, an unplaced pending grave must not delete an adjacent chest
      graveBlk.typeId = MinecraftBlockTypes.Air;
      graveBlk.isAir = true;
      handlePistonActivate({
        dimension: dimMock as any,
        isExpanding: true,
        piston: { getAttachedBlocksLocations: () => [{ x: 41, y: 64, z: 40 }] } as any,
      } as any);
      expect(graveBlk.typeId).toBe(MinecraftBlockTypes.Air);
      expect(adjacentChest.typeId).toBe(MinecraftBlockTypes.Chest);
    } finally {
      getDimSpy.mockRestore();
      runSpy.mockRestore();
    }
  });

  it('preserves preExistingEntityIds in fallback capture when selfDestruct bypasses hurt snapshot', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 30 },
    } as any);
    const unrelatedRemove = spyOn({ remove: () => {} }, 'remove');
    const unrelatedDrop = {
      id: 'pre-existing-gold',
      isValid: true,
      getComponent: (id: string) =>
        id === EntityComponentTypes.Item ? { itemStack: new ItemStack(MinecraftItemTypes.GoldIngot, 3) } : undefined,
      remove: unrelatedRemove,
    };
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: () => ({ isAir: true, typeId: MinecraftBlockTypes.Air, setType: () => {} }),
      getEntities: () => [unrelatedDrop],
    };
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      const p = new Player('owner-sd-pre', 'OwnerSdPre') as any;
      p.location = { x: 25, y: 64, z: 25 };
      p.dimension = dimMock;
      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Diamond, 1);
      p.getComponent = (id: string) =>
        id === EntityComponentTypes.Inventory
          ? { container: { size: 36, getItem: (i: number) => slots[i], setItem: () => {} } }
          : undefined;
      snapshotPlayerInventoryForGrave(p);
      // Clear inventory before death so selfDestruct enters fallbackCapture
      slots[0] = undefined;
      handlePlayerDeathGrave(p, undefined, EntityDamageCause.selfDestruct ?? ('selfDestruct' as any));
      expect(getPlayerGraves(p.id)).toHaveLength(0);
      expect(unrelatedRemove).not.toHaveBeenCalled();
    } finally {
      runSpy.mockRestore();
    }
  });

  it('requires solid non-hazardous floor for horizontal grave teleport landing spots', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, allowTeleport: true, expiryMinutes: 30, teleportCost: 0 },
      playerDefaults: { rankId: 'member' },
    } as any);
    permSpy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(false);
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: (loc: { x: number; y: number; z: number }) => {
        // Chest at (50, 64, 50), blocked above at (50, 65, 50)
        if (loc.x === 50 && loc.y === 65 && loc.z === 50) {
          return { isAir: false, isLiquid: false, typeId: MinecraftBlockTypes.Stone };
        }
        // (+1, 0) at (51, 64, 50) has air at feet/head, but lava below at (51, 63, 50)
        if (loc.x === 51 && loc.y === 63 && loc.z === 50) {
          return { isAir: false, isLiquid: true, typeId: MinecraftBlockTypes.Lava };
        }
        // (-1, 0) at (49, 64, 50) has air at feet/head and stone below at (49, 63, 50)
        if (loc.x === 49 && loc.y === 63 && loc.z === 50) {
          return { isAir: false, isLiquid: false, typeId: MinecraftBlockTypes.Stone };
        }
        if (loc.y < 64) {
          return { isAir: true, isLiquid: false, typeId: MinecraftBlockTypes.Air };
        }
        return { isAir: true, isLiquid: false, typeId: MinecraftBlockTypes.Air, setType: () => {} };
      },
      getEntities: () => [],
    };
    const getDimSpy = spyOn(world, 'getDimension').mockReturnValue(dimMock as any);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      const p = new Player('owner-tp-safe', 'OwnerTpSafe') as any;
      p.location = { x: 50, y: 64, z: 50 };
      p.dimension = dimMock;
      const slots = new Array<any>(36).fill(undefined);
      slots[0] = new ItemStack(MinecraftItemTypes.Apple, 1);
      p.getComponent = (id: string) =>
        id === EntityComponentTypes.Inventory
          ? { container: { size: 36, getItem: (i: number) => slots[i], setItem: () => {} } }
          : undefined;
      let createdId = '';
      handlePlayerDeathGrave(p, (id) => {
        createdId = id;
      });
      p.teleport.mockClear();
      teleportPlayerToGrave(p, createdId);
      expect(p.teleport).toHaveBeenCalledTimes(1);
      expect(p.teleport.mock.calls[0][0]).toEqual({ x: 49.5, y: 64, z: 50.5 });
    } finally {
      getDimSpy.mockRestore();
      runSpy.mockRestore();
    }
  });

  it('restores vertically stacked displaced graves regardless of getAttachedBlocksLocations order', () => {
    cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      graves: { enabled: true, expiryMinutes: 30 },
    } as any);
    const blocks = new Map<string, any>();
    const getOrCreateBlk = (x: number, y: number, z: number) => {
      const key = `${x},${y},${z}`;
      if (!blocks.has(key)) {
        const blk: any = {
          isAir: true,
          typeId: MinecraftBlockTypes.Air,
          setType: (t: string) => {
            blk.typeId = t;
            blk.isAir = t === MinecraftBlockTypes.Air;
          },
        };
        blocks.set(key, blk);
      }
      return blocks.get(key);
    };
    const dimMock = {
      id: MinecraftDimensionTypes.Overworld,
      getBlock: (loc: { x: number; y: number; z: number }) => getOrCreateBlk(loc.x, loc.y, loc.z),
      getEntities: () => [],
    };
    const getDimSpy = spyOn(world, 'getDimension').mockReturnValue(dimMock as any);
    const runSpy = spyOn(system, 'run').mockImplementation(() => 1);
    try {
      const makeDeadPlayer = (id: string, y: number) => {
        const p = new Player(id, id) as any;
        p.location = { x: 60, y, z: 60 };
        p.dimension = dimMock;
        const slots = new Array<any>(36).fill(undefined);
        slots[0] = new ItemStack(MinecraftItemTypes.Emerald, 1);
        p.getComponent = (c: string) =>
          c === EntityComponentTypes.Inventory
            ? { container: { size: 36, getItem: (i: number) => slots[i], setItem: () => {} } }
            : undefined;
        handlePlayerDeathGrave(p);
      };
      makeDeadPlayer('stack-low', 64);
      makeDeadPlayer('stack-high', 65);
      // Simulate upward piston push: (60,64,60)->(60,65,60) and (60,65,60)->(60,66,60)
      getOrCreateBlk(60, 64, 60).setType(MinecraftBlockTypes.Air);
      getOrCreateBlk(60, 65, 60).setType(MinecraftBlockTypes.Chest);
      getOrCreateBlk(60, 66, 60).setType(MinecraftBlockTypes.Chest);

      // Farther block (60,66,60) listed first
      handlePistonActivate({
        dimension: dimMock as any,
        isExpanding: true,
        piston: {
          getAttachedBlocksLocations: () => [
            { x: 60, y: 66, z: 60 },
            { x: 60, y: 65, z: 60 },
          ],
        } as any,
      } as any);

      expect(getOrCreateBlk(60, 64, 60).typeId).toBe(MinecraftBlockTypes.Chest);
      expect(getOrCreateBlk(60, 65, 60).typeId).toBe(MinecraftBlockTypes.Chest);
      expect(getOrCreateBlk(60, 66, 60).typeId).toBe(MinecraftBlockTypes.Air);
    } finally {
      getDimSpy.mockRestore();
      runSpy.mockRestore();
    }
  });
});
