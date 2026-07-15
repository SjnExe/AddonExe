/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as mc from '@minecraft/server';
import { describe, expect, it, mock } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { escapeCommandArg } from '@core/utils.js';

// Mock formatString and escapeCommandArg
const mockFormatString = mock((template: string, context: any) => {
    let result = template;
    for (const key in context) {
        result = result.replaceAll(`{${key}}`, context[key]);
    }
    return result;
});

mock.module('@core/utils.js', () => ({
    formatString: mockFormatString,
    escapeCommandArg: escapeCommandArg,
    sanitizeString: (str: string) => str // Need this just in case as utils imports a lot of things
}));

mock.module('@core/logger.js', () => ({
    debugLog: mock(),
    errorLog: mock()
}));

// Mock minimal dependencies of flagManager
mock.module('@core/playerCache.js', () => ({
    getAllPlayersFromCache: mock()
}));

mock.module('@core/playerDataManager.js', () => ({
    getPlayer: mock()
}));

mock.module('@core/storage/StorageManager.js', () => ({
    StorageManager: class {
        load() {
            return undefined;
        }
        save() {}
    }
}));

mock.module('@lib/guards.js', () => ({
    isDefined: (val: any) => val !== undefined && val !== null
}));

mock.module('@features/anticheat/anticheatConfig.js', () => ({}));
mock.module('@features/anticheat/configLoader.js', () => ({
    getAnticheatConfig: mock()
}));
mock.module('@features/anticheat/logManager.js', () => ({
    addFlagLog: mock()
}));

// Import after mocking
const { executePunishment } = await import('../flagManager.js');

describe('FlagManager', () => {
    it('executePunishment should sanitize player names to prevent command injection', () => {
        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        // Create a malicious player name containing quotes
        const maliciousName = 'Hacker" ] } ; kill @a ; #';
        const player = new PlayerMock('p1', maliciousName);

        const mockRunCommand = mock();
        Object.defineProperty(player, 'dimension', {
            value: { runCommand: mockRunCommand },
            writable: true
        });

        // The config defines punishments like "kick {player} Illegal Items"
        const commandTemplate = 'kick {player} Illegal Items';

        // Run the punishment
        executePunishment(player, commandTemplate);

        const expectedSafeName = maliciousName.replaceAll('"', "'");
        const expectedCmd = `kick "${expectedSafeName}" Illegal Items`;

        expect(mockRunCommand).toHaveBeenCalledWith(expectedCmd);
    });

    it('executePunishment should handle template with manual quotes', () => {
        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const maliciousName = 'Hacker" ] } ; kill @a ; #';
        const player = new PlayerMock('p1', maliciousName);

        const mockRunCommand = mock();
        Object.defineProperty(player, 'dimension', {
            value: { runCommand: mockRunCommand },
            writable: true
        });

        const commandTemplate = 'kick "{player}" Illegal Items';

        executePunishment(player, commandTemplate);

        const expectedSafeName = maliciousName.replaceAll('"', "'");
        const expectedCmd = `kick "${expectedSafeName}" Illegal Items`;

        expect(mockRunCommand).toHaveBeenCalledWith(expectedCmd);
    });
});
