import { describe, expect, it } from 'bun:test';
import { err, ok, unwrap } from '../result.js';

describe('result.ts', () => {
    describe('unwrap', () => {
        it('should return the data when result is success', () => {
            const result = ok('test data');
            expect(unwrap(result)).toBe('test data');
        });

        it('should throw the error when result is failure and error is an Error object', () => {
            const error = new Error('test error');
            const result = err(error);
            expect(() => unwrap(result)).toThrow(error);
        });

        it('should throw when result is failure and error is a string', () => {
            const errorStr = 'string error';
            const result = err(errorStr);
            expect(() => unwrap(result)).toThrow(errorStr);
        });
    });
});
