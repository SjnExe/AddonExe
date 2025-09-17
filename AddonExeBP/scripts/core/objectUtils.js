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
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) {
                Object.assign(target, { [key]: {} });
            }
            deepMerge(target[key], source[key]);
        } else {
            Object.assign(target, { [key]: source[key] });
        }
    }
    return target;
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
        const isNewKey = !Object.prototype.hasOwnProperty.call(oldDefault, key);
        const newDefaultValue = newDefault[key];
        const oldDefaultValue = oldDefault[key];
        const userSavedValue = userSaved ? userSaved[key] : undefined;
        const userHasSavedValue = userSaved && Object.prototype.hasOwnProperty.call(userSaved, key);

        const isObject = (val) => val && typeof val === 'object' && !Array.isArray(val);

        if (isNewKey) {
            // New property in this version, so add it from the new default config.
            finalConfig[key] = newDefaultValue;
        } else if (isObject(newDefaultValue) && isObject(oldDefaultValue)) {
            // Property is a nested object, so we must recurse.
            // If the user doesn't have a saved object for this key, pass an empty one to the recursion.
            const userSavedChild = isObject(userSavedValue) ? userSavedValue : {};
            finalConfig[key] = reconcileConfig(newDefaultValue, oldDefaultValue, userSavedChild);
        } else if (!deepEqual(newDefaultValue, oldDefaultValue)) {
            // The default value itself has changed between versions. Force the new default value.
            finalConfig[key] = newDefaultValue;
        } else {
            // The default value is the same as the last version. Preserve the user's setting.
            // If the user hasn't customized this specific key, fall back to the new default value.
            finalConfig[key] = userHasSavedValue ? userSavedValue : newDefaultValue;
        }
    }
    return finalConfig;
}
