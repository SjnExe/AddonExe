import * as mc from '@minecraft/server';
import { describe, expect, it, mock } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as realUtils from '@core/utils.js';

mock.module('@core/utils.js', () => ({
    ...realUtils,
    uiWait: mock(async () => ({ canceled: false })),
    getPlayerIcon: mock(() => 'textures/ui/permissions_member_star.png'),
    getCountdownColor: mock(() => '§a'),
    playClickSound: mock(() => {}),
    playSound: mock(),
    resolveTarget: mock(() => [])
}));

mock.module('@core/playerDataManager.js', () => ({
    getPlayer: mock()
}));

import * as realLogManager from '@features/anticheat/logManager.js';
import * as realGuards from '@lib/guards.js';

mock.module('@lib/guards.js', () => ({
    ...realGuards,
    isDefined: (val: any) => val !== undefined && val !== null
}));

mock.module('@features/anticheat/anticheatConfig.js', () => ({}));
mock.module('@features/anticheat/configLoader.js', () => ({
    getAnticheatConfig: mock()
}));

mock.module('@features/anticheat/logManager.js', () => ({
    ...realLogManager,
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
