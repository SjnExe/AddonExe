/**
 * Deeply compares two values for equality, handling objects, arrays, dates, and circular references.
 * @param {*} a The first value to compare.
 * @param {*} b The second value to compare.
 * @param {WeakMap} [map=new WeakMap()] Used internally to handle circular references.
 * @returns {boolean} True if the values are deeply equal.
 */
export function isDeepEqual(a, b, map = new WeakMap()) {
    // Strict equality check for primitives and same object reference.
    if (a === b) {
        return true;
    }

    // Different types or null objects are not equal.
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return false;
    }

    // Handle Dates
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }

    // Handle Regex
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.source === b.source && a.flags === b.flags;
    }

    // Handle circular references for objects and arrays.
    if (map.has(a) && map.get(a) === b) {
        return true;
    }
    map.set(a, b);

    // Handle Arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (!isDeepEqual(a[i], b[i], map)) {
                return false;
            }
        }
        return true;
    }

    // If one is an array and the other is not.
    if (Array.isArray(a) !== Array.isArray(b)) {
        return false;
    }

    // Handle Objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
        return false;
    }

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key) || !isDeepEqual(a[key], b[key], map)) {
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
export function isObject(item) {
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
    return !isDeepEqual(newDefaultValue, oldDefaultValue);
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
 * Performs a 3-way merge of a standard configuration object. It starts with the user's saved
 * configuration and then recursively applies any changes detected between the new default
 * file and the last-loaded version of the file. This ensures that manual file edits by the
 * developer are prioritized and applied over existing in-game settings.
 *
 * @param {object} userSavedConfig The user's current in-game configuration.
 * @param {object} newDefaultConfig The configuration from the newly loaded file.
 * @param {object} lastLoadedConfig The configuration from the last time the file was loaded.
 * @param {(message: string, ...args: any[]) => void} debugLog A function to log debug messages.
 * @param {string} configName The name of the configuration for logging purposes (e.g., 'Main').
 * @returns {object} The merged configuration object.
 */
export function mergeWithFileChanges(userSavedConfig, newDefaultConfig, lastLoadedConfig, debugLog, configName) {
    const mergedConfig = deepClone(userSavedConfig);

    // This recursive helper function is the core of the logic.
    function applyChanges(path, fileObj, lastLoadedObj) {
        if (!isObject(fileObj)) { return; }

        for (const key in fileObj) {
            if (!Object.prototype.hasOwnProperty.call(fileObj, key)) { continue; }

            const currentPath = path ? `${path}.${key}` : key;
            const fileValue = fileObj[key];
            const lastLoadedValue = isObject(lastLoadedObj) ? lastLoadedObj[key] : undefined;

            if (isObject(fileValue) && isObject(lastLoadedValue)) {
                // If both are objects, recurse deeper.
                applyChanges(currentPath, fileValue, lastLoadedValue);
            } else if (!isDeepEqual(fileValue, lastLoadedValue)) {
                // If values are different, the file value takes precedence.
                debugLog(`[${configName}ConfigManager] Manual file change detected for '${currentPath}'. Applying file value.`);
                setValueByPath(mergedConfig, currentPath, fileValue);
            }
        }
    }

    applyChanges('', newDefaultConfig, lastLoadedConfig);
    return mergedConfig;
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

/**
 * Performs a 3-way merge of rank definition arrays to intelligently combine developer file changes
 * with user in-game changes, preserving data where possible.
 *
 * The logic prioritizes changes in the following order:
 * 1. User deletions are always respected.
 * 2. Developer file deletions are respected.
 * 3. New ranks added by the developer are added.
 * 4. For existing ranks, changes made by the developer in the file are merged on top of any
 *    changes the user made in-game. If there's a conflict on the same property, the file change wins.
 *
 * @param {import('./ranksConfig.js').RankDefinition[]} currentUserRanks The ranks currently in the world (with user changes).
 * @param {import('./ranksConfig.js').RankDefinition[]} newFileRanks The ranks from the newly loaded config file.
 * @param {import('./ranksConfig.js').RankDefinition[]} lastLoadedRanks The ranks from the config file as of the last load.
 * @returns {import('./ranksConfig.js').RankDefinition[]} The merged list of ranks.
 */
export function mergeRanks(currentUserRanks, newFileRanks, lastLoadedRanks) {
    const userMap = new Map((currentUserRanks || []).map(r => [r.id, r]));
    const fileMap = new Map((newFileRanks || []).map(r => [r.id, r]));
    const lastMap = new Map((lastLoadedRanks || []).map(r => [r.id, r]));

    const allIds = new Set([...userMap.keys(), ...fileMap.keys(), ...lastMap.keys()]);
    const finalRanks = [];

    for (const id of allIds) {
        const userRank = userMap.get(id);
        const fileRank = fileMap.get(id);
        const lastRank = lastMap.get(id);

        // Case 1: Dev added a new rank to the file.
        if (fileRank && !lastRank) {
            finalRanks.push(deepClone(fileRank));
            continue;
        }

        // Case 2: Dev deleted a rank from the file. It should be removed.
        if (!fileRank && lastRank) {
            continue;
        }

        // Case 3: User deleted a rank in-game. It should be removed.
        if (!userRank && fileRank && lastRank) {
            continue;
        }

        // Case 4: Rank exists and needs to be merged.
        if (userRank && fileRank && lastRank) {
            const fileDidChange = !isDeepEqual(fileRank, lastRank);

            if (fileDidChange) {
                // The file has changed. Merge changes, with file changes taking precedence.
                const mergedRank = deepClone(userRank);
                for (const key in fileRank) {
                    if (!isDeepEqual(fileRank[key], lastRank[key])) {
                        mergedRank[key] = deepClone(fileRank[key]);
                    }
                }
                finalRanks.push(mergedRank);
            } else {
                // File didn't change for this rank, so keep the user's version.
                finalRanks.push(deepClone(userRank));
            }
            continue;
        }

        // Edge Case: A rank exists in-game but was never in the tracked files (e.g., manually added).
        // To be safe, we keep it.
        if (userRank && !fileRank && !lastRank) {
            finalRanks.push(deepClone(userRank));
        }
    }

    // Preserve original order as much as possible
    finalRanks.sort((a, b) => {
        const aIndex = newFileRanks.findIndex(r => r.id === a.id);
        const bIndex = newFileRanks.findIndex(r => r.id === b.id);
        if (aIndex === -1 || bIndex === -1) {
            return 0;
        }
        return aIndex - bIndex;
    });

    return finalRanks;
}

/**
 * Recursively performs a 3-way merge for configurations that use objects as key-value maps (e.g., kits, shop).
 * This function correctly handles additions, modifications, and deletions from both file and in-game changes.
 *
 * @param {object} currentUser The current in-game configuration object.
 * @param {object} newFile The configuration object from the newly loaded file.
 * @param {object} lastLoaded The configuration object from the last time the file was loaded.
 * @returns {object} The merged configuration object.
 */
export function mergeObjectMaps(currentUser, newFile, lastLoaded) {
    const finalConfig = deepClone(currentUser);
    const allKeys = new Set([...Object.keys(currentUser), ...Object.keys(newFile), ...Object.keys(lastLoaded)]);

    for (const key of allKeys) {
        const userValue = currentUser[key];
        const fileValue = newFile[key];
        const lastValue = lastLoaded[key];

        // Scenario 1: Item was deleted from the file by the developer.
        if (fileValue === undefined && lastValue !== undefined) {
            delete finalConfig[key];
            continue;
        }

        // Scenario 2: A new item was added to the file by the developer.
        if (fileValue !== undefined && lastValue === undefined) {
            finalConfig[key] = deepClone(fileValue);
            continue;
        }

        // Scenario 3: The item exists and may need updates.
        if (userValue !== undefined && fileValue !== undefined) {
            const fileDidChange = !isDeepEqual(fileValue, lastValue);

            if (fileDidChange) {
                // If the item is a nested object, recurse. Otherwise, just apply the file value.
                if (isObject(userValue) && isObject(fileValue) && isObject(lastValue)) {
                    finalConfig[key] = mergeObjectMaps(userValue, fileValue, lastValue);
                } else {
                    // The file value takes precedence for this property.
                    finalConfig[key] = deepClone(fileValue);
                }
            }
            // If fileDidChange is false, we do nothing, preserving the userValue that's already in finalConfig.
        }
    }

    return finalConfig;
}
