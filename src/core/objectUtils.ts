/**
 * Deeply compares two values for equality, handling objects, arrays, dates, and circular references.
 * @param a The first value to compare.
 * @param b The second value to compare.
 * @param map Used internally to handle circular references.
 * @returns True if the values are deeply equal.
 */
export function isDeepEqual(a: unknown, b: unknown, map = new WeakMap<object, unknown>()): boolean {
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
        for (const [i, element] of a.entries()) {
            if (!isDeepEqual(element, b[i], map)) {
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
        if (
            !Object.prototype.hasOwnProperty.call(b, key) ||
            !isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], map)
        ) {
            return false;
        }
    }

    return true;
}

/**
 * Deeply merges the properties of a source object into a target object.
 * @param target The target object.
 * @param source The source object.
 * @returns The merged object.
 */
export function deepMerge(target: unknown, source: unknown): unknown {
    if (!isObject(target) || !isObject(source)) {
        return target;
    }
    const output = { ...target } as Record<string, unknown>;

    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (isObject(sourceValue)) {
            if (key in target) {
                output[key] = deepMerge(targetValue, sourceValue);
            } else {
                Object.assign(output, { [key]: sourceValue });
            }
        } else {
            Object.assign(output, { [key]: sourceValue });
        }
    }

    return output;
}

/**
 * Checks if a value is an object.
 * @param item The value to check.
 * @returns True if the value is an object.
 */
export function isObject(item: unknown): item is Record<string, unknown> {
    return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Gets a nested value from an object using a dot-notation string path.
 * @param obj The object to retrieve the value from.
 * @param path The dot-separated path to the property.
 * @returns The value of the property, or undefined if not found.
 */
export function getValueFromPath(obj: unknown, path: string): unknown {
    if (!path) {
        return obj;
    }
    return path.split('.').reduce<unknown>((current, key) => {
        if (current && typeof current === 'object' && key in current) {
            return (current as Record<string, unknown>)[key];
        }
        return;
    }, obj);
}

/**
 * Sets a nested value in an object using a dot-notation string path.
 * This function modifies the object in place.
 * @param obj The object to modify.
 * @param path The dot-separated path to the property.
 * @param value The value to set.
 */
export function setValueByPath(obj: unknown, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey || !isObject(obj)) {
        return;
    }
    const lastObj = keys.reduce<Record<string, unknown>>((current, key) => {
        const record = current;
        if (!record[key]) {
            record[key] = {};
        }
        return record[key] as Record<string, unknown>;
    }, obj);
    lastObj[lastKey] = value;
}

/**
 * Determines if a key is new in the new default configuration.
 * @param key The key to check.
 * @param oldDefault The old default configuration object.
 * @returns True if the key is new.
 */
function isNewKey(key: string, oldDefault: Record<string, unknown>): boolean {
    return !Object.prototype.hasOwnProperty.call(oldDefault, key);
}

/**
 * Handles recursive reconciliation for nested objects.
 * @param newDefaultValue The new default value for the nested object.
 * @param oldDefaultValue The old default value for the nested object.
 * @param userSavedValue The user's saved value for the nested object.
 * @returns The reconciled nested object.
 */
function reconcileNestedObject(newDefaultValue: unknown, oldDefaultValue: unknown, userSavedValue: unknown): unknown {
    const userSavedChild = isObject(userSavedValue) ? userSavedValue : {};
    return reconcileConfig(
        newDefaultValue as Record<string, unknown>,
        oldDefaultValue as Record<string, unknown>,
        userSavedChild
    );
}

/**
 * Determines if the default value for a key has changed.
 * @param newDefaultValue The new default value.
 * @param oldDefaultValue The old default value.
 * @returns True if the default value has changed.
 */
function hasDefaultValueChanged(newDefaultValue: unknown, oldDefaultValue: unknown): boolean {
    return !isDeepEqual(newDefaultValue, oldDefaultValue);
}

/**
 * Gets the final value for a key, preserving user settings if the default value has not changed.
 * @param newDefaultValue The new default value.
 * @param userSavedValue The user's saved value.
 * @param userHasSavedValue Whether the user has a saved value for this key.
 * @returns The final value for the key.
 */
function getFinalValue(newDefaultValue: unknown, userSavedValue: unknown, userHasSavedValue: boolean): unknown {
    return userHasSavedValue ? userSavedValue : newDefaultValue;
}

/**
 * Reconciles three configuration objects based on a specific set of rules for addon updates.
 * - If a setting's default value has changed between versions, the new default is forced.
 * - If a setting's default value is unchanged, the user's custom value is preserved.
 * @param newDefault - The new default config object (from the updated config.js).
 * @param oldDefault - The old default config object (from the last loaded version).
 * @param userSaved - The user's currently saved config object.
 * @returns The final, reconciled configuration object.
 */
