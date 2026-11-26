import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { Dimension, ItemStack, Player, system, world } from '@core/__tests__/__mocks__/minecraftMock.js';
import * as configManager from '@core/config/configManager.js';
import * as protectionService from '@core/events/protectionService.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import {
  _clearContainerLocksForTest,
  canAccessLockedContainer,
  getContainerLockAt,
  lockContainer,
  toggleContainerPublic,
  toggleContainerTrust,
} from '@features/essentials/protection/containerLockManager.js';
import {
  _clearCarriedEntitiesForTest,
  handleCarryEntityInteract,
  tickCarriedEntities,
} from '@features/essentials/survival/carry.js';
import { handleDynamicLightOffhandSwap } from '@features/essentials/survival/dynamicLighting.js';
import { handleSignColorInteract } from '@features/essentials/survival/signColors.js';
import { collectNearbyDropsToPlayer } from '@features/essentials/survival/telekinesis.js';
import { handleVeinMiner } from '@features/essentials/survival/veinMiner.js';
import { EntityComponentTypes, EquipmentSlot } from '@minecraft/server';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

describe('Survival QoL & Extended ContainerLock', () => {
  const spies: Array<ReturnType<typeof spyOn>> = [];

  beforeEach(() => {
    _clearContainerLocksForTest();
    _clearCarriedEntitiesForTest();
  });

  afterEach(() => {
    _clearContainerLocksForTest();
    _clearCarriedEntitiesForTest();
    while (spies.length > 0) {
      spies.pop()?.mockRestore();
    }
  });

  it('containerLockManager handles trust, untrust, and public toggle', () => {
    spies.push(
      spyOn(configManager, 'getConfig').mockReturnValue({
        containerLocking: { enabled: true, maxLocksPerPlayer: 10, allowTeamAccess: false },
        playerDefaults: { rankId: 'member', ranks: ['member'], xrayNotificationsEnabled: false },
      } as any),
      spyOn(permissionEngine, 'hasPermission').mockReturnValue(false),
    );

    const owner = new Player('lock-owner', 'Owner') as any;
    const friend = new Player('lock-friend', 'Friend') as any;
    const dim = new Dimension(MinecraftDimensionTypes.Overworld);
    const block = { typeId: MinecraftBlockTypes.Chest, location: { x: 1, y: 64, z: 1 }, dimension: dim } as any;

    expect(lockContainer(owner, block).success).toBe(true);

    // Trust friend
    const trustRes = toggleContainerTrust(owner, dim.id, block.location, friend.id, friend.name);
    expect(trustRes.success).toBe(true);
    expect(canAccessLockedContainer(getContainerLockAt(dim.id, block.location)!, friend)).toBe(true);

    // Untrust friend
    const untrustRes = toggleContainerTrust(owner, dim.id, block.location, friend.id, friend.name);
    expect(untrustRes.success).toBe(true);
    expect(canAccessLockedContainer(getContainerLockAt(dim.id, block.location)!, friend)).toBe(false);

    // Public toggle
    const pubRes = toggleContainerPublic(owner, dim.id, block.location);
    expect(pubRes.success).toBe(true);
    expect(getContainerLockAt(dim.id, block.location)?.isPublic).toBe(true);

    expect(
      canAccessLockedContainer(
        {
          key: 'k',
          ownerId: owner.id,
          ownerName: owner.name,
          trustedIds: [],
          isPublic: true,
          dimensionId: dim.id,
          x: 1,
          y: 64,
          z: 1,
        },
        friend,
      ),
    ).toBe(true);
  });

  it('signColors formats & codes only when enabled', () => {
    let frontText = '&aHello &bWorld';
    let backText = '&cBack';
    const signComp = {
      getText: (side: any) => (side === 'Back' ? backText : frontText),
      setText: (text: string, side: any) => {
        if (side === 'Back') {
          backText = text;
        } else {
          frontText = text;
        }
      },
    };
    const player = new Player('sign-p1', 'SignPlayer') as any;
    const block = {
      typeId: MinecraftBlockTypes.StandingSign,
      getComponent: () => signComp,
    } as any;

    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      survivalQoL: { signColors: { enabled: false } },
    } as any);
    const runSpy = spyOn(system, 'run').mockImplementation((cb: () => void) => {
      cb();
      return 1;
    });
    spies.push(cfgSpy, runSpy);

    handleSignColorInteract({ player, block } as any);
    expect(runSpy).not.toHaveBeenCalled();
    expect(frontText).toBe('&aHello &bWorld');

    cfgSpy.mockReturnValue({ survivalQoL: { signColors: { enabled: true } } } as any);
    frontText = '&aHello &bTom & Jerry';
    handleSignColorInteract({ player, block } as any);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(frontText).toBe('§aHello §bTom & Jerry');
    expect(backText).toBe('§cBack');
  });

  it('telekinesis collects nearby item entities into player inventory when enabled', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      survivalQoL: { telekinesis: { enabled: false } },
    } as any);
    const protSpy = spyOn(protectionService, 'getProtectionFlags').mockReturnValue({ preventItemPickup: false } as any);
    const runSpy = spyOn(system, 'run').mockImplementation((cb: () => void) => {
      cb();
      return 1;
    });
    spies.push(cfgSpy, protSpy, runSpy);

    const player = new Player('tk-p1', 'Miner') as any;
    const slots = new Array<any>(36).fill(undefined);
    const inv = {
      size: 36,
      getItem: (i: number) => slots[i],
      addItem: (item: any) => {
        const idx = slots.findIndex((s) => s === undefined);
        if (idx === -1) {
          return item;
        }
        slots[idx] = item;
        return undefined;
      },
    };
    player.getComponent = (id: string) => (id === 'minecraft:inventory' ? { container: inv } : undefined);
    let removed = false;
    const dropEntity = {
      id: 'new-drop-1',
      isValid: true,
      location: { x: 1.5, y: 64.5, z: 1.5 },
      getComponent: () => ({ itemStack: new ItemStack(MinecraftItemTypes.Cobblestone, 4) }),
      remove: () => {
        removed = true;
      },
    };
    const existingDrop = {
      id: 'existing-drop-1',
      isValid: true,
      location: { x: 1.5, y: 64.5, z: 1.5 },
      getComponent: () => ({ itemStack: new ItemStack(MinecraftItemTypes.Diamond, 1) }),
      remove: () => {
        existingRemoved = true;
      },
    };
    let existingRemoved = false;
    const entities = [existingDrop];
    const dim = {
      id: MinecraftDimensionTypes.Overworld,
      getEntities: () => entities,
    } as any;

    collectNearbyDropsToPlayer(player, { x: 1, y: 64, z: 1 }, dim);
    expect(runSpy).not.toHaveBeenCalled();
    expect(removed).toBe(false);
    expect(existingRemoved).toBe(false);

    runSpy.mockImplementationOnce((cb: () => void) => {
      entities.push(dropEntity);
      cb();
      return 1;
    });
    cfgSpy.mockReturnValue({ survivalQoL: { telekinesis: { enabled: true } } } as any);
    collectNearbyDropsToPlayer(player, { x: 1, y: 64, z: 1 }, dim);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(removed).toBe(true);
    expect(existingRemoved).toBe(false);
    expect(player.getComponent('minecraft:inventory').container.getItem(0)?.typeId).toBe(
      MinecraftItemTypes.Cobblestone,
    );
    expect(player.getComponent('minecraft:inventory').container.getItem(1)).toBeUndefined();

    // Pre-existing item entities on the ground before the break must not be stolen
    let stolen = false;
    const preExistingDrop = {
      id: 'pre-existing-1',
      isValid: true,
      location: { x: 1.5, y: 64.5, z: 1.5 },
      getComponent: () => ({ itemStack: new ItemStack(MinecraftItemTypes.Diamond, 1) }),
      remove: () => {
        stolen = true;
      },
    };
    const dimWithExisting = {
      id: MinecraftDimensionTypes.Overworld,
      getEntities: () => [preExistingDrop],
    } as any;
    collectNearbyDropsToPlayer(player, { x: 1, y: 64, z: 1 }, dimWithExisting);
    expect(stolen).toBe(false);
  });

  it('carry rejects falling blocks, ridden mounts, and drops carried entities if player mounts them', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      survivalQoL: { carry: { enabled: true } },
    } as any);
    const protSpy = spyOn(protectionService, 'getProtectionFlags').mockReturnValue({
      preventEntityInteraction: false,
    } as any);
    const runSpy = spyOn(system, 'run').mockImplementation((cb: () => void) => {
      cb();
      return 1;
    });

    const requestedPlayerComponents: string[] = [];
    const player = new Player('carry-p1', 'Carrier') as any;
    player.isSneaking = true;
    player.location = { x: 0, y: 64, z: 0 };
    player.dimension = { id: MinecraftDimensionTypes.Overworld };
    let playerRiding = true;
    player.getComponent = (id: string) => {
      if (!id) {
        throw new Error('Component ID must be defined');
      }
      requestedPlayerComponents.push(id);
      return id === EntityComponentTypes.Riding && playerRiding ? { entityRidingOn: { isValid: true } } : undefined;
    };
    player.getViewDirection = () => ({ x: 0, y: 0, z: 1 });

    const teleportCalls: Array<{ loc: unknown; opts: unknown }> = [];
    let entityHasRider = false;
    const mount = {
      id: 'horse-1',
      typeId: 'minecraft:horse',
      isValid: true,
      location: { x: 1, y: 64, z: 1 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
      hasComponent: (id: string) => id === EntityComponentTypes.Health,
      getComponent: (id: string) =>
        id === EntityComponentTypes.Rideable ? { getRiders: () => (entityHasRider ? [player] : []) } : undefined,
      teleport: (loc: unknown, opts: unknown) => {
        teleportCalls.push({ loc, opts });
      },
    } as any;

    const fallingBlock = {
      id: 'fb-1',
      typeId: 'minecraft:falling_block',
      isValid: true,
      location: { x: 1, y: 64, z: 1 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
      hasComponent: () => false,
      getComponent: () => undefined,
    } as any;

    const worldPlayersSpy = spyOn(world, 'getAllPlayers').mockReturnValue([player]);
    spies.push(cfgSpy, protSpy, runSpy, worldPlayersSpy);

    // Cannot pick up while already riding
    const ridingEvent = { player, target: mount, cancel: false } as any;
    expect(handleCarryEntityInteract(ridingEvent)).toBe(false);
    expect(ridingEvent.cancel).toBe(false);
    expect(requestedPlayerComponents).toContain(EntityComponentTypes.Riding);

    // Cannot pick up non-living entities like falling_block
    playerRiding = false;
    const fallingEvent = { player, target: fallingBlock, cancel: false } as any;
    expect(handleCarryEntityInteract(fallingEvent)).toBe(false);
    expect(fallingEvent.cancel).toBe(false);

    // Pick up while dismounted works
    const pickupEvent = { player, target: mount, cancel: false } as any;
    expect(handleCarryEntityInteract(pickupEvent)).toBe(true);
    expect(pickupEvent.cancel).toBe(true);
    tickCarriedEntities();
    expect(teleportCalls.length).toBe(1);
    expect(teleportCalls[0]).toEqual({
      loc: { x: 0, y: 65.1, z: 1.4 },
      opts: { dimension: player.dimension },
    });

    // If player mounts the entity while carrying it, tickCarriedEntities drops it instead of teleporting skyward
    entityHasRider = true;
    tickCarriedEntities();
    expect(teleportCalls.length).toBe(1);
  });

  it('dynamicLighting swaps held light-source items into offhand when sneaking', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      survivalQoL: { dynamicLighting: { enabled: true } },
    } as any);
    const runSpy = spyOn(system, 'run').mockImplementation((cb: () => void) => {
      cb();
      return 1;
    });
    spies.push(cfgSpy, runSpy);

    const player = new Player('dl-p1', 'TorchBearer') as any;
    player.isSneaking = true;
    player.selectedSlotIndex = 0;
    player.onScreenDisplay = { setActionBar: () => {} };
    player.playSound = () => {};

    const torch = new ItemStack(MinecraftItemTypes.Torch, 16);
    const shield = new ItemStack(MinecraftItemTypes.Shield, 1);
    const eqSlots = new Map<string, any>([
      [EquipmentSlot.Mainhand, torch],
      [EquipmentSlot.Offhand, shield],
    ]);
    const setEquipmentCalls: Array<{ slot: string; item: any }> = [];
    player.getComponent = (id: string) =>
      id === EntityComponentTypes.Equippable
        ? {
            getEquipment: (slot: string) => eqSlots.get(slot),
            setEquipment: (slot: string, item: any) => {
              setEquipmentCalls.push({ slot, item });
              eqSlots.set(slot, item);
            },
          }
        : undefined;

    const event = { source: player, itemStack: torch, cancel: false } as any;
    expect(handleDynamicLightOffhandSwap(event)).toBe(true);
    expect(event.cancel).toBe(true);
    expect(setEquipmentCalls.length).toBe(2);
    expect(setEquipmentCalls[0]).toEqual({ slot: EquipmentSlot.Offhand, item: torch });
    expect(setEquipmentCalls[1]).toEqual({ slot: EquipmentSlot.Mainhand, item: shield });
    expect(eqSlots.get(EquipmentSlot.Offhand)?.amount).toBe(16);
    expect(eqSlots.get(EquipmentSlot.Mainhand)?.amount).toBe(1);

    // Non-light items are ignored without additional writes
    const stone = new ItemStack(MinecraftItemTypes.Stone, 1);
    const nonLightEvent = { source: player, itemStack: stone, cancel: false } as any;
    expect(handleDynamicLightOffhandSwap(nonLightEvent)).toBe(false);
    expect(nonLightEvent.cancel).toBe(false);
    expect(setEquipmentCalls.length).toBe(2);
  });

  it('veinMiner blocks insufficient pickaxe tier and signColors respects protection', () => {
    const cfgSpy = spyOn(configManager, 'getConfig').mockReturnValue({
      survivalQoL: {
        veinMiner: { enabled: true, requireSneak: false, damageTool: false },
        signColors: { enabled: true },
      },
    } as any);
    const protSpy = spyOn(protectionService, 'getProtectionFlags').mockReturnValue({
      preventBlockInteraction: true,
    } as any);
    const permSpy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(false);
    spies.push(cfgSpy, protSpy, permSpy);

    const player = new Player('vm-p1', 'Miner') as any;
    player.isSneaking = true;
    const woodPick = new ItemStack(MinecraftItemTypes.WoodenPickaxe, 1);
    player.getComponent = (id: string) =>
      id === EntityComponentTypes.Equippable ? { getEquipment: () => woodPick, setEquipment: () => {} } : undefined;

    const diamondBlock = {
      typeId: MinecraftBlockTypes.DiamondOre,
      location: { x: 0, y: 12, z: 0 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
    } as any;
    expect(handleVeinMiner(player, diamondBlock)).toBe(0);

    let signSetCalled = false;
    const signBlock = {
      typeId: MinecraftBlockTypes.StandingSign,
      location: { x: 2, y: 64, z: 2 },
      dimension: { id: MinecraftDimensionTypes.Overworld },
      getComponent: () => ({
        getText: () => '&aProtected',
        setText: () => {
          signSetCalled = true;
        },
      }),
    } as any;
    handleSignColorInteract({ player, block: signBlock } as any);
    expect(signSetCalled).toBe(false);
  });
});
