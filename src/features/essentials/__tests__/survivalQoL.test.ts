import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { Dimension, ItemStack, Player, system } from '@core/__tests__/__mocks__/minecraftMock.js';
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
import { handleSignColorInteract } from '@features/essentials/survival/signColors.js';
import { collectNearbyDropsToPlayer } from '@features/essentials/survival/telekinesis.js';
import { MinecraftBlockTypes, MinecraftDimensionTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

describe('Survival QoL & Extended ContainerLock', () => {
  const spies: Array<ReturnType<typeof spyOn>> = [];

  beforeEach(() => {
    _clearContainerLocksForTest();
  });

  afterEach(() => {
    _clearContainerLocksForTest();
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
      isValid: true,
      location: { x: 1.5, y: 64.5, z: 1.5 },
      getComponent: () => ({ itemStack: new ItemStack(MinecraftItemTypes.Cobblestone, 4) }),
      remove: () => {
        removed = true;
      },
    };
    const dim = {
      id: MinecraftDimensionTypes.Overworld,
      getEntities: () => [dropEntity],
    } as any;

    collectNearbyDropsToPlayer(player, { x: 1, y: 64, z: 1 }, dim);
    expect(runSpy).not.toHaveBeenCalled();
    expect(removed).toBe(false);

    cfgSpy.mockReturnValue({ survivalQoL: { telekinesis: { enabled: true } } } as any);
    collectNearbyDropsToPlayer(player, { x: 1, y: 64, z: 1 }, dim);
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(removed).toBe(true);
    expect(player.getComponent('minecraft:inventory').container.getItem(0)?.typeId).toBe(
      MinecraftItemTypes.Cobblestone,
    );
  });
});