export function reconcileConfig(
    newDefault: Record<string, unknown>,
    oldDefault: Record<string, unknown>,
    userSaved: Record<string, unknown> | null
): Record<string, unknown> {
    const finalConfig: Record<string, unknown> = {};

    for (const key in newDefault) {
        const newDefaultValue = newDefault[key];
        const oldDefaultValue = oldDefault[key];
        const userSavedValue = userSaved ? userSaved[key] : undefined;
        const userHasSavedValue = userSaved ? Object.prototype.hasOwnProperty.call(userSaved, key) : false;

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
 * Performs a 3-way merge of a standard configuration object.
 * @param userSavedConfig The user's current in-game configuration.
 * @param newDefaultConfig The configuration from the newly loaded file.
 * @param lastLoadedConfig The configuration from the last time the file was loaded.
 * @param debugLog A function to log debug messages.
 * @param configName The name of the configuration for logging purposes (e.g., 'Main').
 * @returns The merged configuration object.
 */
export function mergeWithFileChanges(
    userSavedConfig: unknown,
    newDefaultConfig: unknown,
    lastLoadedConfig: unknown,
    debugLog: (message: string, ...args: unknown[]) => void,
    configName: string
): unknown {
    const mergedConfig = deepClone(userSavedConfig);

    // This recursive helper function is the core of the logic.
    function applyChanges(path: string, fileObj: unknown, lastLoadedObj: unknown) {
        if (!isObject(fileObj)) {
            return;
        }

        for (const key in fileObj) {
            if (!Object.prototype.hasOwnProperty.call(fileObj, key)) {
                continue;
            }

            const currentPath = path ? `${path}.${key}` : key;
            const fileValue = fileObj[key];
            const lastLoadedValue = isObject(lastLoadedObj) ? lastLoadedObj[key] : undefined;

            if (isObject(fileValue) && isObject(lastLoadedValue)) {
                // If both are objects, recurse deeper.
                applyChanges(currentPath, fileValue, lastLoadedValue);
            } else if (!isDeepEqual(fileValue, lastLoadedValue)) {
                // If values are different, the file value takes precedence.
                debugLog(
                    `[${configName}ConfigManager] Manual file change detected for '${currentPath}'. Applying file value.`
                );
                setValueByPath(mergedConfig, currentPath, fileValue);
            }
        }
    }

    applyChanges('', newDefaultConfig, lastLoadedConfig);
    return mergedConfig;
}

/**
 * Creates a deep clone of an object.
 * @param obj The value to clone.
 * @param hash A map to store references to already cloned objects to handle circular references.
 * @returns A deep clone of the value.
 */
export function deepClone<T>(obj: T, hash = new WeakMap<object, unknown>()): T {
    if (Object(obj) !== obj) {
        // Primitives are returned directly
        return obj;
    }
    if (hash.has(obj as object)) {
        // Handle circular references
        return hash.get(obj as object) as T;
    }
    if (obj instanceof Date) {
        return new Date(obj) as unknown as T;
    }
    if (obj instanceof RegExp) {
        return new RegExp(obj.source, obj.flags) as unknown as T;
    }

    const result = (
        Array.isArray(obj) ? [] : Object.create(Object.getPrototypeOf(obj as object) as object | null)
    ) as T;

    hash.set(obj as object, result);

    return Object.assign(
        result as object,
        ...Object.keys(obj as Record<string, unknown>).map((key) => ({
            [key]: deepClone((obj as Record<string, unknown>)[key], hash)
        }))
    ) as T;
}

/**
 * Performs a 3-way merge of rank definition arrays.
 * @param currentUserRanks The ranks currently in the world (with user changes).
 * @param newFileRanks The ranks from the newly loaded config file.
 * @param lastLoadedRanks The ranks from the config file as of the last load.
 * @returns The merged list of ranks.
 */
export function mergeRanks(
    currentUserRanks: Record<string, unknown>[],
    newFileRanks: Record<string, unknown>[],
    lastLoadedRanks: Record<string, unknown>[]
): Record<string, unknown>[] {
    const safeUserRanks = Array.isArray(currentUserRanks) ? currentUserRanks : [];
    const safeFileRanks = Array.isArray(newFileRanks) ? newFileRanks : [];
    const safeLastRanks = Array.isArray(lastLoadedRanks) ? lastLoadedRanks : [];

    const userMap = new Map(safeUserRanks.map((r) => [r['id'], r]));
    const fileMap = new Map(safeFileRanks.map((r) => [r['id'], r]));
    const lastMap = new Map(safeLastRanks.map((r) => [r['id'], r]));

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
    // Optimization: Create a map for O(1) lookups instead of O(N) findIndex
    const fileRankIndexMap = new Map<unknown, number>();
    for (const [index, r] of newFileRanks.entries()) {
        if (r && r['id']) fileRankIndexMap.set(r['id'], index);
    }

    finalRanks.sort((a, b) => {
        const aId = a['id'];
        const bId = b['id'];

        const aIndex = fileRankIndexMap.has(aId) ? fileRankIndexMap.get(aId)! : -1;
        const bIndex = fileRankIndexMap.has(bId) ? fileRankIndexMap.get(bId)! : -1;

        if (aIndex === -1 || bIndex === -1) {
            return 0;
        }
        return aIndex - bIndex;
    });

    return finalRanks;
}

/**
 * Recursively performs a 3-way merge for configurations that use objects as key-value maps.
 * @param currentUser The current in-game configuration object.
 * @param newFile The configuration object from the newly loaded file.
 * @param lastLoaded The configuration object from the last time the file was loaded.
 * @returns The merged configuration object.
 */
export function mergeObjectMaps(
    currentUser: Record<string, unknown>,
    newFile: Record<string, unknown>,
    lastLoaded: Record<string, unknown>
): Record<string, unknown> {
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
