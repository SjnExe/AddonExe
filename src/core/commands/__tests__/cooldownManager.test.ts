import { afterEach, beforeEach, describe, expect, it, mock, onTestFinished, setSystemTime, spyOn } from 'bun:test';

import { MockConstructable } from '@core/__tests__/__mocks__/utils.js';
import { initializeConfigManager } from '@core/config/configManager.js';
import * as permissionEngine from '@core/permissions/permissionEngine.js';
import * as mc from '@minecraft/server';

import {
  canBypassCommandCooldown,
  cleanupExpiredCooldowns,
  clearCommandCooldown,
  getRemainingCommandCooldown,
  resetAllCooldownsForTest,
  setCommandCooldown,
} from '../cooldownManager.js';

describe('Command Cooldown Engine', () => {
  const playerMockConstructor = mc.Player as unknown as MockConstructable<mc.Player>;
  let mockPlayer: mc.Player;
  let currentTime = 1_000_000;

  beforeEach(async () => {
    currentTime = 1_000_000;
    setSystemTime(currentTime);
    await initializeConfigManager(false);
    resetAllCooldownsForTest();

    mockPlayer = new playerMockConstructor('player_test_1', 'PlayerTest');
    Object.defineProperty(mockPlayer, 'isValid', { value: true, writable: true });
    mockPlayer.sendMessage = mock();
  });

  afterEach(() => {
    setSystemTime();
  });

  it('should return 0 when no cooldown is active', () => {
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(0);
  });

  it('should set and retrieve remaining cooldown accurately with controlled clock', () => {
    setCommandCooldown('player_test_1', 'feed', 10);
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(10);

    // Advance clock by 4 seconds
    currentTime += 4000;
    setSystemTime(currentTime);
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(6);

    // Advance past expiry
    currentTime += 6500;
    setSystemTime(currentTime);
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(0);
  });

  it('should isolate cooldowns across different commands and players', () => {
    setCommandCooldown('player_test_1', 'heal', 15);
    setCommandCooldown('player_test_2', 'feed', 5);

    expect(getRemainingCommandCooldown('player_test_1', 'heal')).toBe(15);
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(0);
    expect(getRemainingCommandCooldown('player_test_2', 'heal')).toBe(0);
    expect(getRemainingCommandCooldown('player_test_2', 'feed')).toBe(5);
  });

  it('should clear specific command cooldown', () => {
    setCommandCooldown('player_test_1', 'feed', 30);
    setCommandCooldown('player_test_1', 'heal', 30);

    clearCommandCooldown('player_test_1', 'feed');
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(0);
    expect(getRemainingCommandCooldown('player_test_1', 'heal')).toBe(30);
  });

  it('should clear all cooldowns for a player', () => {
    setCommandCooldown('player_test_1', 'feed', 30);
    setCommandCooldown('player_test_1', 'heal', 30);

    clearCommandCooldown('player_test_1');
    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(0);
    expect(getRemainingCommandCooldown('player_test_1', 'heal')).toBe(0);
  });

  it('should sweep expired entries across all players with cleanupExpiredCooldowns', () => {
    setCommandCooldown('player_test_1', 'feed', 5);
    setCommandCooldown('player_test_2', 'heal', 10);

    currentTime += 6000; // feed expired, heal still active
    setSystemTime(currentTime);
    cleanupExpiredCooldowns();

    expect(getRemainingCommandCooldown('player_test_1', 'feed')).toBe(0);
    expect(getRemainingCommandCooldown('player_test_2', 'heal')).toBe(4);
  });

  it('should evaluate bypass permissions correctly', () => {
    expect(canBypassCommandCooldown(mockPlayer)).toBeFalse();

    const spy = spyOn(permissionEngine, 'hasPermission').mockImplementation(
      (_player, node) => node === 'cmd.cooldown.bypass',
    );
    onTestFinished(() => {
      spy.mockRestore();
    });
    expect(canBypassCommandCooldown(mockPlayer)).toBeTrue();
  });
});
