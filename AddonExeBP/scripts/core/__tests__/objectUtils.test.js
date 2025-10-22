import { isDeepEqual } from '../objectUtils.js';

describe('isDeepEqual', () => {
    test('should return true for identical objects', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { a: 1, b: { c: 2 } };
        expect(isDeepEqual(obj1, obj2)).toBe(true);
    });

    test('should return false for different objects', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { a: 1, b: { c: 3 } };
        expect(isDeepEqual(obj1, obj2)).toBe(false);
    });

    test('should return true for identical objects with different key order', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { b: 2, a: 1 };
        expect(isDeepEqual(obj1, obj2)).toBe(true);
    });

    test('should return false for objects with different keys', () => {
        const obj1 = { a: 1, b: 2 };
        const obj2 = { a: 1, c: 2 };
        expect(isDeepEqual(obj1, obj2)).toBe(false);
    });
});
