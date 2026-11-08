import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { initializeConfigManager } from '@core/config/configManager.js';
import { getItemBlacklistConfig, saveItemBlacklistConfig } from '@core/config/configurations.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import * as rankManager from '@core/permissions/rankManager.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes, world } from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

import itemBlacklistCommands from '../commands/itemblacklist.js';
import { defaultItemBlacklistConfig } from '../config.js';
import {
  _resetBlacklistInitializationForTest,
  canBypassItemBlacklist,
  clearBlacklistAuditLogs,
  getBlacklistAuditLogs,
  handleProhibitedItem,
  initializeItemBlacklist,
  isItemBlacklisted,
  scanPlayerInventory,
} from '../manager.js';

// silence-blacklist-console-logs: suppress intentional infraction warning/info logs
let warnSpy: { mockRestore: () => void } | undefined;
let logSpy: { mockRestore: () => void } | undefined;
let infoSpy: { mockRestore: () => void } | undefined;
beforeEach(() => {
  warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
  infoSpy = spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy?.mockRestore();
  logSpy?.mockRestore();
  infoSpy?.mockRestore();
});

describe('Item Blacklist System', () => {
  const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
  const ItemStackMock = mc.ItemStack as unknown as MockConstructable<mc.ItemStack>;

  let mockPlayer: mc.Player;
  let mockStaff: mc.Player;
  let sentMessages: string[] = [];
  let staffMessages: string[] = [];

  beforeEach(async () => {
    await initializeConfigManager(false);
    saveItemBlacklistConfig({ ...defaultItemBlacklistConfig });
    clearBlacklistAuditLogs();

    sentMessages = [];
    staffMessages = [];

    mockPlayer = new PlayerMock('player_1', 'PlayerOne');
    Object.defineProperty(mockPlayer, 'isValid', { value: true, writable: true });
    mockPlayer.sendMessage = mock((msg: string | mc.RawMessage) => {
      sentMessages.push(String(msg));
    });

    mockStaff = new PlayerMock('staff_1', 'StaffAdmin');
    Object.defineProperty(mockStaff, 'isValid', { value: true, writable: true });
    mockStaff.sendMessage = mock((msg: string | mc.RawMessage) => {
      staffMessages.push(String(msg));
    });
  });

  describe('Configuration Defaults', () => {
    it('should default to disabled per feature defaulting policy', () => {
      const config = getItemBlacklistConfig();
      expect(config.enabled).toBeFalse();
      expect(config.action).toBe('confiscate');
      expect(config.blacklistedItems).toContain(MinecraftItemTypes.Bedrock);
      expect(config.blacklistedItems).toContain(MinecraftItemTypes.Barrier);
    });
  });

  describe('isItemBlacklisted', () => {
    it('should return false when system is disabled', () => {
      saveItemBlacklistConfig({ ...defaultItemBlacklistConfig, enabled: false });
      expect(isItemBlacklisted(MinecraftItemTypes.Bedrock)).toBeFalse();
    });

    it('should return true for blacklisted items when enabled', () => {
      saveItemBlacklistConfig({ ...defaultItemBlacklistConfig, enabled: true });
      expect(isItemBlacklisted(MinecraftItemTypes.Bedrock)).toBeTrue();
      expect(isItemBlacklisted(MinecraftItemTypes.Barrier)).toBeTrue();
    });

    it('should return false for permitted items', () => {
      saveItemBlacklistConfig({ ...defaultItemBlacklistConfig, enabled: true });
      expect(isItemBlacklisted(MinecraftItemTypes.Diamond)).toBeFalse();
      expect(isItemBlacklisted(MinecraftItemTypes.Apple)).toBeFalse();
    });

    it('should correctly handle item identifiers with or without namespace', () => {
      saveItemBlacklistConfig({ ...defaultItemBlacklistConfig, enabled: true });
      expect(isItemBlacklisted('bedrock')).toBeTrue();
      expect(isItemBlacklisted('BEDROCK')).toBeTrue();
      expect(isItemBlacklisted('Minecraft:Bedrock')).toBeTrue();
    });
  });

  describe('canBypassItemBlacklist', () => {
    it('should return false for regular players without exempt rank', () => {
      expect(canBypassItemBlacklist(mockPlayer)).toBeFalse();
    });

    it('should return true for players with bypass permission', () => {
      const spy = spyOn(permissionEngine, 'hasPermission').mockImplementation(
        (_player, node) => node === 'cmd.blacklist.bypass',
      );
      try {
        expect(canBypassItemBlacklist(mockPlayer)).toBeTrue();
      } finally {
        spy.mockRestore();
      }
    });

    it('should return true for players with exempt rank', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        exemptRanks: ['admin_rank'],
      });
      const spy = spyOn(rankManager, 'getPlayerRank').mockReturnValue({
        id: 'admin_rank',
        name: 'Admin',
        priority: 10,
      } as any);
      try {
        expect(canBypassItemBlacklist(mockPlayer)).toBeTrue();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('handleProhibitedItem Enforcement & 3-Tier Logging', () => {
    it('should confiscate prohibited item from container and log audit record', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        enabled: true,
        action: 'confiscate',
        persistToLog: true,
      });

      const fakeItem = new ItemStackMock(MinecraftItemTypes.Bedrock, 1);
      const containerItems: (mc.ItemStack | undefined)[] = [fakeItem];

      const mockContainer = {
        size: 1,
        getItem: mock((slot: number) => containerItems[slot]),
        setItem: mock((slot: number, item?: mc.ItemStack) => {
          containerItems[slot] = item;
        }),
      };

      mockPlayer.getComponent = mock((compId: string) => {
        if (compId === EntityComponentTypes.Inventory) {
          return { container: mockContainer } as unknown as mc.EntityInventoryComponent;
        }
        return undefined;
      });

      handleProhibitedItem(mockPlayer, fakeItem, 'test_trigger', 0);

      expect(mockContainer.setItem).toHaveBeenCalledWith(0, undefined);
      expect(sentMessages.some((m) => m.includes('confiscated'))).toBeTrue();

      const logs = getBlacklistAuditLogs();
      expect(logs).toBeArrayOfSize(1);
      expect(logs[0]?.playerName).toBe('PlayerOne');
      expect(logs[0]?.itemTypeId).toBe(MinecraftItemTypes.Bedrock);
      expect(logs[0]?.trigger).toBe('test_trigger');
      expect(logs[0]?.action).toBe('confiscate');
    });

    it('should notify player when in cancel enforcement mode without altering container', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        enabled: true,
        action: 'cancel',
        persistToLog: true,
      });

      const fakeItem = new ItemStackMock(MinecraftItemTypes.Barrier, 1);
      handleProhibitedItem(mockPlayer, fakeItem, 'itemUse');

      expect(sentMessages.some((m) => m.includes('not permitted'))).toBeTrue();
      const logs = getBlacklistAuditLogs();
      expect(logs).toBeArrayOfSize(1);
      expect(logs[0]?.action).toBe('cancel');
    });
  });

  describe('scanPlayerInventory', () => {
    it('should do nothing in cancel mode (avoids spamming and un-equipping)', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        enabled: true,
        action: 'cancel',
      });

      const fakeItem = new ItemStackMock(MinecraftItemTypes.Bedrock, 1);
      const setItem = mock(() => {});
      const setEquipment = mock(() => {});

      mockPlayer.getComponent = mock((compId: string) => {
        if (compId === EntityComponentTypes.Inventory) {
          return {
            container: {
              size: 1,
              getItem: () => fakeItem,
              setItem,
            },
          } as any;
        }
        if (compId === EntityComponentTypes.Equippable) {
          return {
            getEquipment: () => fakeItem,
            setEquipment,
          } as any;
        }
        return undefined;
      });

      scanPlayerInventory(mockPlayer);

      expect(setItem).not.toHaveBeenCalled();
      expect(setEquipment).not.toHaveBeenCalled();
      expect(getBlacklistAuditLogs()).toBeEmpty();
    });

    it('should confiscate items in confiscate mode and record audit logs', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        enabled: true,
        action: 'confiscate',
      });

      const fakeItem = new ItemStackMock(MinecraftItemTypes.Bedrock, 1);
      const setItem = mock(() => {});
      const setEquipment = mock(() => {});

      mockPlayer.getComponent = mock((compId: string) => {
        if (compId === EntityComponentTypes.Inventory) {
          return {
            container: {
              size: 1,
              getItem: () => fakeItem,
              setItem,
            },
          } as any;
        }
        if (compId === EntityComponentTypes.Equippable) {
          return {
            getEquipment: () => fakeItem,
            setEquipment,
          } as any;
        }
        return undefined;
      });

      scanPlayerInventory(mockPlayer);

      expect(setItem).toHaveBeenCalledWith(0, undefined);
      expect(setEquipment).toHaveBeenCalled();

      const logs = getBlacklistAuditLogs();
      expect(logs.some((l) => l.trigger === 'held' && l.itemTypeId === MinecraftItemTypes.Bedrock)).toBeTrue();
      expect(logs.some((l) => l.trigger === 'equipped' && l.itemTypeId === MinecraftItemTypes.Bedrock)).toBeTrue();
    });

    it('should not confiscate items if player has bypass permission', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        enabled: true,
        action: 'confiscate',
      });

      const fakeItem = new ItemStackMock(MinecraftItemTypes.Bedrock, 1);
      const setItem = mock(() => {});
      const setEquipment = mock(() => {});

      mockPlayer.getComponent = mock((compId: string) => {
        if (compId === EntityComponentTypes.Inventory) {
          return {
            container: {
              size: 1,
              getItem: () => fakeItem,
              setItem,
            },
          } as any;
        }
        if (compId === EntityComponentTypes.Equippable) {
          return {
            getEquipment: () => fakeItem,
            setEquipment,
          } as any;
        }
        return undefined;
      });

      const spy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(true);
      try {
        scanPlayerInventory(mockPlayer);
        expect(setItem).not.toHaveBeenCalled();
        expect(setEquipment).not.toHaveBeenCalled();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('initializeItemBlacklist', () => {
    it('should subscribe to beforeEvents, cancel prohibited actions and defer enforcement', () => {
      saveItemBlacklistConfig({
        ...defaultItemBlacklistConfig,
        enabled: true,
      });

      const origItemUseSub = world.beforeEvents.itemUse.subscribe;
      const origInteractSub = world.beforeEvents.playerInteractWithBlock.subscribe;
      const origSystemRun = mc.system.run;

      let itemUseCallback: ((event: any) => void) | undefined;
      let interactCallback: ((event: any) => void) | undefined;
      const deferredCallbacks: (() => void)[] = [];

      world.beforeEvents.itemUse.subscribe = mock((cb: any) => {
        itemUseCallback = cb;
      }) as any;
      world.beforeEvents.playerInteractWithBlock.subscribe = mock((cb: any) => {
        interactCallback = cb;
      }) as any;
      mc.system.run = mock((fn: any) => {
        deferredCallbacks.push(fn);
        return 1;
      }) as any;

      try {
        _resetBlacklistInitializationForTest();
        initializeItemBlacklist();
        expect(itemUseCallback).toBeDefined();
        expect(interactCallback).toBeDefined();

        // 1. Prohibited item usage cancels event and defers handleProhibitedItem
        const fakeBedrock = new ItemStackMock(MinecraftItemTypes.Bedrock, 1);
        const event1 = {
          source: mockPlayer,
          itemStack: fakeBedrock,
          cancel: false,
        };
        itemUseCallback!(event1);
        expect(event1.cancel).toBeTrue();
        expect(deferredCallbacks.length).toBeGreaterThan(0);
        // Enforcement must be deferred to next tick outside the read-only beforeEvents handler
        expect(getBlacklistAuditLogs()).toBeEmpty();
        for (const fn of deferredCallbacks.splice(0)) {
          fn();
        }
        expect(getBlacklistAuditLogs().some((l) => l.trigger === 'itemUse')).toBeTrue();

        // 2. Block interaction path cancels and defers handleProhibitedItem
        const event3 = {
          player: mockPlayer,
          itemStack: fakeBedrock,
          cancel: false,
        };
        interactCallback!(event3);
        expect(event3.cancel).toBeTrue();
        for (const fn of deferredCallbacks.splice(0)) {
          fn();
        }
        expect(getBlacklistAuditLogs().some((l) => l.trigger === 'playerInteractWithBlock')).toBeTrue();

        // 3. Bypass player does not get cancelled or deferred
        const spy = spyOn(permissionEngine, 'hasPermission').mockReturnValue(true);
        try {
          const deferredCountBefore = deferredCallbacks.length;
          const event2 = {
            source: mockPlayer,
            itemStack: fakeBedrock,
            cancel: false,
          };
          itemUseCallback!(event2);
          expect(event2.cancel).toBeFalse();
          expect(deferredCallbacks).toBeArrayOfSize(deferredCountBefore);
        } finally {
          spy.mockRestore();
        }
      } finally {
        world.beforeEvents.itemUse.subscribe = origItemUseSub;
        world.beforeEvents.playerInteractWithBlock.subscribe = origInteractSub;
        mc.system.run = origSystemRun;
      }
    });
  });

  describe('Command Execution (/itemblacklist)', () => {
    const cmd = itemBlacklistCommands[0]!;

    it('should toggle blacklist enabled status', () => {
      const messages: string[] = [];
      const executor = {
        isConsole: true as const,
        sendMessage: (msg: string | mc.RawMessage) => messages.push(String(msg)),
      };

      cmd.execute(executor, { action: 'toggle' });
      expect(getItemBlacklistConfig().enabled).toBeTrue();
      expect(messages.some((m) => m.includes('enabled'))).toBeTrue();

      cmd.execute(executor, { action: 'toggle' });
      expect(getItemBlacklistConfig().enabled).toBeFalse();
      expect(messages.some((m) => m.includes('disabled'))).toBeTrue();
    });

    it('should add and remove prohibited items via command arguments', () => {
      const messages: string[] = [];
      const executor = {
        isConsole: true as const,
        sendMessage: (msg: string | mc.RawMessage) => messages.push(String(msg)),
      };

      cmd.execute(executor, { action: 'add', item: MinecraftItemTypes.Tnt });
      expect(getItemBlacklistConfig().blacklistedItems).toContain(MinecraftItemTypes.Tnt);

      cmd.execute(executor, { action: 'remove', item: MinecraftItemTypes.Tnt });
      expect(getItemBlacklistConfig().blacklistedItems).not.toContain(MinecraftItemTypes.Tnt);
    });

    it('should reject malformed identifiers on add and remove', () => {
      const messages: string[] = [];
      const executor = {
        isConsole: true as const,
        sendMessage: (msg: string | mc.RawMessage) => messages.push(String(msg)),
      };

      cmd.execute(executor, { action: 'add', item: 'minecraft:' });
      expect(messages.some((m) => m.includes('Invalid item identifier'))).toBeTrue();

      messages.length = 0;
      cmd.execute(executor, { action: 'remove', item: ':::' });
      expect(messages.some((m) => m.includes('Invalid item identifier'))).toBeTrue();
    });

    it('should reject duplicate items when specified in unnormalized format', () => {
      const messages: string[] = [];
      const executor = {
        isConsole: true as const,
        sendMessage: (msg: string | mc.RawMessage) => messages.push(String(msg)),
      };

      // Bedrock is already in the default blacklist as MinecraftItemTypes.Bedrock ('minecraft:bedrock')
      cmd.execute(executor, { action: 'add', item: 'bedrock' });
      expect(messages.some((m) => m.includes('already blacklisted'))).toBeTrue();
    });

    it('should list blacklisted items', () => {
      const messages: string[] = [];
      const executor = {
        isConsole: true as const,
        sendMessage: (msg: string | mc.RawMessage) => messages.push(String(msg)),
      };

      cmd.execute(executor, { action: 'list' });
      expect(messages.some((m) => m.includes(MinecraftItemTypes.Bedrock))).toBeTrue();
    });
  });
});
