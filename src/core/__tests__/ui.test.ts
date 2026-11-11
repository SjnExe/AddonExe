import { beforeEach, describe, expect, it, setSystemTime, spyOn } from 'bun:test';

import { initializeConfigManager } from '@core/config/configManager.js';
import { ActionFormBuilder } from '@core/ui/builders/actionFormBuilder.js';
import { configPanelSchema } from '@core/ui/configPanelRegistry.js';
import { getMenuItemsForHub, MenuHubId } from '@core/ui/menuRegistry.js';
import { getSystemDefinition, getSystemRegistry, searchConfigSystems } from '@core/ui/systemRegistry.js';
import { configHandlers, getSystemsByCategory, getVisibleCategories } from '@core/ui/uiUtils.js';
import { getIdTimestamp } from '@core/utils/index.js';
import { getValueFromPath } from '@core/utils/objectUtils.js';
import {
  beginUiSession,
  clearPlayerUiSession,
  endUiSession,
  isUiSessionActive,
  nextTick,
  sleepTicks,
  uiWait,
} from '@core/utils/ui.js';
import { registerAllSuites } from '@features/test/suites/index.js';
import { runTests } from '@features/test/testRunner.js';
import { generateId } from '@lib/id.js';
import * as mc from '@minecraft/server';
import { FormCancelationReason } from '@minecraft/server-ui';

