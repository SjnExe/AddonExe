import { describe, expect, it } from 'bun:test';
import { err, ok, unwrap } from '../result.js';

describe('result', () => {
    describe('ok()', () => {
        it('should create a success result', () => {
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

        it('should create a failure result with a custom error type', () => {
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

        it('should throw a new Error with stringified content for string errors', () => {
            const errorStr = 'Just a string error';
            const result = err(errorStr);
            expect(() => unwrap(result)).toThrow(new Error(errorStr));
        });

        it('should throw a new Error with stringified content for custom object errors', () => {
            const customError = { code: 500 };
            const result = err(customError);
            expect(() => unwrap(result)).toThrow(new Error('[object Object]'));
        });
    });
});
