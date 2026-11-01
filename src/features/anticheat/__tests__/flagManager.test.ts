import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import * as mc from '@minecraft/server';

import { _resetFlagManagerForTest, executePunishment, flag } from '../flagManager.js';

describe('FlagManager', () => {
  let getAnticheatConfigSpy: any;

  beforeEach(() => {
    _resetFlagManagerForTest();
    getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({} as any);
  });

  afterEach(() => {
    _resetFlagManagerForTest();
    getAnticheatConfigSpy?.mockRestore();
  });

  it('executePunishment should sanitize player names to prevent command injection', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const maliciousName = 'Hacker" ] } ; kill @a ; #';
    const player = new PlayerMock('p1', maliciousName);

    const mockRunCommand = mock();
    Object.defineProperty(player, 'dimension', {
      value: { runCommand: mockRunCommand },
      writable: true,
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
      writable: true,
    });

    const commandTemplate = 'kick "{player}" Illegal Items';

    executePunishment(player, commandTemplate);

    const expectedSafeName = maliciousName.replaceAll('"', "'");
    const expectedCmd = `kick "${expectedSafeName}" Illegal Items`;

    expect(mockRunCommand).toHaveBeenCalledWith(expectedCmd);
  });

  it('should trigger punishment when violation level jumps past threshold', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p_thresh', 'ThresholdTester');

    const mockRunCommand = mock();
    Object.defineProperty(player, 'dimension', {
      value: { runCommand: mockRunCommand },
      writable: true,
    });

    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      consoleNotifications: false,
      testCheck: {
        enabled: true,
        notifyStaff: false,
        flagDecaySeconds: 60,
        violations: [{ threshold: 5, command: 'kick {player} Threshold reached' }],
      },
    });

    // Flag with increment of 6 (jumping from 0 straight to 6, past 5)
    flag(player, 'testCheck', 'Big violation jump', 6);

    expect(mockRunCommand).toHaveBeenCalledWith('kick "ThresholdTester" Threshold reached');
  });
});
