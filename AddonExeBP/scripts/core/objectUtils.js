/**
 * Deeply compares two objects for equality.
 * @param {any} object1 The first object.
 * @param {any} object2 The second object.
 * @returns {boolean} True if the objects are equal.
 */
export function deepEqual(object1, object2) {
    if (object1 === object2) {
        return true;
    }

    if (object1 === null || typeof object1 !== 'object' || object2 === null || typeof object2 !== 'object') {
        return false;
    }

    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);

    if (keys1.length !== keys2.length) {
        return false;
    }

    for (const key of keys1) {
        if (!keys2.includes(key) || !deepEqual(object1[key], object2[key])) {
            return false;
        }
    }

    return true;
}

/**
 * Deeply merges the properties of a source object into a target object.
 * @param {object} target The target object.
 * @param {object} source The source object.
 * @returns {object} The merged object.
 */
export function deepMerge(target, source) {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

/**
 * Checks if a value is an object.
 * @param {*} item The value to check.
 * @returns {boolean} True if the value is an object.
 */
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Gets a nested value from an object using a dot-notation string path.
 * @param {object} obj The object to retrieve the value from.
 * @param {string} path The dot-separated path to the property.
 * @returns {*} The value of the property, or undefined if not found.
 */
export function getValueFromPath(obj, path) {
    if (!path) {return obj;}
    return path.split('.').reduce((current, key) => (current && current[key] !== undefined) ? current[key] : undefined, obj);
}

/**
 * Sets a nested value in an object using a dot-notation string path.
 * This function modifies the object in place.
 * @param {object} obj The object to modify.
 * @param {string} path The dot-separated path to the property.
 * @param {*} value The value to set.
 */
export function setValueByPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) {
        return;
    }
    const lastObj = keys.reduce((current, key) => (current[key] = current[key] || {}), obj);
    lastObj[lastKey] = value;
}

/**
 * Determines if a key is new in the new default configuration.
 * @param {string} key The key to check.
 * @param {object} oldDefault The old default configuration object.
 * @returns {boolean} True if the key is new.
 */
function isNewKey(key, oldDefault) {
    return !Object.prototype.hasOwnProperty.call(oldDefault, key);
}

/**
 * Handles recursive reconciliation for nested objects.
 * @param {object} newDefaultValue The new default value for the nested object.
 * @param {object} oldDefaultValue The old default value for the nested object.
 * @param {object} userSavedValue The user's saved value for the nested object.
 * @returns {object} The reconciled nested object.
 */
function reconcileNestedObject(newDefaultValue, oldDefaultValue, userSavedValue) {
    const userSavedChild = isObject(userSavedValue) ? userSavedValue : {};
    return reconcileConfig(newDefaultValue, oldDefaultValue, userSavedChild);
}

/**
 * Determines if the default value for a key has changed.
 * @param {*} newDefaultValue The new default value.
 * @param {*} oldDefaultValue The old default value.
 * @returns {boolean} True if the default value has changed.
 */
function hasDefaultValueChanged(newDefaultValue, oldDefaultValue) {
    return !deepEqual(newDefaultValue, oldDefaultValue);
}

/**
 * Gets the final value for a key, preserving user settings if the default value has not changed.
 * @param {*} newDefaultValue The new default value.
 * @param {*} userSavedValue The user's saved value.
 * @param {boolean} userHasSavedValue Whether the user has a saved value for this key.
 * @returns {*} The final value for the key.
 */
function getFinalValue(newDefaultValue, userSavedValue, userHasSavedValue) {
    return userHasSavedValue ? userSavedValue : newDefaultValue;
}

/**
 * Reconciles three configuration objects based on a specific set of rules for addon updates.
 * - If a setting's default value has changed between versions, the new default is forced.
 * - If a setting's default value is unchanged, the user's custom value is preserved.
 * @param {object} newDefault - The new default config object (from the updated config.js).
 * @param {object} oldDefault - The old default config object (from the last loaded version).
 * @param {object} userSaved - The user's currently saved config object.
 * @returns {object} The final, reconciled configuration object.
 */
export function reconcileConfig(newDefault, oldDefault, userSaved) {
    const finalConfig = {};

    for (const key in newDefault) {
        const newDefaultValue = newDefault[key];
        const oldDefaultValue = oldDefault[key];
        const userSavedValue = userSaved ? userSaved[key] : undefined;
        const userHasSavedValue = userSaved && Object.prototype.hasOwnProperty.call(userSaved, key);

        if (isNewKey(key, oldDefault)) {
            finalConfig[key] = newDefaultValue;
        } else if (isObject(newDefaultValue) && isObject(oldDefaultValue)) {
            finalConfig[key] = reconcileNestedObject(newDefaultValue, oldDefaultValue, userSavedValue);
        } else if (hasDefaultValueChanged(newDefaultValue, oldDefaultValue)) {
            finalConfig[key] = newDefaultValue;
        } else {
            finalConfig[key] = getFinalValue(newDefaultValue, userSavedValue, userHasSavedValue);
        }
    }
    return finalConfig;
}

/**
 * Creates a deep clone of an object.
 * @param {*} obj The value to clone.
 * @param {WeakMap} [hash=new WeakMap()] A map to store references to already cloned objects to handle circular references.
 * @returns {*} A deep clone of the value.
 */
export function deepClone(obj, hash = new WeakMap()) {
    if (Object(obj) !== obj) {
        // Primitives are returned directly
        return obj;
    }
    if (hash.has(obj)) {
        // Handle circular references
        return hash.get(obj);
    }
    if (obj instanceof Date) {
        return new Date(obj);
    }
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags);
    }

    const result = obj instanceof Array ? [] : Object.create(Object.getPrototypeOf(obj));

    hash.set(obj, result);

    return Object.assign(result, ...Object.keys(obj).map(
        key => ({ [key]: deepClone(obj[key], hash) })
    ));
}
