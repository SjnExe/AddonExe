import * as mc from '@minecraft/server';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@features/anticheat/configLoader.js';
import { executePunishment } from '../flagManager.js';

describe('FlagManager', () => {
    let getAnticheatConfigSpy: any;

    beforeEach(() => {
        getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({} as any);
    });

    afterEach(() => {
        getAnticheatConfigSpy?.mockRestore();
    });

    it('executePunishment should sanitize player names to prevent command injection', () => {
        const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
        const maliciousName = 'Hacker" ] } ; kill @a ; #';
        const player = new PlayerMock('p1', maliciousName);

        const mockRunCommand = mock();
        Object.defineProperty(player, 'dimension', {
            value: { runCommand: mockRunCommand },
            writable: true
        });

        const commandTemplate = 'kick {player} Illegal Items';

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
