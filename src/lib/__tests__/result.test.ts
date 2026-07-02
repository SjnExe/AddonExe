import { describe, expect, it } from 'bun:test';
import { err, ok, unwrap } from '../result.js';

describe('Result Utilities', () => {
    describe('ok()', () => {
        it('should create a success result with an object payload', () => {
            const data = { id: 1, name: 'Test' };
            const result = ok(data);

            expect(result.success).toBe(true);
            expect(result.data).toBe(data);
        });

        it('should create a success result with primitive data', () => {
            const data = 'success data';
            const result = ok(data);

            expect(result.success).toBe(true);
            expect(result.data).toBe(data);
        });

        it('should create a success result with null data', () => {
            const result = ok(null);

            expect(result.success).toBe(true);
            expect(result.data).toBeNull();
        });

        it('should create a success result with undefined data', () => {
            const result = ok(undefined);

            expect(result.success).toBe(true);
            expect(result.data).toBeUndefined();
        });

        it('should create a success result with falsy values', () => {
            const resultZero = ok(0);
            expect(resultZero.success).toBe(true);
            expect(resultZero.data).toBe(0);

            const resultFalse = ok(false);
            expect(resultFalse.success).toBe(true);
            expect(resultFalse.data).toBe(false);

            const resultEmptyString = ok('');
            expect(resultEmptyString.success).toBe(true);
            expect(resultEmptyString.data).toBe('');
        });

        it('should create a success result with an array', () => {
            const data = [1, 2, 3];
            const result = ok(data);

            expect(result.success).toBe(true);
            expect(result.data).toBe(data);
        });
    });

    describe('err()', () => {
        it('should create a failure result with an Error object', () => {
            const error = new Error('test error');
            const result = err(error);

            expect(result.success).toBe(false);
            expect(result.error).toBe(error);
        });

        it('should create a failure result with a string error', () => {
            const errorStr = 'string error';
            const result = err(errorStr);

            expect(result.success).toBe(false);
            expect(result.error).toBe(errorStr);
        });

        it('should create a failure result with a custom error object', () => {
            const customError = { code: 404, message: 'Not Found' };
            const result = err(customError);

            expect(result.success).toBe(false);
            expect(result.error).toBe(customError);
        });
    });

    describe('unwrap()', () => {
        it('should return data for a success result', () => {
            const data = { value: 42 };
            const result = ok(data);

            expect(unwrap(result)).toBe(data);
        });

        it('should throw the original error if it is an instance of Error', () => {
            const error = new Error('Original Error');
            const result = err(error);

            expect(() => unwrap(result)).toThrow(error);
            expect(() => unwrap(result)).toThrow('Original Error');
        });

        it('should throw a wrapper Error for string errors', () => {
            const errorStr = 'Just a string error';
            const result = err(errorStr);

            expect(() => unwrap(result)).toThrow(errorStr);
            expect(() => unwrap(result)).toThrow(new Error(errorStr));
        });

        it('should throw a wrapped Error with stringified content for custom object errors', () => {
            const customError = { code: 500 };
            const result = err(customError);

            expect(() => unwrap(result)).toThrow(new Error('[object Object]'));
        });
    });
});
