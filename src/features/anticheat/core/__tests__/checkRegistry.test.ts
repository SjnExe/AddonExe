import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { AntiCheatCheck } from '@features/anticheat/core/check.js';
import { checkRegistry, clearPlayerAntiCheatState } from '@features/anticheat/core/checkRegistry.js';
import { hasGrace, recordPlayerTeleportGrace } from '@features/anticheat/core/graceManager.js';

describe('CheckRegistry', () => {
  beforeEach(() => {
    checkRegistry.unregisterAll();
  });

  it('should register, retrieve, and enumerate checks', () => {
    const mockCheck: AntiCheatCheck = {
      id: 'customCheck',
      name: 'Custom AntiCheat Check',
      category: 'movement',
      description: 'Test check description',
      start: mock(),
      stop: mock(),
      clearPlayer: mock(),
      reset: mock(),
    };

    checkRegistry.registerCheck(mockCheck);

    expect(checkRegistry.getCheck('customCheck')).toBe(mockCheck);
    expect(checkRegistry.getAllChecks()).toContain(mockCheck);
  });

  it('startAll, stopAll, and resetAll should dispatch to all registered checks', () => {
    const startMock1 = mock();
    const stopMock1 = mock();
    const resetMock1 = mock();

    const check1: AntiCheatCheck = {
      id: 'check1',
      name: 'Check 1',
      category: 'combat',
      description: 'Check 1',
      start: startMock1,
      stop: stopMock1,
      clearPlayer: mock(),
      reset: resetMock1,
    };

    const startMock2 = mock();
    const stopMock2 = mock();
    const resetMock2 = mock();

    const check2: AntiCheatCheck = {
      id: 'check2',
      name: 'Check 2',
      category: 'mining',
      description: 'Check 2',
      start: startMock2,
      stop: stopMock2,
      clearPlayer: mock(),
      reset: resetMock2,
    };

    checkRegistry.registerCheck(check1);
    checkRegistry.registerCheck(check2);

    checkRegistry.startAll();
    expect(startMock1).toHaveBeenCalled();
    expect(startMock2).toHaveBeenCalled();

    checkRegistry.stopAll();
    expect(stopMock1).toHaveBeenCalled();
    expect(stopMock2).toHaveBeenCalled();

    checkRegistry.resetAll();
    expect(resetMock1).toHaveBeenCalled();
    expect(resetMock2).toHaveBeenCalled();
  });

  it('clearPlayerAntiCheatState should clean up check states and grace timers', () => {
    const clearPlayerMock = mock();
    const check: AntiCheatCheck = {
      id: 'check_clean',
      name: 'Clean Check',
      category: 'inventory',
      description: 'Clean Check',
      start: mock(),
      stop: mock(),
      clearPlayer: clearPlayerMock,
      reset: mock(),
    };

    checkRegistry.registerCheck(check);
    recordPlayerTeleportGrace('player_test_clean', 4000);

    expect(hasGrace('player_test_clean', 'teleport')).toBe(true);

    clearPlayerAntiCheatState('player_test_clean');

    expect(clearPlayerMock).toHaveBeenCalledWith('player_test_clean');
    expect(hasGrace('player_test_clean', 'teleport')).toBe(false);
  });
});
