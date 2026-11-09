import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import * as configLoader from '@core/config/configurations.js';
import * as playerCache from '@core/data/playerCache.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import { _resetGraceManagerForTest, addGrace } from '@features/anticheat/core/graceManager.js';
import * as mc from '@minecraft/server';

import { _resetFlagManagerForTest, executePunishment, flag } from '../flagManager.js';

describe('FlagManager', () => {
  let getAnticheatConfigSpy: any;
  let getAllPlayersSpy: any;
  let hasPermissionSpy: any;

  beforeEach(() => {
    _resetFlagManagerForTest();
    _resetGraceManagerForTest();
    getAnticheatConfigSpy = spyOn(configLoader, 'getAnticheatConfig').mockReturnValue({} as any);
  });

  afterEach(() => {
    _resetFlagManagerForTest();
    _resetGraceManagerForTest();
    getAnticheatConfigSpy?.mockRestore();
    getAllPlayersSpy?.mockRestore();
    hasPermissionSpy?.mockRestore();
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

  it('should exempt players with active movement grace from movement violations', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const player = new PlayerMock('p_grace', 'GracefulRunner');

    const mockRunCommand = mock();
    Object.defineProperty(player, 'dimension', {
      value: { runCommand: mockRunCommand },
      writable: true,
    });

    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      consoleNotifications: false,
      movementCheck: {
        enabled: true,
        notifyStaff: false,
        flagDecaySeconds: 60,
        violations: [{ threshold: 1, command: 'kick {player} Speed' }],
      },
    });

    // Grant knockback grace
    addGrace('p_grace', 'knockback', 3000);

    // Call flag for movement
    flag(player, 'movementCheck', 'Speed violation while in knockback', 2, { category: 'movement' });

    // Dimension runCommand should NOT be called because flag was suppressed by grace
    expect(mockRunCommand).not.toHaveBeenCalled();

    // Reset grace and verify violation now triggers punishment
    _resetGraceManagerForTest();
    flag(player, 'movementCheck', 'Speed violation outside grace', 2, { category: 'movement' });
    expect(mockRunCommand).toHaveBeenCalledTimes(1);
  });

  it('should throttle staff alert notifications during alertCooldownSeconds', () => {
    const PlayerMock = mc.Player as unknown as MockConstructable<mc.Player>;
    const suspect = new PlayerMock('suspect_ac', 'SuspectPlayer');
    const admin = new PlayerMock('admin_1', 'StaffAdmin');
    const sendMock = mock();
    admin.sendMessage = sendMock;

    getAllPlayersSpy = spyOn(playerCache, 'getAllPlayersFromCache').mockReturnValue([admin]);
    hasPermissionSpy = spyOn(permissionEngine, 'hasPermission').mockImplementation(
      (p, node) => node === 'group.mod' && p.id === 'admin_1',
    );

    getAnticheatConfigSpy.mockReturnValue({
      enabled: true,
      consoleNotifications: false,
      alertCooldownSeconds: 5,
      minAlertVl: 1,
      combatCheck: {
        enabled: true,
        notifyStaff: true,
        flagDecaySeconds: 60,
        violations: [],
      },
    });

    // First flag should send alert
    flag(suspect, 'combatCheck', 'Reach anomaly', 1);
    expect(sendMock).toHaveBeenCalledTimes(1);

    // Immediate second flag within cooldown should be suppressed
    flag(suspect, 'combatCheck', 'Reach anomaly again', 1);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
