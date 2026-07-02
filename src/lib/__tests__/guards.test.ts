import { describe, expect, it } from 'bun:test';
import { isNumber } from '../guards.js';

describe('Guards', () => {
    describe('isNumber', () => {
        it('should return true for regular numbers', () => {
            expect(isNumber(42)).toBe(true);
            expect(isNumber(0)).toBe(true);
            expect(isNumber(-10.5)).toBe(true);
        });

        it('should return false for NaN', () => {
            expect(isNumber(NaN)).toBe(false);
            expect(isNumber(Number.NaN)).toBe(false);
        });

        it('should return false for strings', () => {
            expect(isNumber('42')).toBe(false);
            expect(isNumber('')).toBe(false);
        });

        it('should return false for null and undefined', () => {
            expect(isNumber(null)).toBe(false);
            expect(isNumber(undefined)).toBe(false);
        });

        it('should return false for other types', () => {
            expect(isNumber({})).toBe(false);
            expect(isNumber([])).toBe(false);
            expect(isNumber(() => {})).toBe(false);
            expect(isNumber(true)).toBe(false);
            expect(isNumber(false)).toBe(false);
        });
    });
});
