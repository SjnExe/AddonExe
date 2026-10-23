import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  clearLastHit,
  getLastHit,
  getRemainingCombatCooldown,
  isInCombat,
  setLastHit,
} from '@features/essentials/combatManager.js';

describe('combatManager', () => {
  beforeEach(() => {
    clearLastHit('victim1');
    clearLastHit('victim2');
    clearLastHit('non_existent_victim');
  });

  describe('setLastHit() & combat cooldown', () => {
    let originalDateNow: () => number;

    beforeEach(() => {
      originalDateNow = Date.now;
    });

    afterEach(() => {
      Date.now = originalDateNow;
    });

    it('should set last hit data with an exact timestamp and report active combat', () => {
      const mockTimestamp = 1600000000000;
      Date.now = () => mockTimestamp;

      setLastHit('victim1', 'attacker1');

      const hitInfo = getLastHit('victim1');
      expect(hitInfo).toBeDefined();
      expect(hitInfo?.attackerId).toBe('attacker1');
      expect(hitInfo?.timestamp).toBe(mockTimestamp);
      expect(isInCombat('victim1')).toBe(true);
      expect(getRemainingCombatCooldown('victim1')).toBeGreaterThan(0);
    });

    it('should expire combat tag after timeout', () => {
      const start = 1600000000000;
      Date.now = () => start;
      setLastHit('victim1', 'attacker1');

      Date.now = () => start + 20_000;
      expect(isInCombat('victim1')).toBe(false);
      expect(getRemainingCombatCooldown('victim1')).toBe(0);
    });

    it('should overwrite previous hit data for the same victim', () => {
      setLastHit('victim1', 'attacker1');
      setLastHit('victim1', 'attacker2');

      const hitInfo = getLastHit('victim1');
      expect(hitInfo?.attackerId).toBe('attacker2');
    });
  });

  describe('clearLastHit()', () => {
    it('should clear existing last hit data successfully', () => {
      setLastHit('victim1', 'attacker1');
      expect(getLastHit('victim1')).toBeDefined();

      clearLastHit('victim1');
      expect(getLastHit('victim1')).toBeUndefined();
    });
  });
});