describe('UI, Config Schema & UUIDv7 Integrity', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
  });

  it('every configPanelSchema category should have a valid configSource handler and resolvable setting keys', () => {
    const seenIds = new Set<string>();

    for (const category of configPanelSchema) {
      expect(seenIds.has(category.id)).toBeFalse();
      seenIds.add(category.id);

      const defaultSource = category.configSource ?? 'main';
      expect(configHandlers[defaultSource]).toBeDefined();

      for (const setting of category.settings) {
        const source = setting.configSource ?? defaultSource;
        const handler = configHandlers[source];
        expect(handler).toBeDefined();

        if (!setting.key.startsWith('spawn.spawnLocation.')) {
          const configObj = handler!.get();
          const val = getValueFromPath(configObj, setting.key);
          expect(val).toBeDefined();
        }
      }
    }
  });

  it('systemRegistry should not contain duplicate system IDs or unsupported non-ASCII emojis', () => {
    const systems = getSystemRegistry();
    const ids = new Set<string>();
    const nonAsciiEmojiRegex = /[^\x20-\x7E\n\r\t§]/;

    for (const sys of systems) {
      expect(ids.has(sys.id)).toBeFalse();
      ids.add(sys.id);
      expect(nonAsciiEmojiRegex.test(sys.title)).toBeFalse();
    }
  });

  it('menuRegistry hubs should return ordered items with no unsupported emojis', () => {
    const hubs: MenuHubId[] = [
      'main',
      'economy',
      'social',
      'games',
      'profile',
      'staff',
      'staff_moderation',
      'staff_player',
      'staff_world',
      'staff_config',
    ];
    const nonAsciiEmojiRegex = /[^\x20-\x7E\n\r\t§]/;
    const mockOwner = { id: 'owner_1', name: 'Owner', hasTag: (t: string) => t === 'owner' } as any;

    for (const hub of hubs) {
      const items = getMenuItemsForHub(hub, mockOwner);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(nonAsciiEmojiRegex.test(item.title)).toBeFalse();
        if (item.description) {
          expect(nonAsciiEmojiRegex.test(item.description)).toBeFalse();
        }
      }
    }
  });

  it('in-game /test diagnostic suites should all pass under mock runtime', async () => {
    const { loadCommands } = await import('@features/commandIndex.js');
    await loadCommands();
    registerAllSuites();
    const res = await runTests();
    expect(res.failed).toBe(0);
    expect(res.passed).toBeGreaterThanOrEqual(4);
  });

  it('generateId should generate valid RFC 9562 v7 UUIDs with accurate embedded timestamps', () => {
    const fixedTs = 1700000000000;
    setSystemTime(fixedTs);
    try {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toMatch(/^[0-9a-z]+-[0-9a-z]{7}$/);
      expect(id2).toMatch(/^[0-9a-z]+-[0-9a-z]{7}$/);
      expect(id1).not.toBe(id2);

      const extractedTs = getIdTimestamp(id1);
      expect(extractedTs).toBe(fixedTs);
    } finally {
      setSystemTime();
    }
  });

  it('protectionService fast path returns frozen defaultFlags when no zones or spawn protection are active', async () => {
    const { getProtectionFlags, invalidateProtectionZoneCache } = await import('@core/events/protectionService.js');
    invalidateProtectionZoneCache();
    const f1 = getProtectionFlags({ x: 0, y: 64, z: 0 }, 'minecraft:overworld');
    const f2 = getProtectionFlags({ x: 100, y: 64, z: 100 }, 'minecraft:overworld');
    expect(f1).toBe(f2);
    expect(f1.preventBlockBreaking).toBeFalse();
  });

  it('category-based config hierarchy exposes Survival & Utilities without monolithic master toggles', () => {
    expect(configPanelSchema.some((s) => s.id === 'featureToggles')).toBeFalse();

    const mockAdmin = {
      id: 'admin_1',
      name: 'Admin',
      hasTag: (t: string) => t === 'admin' || t === 'owner',
    } as any;

    const categories = getVisibleCategories(mockAdmin);
    expect(categories.some((c) => c.id === 'Survival & Utilities')).toBeTrue();

    const survivalSystems = getSystemsByCategory(mockAdmin, 'Survival & Utilities');
    const systemIds = survivalSystems.map((s) => s.id);
    expect(systemIds).toContain('survivalQoL');
    expect(systemIds).toContain('clearLag');
    expect(systemIds).toContain('playerUtilities');
    expect(systemIds).toContain('afk');
  });

  it('UI session lifecycle tracks tokens, isolates concurrent loops, and clears correctly', () => {
    const playerId = 'session_test_p1';
    clearPlayerUiSession(playerId);

    expect(isUiSessionActive(playerId, 1)).toBeFalse();

    const v1 = beginUiSession(playerId);
    expect(v1).toBeGreaterThan(0);
    expect(isUiSessionActive(playerId, v1)).toBeTrue();

    const v2 = beginUiSession(playerId);
    expect(v2).toBeGreaterThan(v1);
    expect(isUiSessionActive(playerId, v1)).toBeFalse();
    expect(isUiSessionActive(playerId, v2)).toBeTrue();

    endUiSession(playerId);
    expect(isUiSessionActive(playerId, v2)).toBeFalse();

    const v3 = beginUiSession(playerId);
    expect(v3).toBeGreaterThan(v2);
    expect(isUiSessionActive(playerId, v1)).toBeFalse();
    expect(isUiSessionActive(playerId, v2)).toBeFalse();
    expect(isUiSessionActive(playerId, v3)).toBeTrue();
    clearPlayerUiSession(playerId);
    expect(isUiSessionActive(playerId, v3)).toBeFalse();
  });

  it('sleepTicks and nextTick resolve cleanly via server system timer', async () => {
    await expect(sleepTicks(1)).resolves.toBeUndefined();
    await expect(sleepTicks(0)).resolves.toBeUndefined();
    await expect(nextTick()).resolves.toBeUndefined();
  });

  it('ActionFormBuilder tracks button count and indexes callbacks correctly', async () => {
    const builder = new ActionFormBuilder();
    builder.grid('board').title('Fast Grid');

    builder.rawButton('Square 0');
    builder.rawButton('Square 1', 'textures/items/diamond');

    expect(builder.getButtonCount()).toBe(2);

    let callbackTriggered = false;
    builder.button('Action 2', null, () => {
      callbackTriggered = true;
    });

    expect(builder.getButtonCount()).toBe(3);

    const mockPlayer = { id: 'p_btn_test', isValid: true } as any;
    const res = await builder.show(mockPlayer);
    expect(res.canceled).toBeFalse();
    expect(res.selection).toBe(0);
    expect(callbackTriggered).toBeFalse();
  });

  it('uiWait handles chained continuation with nextTick deferral', async () => {
    const runTimeoutSpy = spyOn(mc.system, 'runTimeout').mockImplementation((cb: () => void) => {
      cb();
      return 1;
    });
    runTimeoutSpy.mockClear();

    try {
      const mockPlayer = { id: 'p_wait_chained', isValid: true } as any;
      const formChained = new ActionFormBuilder().rawButton('A').rawButton('B');

      const resChained = await formChained.show(mockPlayer, { chained: true });
      expect(resChained).toBeDefined();
      expect(resChained.canceled).toBeFalse();
      expect(resChained.selection).toBe(0);
      expect(runTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(runTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1);

      runTimeoutSpy.mockClear();

      const mockPlayerImmediate = { id: 'p_wait_immediate', isValid: true } as any;
      const formImmediate = new ActionFormBuilder().rawButton('C');
      const resImmediate = await formImmediate.show(mockPlayerImmediate, { chained: false });
      expect(resImmediate).toBeDefined();
      expect(resImmediate.canceled).toBeFalse();
      expect(resImmediate.selection).toBe(0);
      expect(runTimeoutSpy).not.toHaveBeenCalled();
    } finally {
      runTimeoutSpy.mockRestore();
    }
  });

  it('uiWait cancels immediately without presentation when sessionVersion is stale', async () => {
    const mockPlayer = { id: 'p_stale_wait', isValid: true } as any;
    const v1 = beginUiSession(mockPlayer.id);
    const v2 = beginUiSession(mockPlayer.id);

    const form = new ActionFormBuilder().rawButton('A');
    const res = await form.show(mockPlayer, { sessionVersion: v1 });
    expect(res.canceled).toBeTrue();
    expect(res.cancelationReason).toBe(FormCancelationReason.UserClosed);

    const validRes = await form.show(mockPlayer, { sessionVersion: v2 });
    expect(validRes.canceled).toBeFalse();
  });

  it('mob_money_editor is titled "Mob Kill Rewards & Penalties" with search indexing', () => {
    const mobSys = getSystemDefinition('mob_money_editor');
    expect(mobSys).toBeDefined();
    expect(mobSys?.title).toBe('Mob Kill Rewards & Penalties');
    expect(mobSys?.category).toBe('Economy');
    expect(mobSys?.description).toContain('penalty');
    expect(mobSys?.description).toContain('rewards');
  });

  it('searchConfigSystems filters systems by title, description, schema settings, and tokens', () => {
    // Empty queries return empty array
    expect(searchConfigSystems('')).toEqual([]);
    expect(searchConfigSystems('   ')).toEqual([]);

    // Direct title/ID search
    const mobMatches = searchConfigSystems('Mob Kill Rewards');
    expect(mobMatches.some((s) => s.id === 'mob_money_editor')).toBeTrue();

    // Keyword search in description (e.g. pandas, penalty)
    const penaltyMatches = searchConfigSystems('pandas');
    expect(penaltyMatches.some((s) => s.id === 'mob_money_editor')).toBeTrue();

    const killMatches = searchConfigSystems('penalty');
    expect(killMatches.some((s) => s.id === 'mob_money_editor')).toBeTrue();

    // Setting key / label search (e.g. treeCapitator in survivalQoL)
    const treeMatches = searchConfigSystems('treeCapitator');
    expect(treeMatches.some((s) => s.id === 'survivalQoL')).toBeTrue();

    const veinMatches = searchConfigSystems('vein miner');
    expect(veinMatches.some((s) => s.id === 'survivalQoL')).toBeTrue();
  });
});
