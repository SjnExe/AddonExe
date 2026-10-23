import { isDefined, isNonEmptyString, isObject } from '@lib/guards.js';

export { isObject };

/** Deeply compares two values for equality, handling objects, arrays, dates, and circular references. */
export function isDeepEqual(a: unknown, b: unknown, map = new WeakMap<object, unknown>()): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (map.has(a) && map.get(a) === b) {
    return true;
  }
  map.set(a, b);

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (const [i, element] of a.entries()) {
      if (!isDeepEqual(element, b[i], map)) {
        return false;
      }
    }
    return true;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], map)
    ) {
      return false;
    }
  }

  return true;
}

/** Deeply merges the properties of a source object into a target object. */
export function deepMerge(target: unknown, source: unknown): unknown {
  if (!isObject(target) || !isObject(source)) {
    return target;
  }
  const output: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isObject(sourceValue)) {
      output[key] = key in target ? deepMerge(targetValue, sourceValue) : deepClone(sourceValue);
    } else {
      output[key] = deepClone(sourceValue);
    }
  }

  return output;
}

/** Gets a nested value from an object using a dot-notation string path. */
export function getValueFromPath(obj: unknown, pathStr: string): unknown {
  if (!pathStr) {
    return obj;
  }
  let current = obj;
  for (const key of pathStr.split('.')) {
    if (isDefined(current) && isObject(current) && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Sets a nested value in an object using a dot-notation string path. */
export function setValueByPath(obj: unknown, pathStr: string, value: unknown): void {
  const keys = pathStr.split('.');
  const lastKey = keys.pop();
  if (!isNonEmptyString(lastKey) || !isObject(obj)) {
    return;
  }
  let lastObj = obj;
  for (const key of keys) {
    if (!isDefined(lastObj[key]) || !isObject(lastObj[key])) {
      lastObj[key] = {};
    }
    lastObj = lastObj[key] as Record<string, unknown>;
  }
  lastObj[lastKey] = value;
}

/** Creates a deep clone of an object or primitive. */
export function deepClone<T>(obj: T, hash?: WeakMap<object, unknown>): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T;
  }
  if (hash?.has(obj)) {
    return hash.get(obj) as T;
  }

  const seen = hash ?? new WeakMap<object, unknown>();

  if (Array.isArray(obj)) {
    const arr = new Array(obj.length);
    seen.set(obj, arr);
    for (let i = 0; i < obj.length; i++) {
      arr[i] = deepClone(obj[i], seen);
    }
    return arr as unknown as T;
  }

  const proto = Object.getPrototypeOf(obj) as object | null;
  const result = (proto === Object.prototype || proto === null ? {} : Object.create(proto)) as Record<string, unknown>;
  seen.set(obj, result);

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    result[key] = deepClone(record[key], seen);
  }
  return result as T;
}
