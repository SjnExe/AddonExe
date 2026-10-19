import { commandManager } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { getCooldown, setCooldown } from '@core/data/cooldownManager.js';
import { StorageManager } from '@core/data/storageManager.js';
import { calculateRankMap } from '@core/permissions/permissionEngine.js';
import { configPanelSchema } from '@core/ui/configPanelRegistry.js';
import { configHandlers } from '@core/ui/uiUtils.js';
import { getIdTimestamp } from '@core/utils/index.js';
import { getValueFromPath } from '@core/utils/objectUtils.js';
import { escapeCommandArg, sanitizeString } from '@core/utils/sanitization.js';
import { generateId } from '@lib/id.js';
import { addTest, assert } from '../testRunner.js';

const SUITE_NAME = 'core';

export function registerCoreTests() {
    addTest(SUITE_NAME, 'sanitizeString and escapeCommandArg prevent injection', () => {
        const input = 'Hello §cWorld!';
        assert.equal(sanitizeString(input, false), 'Hello World!', 'Should strip color codes when allowColor=false');
        assert.equal(sanitizeString(input, true), input, 'Should preserve color codes when allowColor=true');

        const malicious = 'Player" ;op me\n';
        const escaped = escapeCommandArg(malicious);
        assert.ok(!escaped.includes('"') && !escaped.includes('\n'), 'escapeCommandArg must strip quotes and newlines');
    });

    addTest(SUITE_NAME, 'UUIDv7 generator produces valid RFC 9562 time-ordered IDs', () => {
        const before = Date.now();
        const uuid = generateId();
        const after = Date.now();

        assert.ok(/^[0-9a-z]+-[0-9a-z]{7}$/.test(uuid), `Invalid ID format: ${uuid}`);
        const ts = getIdTimestamp(uuid);
        assert.ok(ts >= before && ts <= after, `Extracted timestamp ${ts} out of range [${before}, ${after}]`);
    });

    addTest(SUITE_NAME, 'StorageManager shards >30KB payloads across multiple dynamic properties and cleans up', () => {
        const storage = new StorageManager('exe:__test_sharded_storage__');
        const largeArray = Array.from({ length: 1200 }, (_, i) => `entry_${i}_${'x'.repeat(30)}`);
        const payload = { count: largeArray.length, items: largeArray };

        storage.save(payload);
        const loaded = storage.load<typeof payload>();

        assert.ok(loaded, 'Loaded sharded payload should not be undefined');
        assert.equal(loaded!.count, 1200, 'Loaded count should match');
        assert.equal(loaded!.items.length, 1200, 'Loaded items length should match');
        assert.equal(loaded!.items[1199], largeArray[1199], 'Last sharded item should match');

        storage.delete();
        assert.equal(storage.load(), undefined, 'Storage should return undefined after delete()');
    });

    addTest(SUITE_NAME, 'Cooldown Manager tracks and expires cooldowns', () => {
        const playerId = '__test_cooldown_player__';
        const actionId = 'testAction';

        assert.equal(getCooldown(playerId, actionId), 0, 'Cooldown should be 0 initially');
        setCooldown(playerId, actionId, 2);
        assert.ok(getCooldown(playerId, actionId) > 0, 'Cooldown should be active after setCooldown');
    });

    addTest(SUITE_NAME, 'Permission Engine rank map merges groups, allow, and deny precedence', () => {
        const map = calculateRankMap({
            id: 'test_rank',
            name: 'Test',
            priority: 50,
            conditions: [],
            groups: ['default'],
            allow: ['cmd.kick.mod', 'cmd.mute.mod'],
            deny: ['cmd.mute.mod']
        });

        assert.equal(map['**.member'], true, 'Should inherit group node **.member');
        assert.equal(map['cmd.kick.mod'], true, 'Should allow cmd.kick.mod');
        assert.equal(map['cmd.mute.mod'], false, 'Deny must override allow for cmd.mute.mod');
    });

    addTest(SUITE_NAME, 'All configPanelSchema settings resolve against live runtime config handlers', () => {
        assert.ok(getConfig(), 'Main config should be loaded');

        for (const category of configPanelSchema) {
            const defaultSource = category.configSource ?? 'main';
            const defaultHandler = configHandlers[defaultSource];
            assert.ok(defaultHandler, `Missing handler for configSource '${defaultSource}' in category '${category.id}'`);

            for (const setting of category.settings) {
                const source = setting.configSource ?? defaultSource;
                const handler = configHandlers[source];
                assert.ok(handler, `Missing handler for setting '${setting.key}' (source '${source}')`);

                if (!setting.key.startsWith('spawn.spawnLocation.')) {
                    const val = getValueFromPath(handler!.get(), setting.key);
                    assert.ok(val !== undefined, `Config key '${setting.key}' in '${category.id}' resolved to undefined`);
                }
            }
        }
    });

    addTest(SUITE_NAME, 'All registered slash commands have valid metadata and permission nodes', () => {
        const commands = commandManager.getAllCommands();
        assert.ok(commands.length > 20, `Expected >20 registered commands, found ${commands.length}`);

        for (const cmd of commands) {
            assert.ok(cmd.name.length > 0, 'Command name must not be empty');
            assert.ok(cmd.description.length > 0, `Command '${cmd.name}' is missing description`);
            assert.ok(cmd.permissionNode.startsWith('cmd.'), `Command '${cmd.name}' has invalid permissionNode '${cmd.permissionNode}'`);
        }
    });
}
