import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { clearLastHit, getLastHit, setLastHit } from '../lastHitManager.js';

describe('lastHitManager', () => {
    beforeEach(() => {
        // Clear state before each test
        clearLastHit('victim1');
        clearLastHit('victim2');
    });

    describe('setLastHit', () => {
        let dateNowSpy: ReturnType<typeof spyOn>;

        beforeEach(() => {
            dateNowSpy = spyOn(Date, 'now').mockReturnValue(1234567890);
        });

        afterEach(() => {
            dateNowSpy.mockRestore();
        });

        it('should correctly set last hit data with the current timestamp', () => {
            setLastHit('victim1', 'attacker1');

            const hitInfo = getLastHit('victim1');
            expect(hitInfo).toBeDefined();
            expect(hitInfo?.attackerId).toBe('attacker1');
            expect(hitInfo?.timestamp).toBe(1234567890);
        });

        it('should overwrite previous hit data for the same victim', () => {
            setLastHit('victim1', 'attacker1');
            dateNowSpy.mockReturnValue(1234567899);
            setLastHit('victim1', 'attacker2');

            const hitInfo = getLastHit('victim1');
            expect(hitInfo?.attackerId).toBe('attacker2');
            expect(hitInfo?.timestamp).toBe(1234567899);
        });
    });

    it('should correctly set and get last hit data without mocking', () => {
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
});
