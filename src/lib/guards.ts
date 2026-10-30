import type { Nullable } from '@lib/types.js';

/**
 * Checks if a value is defined (not null and not undefined).
 * @param value The value to check.
 * @returns True if the value is defined.
 */
export function isDefined<T>(value: Nullable<T>): value is T {
    return value !== null && value !== undefined;
}

/**
 * Checks if a value is a string.
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Checks if a value is a number and not NaN.
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Checks if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.length > 0;
}
