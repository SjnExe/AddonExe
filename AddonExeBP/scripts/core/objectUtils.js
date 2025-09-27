/**
 * @fileoverview Utility functions for working with JavaScript objects.
 */

/**
 * Retrieves a value from a nested object using a dot-separated path.
 * @param {object} obj The object to search.
 * @param {string} path The path to the desired value (e.g., 'a.b.c').
 * @returns {*} The value found at the path, or undefined if not found.
 */
export function getValueFromPath(obj, path) {
    if (!obj || typeof path !== 'string') {
        return undefined;
    }
    return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

/**
 * Sets a value in a nested object using a dot-separated path. Creates nested objects if they don't exist.
 * @param {object} obj The object to modify.
 * @param {string} path The path to set the value at (e.g., 'a.b.c').
 * @param {*} value The value to set.
 */
export function setValueFromPath(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
}


/**
 * Creates a deep copy of an object or array.
 * @param {*} source The object or array to clone.
 * @returns {*} A deep copy of the source.
 */
export function deepClone(source) {
    if (source === null || typeof source !== 'object') {
        return source;
    }

    if (Array.isArray(source)) {
        const clone = [];
        for (let i = 0; i < source.length; i++) {
            clone[i] = deepClone(source[i]);
        }
        return clone;
    }

    const clone = {};
    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            clone[key] = deepClone(source[key]);
        }
    }
    return clone;
}