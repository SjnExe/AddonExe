import { beforeEach, describe, expect, it } from 'bun:test';
import { clearLastHit, getLastHit, setLastHit } from '../lastHitManager.js';

describe('lastHitManager', () => {
    beforeEach(() => {
        // Clear state before each test
        clearLastHit('victim1');
        clearLastHit('victim2');
    });

    it('should correctly set and get last hit data', () => {
        const beforeTime = Date.now();
        setLastHit('victim1', 'attacker1');
        const afterTime = Date.now();

        const hitInfo = getLastHit('victim1');

        expect(hitInfo).toBeDefined();
        expect(hitInfo?.attackerId).toBe('attacker1');
        expect(hitInfo?.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(hitInfo?.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should return undefined for a victim with no last hit', () => {
        const hitInfo = getLastHit('victim2');
        expect(hitInfo).toBeUndefined();
    });

    it('should clear last hit data correctly', () => {
        setLastHit('victim1', 'attacker1');
        expect(getLastHit('victim1')).toBeDefined();

        clearLastHit('victim1');
        expect(getLastHit('victim1')).toBeUndefined();
    });

    it('should overwrite previous hit data for the same victim', () => {
        setLastHit('victim1', 'attacker1');
        setLastHit('victim1', 'attacker2');

        const hitInfo = getLastHit('victim1');
        expect(hitInfo?.attackerId).toBe('attacker2');
    });
});
