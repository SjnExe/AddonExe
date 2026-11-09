import { beforeEach, describe, expect, it } from 'bun:test';

import {
  _resetGraceManagerForTest,
  addGrace,
  clearPlayerGrace,
  getRemainingGrace,
  hasGrace,
  recordPlayerBounceGrace,
  recordPlayerDamageGrace,
  recordPlayerTeleportGrace,
  recordPlayerVehicleGrace,
} from '@features/anticheat/core/graceManager.js';

describe('GraceManager', () => {
  beforeEach(() => {
    _resetGraceManagerForTest();
  });

  it('should grant and recognize active grace windows', () => {
    addGrace('player1', 'teleport', 2000);

    expect(hasGrace('player1', 'teleport')).toBe(true);
    expect(hasGrace('player1')).toBe(true);
    expect(hasGrace('player1', 'damage')).toBe(false);
    expect(getRemainingGrace('player1', 'teleport')).toBeGreaterThan(0);
  });

  it('should support checking multiple grace reasons', () => {
    addGrace('player2', 'knockback', 3000);

    expect(hasGrace('player2', ['teleport', 'knockback'])).toBe(true);
    expect(hasGrace('player2', ['damage', 'vehicle'])).toBe(false);
  });

  it('recordPlayerDamageGrace should set both damage and knockback grace', () => {
    recordPlayerDamageGrace('player3', 2500);

    expect(hasGrace('player3', 'damage')).toBe(true);
    expect(hasGrace('player3', 'knockback')).toBe(true);
    expect(hasGrace('player3', 'teleport')).toBe(false);
  });

  it('recordPlayerTeleportGrace should set teleport grace', () => {
    recordPlayerTeleportGrace('player4', 3000);

    expect(hasGrace('player4', 'teleport')).toBe(true);
  });

  it('recordPlayerBounceGrace should set bounce grace', () => {
    recordPlayerBounceGrace('player5', 2500);

    expect(hasGrace('player5', 'bounce')).toBe(true);
  });

  it('recordPlayerVehicleGrace should set vehicle grace', () => {
    recordPlayerVehicleGrace('player6', 2000);

    expect(hasGrace('player6', 'vehicle')).toBe(true);
  });

  it('clearPlayerGrace should delete all active grace entries for a specific player', () => {
    addGrace('player7', 'teleport', 5000);
    addGrace('player7', 'damage', 5000);
    addGrace('player8', 'teleport', 5000);

    clearPlayerGrace('player7');

    expect(hasGrace('player7')).toBe(false);
    expect(hasGrace('player8')).toBe(true);
  });

  it('should return 0 remaining grace for expired or absent grace reasons', () => {
    expect(getRemainingGrace('nonexistent', 'teleport')).toBe(0);
  });
});
