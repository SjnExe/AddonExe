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

export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [Key in string]?: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

declare const opaqueTagSymbol: unique symbol;
export type Opaque<Type, Token = unknown> = Type & { readonly [opaqueTagSymbol]: Token };
