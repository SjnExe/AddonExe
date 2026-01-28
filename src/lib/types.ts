/**
 * Re-export useful type-fest types.
 */

/**
 * Represents a value that may be null or undefined.
 */
export type Nullable<T> = T | null | undefined;

/**
 * Common type for a primitive value.
 */
export type Primitive = string | number | boolean | bigint | symbol | undefined | null;

/**
 * Helper to enforce that a type contains specific keys.
 */
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export { type JsonValue, type Opaque } from 'type-fest';
