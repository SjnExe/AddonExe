import { initializeConfigManager } from '@core/configManager.js';
import { getValueFromPath } from '@core/objectUtils.js';
import { configPanelSchema } from '@core/ui/configPanelRegistry.js';
import { getMenuItemsForHub, MenuHubId } from '@core/ui/menuRegistry.js';
import { getSystemRegistry } from '@core/ui/systemRegistry.js';
import { configHandlers } from '@core/ui/uiUtils.js';
import { getTimestampFromUUIDv7 } from '@core/utils.js';
import { registerAllSuites } from '@features/test/suites/index.js';
import { runTests } from '@features/test/testRunner.js';
import { generateUUIDv7 } from '@lib/uuid.js';
import { beforeEach, describe, expect, it } from 'bun:test';

describe('UI, Config Schema & UUIDv7 Integrity', () => {
    beforeEach(async () => {
        await initializeConfigManager(false);
    });

    it('every configPanelSchema category should have a valid configSource handler and resolvable setting keys', () => {
        const seenIds = new Set<string>();

        for (const category of configPanelSchema) {
            expect(seenIds.has(category.id)).toBe(false);
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
            expect(ids.has(sys.id)).toBe(false);
            ids.add(sys.id);
            expect(nonAsciiEmojiRegex.test(sys.title)).toBe(false);
        }
    });

    it('menuRegistry hubs should return ordered items with no unsupported emojis', () => {
        const hubs: MenuHubId[] = ['main', 'economy', 'social', 'games', 'profile', 'staff', 'staff_moderation', 'staff_player', 'staff_world', 'staff_config'];
        const nonAsciiEmojiRegex = /[^\x20-\x7E\n\r\t§]/;
        const mockOwner = { id: 'owner_1', name: 'Owner', hasTag: (t: string) => t === 'owner' } as any;

        for (const hub of hubs) {
            const items = getMenuItemsForHub(hub, mockOwner);
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(nonAsciiEmojiRegex.test(item.title)).toBe(false);
                if (item.description) {
                    expect(nonAsciiEmojiRegex.test(item.description)).toBe(false);
                }
            }
        }
    });

    it('in-game /test diagnostic suites should all pass under mock runtime', async () => {
        const { loadCommands } = await import('virtual:command-index');
        await loadCommands();
        registerAllSuites();
        const res = await runTests();
        expect(res.failed).toBe(0);
        expect(res.passed).toBeGreaterThanOrEqual(20);
    });

    it('generateUUIDv7 should generate valid RFC 9562 v7 UUIDs with accurate embedded timestamps', () => {
        const before = Date.now();
        const id1 = generateUUIDv7();
        const id2 = generateUUIDv7();
        const after = Date.now();

        expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(id1).not.toBe(id2);

        const extractedTs = getTimestampFromUUIDv7(id1);
        expect(extractedTs).toBeGreaterThanOrEqual(before);
        expect(extractedTs).toBeLessThanOrEqual(after);
    });
});
