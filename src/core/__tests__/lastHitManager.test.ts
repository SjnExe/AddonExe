import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { clearLastHit, getLastHit, setLastHit } from '../lastHitManager.js';

describe('lastHitManager', () => {
    beforeEach(() => {
        // Reset state before each test to guarantee test isolation
        clearLastHit('victim1');
        clearLastHit('victim2');
        clearLastHit('non_existent_victim');
    });

    describe('setLastHit()', () => {
        let originalDateNow: () => number;

        beforeEach(() => {
            originalDateNow = Date.now;
        });

        afterEach(() => {
            Date.now = originalDateNow;
        });

        it('should correctly set last hit data with an exact mocked timestamp', () => {
            const mockTimestamp = 1600000000000;
            Date.now = () => mockTimestamp;

            setLastHit('victim1', 'attacker1');

            const hitInfo = getLastHit('victim1');

            expect(hitInfo).toBeDefined();
            expect(hitInfo?.attackerId).toBe('attacker1');
            expect(hitInfo?.timestamp).toBe(mockTimestamp);
        });

        it('should correctly set last hit data with a valid timestamp', () => {
            const beforeTime = Date.now();
            setLastHit('victim1', 'attacker1');
            const afterTime = Date.now();

            const hitInfo = getLastHit('victim1');

            expect(hitInfo).toBeDefined();
            expect(hitInfo?.attackerId).toBe('attacker1');
            expect(hitInfo?.timestamp).toBeGreaterThanOrEqual(beforeTime);
            expect(hitInfo?.timestamp).toBeLessThanOrEqual(afterTime);
        });

        it('should overwrite previous hit data for the same victim', () => {
            setLastHit('victim1', 'attacker1');
            setLastHit('victim1', 'attacker2');

            const hitInfo = getLastHit('victim1');
            expect(hitInfo?.attackerId).toBe('attacker2');
        });

        it('should allow empty string for victimId and attackerId', () => {
            setLastHit('', '');

            const hitInfo = getLastHit('');
            expect(hitInfo?.attackerId).toBe('');
        });
    });

    describe('getLastHit()', () => {
        it('should return undefined for a victim with no last hit history', () => {
            const hitInfo = getLastHit('victim2');
            expect(hitInfo).toBeUndefined();
        });
    });

    describe('clearLastHit()', () => {
        it('should clear existing last hit data successfully', () => {
            setLastHit('victim1', 'attacker1');
            expect(getLastHit('victim1')).toBeDefined();

            clearLastHit('victim1');
            expect(getLastHit('victim1')).toBeUndefined();
        });

        it('should only clear the specified victim and leave others intact', () => {
            setLastHit('victim1', 'attacker1');
            setLastHit('victim2', 'attacker2');

            clearLastHit('victim1');

            expect(getLastHit('victim1')).toBeUndefined();
            expect(getLastHit('victim2')?.attackerId).toBe('attacker2');
        });

        it('should gracefully handle clearing a non-existent victim without throwing', () => {
            expect(() => {
                clearLastHit('non_existent_victim');
            }).not.toThrow();

            expect(getLastHit('non_existent_victim')).toBeUndefined();
        });
    });
});
