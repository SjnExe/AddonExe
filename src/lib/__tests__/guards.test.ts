import { describe, expect, it } from 'bun:test';
import { isDefined, isString, isNumber, isNonEmptyString } from '../guards.js';

describe('Type Guards', () => {
    describe('isDefined', () => {
        it('should return true for defined values', () => {
            expect(isDefined(0)).toBe(true);
            expect(isDefined('')).toBe(true);
            expect(isDefined(false)).toBe(true);
            expect(isDefined({})).toBe(true);
            expect(isDefined([])).toBe(true);
        });

        it('should return false for null', () => {
            expect(isDefined(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(isDefined(undefined)).toBe(false);
        });
    });

    describe('isString', () => {
        it('should return true for strings', () => {
            expect(isString('')).toBe(true);
            expect(isString('hello')).toBe(true);
        });

        it('should return false for non-strings', () => {
            expect(isString(123)).toBe(false);
            expect(isString(null)).toBe(false);
            expect(isString(undefined)).toBe(false);
            expect(isString({})).toBe(false);
            expect(isString(true)).toBe(false);
        });
    });

    describe('isNumber', () => {
        it('should return true for numbers', () => {
            expect(isNumber(0)).toBe(true);
            expect(isNumber(-1)).toBe(true);
            expect(isNumber(1.5)).toBe(true);
        });

        it('should return false for NaN', () => {
            expect(isNumber(NaN)).toBe(false);
        });

        it('should return false for non-numbers', () => {
            expect(isNumber('123')).toBe(false);
            expect(isNumber(null)).toBe(false);
            expect(isNumber(undefined)).toBe(false);
            expect(isNumber({})).toBe(false);
            expect(isNumber(true)).toBe(false);
        });
    });

    describe('isNonEmptyString', () => {
        it('should return true for non-empty strings', () => {
            expect(isNonEmptyString('a')).toBe(true);
            expect(isNonEmptyString('hello')).toBe(true);
            expect(isNonEmptyString(' ')).toBe(true); // Space is a valid non-empty string
        });

        it('should return false for empty strings', () => {
            expect(isNonEmptyString('')).toBe(false);
        });

        it('should return false for non-strings', () => {
            expect(isNonEmptyString(123)).toBe(false);
            expect(isNonEmptyString(null)).toBe(false);
            expect(isNonEmptyString(undefined)).toBe(false);
            expect(isNonEmptyString({})).toBe(false);
            expect(isNonEmptyString(true)).toBe(false);
        });
    });
});
