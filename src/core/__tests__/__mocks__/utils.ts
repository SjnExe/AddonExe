export type MockClass<T> = new (...args: unknown[]) => T;
export type AnyFunction = (...args: unknown[]) => unknown;

// Helper to cast abstract classes to constructable for mocking
export type MockConstructable<T> = new (...args: unknown[]) => T;
