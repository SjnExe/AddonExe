import { describe, expect, it } from 'bun:test';
import { isDefined, isNonEmptyString, isNumber, isString } from '../guards.js';

describe('Type Guards', () => {
    describe('isDefined', () => {
        it('should return false for null and undefined', () => {
            expect(isDefined(null)).toBe(false);
            expect(isDefined(undefined)).toBe(false);
        });

        it('should return true for all other values', () => {
            expect(isDefined('')).toBe(true);
            expect(isDefined(0)).toBe(true);
            expect(isDefined(false)).toBe(true);
            expect(isDefined({})).toBe(true);
            expect(isDefined([])).toBe(true);
        });
    });

    describe('isString', () => {
        it('should return true for strings', () => {
            expect(isString('hello')).toBe(true);
            expect(isString('')).toBe(true);
            expect(isString(`template`)).toBe(true);
            expect(isString(String('test'))).toBe(true);
        });

        it('should return false for non-strings', () => {
            expect(isString(null)).toBe(false);
            expect(isString(undefined)).toBe(false);
            expect(isString(123)).toBe(false);
            expect(isString(true)).toBe(false);
            expect(isString(false)).toBe(false);
            expect(isString({})).toBe(false);
            expect(isString([])).toBe(false);
            expect(isString(() => {})).toBe(false);
        });
    });

    describe('isNumber', () => {
        it('should return true for valid numbers', () => {
            expect(isNumber(42)).toBe(true);
            expect(isNumber(0)).toBe(true);
            expect(isNumber(-10.5)).toBe(true);
            expect(isNumber(1.5)).toBe(true);
            expect(isNumber(Number('123'))).toBe(true);
        });

        it('should return false for NaN', () => {
            expect(isNumber(NaN)).toBe(false);
            expect(isNumber(Number.NaN)).toBe(false);
            expect(isNumber(Number('abc'))).toBe(false);
        });

        it('should return false for non-number types', () => {
            expect(isNumber(null)).toBe(false);
            expect(isNumber(undefined)).toBe(false);
            expect(isNumber('42')).toBe(false);
            expect(isNumber('')).toBe(false);
            expect(isNumber(true)).toBe(false);
            expect(isNumber(false)).toBe(false);
            expect(isNumber({})).toBe(false);
            expect(isNumber([])).toBe(false);
            expect(isNumber(() => {})).toBe(false);
        });
    });

    describe('isNonEmptyString', () => {
        it('should return true for non-empty strings', () => {
            expect(isNonEmptyString('hello')).toBe(true);
            expect(isNonEmptyString(' ')).toBe(true);
            expect(isNonEmptyString(`template`)).toBe(true);
        });

        it('should return false for empty strings', () => {
            expect(isNonEmptyString('')).toBe(false);
        });

        it('should return false for non-strings', () => {
            expect(isNonEmptyString(null)).toBe(false);
            expect(isNonEmptyString(undefined)).toBe(false);
            expect(isNonEmptyString(123)).toBe(false);
            expect(isNonEmptyString(true)).toBe(false);
            expect(isNonEmptyString(false)).toBe(false);
            expect(isNonEmptyString({})).toBe(false);
            expect(isNonEmptyString([])).toBe(false);
            expect(isNonEmptyString(() => {})).toBe(false);
        });
    });
});
