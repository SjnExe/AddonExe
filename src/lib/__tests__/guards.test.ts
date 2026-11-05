import { describe, expect, expectTypeOf, it } from 'bun:test';

import { isBoolean, isDefined, isNonBlankString, isNonEmptyString, isNumber, isString } from '../guards.js';

describe('Type Guards', () => {
  describe('isDefined', () => {
    it('should return false for null and undefined', () => {
      expect(isDefined(null)).toBeFalse();
      expect(isDefined(undefined)).toBeFalse();
    });

    it('should return true for all other values', () => {
      expect(isDefined('')).toBeTrue();
      expect(isDefined(0)).toBeTrue();
      expect(isDefined(false)).toBeTrue();
      expect(isDefined({})).toBeTrue();
      expect(isDefined([])).toBeTrue();

      const val: string | undefined = 'hello';
      if (isDefined(val)) {
        expectTypeOf(val).toBeString();
      }
    });
  });

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('hello')).toBeTrue();
      expect(isString('')).toBeTrue();
      expect(isString(`template`)).toBeTrue();
      expect(isString(String('test'))).toBeTrue();

      const unknownVal: unknown = 'abc';
      if (isString(unknownVal)) {
        expectTypeOf(unknownVal).toBeString();
      }
    });

    it('should return false for non-strings', () => {
      expect(isString(null)).toBeFalse();
      expect(isString(undefined)).toBeFalse();
      expect(isString(123)).toBeFalse();
      expect(isString(true)).toBeFalse();
      expect(isString(false)).toBeFalse();
      expect(isString({})).toBeFalse();
      expect(isString([])).toBeFalse();
      expect(isString(() => {})).toBeFalse();
    });
  });

  describe('isNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isNumber(42)).toBeTrue();
      expect(isNumber(0)).toBeTrue();
      expect(isNumber(-10.5)).toBeTrue();
      expect(isNumber(1.5)).toBeTrue();
      expect(isNumber(Number('123'))).toBeTrue();

      const unknownNum: unknown = 42;
      if (isNumber(unknownNum)) {
        expectTypeOf(unknownNum).toBeNumber();
      }
    });

    it('should return false for NaN and Infinity', () => {
      expect(isNumber(NaN)).toBeFalse();
      expect(isNumber(Number.NaN)).toBeFalse();
      expect(isNumber(Infinity)).toBeFalse();
      expect(isNumber(-Infinity)).toBeFalse();
      expect(isNumber(Number('abc'))).toBeFalse();
    });

    it('should return false for non-number types', () => {
      expect(isNumber(null)).toBeFalse();
      expect(isNumber(undefined)).toBeFalse();
      expect(isNumber('42')).toBeFalse();
      expect(isNumber('')).toBeFalse();
      expect(isNumber(true)).toBeFalse();
      expect(isNumber(false)).toBeFalse();
      expect(isNumber({})).toBeFalse();
      expect(isNumber([])).toBeFalse();
      expect(isNumber(() => {})).toBeFalse();
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBeTrue();
      expect(isNonEmptyString(' ')).toBeTrue();
      expect(isNonEmptyString(`template`)).toBeTrue();
    });

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBeFalse();
    });

    it('should return false for non-strings', () => {
      expect(isNonEmptyString(null)).toBeFalse();
      expect(isNonEmptyString(undefined)).toBeFalse();
      expect(isNonEmptyString(123)).toBeFalse();
      expect(isNonEmptyString(true)).toBeFalse();
      expect(isNonEmptyString(false)).toBeFalse();
      expect(isNonEmptyString({})).toBeFalse();
      expect(isNonEmptyString([])).toBeFalse();
      expect(isNonEmptyString(() => {})).toBeFalse();
    });
  });

  describe('isBoolean & isNonBlankString', () => {
    it('should validate booleans and non-blank strings', () => {
      expect(isBoolean(true)).toBeTrue();
      expect(isBoolean(false)).toBeTrue();
      expect(isBoolean(0)).toBeFalse();
      expect(isNonBlankString('hello')).toBeTrue();
      expect(isNonBlankString('   ')).toBeFalse();
      expect(isNonBlankString('')).toBeFalse();

      const unknownBool: unknown = true;
      if (isBoolean(unknownBool)) {
        expectTypeOf(unknownBool).toBeBoolean();
      }
    });
  });
});
