import { world, system, CustomCommandParamType, CommandPermissionLevel, Player, ItemTypes, ItemStack, EnchantmentTypes } from '@minecraft/server';
import { ModalFormData, ActionFormData, MessageFormData } from '@minecraft/server-ui';

/**
 * Deeply compares two values for equality, handling objects, arrays, dates, and circular references.
 * @param {*} a The first value to compare.
 * @param {*} b The second value to compare.
 * @param {WeakMap} [map=new WeakMap()] Used internally to handle circular references.
 * @returns {boolean} True if the values are deeply equal.
 */
function isDeepEqual(a, b, map = new WeakMap()) {
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
function deepMerge(target, source) {
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
function getValueFromPath(obj, path) {
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
function setValueByPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    if (!lastKey) {
        return;
    }
    const lastObj = keys.reduce((current, key) => (current[key] = current[key] || {}), obj);
    lastObj[lastKey] = value;
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
function mergeWithFileChanges(userSavedConfig, newDefaultConfig, lastLoadedConfig, debugLog, configName) {
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
function deepClone(obj, hash = new WeakMap()) {
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
function mergeRanks(currentUserRanks, newFileRanks, lastLoadedRanks) {
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
function mergeObjectMaps(currentUser, newFile, lastLoaded) {
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

// Log level constants, ordered by verbosity
const LogLevels = {
    ERROR: 0, // Critical errors
    WARN: 1,  // Warnings, potential issues
    INFO: 2,  // General information, status updates
    DEBUG: 3  // Verbose debugging for developers
};

// Default log level
let currentLogLevel = LogLevels.INFO;

/**
 * Sets the current log level for the entire application.
 * Messages below this level will not be logged.
 * @param {number | string} level The log level to set (use LogLevels enum).
 */
function setLogLevel(level) {
    const numericLevel = parseInt(level, 10);
    if (!isNaN(numericLevel) && numericLevel >= LogLevels.ERROR && numericLevel <= LogLevels.DEBUG) {
        currentLogLevel = numericLevel;
        // Provide feedback on the new log level for clarity during startup
        infoLog(`[Logger] Log level set to: ${Object.keys(LogLevels).find(key => LogLevels[key] === numericLevel)}`);
    } else {
        errorLog(`[Logger] Invalid log level provided: '${level}'. Defaulting to INFO.`);
        currentLogLevel = LogLevels.INFO;
    }
}


/**
 * Formats an error object or any value into a readable string.
 * @param {any} error The error or object to format.
 * @returns {string} A string representation of the error.
 */
function formatError(error) {
    if (typeof error === 'object' && error !== null) {
        // If the object has a stack, it's likely an error object.
        if (error.stack) {
            return `\n  Message: ${error.message}\n  Stack: ${error.stack}`;
        }
        try {
            // For other objects, attempt to stringify them.
            return JSON.stringify(error, (key, value) => {
                if (value instanceof Error) {
                    return { message: value.message, stack: value.stack };
                }
                return value;
            }, 2);
        } catch {
            return 'Unserializable object';
        }
    }
    return String(error);
}


/**
 * Logs a debug message to the console if the log level is DEBUG.
 * @param {string} message The message to log.
 */
function debugLog(message) {
    if (currentLogLevel >= LogLevels.DEBUG) {
        // eslint-disable-next-line no-console
        console.log(`[DEBUG] ${message}`);
    }
}

/**
 * Logs an informational message to the console if the log level is INFO or lower.
 * @param {string} message The message to log.
 */
function infoLog(message) {
    if (currentLogLevel >= LogLevels.INFO) {
        // eslint-disable-next-line no-console
        console.info(`[INFO] ${message}`);
    }
}

/**
 * Logs a warning message to the console if the log level is WARN or lower.
 * @param {string} message The message to log.
 */
function warnLog(message) {
    if (currentLogLevel >= LogLevels.WARN) {
        // eslint-disable-next-line no-console
        console.warn(`[WARN] ${message}`);
    }
}


/**
 * Logs an error message to the console. Errors are always logged unless the level is > ERROR.
 * @param {string} message The primary error message.
 * @param {any} [error] Optional error object or additional info to serialize.
 */
function errorLog(message, error) {
    if (currentLogLevel >= LogLevels.ERROR) {
        let fullMessage = `[ERROR] ${message}`;
        if (error !== undefined) {
            fullMessage += `\n  Details: ${formatError(error)}`;
        }
        // eslint-disable-next-line no-console
        console.error(fullMessage);
    }
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var ajv = {exports: {}};

var core$1 = {};

var validate = {};

var boolSchema = {};

var errors = {};

var codegen = {};

var code$1 = {};

var hasRequiredCode$1;

function requireCode$1 () {
	if (hasRequiredCode$1) return code$1;
	hasRequiredCode$1 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
		// eslint-disable-next-line @typescript-eslint/no-extraneous-class
		class _CodeOrName {
		}
		exports._CodeOrName = _CodeOrName;
		exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
		class Name extends _CodeOrName {
		    constructor(s) {
		        super();
		        if (!exports.IDENTIFIER.test(s))
		            throw new Error("CodeGen: name must be a valid identifier");
		        this.str = s;
		    }
		    toString() {
		        return this.str;
		    }
		    emptyStr() {
		        return false;
		    }
		    get names() {
		        return { [this.str]: 1 };
		    }
		}
		exports.Name = Name;
		class _Code extends _CodeOrName {
		    constructor(code) {
		        super();
		        this._items = typeof code === "string" ? [code] : code;
		    }
		    toString() {
		        return this.str;
		    }
		    emptyStr() {
		        if (this._items.length > 1)
		            return false;
		        const item = this._items[0];
		        return item === "" || item === '""';
		    }
		    get str() {
		        var _a;
		        return ((_a = this._str) !== null && _a !== void 0 ? _a : (this._str = this._items.reduce((s, c) => `${s}${c}`, "")));
		    }
		    get names() {
		        var _a;
		        return ((_a = this._names) !== null && _a !== void 0 ? _a : (this._names = this._items.reduce((names, c) => {
		            if (c instanceof Name)
		                names[c.str] = (names[c.str] || 0) + 1;
		            return names;
		        }, {})));
		    }
		}
		exports._Code = _Code;
		exports.nil = new _Code("");
		function _(strs, ...args) {
		    const code = [strs[0]];
		    let i = 0;
		    while (i < args.length) {
		        addCodeArg(code, args[i]);
		        code.push(strs[++i]);
		    }
		    return new _Code(code);
		}
		exports._ = _;
		const plus = new _Code("+");
		function str(strs, ...args) {
		    const expr = [safeStringify(strs[0])];
		    let i = 0;
		    while (i < args.length) {
		        expr.push(plus);
		        addCodeArg(expr, args[i]);
		        expr.push(plus, safeStringify(strs[++i]));
		    }
		    optimize(expr);
		    return new _Code(expr);
		}
		exports.str = str;
		function addCodeArg(code, arg) {
		    if (arg instanceof _Code)
		        code.push(...arg._items);
		    else if (arg instanceof Name)
		        code.push(arg);
		    else
		        code.push(interpolate(arg));
		}
		exports.addCodeArg = addCodeArg;
		function optimize(expr) {
		    let i = 1;
		    while (i < expr.length - 1) {
		        if (expr[i] === plus) {
		            const res = mergeExprItems(expr[i - 1], expr[i + 1]);
		            if (res !== undefined) {
		                expr.splice(i - 1, 3, res);
		                continue;
		            }
		            expr[i++] = "+";
		        }
		        i++;
		    }
		}
		function mergeExprItems(a, b) {
		    if (b === '""')
		        return a;
		    if (a === '""')
		        return b;
		    if (typeof a == "string") {
		        if (b instanceof Name || a[a.length - 1] !== '"')
		            return;
		        if (typeof b != "string")
		            return `${a.slice(0, -1)}${b}"`;
		        if (b[0] === '"')
		            return a.slice(0, -1) + b.slice(1);
		        return;
		    }
		    if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
		        return `"${a}${b.slice(1)}`;
		    return;
		}
		function strConcat(c1, c2) {
		    return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str `${c1}${c2}`;
		}
		exports.strConcat = strConcat;
		// TODO do not allow arrays here
		function interpolate(x) {
		    return typeof x == "number" || typeof x == "boolean" || x === null
		        ? x
		        : safeStringify(Array.isArray(x) ? x.join(",") : x);
		}
		function stringify(x) {
		    return new _Code(safeStringify(x));
		}
		exports.stringify = stringify;
		function safeStringify(x) {
		    return JSON.stringify(x)
		        .replace(/\u2028/g, "\\u2028")
		        .replace(/\u2029/g, "\\u2029");
		}
		exports.safeStringify = safeStringify;
		function getProperty(key) {
		    return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _ `[${key}]`;
		}
		exports.getProperty = getProperty;
		//Does best effort to format the name properly
		function getEsmExportName(key) {
		    if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
		        return new _Code(`${key}`);
		    }
		    throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
		}
		exports.getEsmExportName = getEsmExportName;
		function regexpCode(rx) {
		    return new _Code(rx.toString());
		}
		exports.regexpCode = regexpCode;

	} (code$1));
	return code$1;
}

var scope = {};

var hasRequiredScope;

function requireScope () {
	if (hasRequiredScope) return scope;
	hasRequiredScope = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
		const code_1 = requireCode$1();
		class ValueError extends Error {
		    constructor(name) {
		        super(`CodeGen: "code" for ${name} not defined`);
		        this.value = name.value;
		    }
		}
		var UsedValueState;
		(function (UsedValueState) {
		    UsedValueState[UsedValueState["Started"] = 0] = "Started";
		    UsedValueState[UsedValueState["Completed"] = 1] = "Completed";
		})(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
		exports.varKinds = {
		    const: new code_1.Name("const"),
		    let: new code_1.Name("let"),
		    var: new code_1.Name("var"),
		};
		class Scope {
		    constructor({ prefixes, parent } = {}) {
		        this._names = {};
		        this._prefixes = prefixes;
		        this._parent = parent;
		    }
		    toName(nameOrPrefix) {
		        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
		    }
		    name(prefix) {
		        return new code_1.Name(this._newName(prefix));
		    }
		    _newName(prefix) {
		        const ng = this._names[prefix] || this._nameGroup(prefix);
		        return `${prefix}${ng.index++}`;
		    }
		    _nameGroup(prefix) {
		        var _a, _b;
		        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || (this._prefixes && !this._prefixes.has(prefix))) {
		            throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
		        }
		        return (this._names[prefix] = { prefix, index: 0 });
		    }
		}
		exports.Scope = Scope;
		class ValueScopeName extends code_1.Name {
		    constructor(prefix, nameStr) {
		        super(nameStr);
		        this.prefix = prefix;
		    }
		    setValue(value, { property, itemIndex }) {
		        this.value = value;
		        this.scopePath = (0, code_1._) `.${new code_1.Name(property)}[${itemIndex}]`;
		    }
		}
		exports.ValueScopeName = ValueScopeName;
		const line = (0, code_1._) `\n`;
		class ValueScope extends Scope {
		    constructor(opts) {
		        super(opts);
		        this._values = {};
		        this._scope = opts.scope;
		        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
		    }
		    get() {
		        return this._scope;
		    }
		    name(prefix) {
		        return new ValueScopeName(prefix, this._newName(prefix));
		    }
		    value(nameOrPrefix, value) {
		        var _a;
		        if (value.ref === undefined)
		            throw new Error("CodeGen: ref must be passed in value");
		        const name = this.toName(nameOrPrefix);
		        const { prefix } = name;
		        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
		        let vs = this._values[prefix];
		        if (vs) {
		            const _name = vs.get(valueKey);
		            if (_name)
		                return _name;
		        }
		        else {
		            vs = this._values[prefix] = new Map();
		        }
		        vs.set(valueKey, name);
		        const s = this._scope[prefix] || (this._scope[prefix] = []);
		        const itemIndex = s.length;
		        s[itemIndex] = value.ref;
		        name.setValue(value, { property: prefix, itemIndex });
		        return name;
		    }
		    getValue(prefix, keyOrRef) {
		        const vs = this._values[prefix];
		        if (!vs)
		            return;
		        return vs.get(keyOrRef);
		    }
		    scopeRefs(scopeName, values = this._values) {
		        return this._reduceValues(values, (name) => {
		            if (name.scopePath === undefined)
		                throw new Error(`CodeGen: name "${name}" has no value`);
		            return (0, code_1._) `${scopeName}${name.scopePath}`;
		        });
		    }
		    scopeCode(values = this._values, usedValues, getCode) {
		        return this._reduceValues(values, (name) => {
		            if (name.value === undefined)
		                throw new Error(`CodeGen: name "${name}" has no value`);
		            return name.value.code;
		        }, usedValues, getCode);
		    }
		    _reduceValues(values, valueCode, usedValues = {}, getCode) {
		        let code = code_1.nil;
		        for (const prefix in values) {
		            const vs = values[prefix];
		            if (!vs)
		                continue;
		            const nameSet = (usedValues[prefix] = usedValues[prefix] || new Map());
		            vs.forEach((name) => {
		                if (nameSet.has(name))
		                    return;
		                nameSet.set(name, UsedValueState.Started);
		                let c = valueCode(name);
		                if (c) {
		                    const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
		                    code = (0, code_1._) `${code}${def} ${name} = ${c};${this.opts._n}`;
		                }
		                else if ((c = getCode === null || getCode === void 0 ? void 0 : getCode(name))) {
		                    code = (0, code_1._) `${code}${c}${this.opts._n}`;
		                }
		                else {
		                    throw new ValueError(name);
		                }
		                nameSet.set(name, UsedValueState.Completed);
		            });
		        }
		        return code;
		    }
		}
		exports.ValueScope = ValueScope;

	} (scope));
	return scope;
}

var hasRequiredCodegen;

function requireCodegen () {
	if (hasRequiredCodegen) return codegen;
	hasRequiredCodegen = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
		const code_1 = requireCode$1();
		const scope_1 = requireScope();
		var code_2 = requireCode$1();
		Object.defineProperty(exports, "_", { enumerable: true, get: function () { return code_2._; } });
		Object.defineProperty(exports, "str", { enumerable: true, get: function () { return code_2.str; } });
		Object.defineProperty(exports, "strConcat", { enumerable: true, get: function () { return code_2.strConcat; } });
		Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return code_2.nil; } });
		Object.defineProperty(exports, "getProperty", { enumerable: true, get: function () { return code_2.getProperty; } });
		Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return code_2.stringify; } });
		Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function () { return code_2.regexpCode; } });
		Object.defineProperty(exports, "Name", { enumerable: true, get: function () { return code_2.Name; } });
		var scope_2 = requireScope();
		Object.defineProperty(exports, "Scope", { enumerable: true, get: function () { return scope_2.Scope; } });
		Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function () { return scope_2.ValueScope; } });
		Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function () { return scope_2.ValueScopeName; } });
		Object.defineProperty(exports, "varKinds", { enumerable: true, get: function () { return scope_2.varKinds; } });
		exports.operators = {
		    GT: new code_1._Code(">"),
		    GTE: new code_1._Code(">="),
		    LT: new code_1._Code("<"),
		    LTE: new code_1._Code("<="),
		    EQ: new code_1._Code("==="),
		    NEQ: new code_1._Code("!=="),
		    NOT: new code_1._Code("!"),
		    OR: new code_1._Code("||"),
		    AND: new code_1._Code("&&"),
		    ADD: new code_1._Code("+"),
		};
		class Node {
		    optimizeNodes() {
		        return this;
		    }
		    optimizeNames(_names, _constants) {
		        return this;
		    }
		}
		class Def extends Node {
		    constructor(varKind, name, rhs) {
		        super();
		        this.varKind = varKind;
		        this.name = name;
		        this.rhs = rhs;
		    }
		    render({ es5, _n }) {
		        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
		        const rhs = this.rhs === undefined ? "" : ` = ${this.rhs}`;
		        return `${varKind} ${this.name}${rhs};` + _n;
		    }
		    optimizeNames(names, constants) {
		        if (!names[this.name.str])
		            return;
		        if (this.rhs)
		            this.rhs = optimizeExpr(this.rhs, names, constants);
		        return this;
		    }
		    get names() {
		        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
		    }
		}
		class Assign extends Node {
		    constructor(lhs, rhs, sideEffects) {
		        super();
		        this.lhs = lhs;
		        this.rhs = rhs;
		        this.sideEffects = sideEffects;
		    }
		    render({ _n }) {
		        return `${this.lhs} = ${this.rhs};` + _n;
		    }
		    optimizeNames(names, constants) {
		        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
		            return;
		        this.rhs = optimizeExpr(this.rhs, names, constants);
		        return this;
		    }
		    get names() {
		        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
		        return addExprNames(names, this.rhs);
		    }
		}
		class AssignOp extends Assign {
		    constructor(lhs, op, rhs, sideEffects) {
		        super(lhs, rhs, sideEffects);
		        this.op = op;
		    }
		    render({ _n }) {
		        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
		    }
		}
		class Label extends Node {
		    constructor(label) {
		        super();
		        this.label = label;
		        this.names = {};
		    }
		    render({ _n }) {
		        return `${this.label}:` + _n;
		    }
		}
		class Break extends Node {
		    constructor(label) {
		        super();
		        this.label = label;
		        this.names = {};
		    }
		    render({ _n }) {
		        const label = this.label ? ` ${this.label}` : "";
		        return `break${label};` + _n;
		    }
		}
		class Throw extends Node {
		    constructor(error) {
		        super();
		        this.error = error;
		    }
		    render({ _n }) {
		        return `throw ${this.error};` + _n;
		    }
		    get names() {
		        return this.error.names;
		    }
		}
		class AnyCode extends Node {
		    constructor(code) {
		        super();
		        this.code = code;
		    }
		    render({ _n }) {
		        return `${this.code};` + _n;
		    }
		    optimizeNodes() {
		        return `${this.code}` ? this : undefined;
		    }
		    optimizeNames(names, constants) {
		        this.code = optimizeExpr(this.code, names, constants);
		        return this;
		    }
		    get names() {
		        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
		    }
		}
		class ParentNode extends Node {
		    constructor(nodes = []) {
		        super();
		        this.nodes = nodes;
		    }
		    render(opts) {
		        return this.nodes.reduce((code, n) => code + n.render(opts), "");
		    }
		    optimizeNodes() {
		        const { nodes } = this;
		        let i = nodes.length;
		        while (i--) {
		            const n = nodes[i].optimizeNodes();
		            if (Array.isArray(n))
		                nodes.splice(i, 1, ...n);
		            else if (n)
		                nodes[i] = n;
		            else
		                nodes.splice(i, 1);
		        }
		        return nodes.length > 0 ? this : undefined;
		    }
		    optimizeNames(names, constants) {
		        const { nodes } = this;
		        let i = nodes.length;
		        while (i--) {
		            // iterating backwards improves 1-pass optimization
		            const n = nodes[i];
		            if (n.optimizeNames(names, constants))
		                continue;
		            subtractNames(names, n.names);
		            nodes.splice(i, 1);
		        }
		        return nodes.length > 0 ? this : undefined;
		    }
		    get names() {
		        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
		    }
		}
		class BlockNode extends ParentNode {
		    render(opts) {
		        return "{" + opts._n + super.render(opts) + "}" + opts._n;
		    }
		}
		class Root extends ParentNode {
		}
		class Else extends BlockNode {
		}
		Else.kind = "else";
		class If extends BlockNode {
		    constructor(condition, nodes) {
		        super(nodes);
		        this.condition = condition;
		    }
		    render(opts) {
		        let code = `if(${this.condition})` + super.render(opts);
		        if (this.else)
		            code += "else " + this.else.render(opts);
		        return code;
		    }
		    optimizeNodes() {
		        super.optimizeNodes();
		        const cond = this.condition;
		        if (cond === true)
		            return this.nodes; // else is ignored here
		        let e = this.else;
		        if (e) {
		            const ns = e.optimizeNodes();
		            e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
		        }
		        if (e) {
		            if (cond === false)
		                return e instanceof If ? e : e.nodes;
		            if (this.nodes.length)
		                return this;
		            return new If(not(cond), e instanceof If ? [e] : e.nodes);
		        }
		        if (cond === false || !this.nodes.length)
		            return undefined;
		        return this;
		    }
		    optimizeNames(names, constants) {
		        var _a;
		        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
		        if (!(super.optimizeNames(names, constants) || this.else))
		            return;
		        this.condition = optimizeExpr(this.condition, names, constants);
		        return this;
		    }
		    get names() {
		        const names = super.names;
		        addExprNames(names, this.condition);
		        if (this.else)
		            addNames(names, this.else.names);
		        return names;
		    }
		}
		If.kind = "if";
		class For extends BlockNode {
		}
		For.kind = "for";
		class ForLoop extends For {
		    constructor(iteration) {
		        super();
		        this.iteration = iteration;
		    }
		    render(opts) {
		        return `for(${this.iteration})` + super.render(opts);
		    }
		    optimizeNames(names, constants) {
		        if (!super.optimizeNames(names, constants))
		            return;
		        this.iteration = optimizeExpr(this.iteration, names, constants);
		        return this;
		    }
		    get names() {
		        return addNames(super.names, this.iteration.names);
		    }
		}
		class ForRange extends For {
		    constructor(varKind, name, from, to) {
		        super();
		        this.varKind = varKind;
		        this.name = name;
		        this.from = from;
		        this.to = to;
		    }
		    render(opts) {
		        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
		        const { name, from, to } = this;
		        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
		    }
		    get names() {
		        const names = addExprNames(super.names, this.from);
		        return addExprNames(names, this.to);
		    }
		}
		class ForIter extends For {
		    constructor(loop, varKind, name, iterable) {
		        super();
		        this.loop = loop;
		        this.varKind = varKind;
		        this.name = name;
		        this.iterable = iterable;
		    }
		    render(opts) {
		        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
		    }
		    optimizeNames(names, constants) {
		        if (!super.optimizeNames(names, constants))
		            return;
		        this.iterable = optimizeExpr(this.iterable, names, constants);
		        return this;
		    }
		    get names() {
		        return addNames(super.names, this.iterable.names);
		    }
		}
		class Func extends BlockNode {
		    constructor(name, args, async) {
		        super();
		        this.name = name;
		        this.args = args;
		        this.async = async;
		    }
		    render(opts) {
		        const _async = this.async ? "async " : "";
		        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
		    }
		}
		Func.kind = "func";
		class Return extends ParentNode {
		    render(opts) {
		        return "return " + super.render(opts);
		    }
		}
		Return.kind = "return";
		class Try extends BlockNode {
		    render(opts) {
		        let code = "try" + super.render(opts);
		        if (this.catch)
		            code += this.catch.render(opts);
		        if (this.finally)
		            code += this.finally.render(opts);
		        return code;
		    }
		    optimizeNodes() {
		        var _a, _b;
		        super.optimizeNodes();
		        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
		        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
		        return this;
		    }
		    optimizeNames(names, constants) {
		        var _a, _b;
		        super.optimizeNames(names, constants);
		        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
		        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
		        return this;
		    }
		    get names() {
		        const names = super.names;
		        if (this.catch)
		            addNames(names, this.catch.names);
		        if (this.finally)
		            addNames(names, this.finally.names);
		        return names;
		    }
		}
		class Catch extends BlockNode {
		    constructor(error) {
		        super();
		        this.error = error;
		    }
		    render(opts) {
		        return `catch(${this.error})` + super.render(opts);
		    }
		}
		Catch.kind = "catch";
		class Finally extends BlockNode {
		    render(opts) {
		        return "finally" + super.render(opts);
		    }
		}
		Finally.kind = "finally";
		class CodeGen {
		    constructor(extScope, opts = {}) {
		        this._values = {};
		        this._blockStarts = [];
		        this._constants = {};
		        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
		        this._extScope = extScope;
		        this._scope = new scope_1.Scope({ parent: extScope });
		        this._nodes = [new Root()];
		    }
		    toString() {
		        return this._root.render(this.opts);
		    }
		    // returns unique name in the internal scope
		    name(prefix) {
		        return this._scope.name(prefix);
		    }
		    // reserves unique name in the external scope
		    scopeName(prefix) {
		        return this._extScope.name(prefix);
		    }
		    // reserves unique name in the external scope and assigns value to it
		    scopeValue(prefixOrName, value) {
		        const name = this._extScope.value(prefixOrName, value);
		        const vs = this._values[name.prefix] || (this._values[name.prefix] = new Set());
		        vs.add(name);
		        return name;
		    }
		    getScopeValue(prefix, keyOrRef) {
		        return this._extScope.getValue(prefix, keyOrRef);
		    }
		    // return code that assigns values in the external scope to the names that are used internally
		    // (same names that were returned by gen.scopeName or gen.scopeValue)
		    scopeRefs(scopeName) {
		        return this._extScope.scopeRefs(scopeName, this._values);
		    }
		    scopeCode() {
		        return this._extScope.scopeCode(this._values);
		    }
		    _def(varKind, nameOrPrefix, rhs, constant) {
		        const name = this._scope.toName(nameOrPrefix);
		        if (rhs !== undefined && constant)
		            this._constants[name.str] = rhs;
		        this._leafNode(new Def(varKind, name, rhs));
		        return name;
		    }
		    // `const` declaration (`var` in es5 mode)
		    const(nameOrPrefix, rhs, _constant) {
		        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
		    }
		    // `let` declaration with optional assignment (`var` in es5 mode)
		    let(nameOrPrefix, rhs, _constant) {
		        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
		    }
		    // `var` declaration with optional assignment
		    var(nameOrPrefix, rhs, _constant) {
		        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
		    }
		    // assignment code
		    assign(lhs, rhs, sideEffects) {
		        return this._leafNode(new Assign(lhs, rhs, sideEffects));
		    }
		    // `+=` code
		    add(lhs, rhs) {
		        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
		    }
		    // appends passed SafeExpr to code or executes Block
		    code(c) {
		        if (typeof c == "function")
		            c();
		        else if (c !== code_1.nil)
		            this._leafNode(new AnyCode(c));
		        return this;
		    }
		    // returns code for object literal for the passed argument list of key-value pairs
		    object(...keyValues) {
		        const code = ["{"];
		        for (const [key, value] of keyValues) {
		            if (code.length > 1)
		                code.push(",");
		            code.push(key);
		            if (key !== value || this.opts.es5) {
		                code.push(":");
		                (0, code_1.addCodeArg)(code, value);
		            }
		        }
		        code.push("}");
		        return new code_1._Code(code);
		    }
		    // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
		    if(condition, thenBody, elseBody) {
		        this._blockNode(new If(condition));
		        if (thenBody && elseBody) {
		            this.code(thenBody).else().code(elseBody).endIf();
		        }
		        else if (thenBody) {
		            this.code(thenBody).endIf();
		        }
		        else if (elseBody) {
		            throw new Error('CodeGen: "else" body without "then" body');
		        }
		        return this;
		    }
		    // `else if` clause - invalid without `if` or after `else` clauses
		    elseIf(condition) {
		        return this._elseNode(new If(condition));
		    }
		    // `else` clause - only valid after `if` or `else if` clauses
		    else() {
		        return this._elseNode(new Else());
		    }
		    // end `if` statement (needed if gen.if was used only with condition)
		    endIf() {
		        return this._endBlockNode(If, Else);
		    }
		    _for(node, forBody) {
		        this._blockNode(node);
		        if (forBody)
		            this.code(forBody).endFor();
		        return this;
		    }
		    // a generic `for` clause (or statement if `forBody` is passed)
		    for(iteration, forBody) {
		        return this._for(new ForLoop(iteration), forBody);
		    }
		    // `for` statement for a range of values
		    forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
		        const name = this._scope.toName(nameOrPrefix);
		        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
		    }
		    // `for-of` statement (in es5 mode replace with a normal for loop)
		    forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
		        const name = this._scope.toName(nameOrPrefix);
		        if (this.opts.es5) {
		            const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
		            return this.forRange("_i", 0, (0, code_1._) `${arr}.length`, (i) => {
		                this.var(name, (0, code_1._) `${arr}[${i}]`);
		                forBody(name);
		            });
		        }
		        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
		    }
		    // `for-in` statement.
		    // With option `ownProperties` replaced with a `for-of` loop for object keys
		    forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
		        if (this.opts.ownProperties) {
		            return this.forOf(nameOrPrefix, (0, code_1._) `Object.keys(${obj})`, forBody);
		        }
		        const name = this._scope.toName(nameOrPrefix);
		        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
		    }
		    // end `for` loop
		    endFor() {
		        return this._endBlockNode(For);
		    }
		    // `label` statement
		    label(label) {
		        return this._leafNode(new Label(label));
		    }
		    // `break` statement
		    break(label) {
		        return this._leafNode(new Break(label));
		    }
		    // `return` statement
		    return(value) {
		        const node = new Return();
		        this._blockNode(node);
		        this.code(value);
		        if (node.nodes.length !== 1)
		            throw new Error('CodeGen: "return" should have one node');
		        return this._endBlockNode(Return);
		    }
		    // `try` statement
		    try(tryBody, catchCode, finallyCode) {
		        if (!catchCode && !finallyCode)
		            throw new Error('CodeGen: "try" without "catch" and "finally"');
		        const node = new Try();
		        this._blockNode(node);
		        this.code(tryBody);
		        if (catchCode) {
		            const error = this.name("e");
		            this._currNode = node.catch = new Catch(error);
		            catchCode(error);
		        }
		        if (finallyCode) {
		            this._currNode = node.finally = new Finally();
		            this.code(finallyCode);
		        }
		        return this._endBlockNode(Catch, Finally);
		    }
		    // `throw` statement
		    throw(error) {
		        return this._leafNode(new Throw(error));
		    }
		    // start self-balancing block
		    block(body, nodeCount) {
		        this._blockStarts.push(this._nodes.length);
		        if (body)
		            this.code(body).endBlock(nodeCount);
		        return this;
		    }
		    // end the current self-balancing block
		    endBlock(nodeCount) {
		        const len = this._blockStarts.pop();
		        if (len === undefined)
		            throw new Error("CodeGen: not in self-balancing block");
		        const toClose = this._nodes.length - len;
		        if (toClose < 0 || (nodeCount !== undefined && toClose !== nodeCount)) {
		            throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
		        }
		        this._nodes.length = len;
		        return this;
		    }
		    // `function` heading (or definition if funcBody is passed)
		    func(name, args = code_1.nil, async, funcBody) {
		        this._blockNode(new Func(name, args, async));
		        if (funcBody)
		            this.code(funcBody).endFunc();
		        return this;
		    }
		    // end function definition
		    endFunc() {
		        return this._endBlockNode(Func);
		    }
		    optimize(n = 1) {
		        while (n-- > 0) {
		            this._root.optimizeNodes();
		            this._root.optimizeNames(this._root.names, this._constants);
		        }
		    }
		    _leafNode(node) {
		        this._currNode.nodes.push(node);
		        return this;
		    }
		    _blockNode(node) {
		        this._currNode.nodes.push(node);
		        this._nodes.push(node);
		    }
		    _endBlockNode(N1, N2) {
		        const n = this._currNode;
		        if (n instanceof N1 || (N2 && n instanceof N2)) {
		            this._nodes.pop();
		            return this;
		        }
		        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
		    }
		    _elseNode(node) {
		        const n = this._currNode;
		        if (!(n instanceof If)) {
		            throw new Error('CodeGen: "else" without "if"');
		        }
		        this._currNode = n.else = node;
		        return this;
		    }
		    get _root() {
		        return this._nodes[0];
		    }
		    get _currNode() {
		        const ns = this._nodes;
		        return ns[ns.length - 1];
		    }
		    set _currNode(node) {
		        const ns = this._nodes;
		        ns[ns.length - 1] = node;
		    }
		}
		exports.CodeGen = CodeGen;
		function addNames(names, from) {
		    for (const n in from)
		        names[n] = (names[n] || 0) + (from[n] || 0);
		    return names;
		}
		function addExprNames(names, from) {
		    return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
		}
		function optimizeExpr(expr, names, constants) {
		    if (expr instanceof code_1.Name)
		        return replaceName(expr);
		    if (!canOptimize(expr))
		        return expr;
		    return new code_1._Code(expr._items.reduce((items, c) => {
		        if (c instanceof code_1.Name)
		            c = replaceName(c);
		        if (c instanceof code_1._Code)
		            items.push(...c._items);
		        else
		            items.push(c);
		        return items;
		    }, []));
		    function replaceName(n) {
		        const c = constants[n.str];
		        if (c === undefined || names[n.str] !== 1)
		            return n;
		        delete names[n.str];
		        return c;
		    }
		    function canOptimize(e) {
		        return (e instanceof code_1._Code &&
		            e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== undefined));
		    }
		}
		function subtractNames(names, from) {
		    for (const n in from)
		        names[n] = (names[n] || 0) - (from[n] || 0);
		}
		function not(x) {
		    return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._) `!${par(x)}`;
		}
		exports.not = not;
		const andCode = mappend(exports.operators.AND);
		// boolean AND (&&) expression with the passed arguments
		function and(...args) {
		    return args.reduce(andCode);
		}
		exports.and = and;
		const orCode = mappend(exports.operators.OR);
		// boolean OR (||) expression with the passed arguments
		function or(...args) {
		    return args.reduce(orCode);
		}
		exports.or = or;
		function mappend(op) {
		    return (x, y) => (x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._) `${par(x)} ${op} ${par(y)}`);
		}
		function par(x) {
		    return x instanceof code_1.Name ? x : (0, code_1._) `(${x})`;
		}

	} (codegen));
	return codegen;
}

var util = {};

var hasRequiredUtil;

function requireUtil () {
	if (hasRequiredUtil) return util;
	hasRequiredUtil = 1;
	Object.defineProperty(util, "__esModule", { value: true });
	util.checkStrictMode = util.getErrorPath = util.Type = util.useFunc = util.setEvaluated = util.evaluatedPropsToName = util.mergeEvaluated = util.eachItem = util.unescapeJsonPointer = util.escapeJsonPointer = util.escapeFragment = util.unescapeFragment = util.schemaRefOrVal = util.schemaHasRulesButRef = util.schemaHasRules = util.checkUnknownRules = util.alwaysValidSchema = util.toHash = void 0;
	const codegen_1 = requireCodegen();
	const code_1 = requireCode$1();
	// TODO refactor to use Set
	function toHash(arr) {
	    const hash = {};
	    for (const item of arr)
	        hash[item] = true;
	    return hash;
	}
	util.toHash = toHash;
	function alwaysValidSchema(it, schema) {
	    if (typeof schema == "boolean")
	        return schema;
	    if (Object.keys(schema).length === 0)
	        return true;
	    checkUnknownRules(it, schema);
	    return !schemaHasRules(schema, it.self.RULES.all);
	}
	util.alwaysValidSchema = alwaysValidSchema;
	function checkUnknownRules(it, schema = it.schema) {
	    const { opts, self } = it;
	    if (!opts.strictSchema)
	        return;
	    if (typeof schema === "boolean")
	        return;
	    const rules = self.RULES.keywords;
	    for (const key in schema) {
	        if (!rules[key])
	            checkStrictMode(it, `unknown keyword: "${key}"`);
	    }
	}
	util.checkUnknownRules = checkUnknownRules;
	function schemaHasRules(schema, rules) {
	    if (typeof schema == "boolean")
	        return !schema;
	    for (const key in schema)
	        if (rules[key])
	            return true;
	    return false;
	}
	util.schemaHasRules = schemaHasRules;
	function schemaHasRulesButRef(schema, RULES) {
	    if (typeof schema == "boolean")
	        return !schema;
	    for (const key in schema)
	        if (key !== "$ref" && RULES.all[key])
	            return true;
	    return false;
	}
	util.schemaHasRulesButRef = schemaHasRulesButRef;
	function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
	    if (!$data) {
	        if (typeof schema == "number" || typeof schema == "boolean")
	            return schema;
	        if (typeof schema == "string")
	            return (0, codegen_1._) `${schema}`;
	    }
	    return (0, codegen_1._) `${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
	}
	util.schemaRefOrVal = schemaRefOrVal;
	function unescapeFragment(str) {
	    return unescapeJsonPointer(decodeURIComponent(str));
	}
	util.unescapeFragment = unescapeFragment;
	function escapeFragment(str) {
	    return encodeURIComponent(escapeJsonPointer(str));
	}
	util.escapeFragment = escapeFragment;
	function escapeJsonPointer(str) {
	    if (typeof str == "number")
	        return `${str}`;
	    return str.replace(/~/g, "~0").replace(/\//g, "~1");
	}
	util.escapeJsonPointer = escapeJsonPointer;
	function unescapeJsonPointer(str) {
	    return str.replace(/~1/g, "/").replace(/~0/g, "~");
	}
	util.unescapeJsonPointer = unescapeJsonPointer;
	function eachItem(xs, f) {
	    if (Array.isArray(xs)) {
	        for (const x of xs)
	            f(x);
	    }
	    else {
	        f(xs);
	    }
	}
	util.eachItem = eachItem;
	function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName, }) {
	    return (gen, from, to, toName) => {
	        const res = to === undefined
	            ? from
	            : to instanceof codegen_1.Name
	                ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to)
	                : from instanceof codegen_1.Name
	                    ? (mergeToName(gen, to, from), from)
	                    : mergeValues(from, to);
	        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
	    };
	}
	util.mergeEvaluated = {
	    props: makeMergeEvaluated({
	        mergeNames: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true && ${from} !== undefined`, () => {
	            gen.if((0, codegen_1._) `${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._) `${to} || {}`).code((0, codegen_1._) `Object.assign(${to}, ${from})`));
	        }),
	        mergeToName: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true`, () => {
	            if (from === true) {
	                gen.assign(to, true);
	            }
	            else {
	                gen.assign(to, (0, codegen_1._) `${to} || {}`);
	                setEvaluated(gen, to, from);
	            }
	        }),
	        mergeValues: (from, to) => (from === true ? true : { ...from, ...to }),
	        resultToName: evaluatedPropsToName,
	    }),
	    items: makeMergeEvaluated({
	        mergeNames: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._) `${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
	        mergeToName: (gen, from, to) => gen.if((0, codegen_1._) `${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._) `${to} > ${from} ? ${to} : ${from}`)),
	        mergeValues: (from, to) => (from === true ? true : Math.max(from, to)),
	        resultToName: (gen, items) => gen.var("items", items),
	    }),
	};
	function evaluatedPropsToName(gen, ps) {
	    if (ps === true)
	        return gen.var("props", true);
	    const props = gen.var("props", (0, codegen_1._) `{}`);
	    if (ps !== undefined)
	        setEvaluated(gen, props, ps);
	    return props;
	}
	util.evaluatedPropsToName = evaluatedPropsToName;
	function setEvaluated(gen, props, ps) {
	    Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._) `${props}${(0, codegen_1.getProperty)(p)}`, true));
	}
	util.setEvaluated = setEvaluated;
	const snippets = {};
	function useFunc(gen, f) {
	    return gen.scopeValue("func", {
	        ref: f,
	        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code)),
	    });
	}
	util.useFunc = useFunc;
	var Type;
	(function (Type) {
	    Type[Type["Num"] = 0] = "Num";
	    Type[Type["Str"] = 1] = "Str";
	})(Type || (util.Type = Type = {}));
	function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
	    // let path
	    if (dataProp instanceof codegen_1.Name) {
	        const isNumber = dataPropType === Type.Num;
	        return jsPropertySyntax
	            ? isNumber
	                ? (0, codegen_1._) `"[" + ${dataProp} + "]"`
	                : (0, codegen_1._) `"['" + ${dataProp} + "']"`
	            : isNumber
	                ? (0, codegen_1._) `"/" + ${dataProp}`
	                : (0, codegen_1._) `"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`; // TODO maybe use global escapePointer
	    }
	    return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
	}
	util.getErrorPath = getErrorPath;
	function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
	    if (!mode)
	        return;
	    msg = `strict mode: ${msg}`;
	    if (mode === true)
	        throw new Error(msg);
	    it.self.logger.warn(msg);
	}
	util.checkStrictMode = checkStrictMode;

	return util;
}

var names = {};

var hasRequiredNames;

function requireNames () {
	if (hasRequiredNames) return names;
	hasRequiredNames = 1;
	Object.defineProperty(names, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const names$1 = {
	    // validation function arguments
	    data: new codegen_1.Name("data"), // data passed to validation function
	    // args passed from referencing schema
	    valCxt: new codegen_1.Name("valCxt"), // validation/data context - should not be used directly, it is destructured to the names below
	    instancePath: new codegen_1.Name("instancePath"),
	    parentData: new codegen_1.Name("parentData"),
	    parentDataProperty: new codegen_1.Name("parentDataProperty"),
	    rootData: new codegen_1.Name("rootData"), // root data - same as the data passed to the first/top validation function
	    dynamicAnchors: new codegen_1.Name("dynamicAnchors"), // used to support recursiveRef and dynamicRef
	    // function scoped variables
	    vErrors: new codegen_1.Name("vErrors"), // null or array of validation errors
	    errors: new codegen_1.Name("errors"), // counter of validation errors
	    this: new codegen_1.Name("this"),
	    // "globals"
	    self: new codegen_1.Name("self"),
	    scope: new codegen_1.Name("scope"),
	    // JTD serialize/parse name for JSON string and position
	    json: new codegen_1.Name("json"),
	    jsonPos: new codegen_1.Name("jsonPos"),
	    jsonLen: new codegen_1.Name("jsonLen"),
	    jsonPart: new codegen_1.Name("jsonPart"),
	};
	names.default = names$1;

	return names;
}

var hasRequiredErrors;

function requireErrors () {
	if (hasRequiredErrors) return errors;
	hasRequiredErrors = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
		const codegen_1 = requireCodegen();
		const util_1 = requireUtil();
		const names_1 = requireNames();
		exports.keywordError = {
		    message: ({ keyword }) => (0, codegen_1.str) `must pass "${keyword}" keyword validation`,
		};
		exports.keyword$DataError = {
		    message: ({ keyword, schemaType }) => schemaType
		        ? (0, codegen_1.str) `"${keyword}" keyword must be ${schemaType} ($data)`
		        : (0, codegen_1.str) `"${keyword}" keyword is invalid ($data)`,
		};
		function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
		    const { it } = cxt;
		    const { gen, compositeRule, allErrors } = it;
		    const errObj = errorObjectCode(cxt, error, errorPaths);
		    if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : (compositeRule || allErrors)) {
		        addError(gen, errObj);
		    }
		    else {
		        returnErrors(it, (0, codegen_1._) `[${errObj}]`);
		    }
		}
		exports.reportError = reportError;
		function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
		    const { it } = cxt;
		    const { gen, compositeRule, allErrors } = it;
		    const errObj = errorObjectCode(cxt, error, errorPaths);
		    addError(gen, errObj);
		    if (!(compositeRule || allErrors)) {
		        returnErrors(it, names_1.default.vErrors);
		    }
		}
		exports.reportExtraError = reportExtraError;
		function resetErrorsCount(gen, errsCount) {
		    gen.assign(names_1.default.errors, errsCount);
		    gen.if((0, codegen_1._) `${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._) `${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
		}
		exports.resetErrorsCount = resetErrorsCount;
		function extendErrors({ gen, keyword, schemaValue, data, errsCount, it, }) {
		    /* istanbul ignore if */
		    if (errsCount === undefined)
		        throw new Error("ajv implementation error");
		    const err = gen.name("err");
		    gen.forRange("i", errsCount, names_1.default.errors, (i) => {
		        gen.const(err, (0, codegen_1._) `${names_1.default.vErrors}[${i}]`);
		        gen.if((0, codegen_1._) `${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._) `${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
		        gen.assign((0, codegen_1._) `${err}.schemaPath`, (0, codegen_1.str) `${it.errSchemaPath}/${keyword}`);
		        if (it.opts.verbose) {
		            gen.assign((0, codegen_1._) `${err}.schema`, schemaValue);
		            gen.assign((0, codegen_1._) `${err}.data`, data);
		        }
		    });
		}
		exports.extendErrors = extendErrors;
		function addError(gen, errObj) {
		    const err = gen.const("err", errObj);
		    gen.if((0, codegen_1._) `${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._) `[${err}]`), (0, codegen_1._) `${names_1.default.vErrors}.push(${err})`);
		    gen.code((0, codegen_1._) `${names_1.default.errors}++`);
		}
		function returnErrors(it, errs) {
		    const { gen, validateName, schemaEnv } = it;
		    if (schemaEnv.$async) {
		        gen.throw((0, codegen_1._) `new ${it.ValidationError}(${errs})`);
		    }
		    else {
		        gen.assign((0, codegen_1._) `${validateName}.errors`, errs);
		        gen.return(false);
		    }
		}
		const E = {
		    keyword: new codegen_1.Name("keyword"),
		    schemaPath: new codegen_1.Name("schemaPath"), // also used in JTD errors
		    params: new codegen_1.Name("params"),
		    propertyName: new codegen_1.Name("propertyName"),
		    message: new codegen_1.Name("message"),
		    schema: new codegen_1.Name("schema"),
		    parentSchema: new codegen_1.Name("parentSchema"),
		};
		function errorObjectCode(cxt, error, errorPaths) {
		    const { createErrors } = cxt.it;
		    if (createErrors === false)
		        return (0, codegen_1._) `{}`;
		    return errorObject(cxt, error, errorPaths);
		}
		function errorObject(cxt, error, errorPaths = {}) {
		    const { gen, it } = cxt;
		    const keyValues = [
		        errorInstancePath(it, errorPaths),
		        errorSchemaPath(cxt, errorPaths),
		    ];
		    extraErrorProps(cxt, error, keyValues);
		    return gen.object(...keyValues);
		}
		function errorInstancePath({ errorPath }, { instancePath }) {
		    const instPath = instancePath
		        ? (0, codegen_1.str) `${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}`
		        : errorPath;
		    return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
		}
		function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
		    let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str) `${errSchemaPath}/${keyword}`;
		    if (schemaPath) {
		        schPath = (0, codegen_1.str) `${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
		    }
		    return [E.schemaPath, schPath];
		}
		function extraErrorProps(cxt, { params, message }, keyValues) {
		    const { keyword, data, schemaValue, it } = cxt;
		    const { opts, propertyName, topSchemaRef, schemaPath } = it;
		    keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._) `{}`]);
		    if (opts.messages) {
		        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
		    }
		    if (opts.verbose) {
		        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._) `${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
		    }
		    if (propertyName)
		        keyValues.push([E.propertyName, propertyName]);
		}

	} (errors));
	return errors;
}

var hasRequiredBoolSchema;

function requireBoolSchema () {
	if (hasRequiredBoolSchema) return boolSchema;
	hasRequiredBoolSchema = 1;
	Object.defineProperty(boolSchema, "__esModule", { value: true });
	boolSchema.boolOrEmptySchema = boolSchema.topBoolOrEmptySchema = void 0;
	const errors_1 = requireErrors();
	const codegen_1 = requireCodegen();
	const names_1 = requireNames();
	const boolError = {
	    message: "boolean schema is false",
	};
	function topBoolOrEmptySchema(it) {
	    const { gen, schema, validateName } = it;
	    if (schema === false) {
	        falseSchemaError(it, false);
	    }
	    else if (typeof schema == "object" && schema.$async === true) {
	        gen.return(names_1.default.data);
	    }
	    else {
	        gen.assign((0, codegen_1._) `${validateName}.errors`, null);
	        gen.return(true);
	    }
	}
	boolSchema.topBoolOrEmptySchema = topBoolOrEmptySchema;
	function boolOrEmptySchema(it, valid) {
	    const { gen, schema } = it;
	    if (schema === false) {
	        gen.var(valid, false); // TODO var
	        falseSchemaError(it);
	    }
	    else {
	        gen.var(valid, true); // TODO var
	    }
	}
	boolSchema.boolOrEmptySchema = boolOrEmptySchema;
	function falseSchemaError(it, overrideAllErrors) {
	    const { gen, data } = it;
	    // TODO maybe some other interface should be used for non-keyword validation errors...
	    const cxt = {
	        gen,
	        keyword: "false schema",
	        data,
	        schema: false,
	        schemaCode: false,
	        schemaValue: false,
	        params: {},
	        it,
	    };
	    (0, errors_1.reportError)(cxt, boolError, undefined, overrideAllErrors);
	}

	return boolSchema;
}

var dataType = {};

var rules = {};

var hasRequiredRules;

function requireRules () {
	if (hasRequiredRules) return rules;
	hasRequiredRules = 1;
	Object.defineProperty(rules, "__esModule", { value: true });
	rules.getRules = rules.isJSONType = void 0;
	const _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
	const jsonTypes = new Set(_jsonTypes);
	function isJSONType(x) {
	    return typeof x == "string" && jsonTypes.has(x);
	}
	rules.isJSONType = isJSONType;
	function getRules() {
	    const groups = {
	        number: { type: "number", rules: [] },
	        string: { type: "string", rules: [] },
	        array: { type: "array", rules: [] },
	        object: { type: "object", rules: [] },
	    };
	    return {
	        types: { ...groups, integer: true, boolean: true, null: true },
	        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
	        post: { rules: [] },
	        all: {},
	        keywords: {},
	    };
	}
	rules.getRules = getRules;

	return rules;
}

var applicability = {};

var hasRequiredApplicability;

function requireApplicability () {
	if (hasRequiredApplicability) return applicability;
	hasRequiredApplicability = 1;
	Object.defineProperty(applicability, "__esModule", { value: true });
	applicability.shouldUseRule = applicability.shouldUseGroup = applicability.schemaHasRulesForType = void 0;
	function schemaHasRulesForType({ schema, self }, type) {
	    const group = self.RULES.types[type];
	    return group && group !== true && shouldUseGroup(schema, group);
	}
	applicability.schemaHasRulesForType = schemaHasRulesForType;
	function shouldUseGroup(schema, group) {
	    return group.rules.some((rule) => shouldUseRule(schema, rule));
	}
	applicability.shouldUseGroup = shouldUseGroup;
	function shouldUseRule(schema, rule) {
	    var _a;
	    return (schema[rule.keyword] !== undefined ||
	        ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== undefined)));
	}
	applicability.shouldUseRule = shouldUseRule;

	return applicability;
}

var hasRequiredDataType;

function requireDataType () {
	if (hasRequiredDataType) return dataType;
	hasRequiredDataType = 1;
	Object.defineProperty(dataType, "__esModule", { value: true });
	dataType.reportTypeError = dataType.checkDataTypes = dataType.checkDataType = dataType.coerceAndCheckDataType = dataType.getJSONTypes = dataType.getSchemaTypes = dataType.DataType = void 0;
	const rules_1 = requireRules();
	const applicability_1 = requireApplicability();
	const errors_1 = requireErrors();
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	var DataType;
	(function (DataType) {
	    DataType[DataType["Correct"] = 0] = "Correct";
	    DataType[DataType["Wrong"] = 1] = "Wrong";
	})(DataType || (dataType.DataType = DataType = {}));
	function getSchemaTypes(schema) {
	    const types = getJSONTypes(schema.type);
	    const hasNull = types.includes("null");
	    if (hasNull) {
	        if (schema.nullable === false)
	            throw new Error("type: null contradicts nullable: false");
	    }
	    else {
	        if (!types.length && schema.nullable !== undefined) {
	            throw new Error('"nullable" cannot be used without "type"');
	        }
	        if (schema.nullable === true)
	            types.push("null");
	    }
	    return types;
	}
	dataType.getSchemaTypes = getSchemaTypes;
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	function getJSONTypes(ts) {
	    const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
	    if (types.every(rules_1.isJSONType))
	        return types;
	    throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
	}
	dataType.getJSONTypes = getJSONTypes;
	function coerceAndCheckDataType(it, types) {
	    const { gen, data, opts } = it;
	    const coerceTo = coerceToTypes(types, opts.coerceTypes);
	    const checkTypes = types.length > 0 &&
	        !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
	    if (checkTypes) {
	        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
	        gen.if(wrongType, () => {
	            if (coerceTo.length)
	                coerceData(it, types, coerceTo);
	            else
	                reportTypeError(it);
	        });
	    }
	    return checkTypes;
	}
	dataType.coerceAndCheckDataType = coerceAndCheckDataType;
	const COERCIBLE = new Set(["string", "number", "integer", "boolean", "null"]);
	function coerceToTypes(types, coerceTypes) {
	    return coerceTypes
	        ? types.filter((t) => COERCIBLE.has(t) || (coerceTypes === "array" && t === "array"))
	        : [];
	}
	function coerceData(it, types, coerceTo) {
	    const { gen, data, opts } = it;
	    const dataType = gen.let("dataType", (0, codegen_1._) `typeof ${data}`);
	    const coerced = gen.let("coerced", (0, codegen_1._) `undefined`);
	    if (opts.coerceTypes === "array") {
	        gen.if((0, codegen_1._) `${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen
	            .assign(data, (0, codegen_1._) `${data}[0]`)
	            .assign(dataType, (0, codegen_1._) `typeof ${data}`)
	            .if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
	    }
	    gen.if((0, codegen_1._) `${coerced} !== undefined`);
	    for (const t of coerceTo) {
	        if (COERCIBLE.has(t) || (t === "array" && opts.coerceTypes === "array")) {
	            coerceSpecificType(t);
	        }
	    }
	    gen.else();
	    reportTypeError(it);
	    gen.endIf();
	    gen.if((0, codegen_1._) `${coerced} !== undefined`, () => {
	        gen.assign(data, coerced);
	        assignParentData(it, coerced);
	    });
	    function coerceSpecificType(t) {
	        switch (t) {
	            case "string":
	                gen
	                    .elseIf((0, codegen_1._) `${dataType} == "number" || ${dataType} == "boolean"`)
	                    .assign(coerced, (0, codegen_1._) `"" + ${data}`)
	                    .elseIf((0, codegen_1._) `${data} === null`)
	                    .assign(coerced, (0, codegen_1._) `""`);
	                return;
	            case "number":
	                gen
	                    .elseIf((0, codegen_1._) `${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`)
	                    .assign(coerced, (0, codegen_1._) `+${data}`);
	                return;
	            case "integer":
	                gen
	                    .elseIf((0, codegen_1._) `${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`)
	                    .assign(coerced, (0, codegen_1._) `+${data}`);
	                return;
	            case "boolean":
	                gen
	                    .elseIf((0, codegen_1._) `${data} === "false" || ${data} === 0 || ${data} === null`)
	                    .assign(coerced, false)
	                    .elseIf((0, codegen_1._) `${data} === "true" || ${data} === 1`)
	                    .assign(coerced, true);
	                return;
	            case "null":
	                gen.elseIf((0, codegen_1._) `${data} === "" || ${data} === 0 || ${data} === false`);
	                gen.assign(coerced, null);
	                return;
	            case "array":
	                gen
	                    .elseIf((0, codegen_1._) `${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`)
	                    .assign(coerced, (0, codegen_1._) `[${data}]`);
	        }
	    }
	}
	function assignParentData({ gen, parentData, parentDataProperty }, expr) {
	    // TODO use gen.property
	    gen.if((0, codegen_1._) `${parentData} !== undefined`, () => gen.assign((0, codegen_1._) `${parentData}[${parentDataProperty}]`, expr));
	}
	function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
	    const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
	    let cond;
	    switch (dataType) {
	        case "null":
	            return (0, codegen_1._) `${data} ${EQ} null`;
	        case "array":
	            cond = (0, codegen_1._) `Array.isArray(${data})`;
	            break;
	        case "object":
	            cond = (0, codegen_1._) `${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
	            break;
	        case "integer":
	            cond = numCond((0, codegen_1._) `!(${data} % 1) && !isNaN(${data})`);
	            break;
	        case "number":
	            cond = numCond();
	            break;
	        default:
	            return (0, codegen_1._) `typeof ${data} ${EQ} ${dataType}`;
	    }
	    return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
	    function numCond(_cond = codegen_1.nil) {
	        return (0, codegen_1.and)((0, codegen_1._) `typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._) `isFinite(${data})` : codegen_1.nil);
	    }
	}
	dataType.checkDataType = checkDataType;
	function checkDataTypes(dataTypes, data, strictNums, correct) {
	    if (dataTypes.length === 1) {
	        return checkDataType(dataTypes[0], data, strictNums, correct);
	    }
	    let cond;
	    const types = (0, util_1.toHash)(dataTypes);
	    if (types.array && types.object) {
	        const notObj = (0, codegen_1._) `typeof ${data} != "object"`;
	        cond = types.null ? notObj : (0, codegen_1._) `!${data} || ${notObj}`;
	        delete types.null;
	        delete types.array;
	        delete types.object;
	    }
	    else {
	        cond = codegen_1.nil;
	    }
	    if (types.number)
	        delete types.integer;
	    for (const t in types)
	        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
	    return cond;
	}
	dataType.checkDataTypes = checkDataTypes;
	const typeError = {
	    message: ({ schema }) => `must be ${schema}`,
	    params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._) `{type: ${schema}}` : (0, codegen_1._) `{type: ${schemaValue}}`,
	};
	function reportTypeError(it) {
	    const cxt = getTypeErrorContext(it);
	    (0, errors_1.reportError)(cxt, typeError);
	}
	dataType.reportTypeError = reportTypeError;
	function getTypeErrorContext(it) {
	    const { gen, data, schema } = it;
	    const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
	    return {
	        gen,
	        keyword: "type",
	        data,
	        schema: schema.type,
	        schemaCode,
	        schemaValue: schemaCode,
	        parentSchema: schema,
	        params: {},
	        it,
	    };
	}

	return dataType;
}

var defaults = {};

var hasRequiredDefaults;

function requireDefaults () {
	if (hasRequiredDefaults) return defaults;
	hasRequiredDefaults = 1;
	Object.defineProperty(defaults, "__esModule", { value: true });
	defaults.assignDefaults = void 0;
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	function assignDefaults(it, ty) {
	    const { properties, items } = it.schema;
	    if (ty === "object" && properties) {
	        for (const key in properties) {
	            assignDefault(it, key, properties[key].default);
	        }
	    }
	    else if (ty === "array" && Array.isArray(items)) {
	        items.forEach((sch, i) => assignDefault(it, i, sch.default));
	    }
	}
	defaults.assignDefaults = assignDefaults;
	function assignDefault(it, prop, defaultValue) {
	    const { gen, compositeRule, data, opts } = it;
	    if (defaultValue === undefined)
	        return;
	    const childData = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(prop)}`;
	    if (compositeRule) {
	        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
	        return;
	    }
	    let condition = (0, codegen_1._) `${childData} === undefined`;
	    if (opts.useDefaults === "empty") {
	        condition = (0, codegen_1._) `${condition} || ${childData} === null || ${childData} === ""`;
	    }
	    // `${childData} === undefined` +
	    // (opts.useDefaults === "empty" ? ` || ${childData} === null || ${childData} === ""` : "")
	    gen.if(condition, (0, codegen_1._) `${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
	}

	return defaults;
}

var keyword = {};

var code = {};

var hasRequiredCode;

function requireCode () {
	if (hasRequiredCode) return code;
	hasRequiredCode = 1;
	Object.defineProperty(code, "__esModule", { value: true });
	code.validateUnion = code.validateArray = code.usePattern = code.callValidateCode = code.schemaProperties = code.allSchemaProperties = code.noPropertyInData = code.propertyInData = code.isOwnProperty = code.hasPropFunc = code.reportMissingProp = code.checkMissingProp = code.checkReportMissingProp = void 0;
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const names_1 = requireNames();
	const util_2 = requireUtil();
	function checkReportMissingProp(cxt, prop) {
	    const { gen, data, it } = cxt;
	    gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
	        cxt.setParams({ missingProperty: (0, codegen_1._) `${prop}` }, true);
	        cxt.error();
	    });
	}
	code.checkReportMissingProp = checkReportMissingProp;
	function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
	    return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._) `${missing} = ${prop}`)));
	}
	code.checkMissingProp = checkMissingProp;
	function reportMissingProp(cxt, missing) {
	    cxt.setParams({ missingProperty: missing }, true);
	    cxt.error();
	}
	code.reportMissingProp = reportMissingProp;
	function hasPropFunc(gen) {
	    return gen.scopeValue("func", {
	        // eslint-disable-next-line @typescript-eslint/unbound-method
	        ref: Object.prototype.hasOwnProperty,
	        code: (0, codegen_1._) `Object.prototype.hasOwnProperty`,
	    });
	}
	code.hasPropFunc = hasPropFunc;
	function isOwnProperty(gen, data, property) {
	    return (0, codegen_1._) `${hasPropFunc(gen)}.call(${data}, ${property})`;
	}
	code.isOwnProperty = isOwnProperty;
	function propertyInData(gen, data, property, ownProperties) {
	    const cond = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
	    return ownProperties ? (0, codegen_1._) `${cond} && ${isOwnProperty(gen, data, property)}` : cond;
	}
	code.propertyInData = propertyInData;
	function noPropertyInData(gen, data, property, ownProperties) {
	    const cond = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(property)} === undefined`;
	    return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
	}
	code.noPropertyInData = noPropertyInData;
	function allSchemaProperties(schemaMap) {
	    return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
	}
	code.allSchemaProperties = allSchemaProperties;
	function schemaProperties(it, schemaMap) {
	    return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
	}
	code.schemaProperties = schemaProperties;
	function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
	    const dataAndSchema = passSchema ? (0, codegen_1._) `${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
	    const valCxt = [
	        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
	        [names_1.default.parentData, it.parentData],
	        [names_1.default.parentDataProperty, it.parentDataProperty],
	        [names_1.default.rootData, names_1.default.rootData],
	    ];
	    if (it.opts.dynamicRef)
	        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
	    const args = (0, codegen_1._) `${dataAndSchema}, ${gen.object(...valCxt)}`;
	    return context !== codegen_1.nil ? (0, codegen_1._) `${func}.call(${context}, ${args})` : (0, codegen_1._) `${func}(${args})`;
	}
	code.callValidateCode = callValidateCode;
	const newRegExp = (0, codegen_1._) `new RegExp`;
	function usePattern({ gen, it: { opts } }, pattern) {
	    const u = opts.unicodeRegExp ? "u" : "";
	    const { regExp } = opts.code;
	    const rx = regExp(pattern, u);
	    return gen.scopeValue("pattern", {
	        key: rx.toString(),
	        ref: rx,
	        code: (0, codegen_1._) `${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`,
	    });
	}
	code.usePattern = usePattern;
	function validateArray(cxt) {
	    const { gen, data, keyword, it } = cxt;
	    const valid = gen.name("valid");
	    if (it.allErrors) {
	        const validArr = gen.let("valid", true);
	        validateItems(() => gen.assign(validArr, false));
	        return validArr;
	    }
	    gen.var(valid, true);
	    validateItems(() => gen.break());
	    return valid;
	    function validateItems(notValid) {
	        const len = gen.const("len", (0, codegen_1._) `${data}.length`);
	        gen.forRange("i", 0, len, (i) => {
	            cxt.subschema({
	                keyword,
	                dataProp: i,
	                dataPropType: util_1.Type.Num,
	            }, valid);
	            gen.if((0, codegen_1.not)(valid), notValid);
	        });
	    }
	}
	code.validateArray = validateArray;
	function validateUnion(cxt) {
	    const { gen, schema, keyword, it } = cxt;
	    /* istanbul ignore if */
	    if (!Array.isArray(schema))
	        throw new Error("ajv implementation error");
	    const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
	    if (alwaysValid && !it.opts.unevaluated)
	        return;
	    const valid = gen.let("valid", false);
	    const schValid = gen.name("_valid");
	    gen.block(() => schema.forEach((_sch, i) => {
	        const schCxt = cxt.subschema({
	            keyword,
	            schemaProp: i,
	            compositeRule: true,
	        }, schValid);
	        gen.assign(valid, (0, codegen_1._) `${valid} || ${schValid}`);
	        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
	        // can short-circuit if `unevaluatedProperties/Items` not supported (opts.unevaluated !== true)
	        // or if all properties and items were evaluated (it.props === true && it.items === true)
	        if (!merged)
	            gen.if((0, codegen_1.not)(valid));
	    }));
	    cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
	}
	code.validateUnion = validateUnion;

	return code;
}

var hasRequiredKeyword;

function requireKeyword () {
	if (hasRequiredKeyword) return keyword;
	hasRequiredKeyword = 1;
	Object.defineProperty(keyword, "__esModule", { value: true });
	keyword.validateKeywordUsage = keyword.validSchemaType = keyword.funcKeywordCode = keyword.macroKeywordCode = void 0;
	const codegen_1 = requireCodegen();
	const names_1 = requireNames();
	const code_1 = requireCode();
	const errors_1 = requireErrors();
	function macroKeywordCode(cxt, def) {
	    const { gen, keyword, schema, parentSchema, it } = cxt;
	    const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
	    const schemaRef = useKeyword(gen, keyword, macroSchema);
	    if (it.opts.validateSchema !== false)
	        it.self.validateSchema(macroSchema, true);
	    const valid = gen.name("valid");
	    cxt.subschema({
	        schema: macroSchema,
	        schemaPath: codegen_1.nil,
	        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
	        topSchemaRef: schemaRef,
	        compositeRule: true,
	    }, valid);
	    cxt.pass(valid, () => cxt.error(true));
	}
	keyword.macroKeywordCode = macroKeywordCode;
	function funcKeywordCode(cxt, def) {
	    var _a;
	    const { gen, keyword, schema, parentSchema, $data, it } = cxt;
	    checkAsyncKeyword(it, def);
	    const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
	    const validateRef = useKeyword(gen, keyword, validate);
	    const valid = gen.let("valid");
	    cxt.block$data(valid, validateKeyword);
	    cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
	    function validateKeyword() {
	        if (def.errors === false) {
	            assignValid();
	            if (def.modifying)
	                modifyData(cxt);
	            reportErrs(() => cxt.error());
	        }
	        else {
	            const ruleErrs = def.async ? validateAsync() : validateSync();
	            if (def.modifying)
	                modifyData(cxt);
	            reportErrs(() => addErrs(cxt, ruleErrs));
	        }
	    }
	    function validateAsync() {
	        const ruleErrs = gen.let("ruleErrs", null);
	        gen.try(() => assignValid((0, codegen_1._) `await `), (e) => gen.assign(valid, false).if((0, codegen_1._) `${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._) `${e}.errors`), () => gen.throw(e)));
	        return ruleErrs;
	    }
	    function validateSync() {
	        const validateErrs = (0, codegen_1._) `${validateRef}.errors`;
	        gen.assign(validateErrs, null);
	        assignValid(codegen_1.nil);
	        return validateErrs;
	    }
	    function assignValid(_await = def.async ? (0, codegen_1._) `await ` : codegen_1.nil) {
	        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
	        const passSchema = !(("compile" in def && !$data) || def.schema === false);
	        gen.assign(valid, (0, codegen_1._) `${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
	    }
	    function reportErrs(errors) {
	        var _a;
	        gen.if((0, codegen_1.not)((_a = def.valid) !== null && _a !== void 0 ? _a : valid), errors);
	    }
	}
	keyword.funcKeywordCode = funcKeywordCode;
	function modifyData(cxt) {
	    const { gen, data, it } = cxt;
	    gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._) `${it.parentData}[${it.parentDataProperty}]`));
	}
	function addErrs(cxt, errs) {
	    const { gen } = cxt;
	    gen.if((0, codegen_1._) `Array.isArray(${errs})`, () => {
	        gen
	            .assign(names_1.default.vErrors, (0, codegen_1._) `${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`)
	            .assign(names_1.default.errors, (0, codegen_1._) `${names_1.default.vErrors}.length`);
	        (0, errors_1.extendErrors)(cxt);
	    }, () => cxt.error());
	}
	function checkAsyncKeyword({ schemaEnv }, def) {
	    if (def.async && !schemaEnv.$async)
	        throw new Error("async keyword in sync schema");
	}
	function useKeyword(gen, keyword, result) {
	    if (result === undefined)
	        throw new Error(`keyword "${keyword}" failed to compile`);
	    return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
	}
	function validSchemaType(schema, schemaType, allowUndefined = false) {
	    // TODO add tests
	    return (!schemaType.length ||
	        schemaType.some((st) => st === "array"
	            ? Array.isArray(schema)
	            : st === "object"
	                ? schema && typeof schema == "object" && !Array.isArray(schema)
	                : typeof schema == st || (allowUndefined && typeof schema == "undefined")));
	}
	keyword.validSchemaType = validSchemaType;
	function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
	    /* istanbul ignore if */
	    if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
	        throw new Error("ajv implementation error");
	    }
	    const deps = def.dependencies;
	    if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
	        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
	    }
	    if (def.validateSchema) {
	        const valid = def.validateSchema(schema[keyword]);
	        if (!valid) {
	            const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` +
	                self.errorsText(def.validateSchema.errors);
	            if (opts.validateSchema === "log")
	                self.logger.error(msg);
	            else
	                throw new Error(msg);
	        }
	    }
	}
	keyword.validateKeywordUsage = validateKeywordUsage;

	return keyword;
}

var subschema = {};

var hasRequiredSubschema;

function requireSubschema () {
	if (hasRequiredSubschema) return subschema;
	hasRequiredSubschema = 1;
	Object.defineProperty(subschema, "__esModule", { value: true });
	subschema.extendSubschemaMode = subschema.extendSubschemaData = subschema.getSubschema = void 0;
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
	    if (keyword !== undefined && schema !== undefined) {
	        throw new Error('both "keyword" and "schema" passed, only one allowed');
	    }
	    if (keyword !== undefined) {
	        const sch = it.schema[keyword];
	        return schemaProp === undefined
	            ? {
	                schema: sch,
	                schemaPath: (0, codegen_1._) `${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
	                errSchemaPath: `${it.errSchemaPath}/${keyword}`,
	            }
	            : {
	                schema: sch[schemaProp],
	                schemaPath: (0, codegen_1._) `${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
	                errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`,
	            };
	    }
	    if (schema !== undefined) {
	        if (schemaPath === undefined || errSchemaPath === undefined || topSchemaRef === undefined) {
	            throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
	        }
	        return {
	            schema,
	            schemaPath,
	            topSchemaRef,
	            errSchemaPath,
	        };
	    }
	    throw new Error('either "keyword" or "schema" must be passed');
	}
	subschema.getSubschema = getSubschema;
	function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
	    if (data !== undefined && dataProp !== undefined) {
	        throw new Error('both "data" and "dataProp" passed, only one allowed');
	    }
	    const { gen } = it;
	    if (dataProp !== undefined) {
	        const { errorPath, dataPathArr, opts } = it;
	        const nextData = gen.let("data", (0, codegen_1._) `${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
	        dataContextProps(nextData);
	        subschema.errorPath = (0, codegen_1.str) `${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
	        subschema.parentDataProperty = (0, codegen_1._) `${dataProp}`;
	        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
	    }
	    if (data !== undefined) {
	        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true); // replaceable if used once?
	        dataContextProps(nextData);
	        if (propertyName !== undefined)
	            subschema.propertyName = propertyName;
	        // TODO something is possibly wrong here with not changing parentDataProperty and not appending dataPathArr
	    }
	    if (dataTypes)
	        subschema.dataTypes = dataTypes;
	    function dataContextProps(_nextData) {
	        subschema.data = _nextData;
	        subschema.dataLevel = it.dataLevel + 1;
	        subschema.dataTypes = [];
	        it.definedProperties = new Set();
	        subschema.parentData = it.data;
	        subschema.dataNames = [...it.dataNames, _nextData];
	    }
	}
	subschema.extendSubschemaData = extendSubschemaData;
	function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
	    if (compositeRule !== undefined)
	        subschema.compositeRule = compositeRule;
	    if (createErrors !== undefined)
	        subschema.createErrors = createErrors;
	    if (allErrors !== undefined)
	        subschema.allErrors = allErrors;
	    subschema.jtdDiscriminator = jtdDiscriminator; // not inherited
	    subschema.jtdMetadata = jtdMetadata; // not inherited
	}
	subschema.extendSubschemaMode = extendSubschemaMode;

	return subschema;
}

var resolve = {};

var fastDeepEqual;
var hasRequiredFastDeepEqual;

function requireFastDeepEqual () {
	if (hasRequiredFastDeepEqual) return fastDeepEqual;
	hasRequiredFastDeepEqual = 1;

	// do not edit .js files directly - edit src/index.jst



	fastDeepEqual = function equal(a, b) {
	  if (a === b) return true;

	  if (a && b && typeof a == 'object' && typeof b == 'object') {
	    if (a.constructor !== b.constructor) return false;

	    var length, i, keys;
	    if (Array.isArray(a)) {
	      length = a.length;
	      if (length != b.length) return false;
	      for (i = length; i-- !== 0;)
	        if (!equal(a[i], b[i])) return false;
	      return true;
	    }



	    if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
	    if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
	    if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

	    keys = Object.keys(a);
	    length = keys.length;
	    if (length !== Object.keys(b).length) return false;

	    for (i = length; i-- !== 0;)
	      if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

	    for (i = length; i-- !== 0;) {
	      var key = keys[i];

	      if (!equal(a[key], b[key])) return false;
	    }

	    return true;
	  }

	  // true if both NaN, false otherwise
	  return a!==a && b!==b;
	};
	return fastDeepEqual;
}

var jsonSchemaTraverse = {exports: {}};

var hasRequiredJsonSchemaTraverse;

function requireJsonSchemaTraverse () {
	if (hasRequiredJsonSchemaTraverse) return jsonSchemaTraverse.exports;
	hasRequiredJsonSchemaTraverse = 1;

	var traverse = jsonSchemaTraverse.exports = function (schema, opts, cb) {
	  // Legacy support for v0.3.1 and earlier.
	  if (typeof opts == 'function') {
	    cb = opts;
	    opts = {};
	  }

	  cb = opts.cb || cb;
	  var pre = (typeof cb == 'function') ? cb : cb.pre || function() {};
	  var post = cb.post || function() {};

	  _traverse(opts, pre, post, schema, '', schema);
	};


	traverse.keywords = {
	  additionalItems: true,
	  items: true,
	  contains: true,
	  additionalProperties: true,
	  propertyNames: true,
	  not: true,
	  if: true,
	  then: true,
	  else: true
	};

	traverse.arrayKeywords = {
	  items: true,
	  allOf: true,
	  anyOf: true,
	  oneOf: true
	};

	traverse.propsKeywords = {
	  $defs: true,
	  definitions: true,
	  properties: true,
	  patternProperties: true,
	  dependencies: true
	};

	traverse.skipKeywords = {
	  default: true,
	  enum: true,
	  const: true,
	  required: true,
	  maximum: true,
	  minimum: true,
	  exclusiveMaximum: true,
	  exclusiveMinimum: true,
	  multipleOf: true,
	  maxLength: true,
	  minLength: true,
	  pattern: true,
	  format: true,
	  maxItems: true,
	  minItems: true,
	  uniqueItems: true,
	  maxProperties: true,
	  minProperties: true
	};


	function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
	  if (schema && typeof schema == 'object' && !Array.isArray(schema)) {
	    pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
	    for (var key in schema) {
	      var sch = schema[key];
	      if (Array.isArray(sch)) {
	        if (key in traverse.arrayKeywords) {
	          for (var i=0; i<sch.length; i++)
	            _traverse(opts, pre, post, sch[i], jsonPtr + '/' + key + '/' + i, rootSchema, jsonPtr, key, schema, i);
	        }
	      } else if (key in traverse.propsKeywords) {
	        if (sch && typeof sch == 'object') {
	          for (var prop in sch)
	            _traverse(opts, pre, post, sch[prop], jsonPtr + '/' + key + '/' + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
	        }
	      } else if (key in traverse.keywords || (opts.allKeys && !(key in traverse.skipKeywords))) {
	        _traverse(opts, pre, post, sch, jsonPtr + '/' + key, rootSchema, jsonPtr, key, schema);
	      }
	    }
	    post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
	  }
	}


	function escapeJsonPtr(str) {
	  return str.replace(/~/g, '~0').replace(/\//g, '~1');
	}
	return jsonSchemaTraverse.exports;
}

var hasRequiredResolve;

function requireResolve () {
	if (hasRequiredResolve) return resolve;
	hasRequiredResolve = 1;
	Object.defineProperty(resolve, "__esModule", { value: true });
	resolve.getSchemaRefs = resolve.resolveUrl = resolve.normalizeId = resolve._getFullPath = resolve.getFullPath = resolve.inlineRef = void 0;
	const util_1 = requireUtil();
	const equal = requireFastDeepEqual();
	const traverse = requireJsonSchemaTraverse();
	// TODO refactor to use keyword definitions
	const SIMPLE_INLINED = new Set([
	    "type",
	    "format",
	    "pattern",
	    "maxLength",
	    "minLength",
	    "maxProperties",
	    "minProperties",
	    "maxItems",
	    "minItems",
	    "maximum",
	    "minimum",
	    "uniqueItems",
	    "multipleOf",
	    "required",
	    "enum",
	    "const",
	]);
	function inlineRef(schema, limit = true) {
	    if (typeof schema == "boolean")
	        return true;
	    if (limit === true)
	        return !hasRef(schema);
	    if (!limit)
	        return false;
	    return countKeys(schema) <= limit;
	}
	resolve.inlineRef = inlineRef;
	const REF_KEYWORDS = new Set([
	    "$ref",
	    "$recursiveRef",
	    "$recursiveAnchor",
	    "$dynamicRef",
	    "$dynamicAnchor",
	]);
	function hasRef(schema) {
	    for (const key in schema) {
	        if (REF_KEYWORDS.has(key))
	            return true;
	        const sch = schema[key];
	        if (Array.isArray(sch) && sch.some(hasRef))
	            return true;
	        if (typeof sch == "object" && hasRef(sch))
	            return true;
	    }
	    return false;
	}
	function countKeys(schema) {
	    let count = 0;
	    for (const key in schema) {
	        if (key === "$ref")
	            return Infinity;
	        count++;
	        if (SIMPLE_INLINED.has(key))
	            continue;
	        if (typeof schema[key] == "object") {
	            (0, util_1.eachItem)(schema[key], (sch) => (count += countKeys(sch)));
	        }
	        if (count === Infinity)
	            return Infinity;
	    }
	    return count;
	}
	function getFullPath(resolver, id = "", normalize) {
	    if (normalize !== false)
	        id = normalizeId(id);
	    const p = resolver.parse(id);
	    return _getFullPath(resolver, p);
	}
	resolve.getFullPath = getFullPath;
	function _getFullPath(resolver, p) {
	    const serialized = resolver.serialize(p);
	    return serialized.split("#")[0] + "#";
	}
	resolve._getFullPath = _getFullPath;
	const TRAILING_SLASH_HASH = /#\/?$/;
	function normalizeId(id) {
	    return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
	}
	resolve.normalizeId = normalizeId;
	function resolveUrl(resolver, baseId, id) {
	    id = normalizeId(id);
	    return resolver.resolve(baseId, id);
	}
	resolve.resolveUrl = resolveUrl;
	const ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
	function getSchemaRefs(schema, baseId) {
	    if (typeof schema == "boolean")
	        return {};
	    const { schemaId, uriResolver } = this.opts;
	    const schId = normalizeId(schema[schemaId] || baseId);
	    const baseIds = { "": schId };
	    const pathPrefix = getFullPath(uriResolver, schId, false);
	    const localRefs = {};
	    const schemaRefs = new Set();
	    traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
	        if (parentJsonPtr === undefined)
	            return;
	        const fullPath = pathPrefix + jsonPtr;
	        let innerBaseId = baseIds[parentJsonPtr];
	        if (typeof sch[schemaId] == "string")
	            innerBaseId = addRef.call(this, sch[schemaId]);
	        addAnchor.call(this, sch.$anchor);
	        addAnchor.call(this, sch.$dynamicAnchor);
	        baseIds[jsonPtr] = innerBaseId;
	        function addRef(ref) {
	            // eslint-disable-next-line @typescript-eslint/unbound-method
	            const _resolve = this.opts.uriResolver.resolve;
	            ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
	            if (schemaRefs.has(ref))
	                throw ambiguos(ref);
	            schemaRefs.add(ref);
	            let schOrRef = this.refs[ref];
	            if (typeof schOrRef == "string")
	                schOrRef = this.refs[schOrRef];
	            if (typeof schOrRef == "object") {
	                checkAmbiguosRef(sch, schOrRef.schema, ref);
	            }
	            else if (ref !== normalizeId(fullPath)) {
	                if (ref[0] === "#") {
	                    checkAmbiguosRef(sch, localRefs[ref], ref);
	                    localRefs[ref] = sch;
	                }
	                else {
	                    this.refs[ref] = fullPath;
	                }
	            }
	            return ref;
	        }
	        function addAnchor(anchor) {
	            if (typeof anchor == "string") {
	                if (!ANCHOR.test(anchor))
	                    throw new Error(`invalid anchor "${anchor}"`);
	                addRef.call(this, `#${anchor}`);
	            }
	        }
	    });
	    return localRefs;
	    function checkAmbiguosRef(sch1, sch2, ref) {
	        if (sch2 !== undefined && !equal(sch1, sch2))
	            throw ambiguos(ref);
	    }
	    function ambiguos(ref) {
	        return new Error(`reference "${ref}" resolves to more than one schema`);
	    }
	}
	resolve.getSchemaRefs = getSchemaRefs;

	return resolve;
}

var hasRequiredValidate;

function requireValidate () {
	if (hasRequiredValidate) return validate;
	hasRequiredValidate = 1;
	Object.defineProperty(validate, "__esModule", { value: true });
	validate.getData = validate.KeywordCxt = validate.validateFunctionCode = void 0;
	const boolSchema_1 = requireBoolSchema();
	const dataType_1 = requireDataType();
	const applicability_1 = requireApplicability();
	const dataType_2 = requireDataType();
	const defaults_1 = requireDefaults();
	const keyword_1 = requireKeyword();
	const subschema_1 = requireSubschema();
	const codegen_1 = requireCodegen();
	const names_1 = requireNames();
	const resolve_1 = requireResolve();
	const util_1 = requireUtil();
	const errors_1 = requireErrors();
	// schema compilation - generates validation function, subschemaCode (below) is used for subschemas
	function validateFunctionCode(it) {
	    if (isSchemaObj(it)) {
	        checkKeywords(it);
	        if (schemaCxtHasRules(it)) {
	            topSchemaObjCode(it);
	            return;
	        }
	    }
	    validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
	}
	validate.validateFunctionCode = validateFunctionCode;
	function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
	    if (opts.code.es5) {
	        gen.func(validateName, (0, codegen_1._) `${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
	            gen.code((0, codegen_1._) `"use strict"; ${funcSourceUrl(schema, opts)}`);
	            destructureValCxtES5(gen, opts);
	            gen.code(body);
	        });
	    }
	    else {
	        gen.func(validateName, (0, codegen_1._) `${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
	    }
	}
	function destructureValCxt(opts) {
	    return (0, codegen_1._) `{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._) `, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
	}
	function destructureValCxtES5(gen, opts) {
	    gen.if(names_1.default.valCxt, () => {
	        gen.var(names_1.default.instancePath, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.instancePath}`);
	        gen.var(names_1.default.parentData, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.parentData}`);
	        gen.var(names_1.default.parentDataProperty, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
	        gen.var(names_1.default.rootData, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.rootData}`);
	        if (opts.dynamicRef)
	            gen.var(names_1.default.dynamicAnchors, (0, codegen_1._) `${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
	    }, () => {
	        gen.var(names_1.default.instancePath, (0, codegen_1._) `""`);
	        gen.var(names_1.default.parentData, (0, codegen_1._) `undefined`);
	        gen.var(names_1.default.parentDataProperty, (0, codegen_1._) `undefined`);
	        gen.var(names_1.default.rootData, names_1.default.data);
	        if (opts.dynamicRef)
	            gen.var(names_1.default.dynamicAnchors, (0, codegen_1._) `{}`);
	    });
	}
	function topSchemaObjCode(it) {
	    const { schema, opts, gen } = it;
	    validateFunction(it, () => {
	        if (opts.$comment && schema.$comment)
	            commentKeyword(it);
	        checkNoDefault(it);
	        gen.let(names_1.default.vErrors, null);
	        gen.let(names_1.default.errors, 0);
	        if (opts.unevaluated)
	            resetEvaluated(it);
	        typeAndKeywords(it);
	        returnResults(it);
	    });
	    return;
	}
	function resetEvaluated(it) {
	    // TODO maybe some hook to execute it in the end to check whether props/items are Name, as in assignEvaluated
	    const { gen, validateName } = it;
	    it.evaluated = gen.const("evaluated", (0, codegen_1._) `${validateName}.evaluated`);
	    gen.if((0, codegen_1._) `${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._) `${it.evaluated}.props`, (0, codegen_1._) `undefined`));
	    gen.if((0, codegen_1._) `${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._) `${it.evaluated}.items`, (0, codegen_1._) `undefined`));
	}
	function funcSourceUrl(schema, opts) {
	    const schId = typeof schema == "object" && schema[opts.schemaId];
	    return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._) `/*# sourceURL=${schId} */` : codegen_1.nil;
	}
	// schema compilation - this function is used recursively to generate code for sub-schemas
	function subschemaCode(it, valid) {
	    if (isSchemaObj(it)) {
	        checkKeywords(it);
	        if (schemaCxtHasRules(it)) {
	            subSchemaObjCode(it, valid);
	            return;
	        }
	    }
	    (0, boolSchema_1.boolOrEmptySchema)(it, valid);
	}
	function schemaCxtHasRules({ schema, self }) {
	    if (typeof schema == "boolean")
	        return !schema;
	    for (const key in schema)
	        if (self.RULES.all[key])
	            return true;
	    return false;
	}
	function isSchemaObj(it) {
	    return typeof it.schema != "boolean";
	}
	function subSchemaObjCode(it, valid) {
	    const { schema, gen, opts } = it;
	    if (opts.$comment && schema.$comment)
	        commentKeyword(it);
	    updateContext(it);
	    checkAsyncSchema(it);
	    const errsCount = gen.const("_errs", names_1.default.errors);
	    typeAndKeywords(it, errsCount);
	    // TODO var
	    gen.var(valid, (0, codegen_1._) `${errsCount} === ${names_1.default.errors}`);
	}
	function checkKeywords(it) {
	    (0, util_1.checkUnknownRules)(it);
	    checkRefsAndKeywords(it);
	}
	function typeAndKeywords(it, errsCount) {
	    if (it.opts.jtd)
	        return schemaKeywords(it, [], false, errsCount);
	    const types = (0, dataType_1.getSchemaTypes)(it.schema);
	    const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
	    schemaKeywords(it, types, !checkedTypes, errsCount);
	}
	function checkRefsAndKeywords(it) {
	    const { schema, errSchemaPath, opts, self } = it;
	    if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
	        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
	    }
	}
	function checkNoDefault(it) {
	    const { schema, opts } = it;
	    if (schema.default !== undefined && opts.useDefaults && opts.strictSchema) {
	        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
	    }
	}
	function updateContext(it) {
	    const schId = it.schema[it.opts.schemaId];
	    if (schId)
	        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
	}
	function checkAsyncSchema(it) {
	    if (it.schema.$async && !it.schemaEnv.$async)
	        throw new Error("async schema in sync schema");
	}
	function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
	    const msg = schema.$comment;
	    if (opts.$comment === true) {
	        gen.code((0, codegen_1._) `${names_1.default.self}.logger.log(${msg})`);
	    }
	    else if (typeof opts.$comment == "function") {
	        const schemaPath = (0, codegen_1.str) `${errSchemaPath}/$comment`;
	        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
	        gen.code((0, codegen_1._) `${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
	    }
	}
	function returnResults(it) {
	    const { gen, schemaEnv, validateName, ValidationError, opts } = it;
	    if (schemaEnv.$async) {
	        // TODO assign unevaluated
	        gen.if((0, codegen_1._) `${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._) `new ${ValidationError}(${names_1.default.vErrors})`));
	    }
	    else {
	        gen.assign((0, codegen_1._) `${validateName}.errors`, names_1.default.vErrors);
	        if (opts.unevaluated)
	            assignEvaluated(it);
	        gen.return((0, codegen_1._) `${names_1.default.errors} === 0`);
	    }
	}
	function assignEvaluated({ gen, evaluated, props, items }) {
	    if (props instanceof codegen_1.Name)
	        gen.assign((0, codegen_1._) `${evaluated}.props`, props);
	    if (items instanceof codegen_1.Name)
	        gen.assign((0, codegen_1._) `${evaluated}.items`, items);
	}
	function schemaKeywords(it, types, typeErrors, errsCount) {
	    const { gen, schema, data, allErrors, opts, self } = it;
	    const { RULES } = self;
	    if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
	        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition)); // TODO typecast
	        return;
	    }
	    if (!opts.jtd)
	        checkStrictTypes(it, types);
	    gen.block(() => {
	        for (const group of RULES.rules)
	            groupKeywords(group);
	        groupKeywords(RULES.post);
	    });
	    function groupKeywords(group) {
	        if (!(0, applicability_1.shouldUseGroup)(schema, group))
	            return;
	        if (group.type) {
	            gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
	            iterateKeywords(it, group);
	            if (types.length === 1 && types[0] === group.type && typeErrors) {
	                gen.else();
	                (0, dataType_2.reportTypeError)(it);
	            }
	            gen.endIf();
	        }
	        else {
	            iterateKeywords(it, group);
	        }
	        // TODO make it "ok" call?
	        if (!allErrors)
	            gen.if((0, codegen_1._) `${names_1.default.errors} === ${errsCount || 0}`);
	    }
	}
	function iterateKeywords(it, group) {
	    const { gen, schema, opts: { useDefaults }, } = it;
	    if (useDefaults)
	        (0, defaults_1.assignDefaults)(it, group.type);
	    gen.block(() => {
	        for (const rule of group.rules) {
	            if ((0, applicability_1.shouldUseRule)(schema, rule)) {
	                keywordCode(it, rule.keyword, rule.definition, group.type);
	            }
	        }
	    });
	}
	function checkStrictTypes(it, types) {
	    if (it.schemaEnv.meta || !it.opts.strictTypes)
	        return;
	    checkContextTypes(it, types);
	    if (!it.opts.allowUnionTypes)
	        checkMultipleTypes(it, types);
	    checkKeywordTypes(it, it.dataTypes);
	}
	function checkContextTypes(it, types) {
	    if (!types.length)
	        return;
	    if (!it.dataTypes.length) {
	        it.dataTypes = types;
	        return;
	    }
	    types.forEach((t) => {
	        if (!includesType(it.dataTypes, t)) {
	            strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
	        }
	    });
	    narrowSchemaTypes(it, types);
	}
	function checkMultipleTypes(it, ts) {
	    if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
	        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
	    }
	}
	function checkKeywordTypes(it, ts) {
	    const rules = it.self.RULES.all;
	    for (const keyword in rules) {
	        const rule = rules[keyword];
	        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
	            const { type } = rule.definition;
	            if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
	                strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
	            }
	        }
	    }
	}
	function hasApplicableType(schTs, kwdT) {
	    return schTs.includes(kwdT) || (kwdT === "number" && schTs.includes("integer"));
	}
	function includesType(ts, t) {
	    return ts.includes(t) || (t === "integer" && ts.includes("number"));
	}
	function narrowSchemaTypes(it, withTypes) {
	    const ts = [];
	    for (const t of it.dataTypes) {
	        if (includesType(withTypes, t))
	            ts.push(t);
	        else if (withTypes.includes("integer") && t === "number")
	            ts.push("integer");
	    }
	    it.dataTypes = ts;
	}
	function strictTypesError(it, msg) {
	    const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
	    msg += ` at "${schemaPath}" (strictTypes)`;
	    (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
	}
	class KeywordCxt {
	    constructor(it, def, keyword) {
	        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
	        this.gen = it.gen;
	        this.allErrors = it.allErrors;
	        this.keyword = keyword;
	        this.data = it.data;
	        this.schema = it.schema[keyword];
	        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
	        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
	        this.schemaType = def.schemaType;
	        this.parentSchema = it.schema;
	        this.params = {};
	        this.it = it;
	        this.def = def;
	        if (this.$data) {
	            this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
	        }
	        else {
	            this.schemaCode = this.schemaValue;
	            if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
	                throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
	            }
	        }
	        if ("code" in def ? def.trackErrors : def.errors !== false) {
	            this.errsCount = it.gen.const("_errs", names_1.default.errors);
	        }
	    }
	    result(condition, successAction, failAction) {
	        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
	    }
	    failResult(condition, successAction, failAction) {
	        this.gen.if(condition);
	        if (failAction)
	            failAction();
	        else
	            this.error();
	        if (successAction) {
	            this.gen.else();
	            successAction();
	            if (this.allErrors)
	                this.gen.endIf();
	        }
	        else {
	            if (this.allErrors)
	                this.gen.endIf();
	            else
	                this.gen.else();
	        }
	    }
	    pass(condition, failAction) {
	        this.failResult((0, codegen_1.not)(condition), undefined, failAction);
	    }
	    fail(condition) {
	        if (condition === undefined) {
	            this.error();
	            if (!this.allErrors)
	                this.gen.if(false); // this branch will be removed by gen.optimize
	            return;
	        }
	        this.gen.if(condition);
	        this.error();
	        if (this.allErrors)
	            this.gen.endIf();
	        else
	            this.gen.else();
	    }
	    fail$data(condition) {
	        if (!this.$data)
	            return this.fail(condition);
	        const { schemaCode } = this;
	        this.fail((0, codegen_1._) `${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
	    }
	    error(append, errorParams, errorPaths) {
	        if (errorParams) {
	            this.setParams(errorParams);
	            this._error(append, errorPaths);
	            this.setParams({});
	            return;
	        }
	        this._error(append, errorPaths);
	    }
	    _error(append, errorPaths) {
	        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
	    }
	    $dataError() {
	        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
	    }
	    reset() {
	        if (this.errsCount === undefined)
	            throw new Error('add "trackErrors" to keyword definition');
	        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
	    }
	    ok(cond) {
	        if (!this.allErrors)
	            this.gen.if(cond);
	    }
	    setParams(obj, assign) {
	        if (assign)
	            Object.assign(this.params, obj);
	        else
	            this.params = obj;
	    }
	    block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
	        this.gen.block(() => {
	            this.check$data(valid, $dataValid);
	            codeBlock();
	        });
	    }
	    check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
	        if (!this.$data)
	            return;
	        const { gen, schemaCode, schemaType, def } = this;
	        gen.if((0, codegen_1.or)((0, codegen_1._) `${schemaCode} === undefined`, $dataValid));
	        if (valid !== codegen_1.nil)
	            gen.assign(valid, true);
	        if (schemaType.length || def.validateSchema) {
	            gen.elseIf(this.invalid$data());
	            this.$dataError();
	            if (valid !== codegen_1.nil)
	                gen.assign(valid, false);
	        }
	        gen.else();
	    }
	    invalid$data() {
	        const { gen, schemaCode, schemaType, def, it } = this;
	        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
	        function wrong$DataType() {
	            if (schemaType.length) {
	                /* istanbul ignore if */
	                if (!(schemaCode instanceof codegen_1.Name))
	                    throw new Error("ajv implementation error");
	                const st = Array.isArray(schemaType) ? schemaType : [schemaType];
	                return (0, codegen_1._) `${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
	            }
	            return codegen_1.nil;
	        }
	        function invalid$DataSchema() {
	            if (def.validateSchema) {
	                const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema }); // TODO value.code for standalone
	                return (0, codegen_1._) `!${validateSchemaRef}(${schemaCode})`;
	            }
	            return codegen_1.nil;
	        }
	    }
	    subschema(appl, valid) {
	        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
	        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
	        (0, subschema_1.extendSubschemaMode)(subschema, appl);
	        const nextContext = { ...this.it, ...subschema, items: undefined, props: undefined };
	        subschemaCode(nextContext, valid);
	        return nextContext;
	    }
	    mergeEvaluated(schemaCxt, toName) {
	        const { it, gen } = this;
	        if (!it.opts.unevaluated)
	            return;
	        if (it.props !== true && schemaCxt.props !== undefined) {
	            it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
	        }
	        if (it.items !== true && schemaCxt.items !== undefined) {
	            it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
	        }
	    }
	    mergeValidEvaluated(schemaCxt, valid) {
	        const { it, gen } = this;
	        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
	            gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
	            return true;
	        }
	    }
	}
	validate.KeywordCxt = KeywordCxt;
	function keywordCode(it, keyword, def, ruleType) {
	    const cxt = new KeywordCxt(it, def, keyword);
	    if ("code" in def) {
	        def.code(cxt, ruleType);
	    }
	    else if (cxt.$data && def.validate) {
	        (0, keyword_1.funcKeywordCode)(cxt, def);
	    }
	    else if ("macro" in def) {
	        (0, keyword_1.macroKeywordCode)(cxt, def);
	    }
	    else if (def.compile || def.validate) {
	        (0, keyword_1.funcKeywordCode)(cxt, def);
	    }
	}
	const JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
	const RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
	function getData($data, { dataLevel, dataNames, dataPathArr }) {
	    let jsonPointer;
	    let data;
	    if ($data === "")
	        return names_1.default.rootData;
	    if ($data[0] === "/") {
	        if (!JSON_POINTER.test($data))
	            throw new Error(`Invalid JSON-pointer: ${$data}`);
	        jsonPointer = $data;
	        data = names_1.default.rootData;
	    }
	    else {
	        const matches = RELATIVE_JSON_POINTER.exec($data);
	        if (!matches)
	            throw new Error(`Invalid JSON-pointer: ${$data}`);
	        const up = +matches[1];
	        jsonPointer = matches[2];
	        if (jsonPointer === "#") {
	            if (up >= dataLevel)
	                throw new Error(errorMsg("property/index", up));
	            return dataPathArr[dataLevel - up];
	        }
	        if (up > dataLevel)
	            throw new Error(errorMsg("data", up));
	        data = dataNames[dataLevel - up];
	        if (!jsonPointer)
	            return data;
	    }
	    let expr = data;
	    const segments = jsonPointer.split("/");
	    for (const segment of segments) {
	        if (segment) {
	            data = (0, codegen_1._) `${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
	            expr = (0, codegen_1._) `${expr} && ${data}`;
	        }
	    }
	    return expr;
	    function errorMsg(pointerType, up) {
	        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
	    }
	}
	validate.getData = getData;

	return validate;
}

var validation_error = {};

var hasRequiredValidation_error;

function requireValidation_error () {
	if (hasRequiredValidation_error) return validation_error;
	hasRequiredValidation_error = 1;
	Object.defineProperty(validation_error, "__esModule", { value: true });
	class ValidationError extends Error {
	    constructor(errors) {
	        super("validation failed");
	        this.errors = errors;
	        this.ajv = this.validation = true;
	    }
	}
	validation_error.default = ValidationError;

	return validation_error;
}

var ref_error = {};

var hasRequiredRef_error;

function requireRef_error () {
	if (hasRequiredRef_error) return ref_error;
	hasRequiredRef_error = 1;
	Object.defineProperty(ref_error, "__esModule", { value: true });
	const resolve_1 = requireResolve();
	class MissingRefError extends Error {
	    constructor(resolver, baseId, ref, msg) {
	        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
	        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
	        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
	    }
	}
	ref_error.default = MissingRefError;

	return ref_error;
}

var compile = {};

var hasRequiredCompile;

function requireCompile () {
	if (hasRequiredCompile) return compile;
	hasRequiredCompile = 1;
	Object.defineProperty(compile, "__esModule", { value: true });
	compile.resolveSchema = compile.getCompilingSchema = compile.resolveRef = compile.compileSchema = compile.SchemaEnv = void 0;
	const codegen_1 = requireCodegen();
	const validation_error_1 = requireValidation_error();
	const names_1 = requireNames();
	const resolve_1 = requireResolve();
	const util_1 = requireUtil();
	const validate_1 = requireValidate();
	class SchemaEnv {
	    constructor(env) {
	        var _a;
	        this.refs = {};
	        this.dynamicAnchors = {};
	        let schema;
	        if (typeof env.schema == "object")
	            schema = env.schema;
	        this.schema = env.schema;
	        this.schemaId = env.schemaId;
	        this.root = env.root || this;
	        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
	        this.schemaPath = env.schemaPath;
	        this.localRefs = env.localRefs;
	        this.meta = env.meta;
	        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
	        this.refs = {};
	    }
	}
	compile.SchemaEnv = SchemaEnv;
	// let codeSize = 0
	// let nodeCount = 0
	// Compiles schema in SchemaEnv
	function compileSchema(sch) {
	    // TODO refactor - remove compilations
	    const _sch = getCompilingSchema.call(this, sch);
	    if (_sch)
	        return _sch;
	    const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId); // TODO if getFullPath removed 1 tests fails
	    const { es5, lines } = this.opts.code;
	    const { ownProperties } = this.opts;
	    const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
	    let _ValidationError;
	    if (sch.$async) {
	        _ValidationError = gen.scopeValue("Error", {
	            ref: validation_error_1.default,
	            code: (0, codegen_1._) `require("ajv/dist/runtime/validation_error").default`,
	        });
	    }
	    const validateName = gen.scopeName("validate");
	    sch.validateName = validateName;
	    const schemaCxt = {
	        gen,
	        allErrors: this.opts.allErrors,
	        data: names_1.default.data,
	        parentData: names_1.default.parentData,
	        parentDataProperty: names_1.default.parentDataProperty,
	        dataNames: [names_1.default.data],
	        dataPathArr: [codegen_1.nil], // TODO can its length be used as dataLevel if nil is removed?
	        dataLevel: 0,
	        dataTypes: [],
	        definedProperties: new Set(),
	        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true
	            ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) }
	            : { ref: sch.schema }),
	        validateName,
	        ValidationError: _ValidationError,
	        schema: sch.schema,
	        schemaEnv: sch,
	        rootId,
	        baseId: sch.baseId || rootId,
	        schemaPath: codegen_1.nil,
	        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
	        errorPath: (0, codegen_1._) `""`,
	        opts: this.opts,
	        self: this,
	    };
	    let sourceCode;
	    try {
	        this._compilations.add(sch);
	        (0, validate_1.validateFunctionCode)(schemaCxt);
	        gen.optimize(this.opts.code.optimize);
	        // gen.optimize(1)
	        const validateCode = gen.toString();
	        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
	        // console.log((codeSize += sourceCode.length), (nodeCount += gen.nodeCount))
	        if (this.opts.code.process)
	            sourceCode = this.opts.code.process(sourceCode, sch);
	        // console.log("\n\n\n *** \n", sourceCode)
	        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
	        const validate = makeValidate(this, this.scope.get());
	        this.scope.value(validateName, { ref: validate });
	        validate.errors = null;
	        validate.schema = sch.schema;
	        validate.schemaEnv = sch;
	        if (sch.$async)
	            validate.$async = true;
	        if (this.opts.code.source === true) {
	            validate.source = { validateName, validateCode, scopeValues: gen._values };
	        }
	        if (this.opts.unevaluated) {
	            const { props, items } = schemaCxt;
	            validate.evaluated = {
	                props: props instanceof codegen_1.Name ? undefined : props,
	                items: items instanceof codegen_1.Name ? undefined : items,
	                dynamicProps: props instanceof codegen_1.Name,
	                dynamicItems: items instanceof codegen_1.Name,
	            };
	            if (validate.source)
	                validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
	        }
	        sch.validate = validate;
	        return sch;
	    }
	    catch (e) {
	        delete sch.validate;
	        delete sch.validateName;
	        if (sourceCode)
	            this.logger.error("Error compiling schema, function code:", sourceCode);
	        // console.log("\n\n\n *** \n", sourceCode, this.opts)
	        throw e;
	    }
	    finally {
	        this._compilations.delete(sch);
	    }
	}
	compile.compileSchema = compileSchema;
	function resolveRef(root, baseId, ref) {
	    var _a;
	    ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
	    const schOrFunc = root.refs[ref];
	    if (schOrFunc)
	        return schOrFunc;
	    let _sch = resolve.call(this, root, ref);
	    if (_sch === undefined) {
	        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref]; // TODO maybe localRefs should hold SchemaEnv
	        const { schemaId } = this.opts;
	        if (schema)
	            _sch = new SchemaEnv({ schema, schemaId, root, baseId });
	    }
	    if (_sch === undefined)
	        return;
	    return (root.refs[ref] = inlineOrCompile.call(this, _sch));
	}
	compile.resolveRef = resolveRef;
	function inlineOrCompile(sch) {
	    if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
	        return sch.schema;
	    return sch.validate ? sch : compileSchema.call(this, sch);
	}
	// Index of schema compilation in the currently compiled list
	function getCompilingSchema(schEnv) {
	    for (const sch of this._compilations) {
	        if (sameSchemaEnv(sch, schEnv))
	            return sch;
	    }
	}
	compile.getCompilingSchema = getCompilingSchema;
	function sameSchemaEnv(s1, s2) {
	    return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
	}
	// resolve and compile the references ($ref)
	// TODO returns AnySchemaObject (if the schema can be inlined) or validation function
	function resolve(root, // information about the root schema for the current schema
	ref // reference to resolve
	) {
	    let sch;
	    while (typeof (sch = this.refs[ref]) == "string")
	        ref = sch;
	    return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
	}
	// Resolve schema, its root and baseId
	function resolveSchema(root, // root object with properties schema, refs TODO below SchemaEnv is assigned to it
	ref // reference to resolve
	) {
	    const p = this.opts.uriResolver.parse(ref);
	    const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
	    let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, undefined);
	    // TODO `Object.keys(root.schema).length > 0` should not be needed - but removing breaks 2 tests
	    if (Object.keys(root.schema).length > 0 && refPath === baseId) {
	        return getJsonPointer.call(this, p, root);
	    }
	    const id = (0, resolve_1.normalizeId)(refPath);
	    const schOrRef = this.refs[id] || this.schemas[id];
	    if (typeof schOrRef == "string") {
	        const sch = resolveSchema.call(this, root, schOrRef);
	        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
	            return;
	        return getJsonPointer.call(this, p, sch);
	    }
	    if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
	        return;
	    if (!schOrRef.validate)
	        compileSchema.call(this, schOrRef);
	    if (id === (0, resolve_1.normalizeId)(ref)) {
	        const { schema } = schOrRef;
	        const { schemaId } = this.opts;
	        const schId = schema[schemaId];
	        if (schId)
	            baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
	        return new SchemaEnv({ schema, schemaId, root, baseId });
	    }
	    return getJsonPointer.call(this, p, schOrRef);
	}
	compile.resolveSchema = resolveSchema;
	const PREVENT_SCOPE_CHANGE = new Set([
	    "properties",
	    "patternProperties",
	    "enum",
	    "dependencies",
	    "definitions",
	]);
	function getJsonPointer(parsedRef, { baseId, schema, root }) {
	    var _a;
	    if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
	        return;
	    for (const part of parsedRef.fragment.slice(1).split("/")) {
	        if (typeof schema === "boolean")
	            return;
	        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
	        if (partSchema === undefined)
	            return;
	        schema = partSchema;
	        // TODO PREVENT_SCOPE_CHANGE could be defined in keyword def?
	        const schId = typeof schema === "object" && schema[this.opts.schemaId];
	        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
	            baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
	        }
	    }
	    let env;
	    if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
	        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
	        env = resolveSchema.call(this, root, $ref);
	    }
	    // even though resolution failed we need to return SchemaEnv to throw exception
	    // so that compileAsync loads missing schema.
	    const { schemaId } = this.opts;
	    env = env || new SchemaEnv({ schema, schemaId, root, baseId });
	    if (env.schema !== env.root.schema)
	        return env;
	    return undefined;
	}

	return compile;
}

var $id$1 = "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#";
var description$1 = "Meta-schema for $data reference (JSON AnySchema extension proposal)";
var type$2 = "object";
var required$2 = [
	"$data"
];
var properties$3 = {
	$data: {
		type: "string",
		anyOf: [
			{
				format: "relative-json-pointer"
			},
			{
				format: "json-pointer"
			}
		]
	}
};
var additionalProperties$1 = false;
var require$$9 = {
	$id: $id$1,
	description: description$1,
	type: type$2,
	required: required$2,
	properties: properties$3,
	additionalProperties: additionalProperties$1
};

var uri = {};

var fastUri = {exports: {}};

var utils;
var hasRequiredUtils;

function requireUtils () {
	if (hasRequiredUtils) return utils;
	hasRequiredUtils = 1;

	/** @type {(value: string) => boolean} */
	const isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);

	/** @type {(value: string) => boolean} */
	const isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);

	/**
	 * @param {Array<string>} input
	 * @returns {string}
	 */
	function stringArrayToHexStripped (input) {
	  let acc = '';
	  let code = 0;
	  let i = 0;

	  for (i = 0; i < input.length; i++) {
	    code = input[i].charCodeAt(0);
	    if (code === 48) {
	      continue
	    }
	    if (!((code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102))) {
	      return ''
	    }
	    acc += input[i];
	    break
	  }

	  for (i += 1; i < input.length; i++) {
	    code = input[i].charCodeAt(0);
	    if (!((code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102))) {
	      return ''
	    }
	    acc += input[i];
	  }
	  return acc
	}

	/**
	 * @typedef {Object} GetIPV6Result
	 * @property {boolean} error - Indicates if there was an error parsing the IPv6 address.
	 * @property {string} address - The parsed IPv6 address.
	 * @property {string} [zone] - The zone identifier, if present.
	 */

	/**
	 * @param {string} value
	 * @returns {boolean}
	 */
	const nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);

	/**
	 * @param {Array<string>} buffer
	 * @returns {boolean}
	 */
	function consumeIsZone (buffer) {
	  buffer.length = 0;
	  return true
	}

	/**
	 * @param {Array<string>} buffer
	 * @param {Array<string>} address
	 * @param {GetIPV6Result} output
	 * @returns {boolean}
	 */
	function consumeHextets (buffer, address, output) {
	  if (buffer.length) {
	    const hex = stringArrayToHexStripped(buffer);
	    if (hex !== '') {
	      address.push(hex);
	    } else {
	      output.error = true;
	      return false
	    }
	    buffer.length = 0;
	  }
	  return true
	}

	/**
	 * @param {string} input
	 * @returns {GetIPV6Result}
	 */
	function getIPV6 (input) {
	  let tokenCount = 0;
	  const output = { error: false, address: '', zone: '' };
	  /** @type {Array<string>} */
	  const address = [];
	  /** @type {Array<string>} */
	  const buffer = [];
	  let endipv6Encountered = false;
	  let endIpv6 = false;

	  let consume = consumeHextets;

	  for (let i = 0; i < input.length; i++) {
	    const cursor = input[i];
	    if (cursor === '[' || cursor === ']') { continue }
	    if (cursor === ':') {
	      if (endipv6Encountered === true) {
	        endIpv6 = true;
	      }
	      if (!consume(buffer, address, output)) { break }
	      if (++tokenCount > 7) {
	        // not valid
	        output.error = true;
	        break
	      }
	      if (i > 0 && input[i - 1] === ':') {
	        endipv6Encountered = true;
	      }
	      address.push(':');
	      continue
	    } else if (cursor === '%') {
	      if (!consume(buffer, address, output)) { break }
	      // switch to zone detection
	      consume = consumeIsZone;
	    } else {
	      buffer.push(cursor);
	      continue
	    }
	  }
	  if (buffer.length) {
	    if (consume === consumeIsZone) {
	      output.zone = buffer.join('');
	    } else if (endIpv6) {
	      address.push(buffer.join(''));
	    } else {
	      address.push(stringArrayToHexStripped(buffer));
	    }
	  }
	  output.address = address.join('');
	  return output
	}

	/**
	 * @typedef {Object} NormalizeIPv6Result
	 * @property {string} host - The normalized host.
	 * @property {string} [escapedHost] - The escaped host.
	 * @property {boolean} isIPV6 - Indicates if the host is an IPv6 address.
	 */

	/**
	 * @param {string} host
	 * @returns {NormalizeIPv6Result}
	 */
	function normalizeIPv6 (host) {
	  if (findToken(host, ':') < 2) { return { host, isIPV6: false } }
	  const ipv6 = getIPV6(host);

	  if (!ipv6.error) {
	    let newHost = ipv6.address;
	    let escapedHost = ipv6.address;
	    if (ipv6.zone) {
	      newHost += '%' + ipv6.zone;
	      escapedHost += '%25' + ipv6.zone;
	    }
	    return { host: newHost, isIPV6: true, escapedHost }
	  } else {
	    return { host, isIPV6: false }
	  }
	}

	/**
	 * @param {string} str
	 * @param {string} token
	 * @returns {number}
	 */
	function findToken (str, token) {
	  let ind = 0;
	  for (let i = 0; i < str.length; i++) {
	    if (str[i] === token) ind++;
	  }
	  return ind
	}

	/**
	 * @param {string} path
	 * @returns {string}
	 *
	 * @see https://datatracker.ietf.org/doc/html/rfc3986#section-5.2.4
	 */
	function removeDotSegments (path) {
	  let input = path;
	  const output = [];
	  let nextSlash = -1;
	  let len = 0;

	  // eslint-disable-next-line no-cond-assign
	  while (len = input.length) {
	    if (len === 1) {
	      if (input === '.') {
	        break
	      } else if (input === '/') {
	        output.push('/');
	        break
	      } else {
	        output.push(input);
	        break
	      }
	    } else if (len === 2) {
	      if (input[0] === '.') {
	        if (input[1] === '.') {
	          break
	        } else if (input[1] === '/') {
	          input = input.slice(2);
	          continue
	        }
	      } else if (input[0] === '/') {
	        if (input[1] === '.' || input[1] === '/') {
	          output.push('/');
	          break
	        }
	      }
	    } else if (len === 3) {
	      if (input === '/..') {
	        if (output.length !== 0) {
	          output.pop();
	        }
	        output.push('/');
	        break
	      }
	    }
	    if (input[0] === '.') {
	      if (input[1] === '.') {
	        if (input[2] === '/') {
	          input = input.slice(3);
	          continue
	        }
	      } else if (input[1] === '/') {
	        input = input.slice(2);
	        continue
	      }
	    } else if (input[0] === '/') {
	      if (input[1] === '.') {
	        if (input[2] === '/') {
	          input = input.slice(2);
	          continue
	        } else if (input[2] === '.') {
	          if (input[3] === '/') {
	            input = input.slice(3);
	            if (output.length !== 0) {
	              output.pop();
	            }
	            continue
	          }
	        }
	      }
	    }

	    // Rule 2E: Move normal path segment to output
	    if ((nextSlash = input.indexOf('/', 1)) === -1) {
	      output.push(input);
	      break
	    } else {
	      output.push(input.slice(0, nextSlash));
	      input = input.slice(nextSlash);
	    }
	  }

	  return output.join('')
	}

	/**
	 * @param {import('../types/index').URIComponent} component
	 * @param {boolean} esc
	 * @returns {import('../types/index').URIComponent}
	 */
	function normalizeComponentEncoding (component, esc) {
	  const func = esc !== true ? escape : unescape;
	  if (component.scheme !== undefined) {
	    component.scheme = func(component.scheme);
	  }
	  if (component.userinfo !== undefined) {
	    component.userinfo = func(component.userinfo);
	  }
	  if (component.host !== undefined) {
	    component.host = func(component.host);
	  }
	  if (component.path !== undefined) {
	    component.path = func(component.path);
	  }
	  if (component.query !== undefined) {
	    component.query = func(component.query);
	  }
	  if (component.fragment !== undefined) {
	    component.fragment = func(component.fragment);
	  }
	  return component
	}

	/**
	 * @param {import('../types/index').URIComponent} component
	 * @returns {string|undefined}
	 */
	function recomposeAuthority (component) {
	  const uriTokens = [];

	  if (component.userinfo !== undefined) {
	    uriTokens.push(component.userinfo);
	    uriTokens.push('@');
	  }

	  if (component.host !== undefined) {
	    let host = unescape(component.host);
	    if (!isIPv4(host)) {
	      const ipV6res = normalizeIPv6(host);
	      if (ipV6res.isIPV6 === true) {
	        host = `[${ipV6res.escapedHost}]`;
	      } else {
	        host = component.host;
	      }
	    }
	    uriTokens.push(host);
	  }

	  if (typeof component.port === 'number' || typeof component.port === 'string') {
	    uriTokens.push(':');
	    uriTokens.push(String(component.port));
	  }

	  return uriTokens.length ? uriTokens.join('') : undefined
	}
	utils = {
	  nonSimpleDomain,
	  recomposeAuthority,
	  normalizeComponentEncoding,
	  removeDotSegments,
	  isIPv4,
	  isUUID,
	  normalizeIPv6,
	  stringArrayToHexStripped
	};
	return utils;
}

var schemes;
var hasRequiredSchemes;

function requireSchemes () {
	if (hasRequiredSchemes) return schemes;
	hasRequiredSchemes = 1;

	const { isUUID } = requireUtils();
	const URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;

	const supportedSchemeNames = /** @type {const} */ (['http', 'https', 'ws',
	  'wss', 'urn', 'urn:uuid']);

	/** @typedef {supportedSchemeNames[number]} SchemeName */

	/**
	 * @param {string} name
	 * @returns {name is SchemeName}
	 */
	function isValidSchemeName (name) {
	  return supportedSchemeNames.indexOf(/** @type {*} */ (name)) !== -1
	}

	/**
	 * @callback SchemeFn
	 * @param {import('../types/index').URIComponent} component
	 * @param {import('../types/index').Options} options
	 * @returns {import('../types/index').URIComponent}
	 */

	/**
	 * @typedef {Object} SchemeHandler
	 * @property {SchemeName} scheme - The scheme name.
	 * @property {boolean} [domainHost] - Indicates if the scheme supports domain hosts.
	 * @property {SchemeFn} parse - Function to parse the URI component for this scheme.
	 * @property {SchemeFn} serialize - Function to serialize the URI component for this scheme.
	 * @property {boolean} [skipNormalize] - Indicates if normalization should be skipped for this scheme.
	 * @property {boolean} [absolutePath] - Indicates if the scheme uses absolute paths.
	 * @property {boolean} [unicodeSupport] - Indicates if the scheme supports Unicode.
	 */

	/**
	 * @param {import('../types/index').URIComponent} wsComponent
	 * @returns {boolean}
	 */
	function wsIsSecure (wsComponent) {
	  if (wsComponent.secure === true) {
	    return true
	  } else if (wsComponent.secure === false) {
	    return false
	  } else if (wsComponent.scheme) {
	    return (
	      wsComponent.scheme.length === 3 &&
	      (wsComponent.scheme[0] === 'w' || wsComponent.scheme[0] === 'W') &&
	      (wsComponent.scheme[1] === 's' || wsComponent.scheme[1] === 'S') &&
	      (wsComponent.scheme[2] === 's' || wsComponent.scheme[2] === 'S')
	    )
	  } else {
	    return false
	  }
	}

	/** @type {SchemeFn} */
	function httpParse (component) {
	  if (!component.host) {
	    component.error = component.error || 'HTTP URIs must have a host.';
	  }

	  return component
	}

	/** @type {SchemeFn} */
	function httpSerialize (component) {
	  const secure = String(component.scheme).toLowerCase() === 'https';

	  // normalize the default port
	  if (component.port === (secure ? 443 : 80) || component.port === '') {
	    component.port = undefined;
	  }

	  // normalize the empty path
	  if (!component.path) {
	    component.path = '/';
	  }

	  // NOTE: We do not parse query strings for HTTP URIs
	  // as WWW Form Url Encoded query strings are part of the HTML4+ spec,
	  // and not the HTTP spec.

	  return component
	}

	/** @type {SchemeFn} */
	function wsParse (wsComponent) {
	// indicate if the secure flag is set
	  wsComponent.secure = wsIsSecure(wsComponent);

	  // construct resouce name
	  wsComponent.resourceName = (wsComponent.path || '/') + (wsComponent.query ? '?' + wsComponent.query : '');
	  wsComponent.path = undefined;
	  wsComponent.query = undefined;

	  return wsComponent
	}

	/** @type {SchemeFn} */
	function wsSerialize (wsComponent) {
	// normalize the default port
	  if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === '') {
	    wsComponent.port = undefined;
	  }

	  // ensure scheme matches secure flag
	  if (typeof wsComponent.secure === 'boolean') {
	    wsComponent.scheme = (wsComponent.secure ? 'wss' : 'ws');
	    wsComponent.secure = undefined;
	  }

	  // reconstruct path from resource name
	  if (wsComponent.resourceName) {
	    const [path, query] = wsComponent.resourceName.split('?');
	    wsComponent.path = (path && path !== '/' ? path : undefined);
	    wsComponent.query = query;
	    wsComponent.resourceName = undefined;
	  }

	  // forbid fragment component
	  wsComponent.fragment = undefined;

	  return wsComponent
	}

	/** @type {SchemeFn} */
	function urnParse (urnComponent, options) {
	  if (!urnComponent.path) {
	    urnComponent.error = 'URN can not be parsed';
	    return urnComponent
	  }
	  const matches = urnComponent.path.match(URN_REG);
	  if (matches) {
	    const scheme = options.scheme || urnComponent.scheme || 'urn';
	    urnComponent.nid = matches[1].toLowerCase();
	    urnComponent.nss = matches[2];
	    const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
	    const schemeHandler = getSchemeHandler(urnScheme);
	    urnComponent.path = undefined;

	    if (schemeHandler) {
	      urnComponent = schemeHandler.parse(urnComponent, options);
	    }
	  } else {
	    urnComponent.error = urnComponent.error || 'URN can not be parsed.';
	  }

	  return urnComponent
	}

	/** @type {SchemeFn} */
	function urnSerialize (urnComponent, options) {
	  if (urnComponent.nid === undefined) {
	    throw new Error('URN without nid cannot be serialized')
	  }
	  const scheme = options.scheme || urnComponent.scheme || 'urn';
	  const nid = urnComponent.nid.toLowerCase();
	  const urnScheme = `${scheme}:${options.nid || nid}`;
	  const schemeHandler = getSchemeHandler(urnScheme);

	  if (schemeHandler) {
	    urnComponent = schemeHandler.serialize(urnComponent, options);
	  }

	  const uriComponent = urnComponent;
	  const nss = urnComponent.nss;
	  uriComponent.path = `${nid || options.nid}:${nss}`;

	  options.skipEscape = true;
	  return uriComponent
	}

	/** @type {SchemeFn} */
	function urnuuidParse (urnComponent, options) {
	  const uuidComponent = urnComponent;
	  uuidComponent.uuid = uuidComponent.nss;
	  uuidComponent.nss = undefined;

	  if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
	    uuidComponent.error = uuidComponent.error || 'UUID is not valid.';
	  }

	  return uuidComponent
	}

	/** @type {SchemeFn} */
	function urnuuidSerialize (uuidComponent) {
	  const urnComponent = uuidComponent;
	  // normalize UUID
	  urnComponent.nss = (uuidComponent.uuid || '').toLowerCase();
	  return urnComponent
	}

	const http = /** @type {SchemeHandler} */ ({
	  scheme: 'http',
	  domainHost: true,
	  parse: httpParse,
	  serialize: httpSerialize
	});

	const https = /** @type {SchemeHandler} */ ({
	  scheme: 'https',
	  domainHost: http.domainHost,
	  parse: httpParse,
	  serialize: httpSerialize
	});

	const ws = /** @type {SchemeHandler} */ ({
	  scheme: 'ws',
	  domainHost: true,
	  parse: wsParse,
	  serialize: wsSerialize
	});

	const wss = /** @type {SchemeHandler} */ ({
	  scheme: 'wss',
	  domainHost: ws.domainHost,
	  parse: ws.parse,
	  serialize: ws.serialize
	});

	const urn = /** @type {SchemeHandler} */ ({
	  scheme: 'urn',
	  parse: urnParse,
	  serialize: urnSerialize,
	  skipNormalize: true
	});

	const urnuuid = /** @type {SchemeHandler} */ ({
	  scheme: 'urn:uuid',
	  parse: urnuuidParse,
	  serialize: urnuuidSerialize,
	  skipNormalize: true
	});

	const SCHEMES = /** @type {Record<SchemeName, SchemeHandler>} */ ({
	  http,
	  https,
	  ws,
	  wss,
	  urn,
	  'urn:uuid': urnuuid
	});

	Object.setPrototypeOf(SCHEMES, null);

	/**
	 * @param {string|undefined} scheme
	 * @returns {SchemeHandler|undefined}
	 */
	function getSchemeHandler (scheme) {
	  return (
	    scheme && (
	      SCHEMES[/** @type {SchemeName} */ (scheme)] ||
	      SCHEMES[/** @type {SchemeName} */(scheme.toLowerCase())])
	  ) ||
	    undefined
	}

	schemes = {
	  wsIsSecure,
	  SCHEMES,
	  isValidSchemeName,
	  getSchemeHandler,
	};
	return schemes;
}

var hasRequiredFastUri;

function requireFastUri () {
	if (hasRequiredFastUri) return fastUri.exports;
	hasRequiredFastUri = 1;

	const { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizeComponentEncoding, isIPv4, nonSimpleDomain } = requireUtils();
	const { SCHEMES, getSchemeHandler } = requireSchemes();

	/**
	 * @template {import('./types/index').URIComponent|string} T
	 * @param {T} uri
	 * @param {import('./types/index').Options} [options]
	 * @returns {T}
	 */
	function normalize (uri, options) {
	  if (typeof uri === 'string') {
	    uri = /** @type {T} */ (serialize(parse(uri, options), options));
	  } else if (typeof uri === 'object') {
	    uri = /** @type {T} */ (parse(serialize(uri, options), options));
	  }
	  return uri
	}

	/**
	 * @param {string} baseURI
	 * @param {string} relativeURI
	 * @param {import('./types/index').Options} [options]
	 * @returns {string}
	 */
	function resolve (baseURI, relativeURI, options) {
	  const schemelessOptions = options ? Object.assign({ scheme: 'null' }, options) : { scheme: 'null' };
	  const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
	  schemelessOptions.skipEscape = true;
	  return serialize(resolved, schemelessOptions)
	}

	/**
	 * @param {import ('./types/index').URIComponent} base
	 * @param {import ('./types/index').URIComponent} relative
	 * @param {import('./types/index').Options} [options]
	 * @param {boolean} [skipNormalization=false]
	 * @returns {import ('./types/index').URIComponent}
	 */
	function resolveComponent (base, relative, options, skipNormalization) {
	  /** @type {import('./types/index').URIComponent} */
	  const target = {};
	  if (!skipNormalization) {
	    base = parse(serialize(base, options), options); // normalize base component
	    relative = parse(serialize(relative, options), options); // normalize relative component
	  }
	  options = options || {};

	  if (!options.tolerant && relative.scheme) {
	    target.scheme = relative.scheme;
	    // target.authority = relative.authority;
	    target.userinfo = relative.userinfo;
	    target.host = relative.host;
	    target.port = relative.port;
	    target.path = removeDotSegments(relative.path || '');
	    target.query = relative.query;
	  } else {
	    if (relative.userinfo !== undefined || relative.host !== undefined || relative.port !== undefined) {
	      // target.authority = relative.authority;
	      target.userinfo = relative.userinfo;
	      target.host = relative.host;
	      target.port = relative.port;
	      target.path = removeDotSegments(relative.path || '');
	      target.query = relative.query;
	    } else {
	      if (!relative.path) {
	        target.path = base.path;
	        if (relative.query !== undefined) {
	          target.query = relative.query;
	        } else {
	          target.query = base.query;
	        }
	      } else {
	        if (relative.path[0] === '/') {
	          target.path = removeDotSegments(relative.path);
	        } else {
	          if ((base.userinfo !== undefined || base.host !== undefined || base.port !== undefined) && !base.path) {
	            target.path = '/' + relative.path;
	          } else if (!base.path) {
	            target.path = relative.path;
	          } else {
	            target.path = base.path.slice(0, base.path.lastIndexOf('/') + 1) + relative.path;
	          }
	          target.path = removeDotSegments(target.path);
	        }
	        target.query = relative.query;
	      }
	      // target.authority = base.authority;
	      target.userinfo = base.userinfo;
	      target.host = base.host;
	      target.port = base.port;
	    }
	    target.scheme = base.scheme;
	  }

	  target.fragment = relative.fragment;

	  return target
	}

	/**
	 * @param {import ('./types/index').URIComponent|string} uriA
	 * @param {import ('./types/index').URIComponent|string} uriB
	 * @param {import ('./types/index').Options} options
	 * @returns {boolean}
	 */
	function equal (uriA, uriB, options) {
	  if (typeof uriA === 'string') {
	    uriA = unescape(uriA);
	    uriA = serialize(normalizeComponentEncoding(parse(uriA, options), true), { ...options, skipEscape: true });
	  } else if (typeof uriA === 'object') {
	    uriA = serialize(normalizeComponentEncoding(uriA, true), { ...options, skipEscape: true });
	  }

	  if (typeof uriB === 'string') {
	    uriB = unescape(uriB);
	    uriB = serialize(normalizeComponentEncoding(parse(uriB, options), true), { ...options, skipEscape: true });
	  } else if (typeof uriB === 'object') {
	    uriB = serialize(normalizeComponentEncoding(uriB, true), { ...options, skipEscape: true });
	  }

	  return uriA.toLowerCase() === uriB.toLowerCase()
	}

	/**
	 * @param {Readonly<import('./types/index').URIComponent>} cmpts
	 * @param {import('./types/index').Options} [opts]
	 * @returns {string}
	 */
	function serialize (cmpts, opts) {
	  const component = {
	    host: cmpts.host,
	    scheme: cmpts.scheme,
	    userinfo: cmpts.userinfo,
	    port: cmpts.port,
	    path: cmpts.path,
	    query: cmpts.query,
	    nid: cmpts.nid,
	    nss: cmpts.nss,
	    uuid: cmpts.uuid,
	    fragment: cmpts.fragment,
	    reference: cmpts.reference,
	    resourceName: cmpts.resourceName,
	    secure: cmpts.secure,
	    error: ''
	  };
	  const options = Object.assign({}, opts);
	  const uriTokens = [];

	  // find scheme handler
	  const schemeHandler = getSchemeHandler(options.scheme || component.scheme);

	  // perform scheme specific serialization
	  if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);

	  if (component.path !== undefined) {
	    if (!options.skipEscape) {
	      component.path = escape(component.path);

	      if (component.scheme !== undefined) {
	        component.path = component.path.split('%3A').join(':');
	      }
	    } else {
	      component.path = unescape(component.path);
	    }
	  }

	  if (options.reference !== 'suffix' && component.scheme) {
	    uriTokens.push(component.scheme, ':');
	  }

	  const authority = recomposeAuthority(component);
	  if (authority !== undefined) {
	    if (options.reference !== 'suffix') {
	      uriTokens.push('//');
	    }

	    uriTokens.push(authority);

	    if (component.path && component.path[0] !== '/') {
	      uriTokens.push('/');
	    }
	  }
	  if (component.path !== undefined) {
	    let s = component.path;

	    if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
	      s = removeDotSegments(s);
	    }

	    if (
	      authority === undefined &&
	      s[0] === '/' &&
	      s[1] === '/'
	    ) {
	      // don't allow the path to start with "//"
	      s = '/%2F' + s.slice(2);
	    }

	    uriTokens.push(s);
	  }

	  if (component.query !== undefined) {
	    uriTokens.push('?', component.query);
	  }

	  if (component.fragment !== undefined) {
	    uriTokens.push('#', component.fragment);
	  }
	  return uriTokens.join('')
	}

	const URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;

	/**
	 * @param {string} uri
	 * @param {import('./types/index').Options} [opts]
	 * @returns
	 */
	function parse (uri, opts) {
	  const options = Object.assign({}, opts);
	  /** @type {import('./types/index').URIComponent} */
	  const parsed = {
	    scheme: undefined,
	    userinfo: undefined,
	    host: '',
	    port: undefined,
	    path: '',
	    query: undefined,
	    fragment: undefined
	  };

	  let isIP = false;
	  if (options.reference === 'suffix') {
	    if (options.scheme) {
	      uri = options.scheme + ':' + uri;
	    } else {
	      uri = '//' + uri;
	    }
	  }

	  const matches = uri.match(URI_PARSE);

	  if (matches) {
	    // store each component
	    parsed.scheme = matches[1];
	    parsed.userinfo = matches[3];
	    parsed.host = matches[4];
	    parsed.port = parseInt(matches[5], 10);
	    parsed.path = matches[6] || '';
	    parsed.query = matches[7];
	    parsed.fragment = matches[8];

	    // fix port number
	    if (isNaN(parsed.port)) {
	      parsed.port = matches[5];
	    }
	    if (parsed.host) {
	      const ipv4result = isIPv4(parsed.host);
	      if (ipv4result === false) {
	        const ipv6result = normalizeIPv6(parsed.host);
	        parsed.host = ipv6result.host.toLowerCase();
	        isIP = ipv6result.isIPV6;
	      } else {
	        isIP = true;
	      }
	    }
	    if (parsed.scheme === undefined && parsed.userinfo === undefined && parsed.host === undefined && parsed.port === undefined && parsed.query === undefined && !parsed.path) {
	      parsed.reference = 'same-document';
	    } else if (parsed.scheme === undefined) {
	      parsed.reference = 'relative';
	    } else if (parsed.fragment === undefined) {
	      parsed.reference = 'absolute';
	    } else {
	      parsed.reference = 'uri';
	    }

	    // check for reference errors
	    if (options.reference && options.reference !== 'suffix' && options.reference !== parsed.reference) {
	      parsed.error = parsed.error || 'URI is not a ' + options.reference + ' reference.';
	    }

	    // find scheme handler
	    const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);

	    // check if scheme can't handle IRIs
	    if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
	      // if host component is a domain name
	      if (parsed.host && (options.domainHost || (schemeHandler && schemeHandler.domainHost)) && isIP === false && nonSimpleDomain(parsed.host)) {
	        // convert Unicode IDN -> ASCII IDN
	        try {
	          parsed.host = URL.domainToASCII(parsed.host.toLowerCase());
	        } catch (e) {
	          parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
	        }
	      }
	      // convert IRI -> URI
	    }

	    if (!schemeHandler || (schemeHandler && !schemeHandler.skipNormalize)) {
	      if (uri.indexOf('%') !== -1) {
	        if (parsed.scheme !== undefined) {
	          parsed.scheme = unescape(parsed.scheme);
	        }
	        if (parsed.host !== undefined) {
	          parsed.host = unescape(parsed.host);
	        }
	      }
	      if (parsed.path) {
	        parsed.path = escape(unescape(parsed.path));
	      }
	      if (parsed.fragment) {
	        parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
	      }
	    }

	    // perform scheme specific parsing
	    if (schemeHandler && schemeHandler.parse) {
	      schemeHandler.parse(parsed, options);
	    }
	  } else {
	    parsed.error = parsed.error || 'URI can not be parsed.';
	  }
	  return parsed
	}

	const fastUri$1 = {
	  SCHEMES,
	  normalize,
	  resolve,
	  resolveComponent,
	  equal,
	  serialize,
	  parse
	};

	fastUri.exports = fastUri$1;
	fastUri.exports.default = fastUri$1;
	fastUri.exports.fastUri = fastUri$1;
	return fastUri.exports;
}

var hasRequiredUri;

function requireUri () {
	if (hasRequiredUri) return uri;
	hasRequiredUri = 1;
	Object.defineProperty(uri, "__esModule", { value: true });
	const uri$1 = requireFastUri();
	uri$1.code = 'require("ajv/dist/runtime/uri").default';
	uri.default = uri$1;

	return uri;
}

var hasRequiredCore$1;

function requireCore$1 () {
	if (hasRequiredCore$1) return core$1;
	hasRequiredCore$1 = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
		var validate_1 = requireValidate();
		Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function () { return validate_1.KeywordCxt; } });
		var codegen_1 = requireCodegen();
		Object.defineProperty(exports, "_", { enumerable: true, get: function () { return codegen_1._; } });
		Object.defineProperty(exports, "str", { enumerable: true, get: function () { return codegen_1.str; } });
		Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return codegen_1.stringify; } });
		Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return codegen_1.nil; } });
		Object.defineProperty(exports, "Name", { enumerable: true, get: function () { return codegen_1.Name; } });
		Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function () { return codegen_1.CodeGen; } });
		const validation_error_1 = requireValidation_error();
		const ref_error_1 = requireRef_error();
		const rules_1 = requireRules();
		const compile_1 = requireCompile();
		const codegen_2 = requireCodegen();
		const resolve_1 = requireResolve();
		const dataType_1 = requireDataType();
		const util_1 = requireUtil();
		const $dataRefSchema = require$$9;
		const uri_1 = requireUri();
		const defaultRegExp = (str, flags) => new RegExp(str, flags);
		defaultRegExp.code = "new RegExp";
		const META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
		const EXT_SCOPE_NAMES = new Set([
		    "validate",
		    "serialize",
		    "parse",
		    "wrapper",
		    "root",
		    "schema",
		    "keyword",
		    "pattern",
		    "formats",
		    "validate$data",
		    "func",
		    "obj",
		    "Error",
		]);
		const removedOptions = {
		    errorDataPath: "",
		    format: "`validateFormats: false` can be used instead.",
		    nullable: '"nullable" keyword is supported by default.',
		    jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
		    extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
		    missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
		    processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
		    sourceCode: "Use option `code: {source: true}`",
		    strictDefaults: "It is default now, see option `strict`.",
		    strictKeywords: "It is default now, see option `strict`.",
		    uniqueItems: '"uniqueItems" keyword is always validated.',
		    unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
		    cache: "Map is used as cache, schema object as key.",
		    serialize: "Map is used as cache, schema object as key.",
		    ajvErrors: "It is default now.",
		};
		const deprecatedOptions = {
		    ignoreKeywordsWithRef: "",
		    jsPropertySyntax: "",
		    unicode: '"minLength"/"maxLength" account for unicode characters by default.',
		};
		const MAX_EXPRESSION = 200;
		// eslint-disable-next-line complexity
		function requiredOptions(o) {
		    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
		    const s = o.strict;
		    const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
		    const optimize = _optz === true || _optz === undefined ? 1 : _optz || 0;
		    const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
		    const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
		    return {
		        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
		        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
		        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
		        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
		        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
		        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
		        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
		        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
		        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
		        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
		        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
		        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
		        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
		        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
		        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
		        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
		        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
		        uriResolver: uriResolver,
		    };
		}
		class Ajv {
		    constructor(opts = {}) {
		        this.schemas = {};
		        this.refs = {};
		        this.formats = {};
		        this._compilations = new Set();
		        this._loading = {};
		        this._cache = new Map();
		        opts = this.opts = { ...opts, ...requiredOptions(opts) };
		        const { es5, lines } = this.opts.code;
		        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
		        this.logger = getLogger(opts.logger);
		        const formatOpt = opts.validateFormats;
		        opts.validateFormats = false;
		        this.RULES = (0, rules_1.getRules)();
		        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
		        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
		        this._metaOpts = getMetaSchemaOptions.call(this);
		        if (opts.formats)
		            addInitialFormats.call(this);
		        this._addVocabularies();
		        this._addDefaultMetaSchema();
		        if (opts.keywords)
		            addInitialKeywords.call(this, opts.keywords);
		        if (typeof opts.meta == "object")
		            this.addMetaSchema(opts.meta);
		        addInitialSchemas.call(this);
		        opts.validateFormats = formatOpt;
		    }
		    _addVocabularies() {
		        this.addKeyword("$async");
		    }
		    _addDefaultMetaSchema() {
		        const { $data, meta, schemaId } = this.opts;
		        let _dataRefSchema = $dataRefSchema;
		        if (schemaId === "id") {
		            _dataRefSchema = { ...$dataRefSchema };
		            _dataRefSchema.id = _dataRefSchema.$id;
		            delete _dataRefSchema.$id;
		        }
		        if (meta && $data)
		            this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
		    }
		    defaultMeta() {
		        const { meta, schemaId } = this.opts;
		        return (this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : undefined);
		    }
		    validate(schemaKeyRef, // key, ref or schema object
		    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
		    data // to be validated
		    ) {
		        let v;
		        if (typeof schemaKeyRef == "string") {
		            v = this.getSchema(schemaKeyRef);
		            if (!v)
		                throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
		        }
		        else {
		            v = this.compile(schemaKeyRef);
		        }
		        const valid = v(data);
		        if (!("$async" in v))
		            this.errors = v.errors;
		        return valid;
		    }
		    compile(schema, _meta) {
		        const sch = this._addSchema(schema, _meta);
		        return (sch.validate || this._compileSchemaEnv(sch));
		    }
		    compileAsync(schema, meta) {
		        if (typeof this.opts.loadSchema != "function") {
		            throw new Error("options.loadSchema should be a function");
		        }
		        const { loadSchema } = this.opts;
		        return runCompileAsync.call(this, schema, meta);
		        async function runCompileAsync(_schema, _meta) {
		            await loadMetaSchema.call(this, _schema.$schema);
		            const sch = this._addSchema(_schema, _meta);
		            return sch.validate || _compileAsync.call(this, sch);
		        }
		        async function loadMetaSchema($ref) {
		            if ($ref && !this.getSchema($ref)) {
		                await runCompileAsync.call(this, { $ref }, true);
		            }
		        }
		        async function _compileAsync(sch) {
		            try {
		                return this._compileSchemaEnv(sch);
		            }
		            catch (e) {
		                if (!(e instanceof ref_error_1.default))
		                    throw e;
		                checkLoaded.call(this, e);
		                await loadMissingSchema.call(this, e.missingSchema);
		                return _compileAsync.call(this, sch);
		            }
		        }
		        function checkLoaded({ missingSchema: ref, missingRef }) {
		            if (this.refs[ref]) {
		                throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
		            }
		        }
		        async function loadMissingSchema(ref) {
		            const _schema = await _loadSchema.call(this, ref);
		            if (!this.refs[ref])
		                await loadMetaSchema.call(this, _schema.$schema);
		            if (!this.refs[ref])
		                this.addSchema(_schema, ref, meta);
		        }
		        async function _loadSchema(ref) {
		            const p = this._loading[ref];
		            if (p)
		                return p;
		            try {
		                return await (this._loading[ref] = loadSchema(ref));
		            }
		            finally {
		                delete this._loading[ref];
		            }
		        }
		    }
		    // Adds schema to the instance
		    addSchema(schema, // If array is passed, `key` will be ignored
		    key, // Optional schema key. Can be passed to `validate` method instead of schema object or id/ref. One schema per instance can have empty `id` and `key`.
		    _meta, // true if schema is a meta-schema. Used internally, addMetaSchema should be used instead.
		    _validateSchema = this.opts.validateSchema // false to skip schema validation. Used internally, option validateSchema should be used instead.
		    ) {
		        if (Array.isArray(schema)) {
		            for (const sch of schema)
		                this.addSchema(sch, undefined, _meta, _validateSchema);
		            return this;
		        }
		        let id;
		        if (typeof schema === "object") {
		            const { schemaId } = this.opts;
		            id = schema[schemaId];
		            if (id !== undefined && typeof id != "string") {
		                throw new Error(`schema ${schemaId} must be string`);
		            }
		        }
		        key = (0, resolve_1.normalizeId)(key || id);
		        this._checkUnique(key);
		        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
		        return this;
		    }
		    // Add schema that will be used to validate other schemas
		    // options in META_IGNORE_OPTIONS are alway set to false
		    addMetaSchema(schema, key, // schema key
		    _validateSchema = this.opts.validateSchema // false to skip schema validation, can be used to override validateSchema option for meta-schema
		    ) {
		        this.addSchema(schema, key, true, _validateSchema);
		        return this;
		    }
		    //  Validate schema against its meta-schema
		    validateSchema(schema, throwOrLogError) {
		        if (typeof schema == "boolean")
		            return true;
		        let $schema;
		        $schema = schema.$schema;
		        if ($schema !== undefined && typeof $schema != "string") {
		            throw new Error("$schema must be a string");
		        }
		        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
		        if (!$schema) {
		            this.logger.warn("meta-schema not available");
		            this.errors = null;
		            return true;
		        }
		        const valid = this.validate($schema, schema);
		        if (!valid && throwOrLogError) {
		            const message = "schema is invalid: " + this.errorsText();
		            if (this.opts.validateSchema === "log")
		                this.logger.error(message);
		            else
		                throw new Error(message);
		        }
		        return valid;
		    }
		    // Get compiled schema by `key` or `ref`.
		    // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
		    getSchema(keyRef) {
		        let sch;
		        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
		            keyRef = sch;
		        if (sch === undefined) {
		            const { schemaId } = this.opts;
		            const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
		            sch = compile_1.resolveSchema.call(this, root, keyRef);
		            if (!sch)
		                return;
		            this.refs[keyRef] = sch;
		        }
		        return (sch.validate || this._compileSchemaEnv(sch));
		    }
		    // Remove cached schema(s).
		    // If no parameter is passed all schemas but meta-schemas are removed.
		    // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
		    // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
		    removeSchema(schemaKeyRef) {
		        if (schemaKeyRef instanceof RegExp) {
		            this._removeAllSchemas(this.schemas, schemaKeyRef);
		            this._removeAllSchemas(this.refs, schemaKeyRef);
		            return this;
		        }
		        switch (typeof schemaKeyRef) {
		            case "undefined":
		                this._removeAllSchemas(this.schemas);
		                this._removeAllSchemas(this.refs);
		                this._cache.clear();
		                return this;
		            case "string": {
		                const sch = getSchEnv.call(this, schemaKeyRef);
		                if (typeof sch == "object")
		                    this._cache.delete(sch.schema);
		                delete this.schemas[schemaKeyRef];
		                delete this.refs[schemaKeyRef];
		                return this;
		            }
		            case "object": {
		                const cacheKey = schemaKeyRef;
		                this._cache.delete(cacheKey);
		                let id = schemaKeyRef[this.opts.schemaId];
		                if (id) {
		                    id = (0, resolve_1.normalizeId)(id);
		                    delete this.schemas[id];
		                    delete this.refs[id];
		                }
		                return this;
		            }
		            default:
		                throw new Error("ajv.removeSchema: invalid parameter");
		        }
		    }
		    // add "vocabulary" - a collection of keywords
		    addVocabulary(definitions) {
		        for (const def of definitions)
		            this.addKeyword(def);
		        return this;
		    }
		    addKeyword(kwdOrDef, def // deprecated
		    ) {
		        let keyword;
		        if (typeof kwdOrDef == "string") {
		            keyword = kwdOrDef;
		            if (typeof def == "object") {
		                this.logger.warn("these parameters are deprecated, see docs for addKeyword");
		                def.keyword = keyword;
		            }
		        }
		        else if (typeof kwdOrDef == "object" && def === undefined) {
		            def = kwdOrDef;
		            keyword = def.keyword;
		            if (Array.isArray(keyword) && !keyword.length) {
		                throw new Error("addKeywords: keyword must be string or non-empty array");
		            }
		        }
		        else {
		            throw new Error("invalid addKeywords parameters");
		        }
		        checkKeyword.call(this, keyword, def);
		        if (!def) {
		            (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
		            return this;
		        }
		        keywordMetaschema.call(this, def);
		        const definition = {
		            ...def,
		            type: (0, dataType_1.getJSONTypes)(def.type),
		            schemaType: (0, dataType_1.getJSONTypes)(def.schemaType),
		        };
		        (0, util_1.eachItem)(keyword, definition.type.length === 0
		            ? (k) => addRule.call(this, k, definition)
		            : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
		        return this;
		    }
		    getKeyword(keyword) {
		        const rule = this.RULES.all[keyword];
		        return typeof rule == "object" ? rule.definition : !!rule;
		    }
		    // Remove keyword
		    removeKeyword(keyword) {
		        // TODO return type should be Ajv
		        const { RULES } = this;
		        delete RULES.keywords[keyword];
		        delete RULES.all[keyword];
		        for (const group of RULES.rules) {
		            const i = group.rules.findIndex((rule) => rule.keyword === keyword);
		            if (i >= 0)
		                group.rules.splice(i, 1);
		        }
		        return this;
		    }
		    // Add format
		    addFormat(name, format) {
		        if (typeof format == "string")
		            format = new RegExp(format);
		        this.formats[name] = format;
		        return this;
		    }
		    errorsText(errors = this.errors, // optional array of validation errors
		    { separator = ", ", dataVar = "data" } = {} // optional options with properties `separator` and `dataVar`
		    ) {
		        if (!errors || errors.length === 0)
		            return "No errors";
		        return errors
		            .map((e) => `${dataVar}${e.instancePath} ${e.message}`)
		            .reduce((text, msg) => text + separator + msg);
		    }
		    $dataMetaSchema(metaSchema, keywordsJsonPointers) {
		        const rules = this.RULES.all;
		        metaSchema = JSON.parse(JSON.stringify(metaSchema));
		        for (const jsonPointer of keywordsJsonPointers) {
		            const segments = jsonPointer.split("/").slice(1); // first segment is an empty string
		            let keywords = metaSchema;
		            for (const seg of segments)
		                keywords = keywords[seg];
		            for (const key in rules) {
		                const rule = rules[key];
		                if (typeof rule != "object")
		                    continue;
		                const { $data } = rule.definition;
		                const schema = keywords[key];
		                if ($data && schema)
		                    keywords[key] = schemaOrData(schema);
		            }
		        }
		        return metaSchema;
		    }
		    _removeAllSchemas(schemas, regex) {
		        for (const keyRef in schemas) {
		            const sch = schemas[keyRef];
		            if (!regex || regex.test(keyRef)) {
		                if (typeof sch == "string") {
		                    delete schemas[keyRef];
		                }
		                else if (sch && !sch.meta) {
		                    this._cache.delete(sch.schema);
		                    delete schemas[keyRef];
		                }
		            }
		        }
		    }
		    _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
		        let id;
		        const { schemaId } = this.opts;
		        if (typeof schema == "object") {
		            id = schema[schemaId];
		        }
		        else {
		            if (this.opts.jtd)
		                throw new Error("schema must be object");
		            else if (typeof schema != "boolean")
		                throw new Error("schema must be object or boolean");
		        }
		        let sch = this._cache.get(schema);
		        if (sch !== undefined)
		            return sch;
		        baseId = (0, resolve_1.normalizeId)(id || baseId);
		        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
		        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
		        this._cache.set(sch.schema, sch);
		        if (addSchema && !baseId.startsWith("#")) {
		            // TODO atm it is allowed to overwrite schemas without id (instead of not adding them)
		            if (baseId)
		                this._checkUnique(baseId);
		            this.refs[baseId] = sch;
		        }
		        if (validateSchema)
		            this.validateSchema(schema, true);
		        return sch;
		    }
		    _checkUnique(id) {
		        if (this.schemas[id] || this.refs[id]) {
		            throw new Error(`schema with key or id "${id}" already exists`);
		        }
		    }
		    _compileSchemaEnv(sch) {
		        if (sch.meta)
		            this._compileMetaSchema(sch);
		        else
		            compile_1.compileSchema.call(this, sch);
		        /* istanbul ignore if */
		        if (!sch.validate)
		            throw new Error("ajv implementation error");
		        return sch.validate;
		    }
		    _compileMetaSchema(sch) {
		        const currentOpts = this.opts;
		        this.opts = this._metaOpts;
		        try {
		            compile_1.compileSchema.call(this, sch);
		        }
		        finally {
		            this.opts = currentOpts;
		        }
		    }
		}
		Ajv.ValidationError = validation_error_1.default;
		Ajv.MissingRefError = ref_error_1.default;
		exports.default = Ajv;
		function checkOptions(checkOpts, options, msg, log = "error") {
		    for (const key in checkOpts) {
		        const opt = key;
		        if (opt in options)
		            this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
		    }
		}
		function getSchEnv(keyRef) {
		    keyRef = (0, resolve_1.normalizeId)(keyRef); // TODO tests fail without this line
		    return this.schemas[keyRef] || this.refs[keyRef];
		}
		function addInitialSchemas() {
		    const optsSchemas = this.opts.schemas;
		    if (!optsSchemas)
		        return;
		    if (Array.isArray(optsSchemas))
		        this.addSchema(optsSchemas);
		    else
		        for (const key in optsSchemas)
		            this.addSchema(optsSchemas[key], key);
		}
		function addInitialFormats() {
		    for (const name in this.opts.formats) {
		        const format = this.opts.formats[name];
		        if (format)
		            this.addFormat(name, format);
		    }
		}
		function addInitialKeywords(defs) {
		    if (Array.isArray(defs)) {
		        this.addVocabulary(defs);
		        return;
		    }
		    this.logger.warn("keywords option as map is deprecated, pass array");
		    for (const keyword in defs) {
		        const def = defs[keyword];
		        if (!def.keyword)
		            def.keyword = keyword;
		        this.addKeyword(def);
		    }
		}
		function getMetaSchemaOptions() {
		    const metaOpts = { ...this.opts };
		    for (const opt of META_IGNORE_OPTIONS)
		        delete metaOpts[opt];
		    return metaOpts;
		}
		const noLogs = { log() { }, warn() { }, error() { } };
		function getLogger(logger) {
		    if (logger === false)
		        return noLogs;
		    if (logger === undefined)
		        return console;
		    if (logger.log && logger.warn && logger.error)
		        return logger;
		    throw new Error("logger must implement log, warn and error methods");
		}
		const KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
		function checkKeyword(keyword, def) {
		    const { RULES } = this;
		    (0, util_1.eachItem)(keyword, (kwd) => {
		        if (RULES.keywords[kwd])
		            throw new Error(`Keyword ${kwd} is already defined`);
		        if (!KEYWORD_NAME.test(kwd))
		            throw new Error(`Keyword ${kwd} has invalid name`);
		    });
		    if (!def)
		        return;
		    if (def.$data && !("code" in def || "validate" in def)) {
		        throw new Error('$data keyword must have "code" or "validate" function');
		    }
		}
		function addRule(keyword, definition, dataType) {
		    var _a;
		    const post = definition === null || definition === void 0 ? void 0 : definition.post;
		    if (dataType && post)
		        throw new Error('keyword with "post" flag cannot have "type"');
		    const { RULES } = this;
		    let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
		    if (!ruleGroup) {
		        ruleGroup = { type: dataType, rules: [] };
		        RULES.rules.push(ruleGroup);
		    }
		    RULES.keywords[keyword] = true;
		    if (!definition)
		        return;
		    const rule = {
		        keyword,
		        definition: {
		            ...definition,
		            type: (0, dataType_1.getJSONTypes)(definition.type),
		            schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType),
		        },
		    };
		    if (definition.before)
		        addBeforeRule.call(this, ruleGroup, rule, definition.before);
		    else
		        ruleGroup.rules.push(rule);
		    RULES.all[keyword] = rule;
		    (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
		}
		function addBeforeRule(ruleGroup, rule, before) {
		    const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
		    if (i >= 0) {
		        ruleGroup.rules.splice(i, 0, rule);
		    }
		    else {
		        ruleGroup.rules.push(rule);
		        this.logger.warn(`rule ${before} is not defined`);
		    }
		}
		function keywordMetaschema(def) {
		    let { metaSchema } = def;
		    if (metaSchema === undefined)
		        return;
		    if (def.$data && this.opts.$data)
		        metaSchema = schemaOrData(metaSchema);
		    def.validateSchema = this.compile(metaSchema, true);
		}
		const $dataRef = {
		    $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
		};
		function schemaOrData(schema) {
		    return { anyOf: [schema, $dataRef] };
		}

	} (core$1));
	return core$1;
}

var draft7 = {};

var core = {};

var id = {};

var hasRequiredId;

function requireId () {
	if (hasRequiredId) return id;
	hasRequiredId = 1;
	Object.defineProperty(id, "__esModule", { value: true });
	const def = {
	    keyword: "id",
	    code() {
	        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
	    },
	};
	id.default = def;

	return id;
}

var ref = {};

var hasRequiredRef;

function requireRef () {
	if (hasRequiredRef) return ref;
	hasRequiredRef = 1;
	Object.defineProperty(ref, "__esModule", { value: true });
	ref.callRef = ref.getValidate = void 0;
	const ref_error_1 = requireRef_error();
	const code_1 = requireCode();
	const codegen_1 = requireCodegen();
	const names_1 = requireNames();
	const compile_1 = requireCompile();
	const util_1 = requireUtil();
	const def = {
	    keyword: "$ref",
	    schemaType: "string",
	    code(cxt) {
	        const { gen, schema: $ref, it } = cxt;
	        const { baseId, schemaEnv: env, validateName, opts, self } = it;
	        const { root } = env;
	        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
	            return callRootRef();
	        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
	        if (schOrEnv === undefined)
	            throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
	        if (schOrEnv instanceof compile_1.SchemaEnv)
	            return callValidate(schOrEnv);
	        return inlineRefSchema(schOrEnv);
	        function callRootRef() {
	            if (env === root)
	                return callRef(cxt, validateName, env, env.$async);
	            const rootName = gen.scopeValue("root", { ref: root });
	            return callRef(cxt, (0, codegen_1._) `${rootName}.validate`, root, root.$async);
	        }
	        function callValidate(sch) {
	            const v = getValidate(cxt, sch);
	            callRef(cxt, v, sch, sch.$async);
	        }
	        function inlineRefSchema(sch) {
	            const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
	            const valid = gen.name("valid");
	            const schCxt = cxt.subschema({
	                schema: sch,
	                dataTypes: [],
	                schemaPath: codegen_1.nil,
	                topSchemaRef: schName,
	                errSchemaPath: $ref,
	            }, valid);
	            cxt.mergeEvaluated(schCxt);
	            cxt.ok(valid);
	        }
	    },
	};
	function getValidate(cxt, sch) {
	    const { gen } = cxt;
	    return sch.validate
	        ? gen.scopeValue("validate", { ref: sch.validate })
	        : (0, codegen_1._) `${gen.scopeValue("wrapper", { ref: sch })}.validate`;
	}
	ref.getValidate = getValidate;
	function callRef(cxt, v, sch, $async) {
	    const { gen, it } = cxt;
	    const { allErrors, schemaEnv: env, opts } = it;
	    const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
	    if ($async)
	        callAsyncRef();
	    else
	        callSyncRef();
	    function callAsyncRef() {
	        if (!env.$async)
	            throw new Error("async schema referenced by sync schema");
	        const valid = gen.let("valid");
	        gen.try(() => {
	            gen.code((0, codegen_1._) `await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
	            addEvaluatedFrom(v); // TODO will not work with async, it has to be returned with the result
	            if (!allErrors)
	                gen.assign(valid, true);
	        }, (e) => {
	            gen.if((0, codegen_1._) `!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
	            addErrorsFrom(e);
	            if (!allErrors)
	                gen.assign(valid, false);
	        });
	        cxt.ok(valid);
	    }
	    function callSyncRef() {
	        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
	    }
	    function addErrorsFrom(source) {
	        const errs = (0, codegen_1._) `${source}.errors`;
	        gen.assign(names_1.default.vErrors, (0, codegen_1._) `${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`); // TODO tagged
	        gen.assign(names_1.default.errors, (0, codegen_1._) `${names_1.default.vErrors}.length`);
	    }
	    function addEvaluatedFrom(source) {
	        var _a;
	        if (!it.opts.unevaluated)
	            return;
	        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
	        // TODO refactor
	        if (it.props !== true) {
	            if (schEvaluated && !schEvaluated.dynamicProps) {
	                if (schEvaluated.props !== undefined) {
	                    it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
	                }
	            }
	            else {
	                const props = gen.var("props", (0, codegen_1._) `${source}.evaluated.props`);
	                it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
	            }
	        }
	        if (it.items !== true) {
	            if (schEvaluated && !schEvaluated.dynamicItems) {
	                if (schEvaluated.items !== undefined) {
	                    it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
	                }
	            }
	            else {
	                const items = gen.var("items", (0, codegen_1._) `${source}.evaluated.items`);
	                it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
	            }
	        }
	    }
	}
	ref.callRef = callRef;
	ref.default = def;

	return ref;
}

var hasRequiredCore;

function requireCore () {
	if (hasRequiredCore) return core;
	hasRequiredCore = 1;
	Object.defineProperty(core, "__esModule", { value: true });
	const id_1 = requireId();
	const ref_1 = requireRef();
	const core$1 = [
	    "$schema",
	    "$id",
	    "$defs",
	    "$vocabulary",
	    { keyword: "$comment" },
	    "definitions",
	    id_1.default,
	    ref_1.default,
	];
	core.default = core$1;

	return core;
}

var validation = {};

var limitNumber = {};

var hasRequiredLimitNumber;

function requireLimitNumber () {
	if (hasRequiredLimitNumber) return limitNumber;
	hasRequiredLimitNumber = 1;
	Object.defineProperty(limitNumber, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const ops = codegen_1.operators;
	const KWDs = {
	    maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
	    minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
	    exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
	    exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE },
	};
	const error = {
	    message: ({ keyword, schemaCode }) => (0, codegen_1.str) `must be ${KWDs[keyword].okStr} ${schemaCode}`,
	    params: ({ keyword, schemaCode }) => (0, codegen_1._) `{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`,
	};
	const def = {
	    keyword: Object.keys(KWDs),
	    type: "number",
	    schemaType: "number",
	    $data: true,
	    error,
	    code(cxt) {
	        const { keyword, data, schemaCode } = cxt;
	        cxt.fail$data((0, codegen_1._) `${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
	    },
	};
	limitNumber.default = def;

	return limitNumber;
}

var multipleOf = {};

var hasRequiredMultipleOf;

function requireMultipleOf () {
	if (hasRequiredMultipleOf) return multipleOf;
	hasRequiredMultipleOf = 1;
	Object.defineProperty(multipleOf, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const error = {
	    message: ({ schemaCode }) => (0, codegen_1.str) `must be multiple of ${schemaCode}`,
	    params: ({ schemaCode }) => (0, codegen_1._) `{multipleOf: ${schemaCode}}`,
	};
	const def = {
	    keyword: "multipleOf",
	    type: "number",
	    schemaType: "number",
	    $data: true,
	    error,
	    code(cxt) {
	        const { gen, data, schemaCode, it } = cxt;
	        // const bdt = bad$DataType(schemaCode, <string>def.schemaType, $data)
	        const prec = it.opts.multipleOfPrecision;
	        const res = gen.let("res");
	        const invalid = prec
	            ? (0, codegen_1._) `Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}`
	            : (0, codegen_1._) `${res} !== parseInt(${res})`;
	        cxt.fail$data((0, codegen_1._) `(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
	    },
	};
	multipleOf.default = def;

	return multipleOf;
}

var limitLength = {};

var ucs2length = {};

var hasRequiredUcs2length;

function requireUcs2length () {
	if (hasRequiredUcs2length) return ucs2length;
	hasRequiredUcs2length = 1;
	Object.defineProperty(ucs2length, "__esModule", { value: true });
	// https://mathiasbynens.be/notes/javascript-encoding
	// https://github.com/bestiejs/punycode.js - punycode.ucs2.decode
	function ucs2length$1(str) {
	    const len = str.length;
	    let length = 0;
	    let pos = 0;
	    let value;
	    while (pos < len) {
	        length++;
	        value = str.charCodeAt(pos++);
	        if (value >= 0xd800 && value <= 0xdbff && pos < len) {
	            // high surrogate, and there is a next character
	            value = str.charCodeAt(pos);
	            if ((value & 0xfc00) === 0xdc00)
	                pos++; // low surrogate
	        }
	    }
	    return length;
	}
	ucs2length.default = ucs2length$1;
	ucs2length$1.code = 'require("ajv/dist/runtime/ucs2length").default';

	return ucs2length;
}

var hasRequiredLimitLength;

function requireLimitLength () {
	if (hasRequiredLimitLength) return limitLength;
	hasRequiredLimitLength = 1;
	Object.defineProperty(limitLength, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const ucs2length_1 = requireUcs2length();
	const error = {
	    message({ keyword, schemaCode }) {
	        const comp = keyword === "maxLength" ? "more" : "fewer";
	        return (0, codegen_1.str) `must NOT have ${comp} than ${schemaCode} characters`;
	    },
	    params: ({ schemaCode }) => (0, codegen_1._) `{limit: ${schemaCode}}`,
	};
	const def = {
	    keyword: ["maxLength", "minLength"],
	    type: "string",
	    schemaType: "number",
	    $data: true,
	    error,
	    code(cxt) {
	        const { keyword, data, schemaCode, it } = cxt;
	        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
	        const len = it.opts.unicode === false ? (0, codegen_1._) `${data}.length` : (0, codegen_1._) `${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
	        cxt.fail$data((0, codegen_1._) `${len} ${op} ${schemaCode}`);
	    },
	};
	limitLength.default = def;

	return limitLength;
}

var pattern = {};

var hasRequiredPattern;

function requirePattern () {
	if (hasRequiredPattern) return pattern;
	hasRequiredPattern = 1;
	Object.defineProperty(pattern, "__esModule", { value: true });
	const code_1 = requireCode();
	const codegen_1 = requireCodegen();
	const error = {
	    message: ({ schemaCode }) => (0, codegen_1.str) `must match pattern "${schemaCode}"`,
	    params: ({ schemaCode }) => (0, codegen_1._) `{pattern: ${schemaCode}}`,
	};
	const def = {
	    keyword: "pattern",
	    type: "string",
	    schemaType: "string",
	    $data: true,
	    error,
	    code(cxt) {
	        const { data, $data, schema, schemaCode, it } = cxt;
	        // TODO regexp should be wrapped in try/catchs
	        const u = it.opts.unicodeRegExp ? "u" : "";
	        const regExp = $data ? (0, codegen_1._) `(new RegExp(${schemaCode}, ${u}))` : (0, code_1.usePattern)(cxt, schema);
	        cxt.fail$data((0, codegen_1._) `!${regExp}.test(${data})`);
	    },
	};
	pattern.default = def;

	return pattern;
}

var limitProperties = {};

var hasRequiredLimitProperties;

function requireLimitProperties () {
	if (hasRequiredLimitProperties) return limitProperties;
	hasRequiredLimitProperties = 1;
	Object.defineProperty(limitProperties, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const error = {
	    message({ keyword, schemaCode }) {
	        const comp = keyword === "maxProperties" ? "more" : "fewer";
	        return (0, codegen_1.str) `must NOT have ${comp} than ${schemaCode} properties`;
	    },
	    params: ({ schemaCode }) => (0, codegen_1._) `{limit: ${schemaCode}}`,
	};
	const def = {
	    keyword: ["maxProperties", "minProperties"],
	    type: "object",
	    schemaType: "number",
	    $data: true,
	    error,
	    code(cxt) {
	        const { keyword, data, schemaCode } = cxt;
	        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
	        cxt.fail$data((0, codegen_1._) `Object.keys(${data}).length ${op} ${schemaCode}`);
	    },
	};
	limitProperties.default = def;

	return limitProperties;
}

var required$1 = {};

var hasRequiredRequired;

function requireRequired () {
	if (hasRequiredRequired) return required$1;
	hasRequiredRequired = 1;
	Object.defineProperty(required$1, "__esModule", { value: true });
	const code_1 = requireCode();
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const error = {
	    message: ({ params: { missingProperty } }) => (0, codegen_1.str) `must have required property '${missingProperty}'`,
	    params: ({ params: { missingProperty } }) => (0, codegen_1._) `{missingProperty: ${missingProperty}}`,
	};
	const def = {
	    keyword: "required",
	    type: "object",
	    schemaType: "array",
	    $data: true,
	    error,
	    code(cxt) {
	        const { gen, schema, schemaCode, data, $data, it } = cxt;
	        const { opts } = it;
	        if (!$data && schema.length === 0)
	            return;
	        const useLoop = schema.length >= opts.loopRequired;
	        if (it.allErrors)
	            allErrorsMode();
	        else
	            exitOnErrorMode();
	        if (opts.strictRequired) {
	            const props = cxt.parentSchema.properties;
	            const { definedProperties } = cxt.it;
	            for (const requiredKey of schema) {
	                if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === undefined && !definedProperties.has(requiredKey)) {
	                    const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
	                    const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
	                    (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
	                }
	            }
	        }
	        function allErrorsMode() {
	            if (useLoop || $data) {
	                cxt.block$data(codegen_1.nil, loopAllRequired);
	            }
	            else {
	                for (const prop of schema) {
	                    (0, code_1.checkReportMissingProp)(cxt, prop);
	                }
	            }
	        }
	        function exitOnErrorMode() {
	            const missing = gen.let("missing");
	            if (useLoop || $data) {
	                const valid = gen.let("valid", true);
	                cxt.block$data(valid, () => loopUntilMissing(missing, valid));
	                cxt.ok(valid);
	            }
	            else {
	                gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
	                (0, code_1.reportMissingProp)(cxt, missing);
	                gen.else();
	            }
	        }
	        function loopAllRequired() {
	            gen.forOf("prop", schemaCode, (prop) => {
	                cxt.setParams({ missingProperty: prop });
	                gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
	            });
	        }
	        function loopUntilMissing(missing, valid) {
	            cxt.setParams({ missingProperty: missing });
	            gen.forOf(missing, schemaCode, () => {
	                gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
	                gen.if((0, codegen_1.not)(valid), () => {
	                    cxt.error();
	                    gen.break();
	                });
	            }, codegen_1.nil);
	        }
	    },
	};
	required$1.default = def;

	return required$1;
}

var limitItems = {};

var hasRequiredLimitItems;

function requireLimitItems () {
	if (hasRequiredLimitItems) return limitItems;
	hasRequiredLimitItems = 1;
	Object.defineProperty(limitItems, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const error = {
	    message({ keyword, schemaCode }) {
	        const comp = keyword === "maxItems" ? "more" : "fewer";
	        return (0, codegen_1.str) `must NOT have ${comp} than ${schemaCode} items`;
	    },
	    params: ({ schemaCode }) => (0, codegen_1._) `{limit: ${schemaCode}}`,
	};
	const def = {
	    keyword: ["maxItems", "minItems"],
	    type: "array",
	    schemaType: "number",
	    $data: true,
	    error,
	    code(cxt) {
	        const { keyword, data, schemaCode } = cxt;
	        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
	        cxt.fail$data((0, codegen_1._) `${data}.length ${op} ${schemaCode}`);
	    },
	};
	limitItems.default = def;

	return limitItems;
}

var uniqueItems = {};

var equal = {};

var hasRequiredEqual;

function requireEqual () {
	if (hasRequiredEqual) return equal;
	hasRequiredEqual = 1;
	Object.defineProperty(equal, "__esModule", { value: true });
	// https://github.com/ajv-validator/ajv/issues/889
	const equal$1 = requireFastDeepEqual();
	equal$1.code = 'require("ajv/dist/runtime/equal").default';
	equal.default = equal$1;

	return equal;
}

var hasRequiredUniqueItems;

function requireUniqueItems () {
	if (hasRequiredUniqueItems) return uniqueItems;
	hasRequiredUniqueItems = 1;
	Object.defineProperty(uniqueItems, "__esModule", { value: true });
	const dataType_1 = requireDataType();
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const equal_1 = requireEqual();
	const error = {
	    message: ({ params: { i, j } }) => (0, codegen_1.str) `must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
	    params: ({ params: { i, j } }) => (0, codegen_1._) `{i: ${i}, j: ${j}}`,
	};
	const def = {
	    keyword: "uniqueItems",
	    type: "array",
	    schemaType: "boolean",
	    $data: true,
	    error,
	    code(cxt) {
	        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
	        if (!$data && !schema)
	            return;
	        const valid = gen.let("valid");
	        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
	        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._) `${schemaCode} === false`);
	        cxt.ok(valid);
	        function validateUniqueItems() {
	            const i = gen.let("i", (0, codegen_1._) `${data}.length`);
	            const j = gen.let("j");
	            cxt.setParams({ i, j });
	            gen.assign(valid, true);
	            gen.if((0, codegen_1._) `${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
	        }
	        function canOptimize() {
	            return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
	        }
	        function loopN(i, j) {
	            const item = gen.name("item");
	            const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
	            const indices = gen.const("indices", (0, codegen_1._) `{}`);
	            gen.for((0, codegen_1._) `;${i}--;`, () => {
	                gen.let(item, (0, codegen_1._) `${data}[${i}]`);
	                gen.if(wrongType, (0, codegen_1._) `continue`);
	                if (itemTypes.length > 1)
	                    gen.if((0, codegen_1._) `typeof ${item} == "string"`, (0, codegen_1._) `${item} += "_"`);
	                gen
	                    .if((0, codegen_1._) `typeof ${indices}[${item}] == "number"`, () => {
	                    gen.assign(j, (0, codegen_1._) `${indices}[${item}]`);
	                    cxt.error();
	                    gen.assign(valid, false).break();
	                })
	                    .code((0, codegen_1._) `${indices}[${item}] = ${i}`);
	            });
	        }
	        function loopN2(i, j) {
	            const eql = (0, util_1.useFunc)(gen, equal_1.default);
	            const outer = gen.name("outer");
	            gen.label(outer).for((0, codegen_1._) `;${i}--;`, () => gen.for((0, codegen_1._) `${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._) `${eql}(${data}[${i}], ${data}[${j}])`, () => {
	                cxt.error();
	                gen.assign(valid, false).break(outer);
	            })));
	        }
	    },
	};
	uniqueItems.default = def;

	return uniqueItems;
}

var _const = {};

var hasRequired_const;

function require_const () {
	if (hasRequired_const) return _const;
	hasRequired_const = 1;
	Object.defineProperty(_const, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const equal_1 = requireEqual();
	const error = {
	    message: "must be equal to constant",
	    params: ({ schemaCode }) => (0, codegen_1._) `{allowedValue: ${schemaCode}}`,
	};
	const def = {
	    keyword: "const",
	    $data: true,
	    error,
	    code(cxt) {
	        const { gen, data, $data, schemaCode, schema } = cxt;
	        if ($data || (schema && typeof schema == "object")) {
	            cxt.fail$data((0, codegen_1._) `!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
	        }
	        else {
	            cxt.fail((0, codegen_1._) `${schema} !== ${data}`);
	        }
	    },
	};
	_const.default = def;

	return _const;
}

var _enum = {};

var hasRequired_enum;

function require_enum () {
	if (hasRequired_enum) return _enum;
	hasRequired_enum = 1;
	Object.defineProperty(_enum, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const equal_1 = requireEqual();
	const error = {
	    message: "must be equal to one of the allowed values",
	    params: ({ schemaCode }) => (0, codegen_1._) `{allowedValues: ${schemaCode}}`,
	};
	const def = {
	    keyword: "enum",
	    schemaType: "array",
	    $data: true,
	    error,
	    code(cxt) {
	        const { gen, data, $data, schema, schemaCode, it } = cxt;
	        if (!$data && schema.length === 0)
	            throw new Error("enum must have non-empty array");
	        const useLoop = schema.length >= it.opts.loopEnum;
	        let eql;
	        const getEql = () => (eql !== null && eql !== void 0 ? eql : (eql = (0, util_1.useFunc)(gen, equal_1.default)));
	        let valid;
	        if (useLoop || $data) {
	            valid = gen.let("valid");
	            cxt.block$data(valid, loopEnum);
	        }
	        else {
	            /* istanbul ignore if */
	            if (!Array.isArray(schema))
	                throw new Error("ajv implementation error");
	            const vSchema = gen.const("vSchema", schemaCode);
	            valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
	        }
	        cxt.pass(valid);
	        function loopEnum() {
	            gen.assign(valid, false);
	            gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._) `${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
	        }
	        function equalCode(vSchema, i) {
	            const sch = schema[i];
	            return typeof sch === "object" && sch !== null
	                ? (0, codegen_1._) `${getEql()}(${data}, ${vSchema}[${i}])`
	                : (0, codegen_1._) `${data} === ${sch}`;
	        }
	    },
	};
	_enum.default = def;

	return _enum;
}

var hasRequiredValidation;

function requireValidation () {
	if (hasRequiredValidation) return validation;
	hasRequiredValidation = 1;
	Object.defineProperty(validation, "__esModule", { value: true });
	const limitNumber_1 = requireLimitNumber();
	const multipleOf_1 = requireMultipleOf();
	const limitLength_1 = requireLimitLength();
	const pattern_1 = requirePattern();
	const limitProperties_1 = requireLimitProperties();
	const required_1 = requireRequired();
	const limitItems_1 = requireLimitItems();
	const uniqueItems_1 = requireUniqueItems();
	const const_1 = require_const();
	const enum_1 = require_enum();
	const validation$1 = [
	    // number
	    limitNumber_1.default,
	    multipleOf_1.default,
	    // string
	    limitLength_1.default,
	    pattern_1.default,
	    // object
	    limitProperties_1.default,
	    required_1.default,
	    // array
	    limitItems_1.default,
	    uniqueItems_1.default,
	    // any
	    { keyword: "type", schemaType: ["string", "array"] },
	    { keyword: "nullable", schemaType: "boolean" },
	    const_1.default,
	    enum_1.default,
	];
	validation.default = validation$1;

	return validation;
}

var applicator = {};

var additionalItems = {};

var hasRequiredAdditionalItems;

function requireAdditionalItems () {
	if (hasRequiredAdditionalItems) return additionalItems;
	hasRequiredAdditionalItems = 1;
	Object.defineProperty(additionalItems, "__esModule", { value: true });
	additionalItems.validateAdditionalItems = void 0;
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const error = {
	    message: ({ params: { len } }) => (0, codegen_1.str) `must NOT have more than ${len} items`,
	    params: ({ params: { len } }) => (0, codegen_1._) `{limit: ${len}}`,
	};
	const def = {
	    keyword: "additionalItems",
	    type: "array",
	    schemaType: ["boolean", "object"],
	    before: "uniqueItems",
	    error,
	    code(cxt) {
	        const { parentSchema, it } = cxt;
	        const { items } = parentSchema;
	        if (!Array.isArray(items)) {
	            (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
	            return;
	        }
	        validateAdditionalItems(cxt, items);
	    },
	};
	function validateAdditionalItems(cxt, items) {
	    const { gen, schema, data, keyword, it } = cxt;
	    it.items = true;
	    const len = gen.const("len", (0, codegen_1._) `${data}.length`);
	    if (schema === false) {
	        cxt.setParams({ len: items.length });
	        cxt.pass((0, codegen_1._) `${len} <= ${items.length}`);
	    }
	    else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
	        const valid = gen.var("valid", (0, codegen_1._) `${len} <= ${items.length}`); // TODO var
	        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
	        cxt.ok(valid);
	    }
	    function validateItems(valid) {
	        gen.forRange("i", items.length, len, (i) => {
	            cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
	            if (!it.allErrors)
	                gen.if((0, codegen_1.not)(valid), () => gen.break());
	        });
	    }
	}
	additionalItems.validateAdditionalItems = validateAdditionalItems;
	additionalItems.default = def;

	return additionalItems;
}

var prefixItems = {};

var items$1 = {};

var hasRequiredItems;

function requireItems () {
	if (hasRequiredItems) return items$1;
	hasRequiredItems = 1;
	Object.defineProperty(items$1, "__esModule", { value: true });
	items$1.validateTuple = void 0;
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const code_1 = requireCode();
	const def = {
	    keyword: "items",
	    type: "array",
	    schemaType: ["object", "array", "boolean"],
	    before: "uniqueItems",
	    code(cxt) {
	        const { schema, it } = cxt;
	        if (Array.isArray(schema))
	            return validateTuple(cxt, "additionalItems", schema);
	        it.items = true;
	        if ((0, util_1.alwaysValidSchema)(it, schema))
	            return;
	        cxt.ok((0, code_1.validateArray)(cxt));
	    },
	};
	function validateTuple(cxt, extraItems, schArr = cxt.schema) {
	    const { gen, parentSchema, data, keyword, it } = cxt;
	    checkStrictTuple(parentSchema);
	    if (it.opts.unevaluated && schArr.length && it.items !== true) {
	        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
	    }
	    const valid = gen.name("valid");
	    const len = gen.const("len", (0, codegen_1._) `${data}.length`);
	    schArr.forEach((sch, i) => {
	        if ((0, util_1.alwaysValidSchema)(it, sch))
	            return;
	        gen.if((0, codegen_1._) `${len} > ${i}`, () => cxt.subschema({
	            keyword,
	            schemaProp: i,
	            dataProp: i,
	        }, valid));
	        cxt.ok(valid);
	    });
	    function checkStrictTuple(sch) {
	        const { opts, errSchemaPath } = it;
	        const l = schArr.length;
	        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
	        if (opts.strictTuples && !fullTuple) {
	            const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
	            (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
	        }
	    }
	}
	items$1.validateTuple = validateTuple;
	items$1.default = def;

	return items$1;
}

var hasRequiredPrefixItems;

function requirePrefixItems () {
	if (hasRequiredPrefixItems) return prefixItems;
	hasRequiredPrefixItems = 1;
	Object.defineProperty(prefixItems, "__esModule", { value: true });
	const items_1 = requireItems();
	const def = {
	    keyword: "prefixItems",
	    type: "array",
	    schemaType: ["array"],
	    before: "uniqueItems",
	    code: (cxt) => (0, items_1.validateTuple)(cxt, "items"),
	};
	prefixItems.default = def;

	return prefixItems;
}

var items2020 = {};

var hasRequiredItems2020;

function requireItems2020 () {
	if (hasRequiredItems2020) return items2020;
	hasRequiredItems2020 = 1;
	Object.defineProperty(items2020, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const code_1 = requireCode();
	const additionalItems_1 = requireAdditionalItems();
	const error = {
	    message: ({ params: { len } }) => (0, codegen_1.str) `must NOT have more than ${len} items`,
	    params: ({ params: { len } }) => (0, codegen_1._) `{limit: ${len}}`,
	};
	const def = {
	    keyword: "items",
	    type: "array",
	    schemaType: ["object", "boolean"],
	    before: "uniqueItems",
	    error,
	    code(cxt) {
	        const { schema, parentSchema, it } = cxt;
	        const { prefixItems } = parentSchema;
	        it.items = true;
	        if ((0, util_1.alwaysValidSchema)(it, schema))
	            return;
	        if (prefixItems)
	            (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
	        else
	            cxt.ok((0, code_1.validateArray)(cxt));
	    },
	};
	items2020.default = def;

	return items2020;
}

var contains = {};

var hasRequiredContains;

function requireContains () {
	if (hasRequiredContains) return contains;
	hasRequiredContains = 1;
	Object.defineProperty(contains, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const error = {
	    message: ({ params: { min, max } }) => max === undefined
	        ? (0, codegen_1.str) `must contain at least ${min} valid item(s)`
	        : (0, codegen_1.str) `must contain at least ${min} and no more than ${max} valid item(s)`,
	    params: ({ params: { min, max } }) => max === undefined ? (0, codegen_1._) `{minContains: ${min}}` : (0, codegen_1._) `{minContains: ${min}, maxContains: ${max}}`,
	};
	const def = {
	    keyword: "contains",
	    type: "array",
	    schemaType: ["object", "boolean"],
	    before: "uniqueItems",
	    trackErrors: true,
	    error,
	    code(cxt) {
	        const { gen, schema, parentSchema, data, it } = cxt;
	        let min;
	        let max;
	        const { minContains, maxContains } = parentSchema;
	        if (it.opts.next) {
	            min = minContains === undefined ? 1 : minContains;
	            max = maxContains;
	        }
	        else {
	            min = 1;
	        }
	        const len = gen.const("len", (0, codegen_1._) `${data}.length`);
	        cxt.setParams({ min, max });
	        if (max === undefined && min === 0) {
	            (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
	            return;
	        }
	        if (max !== undefined && min > max) {
	            (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
	            cxt.fail();
	            return;
	        }
	        if ((0, util_1.alwaysValidSchema)(it, schema)) {
	            let cond = (0, codegen_1._) `${len} >= ${min}`;
	            if (max !== undefined)
	                cond = (0, codegen_1._) `${cond} && ${len} <= ${max}`;
	            cxt.pass(cond);
	            return;
	        }
	        it.items = true;
	        const valid = gen.name("valid");
	        if (max === undefined && min === 1) {
	            validateItems(valid, () => gen.if(valid, () => gen.break()));
	        }
	        else if (min === 0) {
	            gen.let(valid, true);
	            if (max !== undefined)
	                gen.if((0, codegen_1._) `${data}.length > 0`, validateItemsWithCount);
	        }
	        else {
	            gen.let(valid, false);
	            validateItemsWithCount();
	        }
	        cxt.result(valid, () => cxt.reset());
	        function validateItemsWithCount() {
	            const schValid = gen.name("_valid");
	            const count = gen.let("count", 0);
	            validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
	        }
	        function validateItems(_valid, block) {
	            gen.forRange("i", 0, len, (i) => {
	                cxt.subschema({
	                    keyword: "contains",
	                    dataProp: i,
	                    dataPropType: util_1.Type.Num,
	                    compositeRule: true,
	                }, _valid);
	                block();
	            });
	        }
	        function checkLimits(count) {
	            gen.code((0, codegen_1._) `${count}++`);
	            if (max === undefined) {
	                gen.if((0, codegen_1._) `${count} >= ${min}`, () => gen.assign(valid, true).break());
	            }
	            else {
	                gen.if((0, codegen_1._) `${count} > ${max}`, () => gen.assign(valid, false).break());
	                if (min === 1)
	                    gen.assign(valid, true);
	                else
	                    gen.if((0, codegen_1._) `${count} >= ${min}`, () => gen.assign(valid, true));
	            }
	        }
	    },
	};
	contains.default = def;

	return contains;
}

var dependencies = {};

var hasRequiredDependencies;

function requireDependencies () {
	if (hasRequiredDependencies) return dependencies;
	hasRequiredDependencies = 1;
	(function (exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
		const codegen_1 = requireCodegen();
		const util_1 = requireUtil();
		const code_1 = requireCode();
		exports.error = {
		    message: ({ params: { property, depsCount, deps } }) => {
		        const property_ies = depsCount === 1 ? "property" : "properties";
		        return (0, codegen_1.str) `must have ${property_ies} ${deps} when property ${property} is present`;
		    },
		    params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._) `{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`, // TODO change to reference
		};
		const def = {
		    keyword: "dependencies",
		    type: "object",
		    schemaType: "object",
		    error: exports.error,
		    code(cxt) {
		        const [propDeps, schDeps] = splitDependencies(cxt);
		        validatePropertyDeps(cxt, propDeps);
		        validateSchemaDeps(cxt, schDeps);
		    },
		};
		function splitDependencies({ schema }) {
		    const propertyDeps = {};
		    const schemaDeps = {};
		    for (const key in schema) {
		        if (key === "__proto__")
		            continue;
		        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
		        deps[key] = schema[key];
		    }
		    return [propertyDeps, schemaDeps];
		}
		function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
		    const { gen, data, it } = cxt;
		    if (Object.keys(propertyDeps).length === 0)
		        return;
		    const missing = gen.let("missing");
		    for (const prop in propertyDeps) {
		        const deps = propertyDeps[prop];
		        if (deps.length === 0)
		            continue;
		        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
		        cxt.setParams({
		            property: prop,
		            depsCount: deps.length,
		            deps: deps.join(", "),
		        });
		        if (it.allErrors) {
		            gen.if(hasProperty, () => {
		                for (const depProp of deps) {
		                    (0, code_1.checkReportMissingProp)(cxt, depProp);
		                }
		            });
		        }
		        else {
		            gen.if((0, codegen_1._) `${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
		            (0, code_1.reportMissingProp)(cxt, missing);
		            gen.else();
		        }
		    }
		}
		exports.validatePropertyDeps = validatePropertyDeps;
		function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
		    const { gen, data, keyword, it } = cxt;
		    const valid = gen.name("valid");
		    for (const prop in schemaDeps) {
		        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
		            continue;
		        gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties), () => {
		            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
		            cxt.mergeValidEvaluated(schCxt, valid);
		        }, () => gen.var(valid, true) // TODO var
		        );
		        cxt.ok(valid);
		    }
		}
		exports.validateSchemaDeps = validateSchemaDeps;
		exports.default = def;

	} (dependencies));
	return dependencies;
}

var propertyNames = {};

var hasRequiredPropertyNames;

function requirePropertyNames () {
	if (hasRequiredPropertyNames) return propertyNames;
	hasRequiredPropertyNames = 1;
	Object.defineProperty(propertyNames, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const error = {
	    message: "property name must be valid",
	    params: ({ params }) => (0, codegen_1._) `{propertyName: ${params.propertyName}}`,
	};
	const def = {
	    keyword: "propertyNames",
	    type: "object",
	    schemaType: ["object", "boolean"],
	    error,
	    code(cxt) {
	        const { gen, schema, data, it } = cxt;
	        if ((0, util_1.alwaysValidSchema)(it, schema))
	            return;
	        const valid = gen.name("valid");
	        gen.forIn("key", data, (key) => {
	            cxt.setParams({ propertyName: key });
	            cxt.subschema({
	                keyword: "propertyNames",
	                data: key,
	                dataTypes: ["string"],
	                propertyName: key,
	                compositeRule: true,
	            }, valid);
	            gen.if((0, codegen_1.not)(valid), () => {
	                cxt.error(true);
	                if (!it.allErrors)
	                    gen.break();
	            });
	        });
	        cxt.ok(valid);
	    },
	};
	propertyNames.default = def;

	return propertyNames;
}

var additionalProperties = {};

var hasRequiredAdditionalProperties;

function requireAdditionalProperties () {
	if (hasRequiredAdditionalProperties) return additionalProperties;
	hasRequiredAdditionalProperties = 1;
	Object.defineProperty(additionalProperties, "__esModule", { value: true });
	const code_1 = requireCode();
	const codegen_1 = requireCodegen();
	const names_1 = requireNames();
	const util_1 = requireUtil();
	const error = {
	    message: "must NOT have additional properties",
	    params: ({ params }) => (0, codegen_1._) `{additionalProperty: ${params.additionalProperty}}`,
	};
	const def = {
	    keyword: "additionalProperties",
	    type: ["object"],
	    schemaType: ["boolean", "object"],
	    allowUndefined: true,
	    trackErrors: true,
	    error,
	    code(cxt) {
	        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
	        /* istanbul ignore if */
	        if (!errsCount)
	            throw new Error("ajv implementation error");
	        const { allErrors, opts } = it;
	        it.props = true;
	        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
	            return;
	        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
	        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
	        checkAdditionalProperties();
	        cxt.ok((0, codegen_1._) `${errsCount} === ${names_1.default.errors}`);
	        function checkAdditionalProperties() {
	            gen.forIn("key", data, (key) => {
	                if (!props.length && !patProps.length)
	                    additionalPropertyCode(key);
	                else
	                    gen.if(isAdditional(key), () => additionalPropertyCode(key));
	            });
	        }
	        function isAdditional(key) {
	            let definedProp;
	            if (props.length > 8) {
	                // TODO maybe an option instead of hard-coded 8?
	                const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
	                definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
	            }
	            else if (props.length) {
	                definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._) `${key} === ${p}`));
	            }
	            else {
	                definedProp = codegen_1.nil;
	            }
	            if (patProps.length) {
	                definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._) `${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
	            }
	            return (0, codegen_1.not)(definedProp);
	        }
	        function deleteAdditional(key) {
	            gen.code((0, codegen_1._) `delete ${data}[${key}]`);
	        }
	        function additionalPropertyCode(key) {
	            if (opts.removeAdditional === "all" || (opts.removeAdditional && schema === false)) {
	                deleteAdditional(key);
	                return;
	            }
	            if (schema === false) {
	                cxt.setParams({ additionalProperty: key });
	                cxt.error();
	                if (!allErrors)
	                    gen.break();
	                return;
	            }
	            if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
	                const valid = gen.name("valid");
	                if (opts.removeAdditional === "failing") {
	                    applyAdditionalSchema(key, valid, false);
	                    gen.if((0, codegen_1.not)(valid), () => {
	                        cxt.reset();
	                        deleteAdditional(key);
	                    });
	                }
	                else {
	                    applyAdditionalSchema(key, valid);
	                    if (!allErrors)
	                        gen.if((0, codegen_1.not)(valid), () => gen.break());
	                }
	            }
	        }
	        function applyAdditionalSchema(key, valid, errors) {
	            const subschema = {
	                keyword: "additionalProperties",
	                dataProp: key,
	                dataPropType: util_1.Type.Str,
	            };
	            if (errors === false) {
	                Object.assign(subschema, {
	                    compositeRule: true,
	                    createErrors: false,
	                    allErrors: false,
	                });
	            }
	            cxt.subschema(subschema, valid);
	        }
	    },
	};
	additionalProperties.default = def;

	return additionalProperties;
}

var properties$2 = {};

var hasRequiredProperties;

function requireProperties () {
	if (hasRequiredProperties) return properties$2;
	hasRequiredProperties = 1;
	Object.defineProperty(properties$2, "__esModule", { value: true });
	const validate_1 = requireValidate();
	const code_1 = requireCode();
	const util_1 = requireUtil();
	const additionalProperties_1 = requireAdditionalProperties();
	const def = {
	    keyword: "properties",
	    type: "object",
	    schemaType: "object",
	    code(cxt) {
	        const { gen, schema, parentSchema, data, it } = cxt;
	        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === undefined) {
	            additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
	        }
	        const allProps = (0, code_1.allSchemaProperties)(schema);
	        for (const prop of allProps) {
	            it.definedProperties.add(prop);
	        }
	        if (it.opts.unevaluated && allProps.length && it.props !== true) {
	            it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
	        }
	        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
	        if (properties.length === 0)
	            return;
	        const valid = gen.name("valid");
	        for (const prop of properties) {
	            if (hasDefault(prop)) {
	                applyPropertySchema(prop);
	            }
	            else {
	                gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
	                applyPropertySchema(prop);
	                if (!it.allErrors)
	                    gen.else().var(valid, true);
	                gen.endIf();
	            }
	            cxt.it.definedProperties.add(prop);
	            cxt.ok(valid);
	        }
	        function hasDefault(prop) {
	            return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== undefined;
	        }
	        function applyPropertySchema(prop) {
	            cxt.subschema({
	                keyword: "properties",
	                schemaProp: prop,
	                dataProp: prop,
	            }, valid);
	        }
	    },
	};
	properties$2.default = def;

	return properties$2;
}

var patternProperties = {};

var hasRequiredPatternProperties;

function requirePatternProperties () {
	if (hasRequiredPatternProperties) return patternProperties;
	hasRequiredPatternProperties = 1;
	Object.defineProperty(patternProperties, "__esModule", { value: true });
	const code_1 = requireCode();
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const util_2 = requireUtil();
	const def = {
	    keyword: "patternProperties",
	    type: "object",
	    schemaType: "object",
	    code(cxt) {
	        const { gen, schema, data, parentSchema, it } = cxt;
	        const { opts } = it;
	        const patterns = (0, code_1.allSchemaProperties)(schema);
	        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
	        if (patterns.length === 0 ||
	            (alwaysValidPatterns.length === patterns.length &&
	                (!it.opts.unevaluated || it.props === true))) {
	            return;
	        }
	        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
	        const valid = gen.name("valid");
	        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
	            it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
	        }
	        const { props } = it;
	        validatePatternProperties();
	        function validatePatternProperties() {
	            for (const pat of patterns) {
	                if (checkProperties)
	                    checkMatchingProperties(pat);
	                if (it.allErrors) {
	                    validateProperties(pat);
	                }
	                else {
	                    gen.var(valid, true); // TODO var
	                    validateProperties(pat);
	                    gen.if(valid);
	                }
	            }
	        }
	        function checkMatchingProperties(pat) {
	            for (const prop in checkProperties) {
	                if (new RegExp(pat).test(prop)) {
	                    (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
	                }
	            }
	        }
	        function validateProperties(pat) {
	            gen.forIn("key", data, (key) => {
	                gen.if((0, codegen_1._) `${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
	                    const alwaysValid = alwaysValidPatterns.includes(pat);
	                    if (!alwaysValid) {
	                        cxt.subschema({
	                            keyword: "patternProperties",
	                            schemaProp: pat,
	                            dataProp: key,
	                            dataPropType: util_2.Type.Str,
	                        }, valid);
	                    }
	                    if (it.opts.unevaluated && props !== true) {
	                        gen.assign((0, codegen_1._) `${props}[${key}]`, true);
	                    }
	                    else if (!alwaysValid && !it.allErrors) {
	                        // can short-circuit if `unevaluatedProperties` is not supported (opts.next === false)
	                        // or if all properties were evaluated (props === true)
	                        gen.if((0, codegen_1.not)(valid), () => gen.break());
	                    }
	                });
	            });
	        }
	    },
	};
	patternProperties.default = def;

	return patternProperties;
}

var not = {};

var hasRequiredNot;

function requireNot () {
	if (hasRequiredNot) return not;
	hasRequiredNot = 1;
	Object.defineProperty(not, "__esModule", { value: true });
	const util_1 = requireUtil();
	const def = {
	    keyword: "not",
	    schemaType: ["object", "boolean"],
	    trackErrors: true,
	    code(cxt) {
	        const { gen, schema, it } = cxt;
	        if ((0, util_1.alwaysValidSchema)(it, schema)) {
	            cxt.fail();
	            return;
	        }
	        const valid = gen.name("valid");
	        cxt.subschema({
	            keyword: "not",
	            compositeRule: true,
	            createErrors: false,
	            allErrors: false,
	        }, valid);
	        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
	    },
	    error: { message: "must NOT be valid" },
	};
	not.default = def;

	return not;
}

var anyOf = {};

var hasRequiredAnyOf;

function requireAnyOf () {
	if (hasRequiredAnyOf) return anyOf;
	hasRequiredAnyOf = 1;
	Object.defineProperty(anyOf, "__esModule", { value: true });
	const code_1 = requireCode();
	const def = {
	    keyword: "anyOf",
	    schemaType: "array",
	    trackErrors: true,
	    code: code_1.validateUnion,
	    error: { message: "must match a schema in anyOf" },
	};
	anyOf.default = def;

	return anyOf;
}

var oneOf = {};

var hasRequiredOneOf;

function requireOneOf () {
	if (hasRequiredOneOf) return oneOf;
	hasRequiredOneOf = 1;
	Object.defineProperty(oneOf, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const error = {
	    message: "must match exactly one schema in oneOf",
	    params: ({ params }) => (0, codegen_1._) `{passingSchemas: ${params.passing}}`,
	};
	const def = {
	    keyword: "oneOf",
	    schemaType: "array",
	    trackErrors: true,
	    error,
	    code(cxt) {
	        const { gen, schema, parentSchema, it } = cxt;
	        /* istanbul ignore if */
	        if (!Array.isArray(schema))
	            throw new Error("ajv implementation error");
	        if (it.opts.discriminator && parentSchema.discriminator)
	            return;
	        const schArr = schema;
	        const valid = gen.let("valid", false);
	        const passing = gen.let("passing", null);
	        const schValid = gen.name("_valid");
	        cxt.setParams({ passing });
	        // TODO possibly fail straight away (with warning or exception) if there are two empty always valid schemas
	        gen.block(validateOneOf);
	        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
	        function validateOneOf() {
	            schArr.forEach((sch, i) => {
	                let schCxt;
	                if ((0, util_1.alwaysValidSchema)(it, sch)) {
	                    gen.var(schValid, true);
	                }
	                else {
	                    schCxt = cxt.subschema({
	                        keyword: "oneOf",
	                        schemaProp: i,
	                        compositeRule: true,
	                    }, schValid);
	                }
	                if (i > 0) {
	                    gen
	                        .if((0, codegen_1._) `${schValid} && ${valid}`)
	                        .assign(valid, false)
	                        .assign(passing, (0, codegen_1._) `[${passing}, ${i}]`)
	                        .else();
	                }
	                gen.if(schValid, () => {
	                    gen.assign(valid, true);
	                    gen.assign(passing, i);
	                    if (schCxt)
	                        cxt.mergeEvaluated(schCxt, codegen_1.Name);
	                });
	            });
	        }
	    },
	};
	oneOf.default = def;

	return oneOf;
}

var allOf = {};

var hasRequiredAllOf;

function requireAllOf () {
	if (hasRequiredAllOf) return allOf;
	hasRequiredAllOf = 1;
	Object.defineProperty(allOf, "__esModule", { value: true });
	const util_1 = requireUtil();
	const def = {
	    keyword: "allOf",
	    schemaType: "array",
	    code(cxt) {
	        const { gen, schema, it } = cxt;
	        /* istanbul ignore if */
	        if (!Array.isArray(schema))
	            throw new Error("ajv implementation error");
	        const valid = gen.name("valid");
	        schema.forEach((sch, i) => {
	            if ((0, util_1.alwaysValidSchema)(it, sch))
	                return;
	            const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
	            cxt.ok(valid);
	            cxt.mergeEvaluated(schCxt);
	        });
	    },
	};
	allOf.default = def;

	return allOf;
}

var _if = {};

var hasRequired_if;

function require_if () {
	if (hasRequired_if) return _if;
	hasRequired_if = 1;
	Object.defineProperty(_if, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const util_1 = requireUtil();
	const error = {
	    message: ({ params }) => (0, codegen_1.str) `must match "${params.ifClause}" schema`,
	    params: ({ params }) => (0, codegen_1._) `{failingKeyword: ${params.ifClause}}`,
	};
	const def = {
	    keyword: "if",
	    schemaType: ["object", "boolean"],
	    trackErrors: true,
	    error,
	    code(cxt) {
	        const { gen, parentSchema, it } = cxt;
	        if (parentSchema.then === undefined && parentSchema.else === undefined) {
	            (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
	        }
	        const hasThen = hasSchema(it, "then");
	        const hasElse = hasSchema(it, "else");
	        if (!hasThen && !hasElse)
	            return;
	        const valid = gen.let("valid", true);
	        const schValid = gen.name("_valid");
	        validateIf();
	        cxt.reset();
	        if (hasThen && hasElse) {
	            const ifClause = gen.let("ifClause");
	            cxt.setParams({ ifClause });
	            gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
	        }
	        else if (hasThen) {
	            gen.if(schValid, validateClause("then"));
	        }
	        else {
	            gen.if((0, codegen_1.not)(schValid), validateClause("else"));
	        }
	        cxt.pass(valid, () => cxt.error(true));
	        function validateIf() {
	            const schCxt = cxt.subschema({
	                keyword: "if",
	                compositeRule: true,
	                createErrors: false,
	                allErrors: false,
	            }, schValid);
	            cxt.mergeEvaluated(schCxt);
	        }
	        function validateClause(keyword, ifClause) {
	            return () => {
	                const schCxt = cxt.subschema({ keyword }, schValid);
	                gen.assign(valid, schValid);
	                cxt.mergeValidEvaluated(schCxt, valid);
	                if (ifClause)
	                    gen.assign(ifClause, (0, codegen_1._) `${keyword}`);
	                else
	                    cxt.setParams({ ifClause: keyword });
	            };
	        }
	    },
	};
	function hasSchema(it, keyword) {
	    const schema = it.schema[keyword];
	    return schema !== undefined && !(0, util_1.alwaysValidSchema)(it, schema);
	}
	_if.default = def;

	return _if;
}

var thenElse = {};

var hasRequiredThenElse;

function requireThenElse () {
	if (hasRequiredThenElse) return thenElse;
	hasRequiredThenElse = 1;
	Object.defineProperty(thenElse, "__esModule", { value: true });
	const util_1 = requireUtil();
	const def = {
	    keyword: ["then", "else"],
	    schemaType: ["object", "boolean"],
	    code({ keyword, parentSchema, it }) {
	        if (parentSchema.if === undefined)
	            (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
	    },
	};
	thenElse.default = def;

	return thenElse;
}

var hasRequiredApplicator;

function requireApplicator () {
	if (hasRequiredApplicator) return applicator;
	hasRequiredApplicator = 1;
	Object.defineProperty(applicator, "__esModule", { value: true });
	const additionalItems_1 = requireAdditionalItems();
	const prefixItems_1 = requirePrefixItems();
	const items_1 = requireItems();
	const items2020_1 = requireItems2020();
	const contains_1 = requireContains();
	const dependencies_1 = requireDependencies();
	const propertyNames_1 = requirePropertyNames();
	const additionalProperties_1 = requireAdditionalProperties();
	const properties_1 = requireProperties();
	const patternProperties_1 = requirePatternProperties();
	const not_1 = requireNot();
	const anyOf_1 = requireAnyOf();
	const oneOf_1 = requireOneOf();
	const allOf_1 = requireAllOf();
	const if_1 = require_if();
	const thenElse_1 = requireThenElse();
	function getApplicator(draft2020 = false) {
	    const applicator = [
	        // any
	        not_1.default,
	        anyOf_1.default,
	        oneOf_1.default,
	        allOf_1.default,
	        if_1.default,
	        thenElse_1.default,
	        // object
	        propertyNames_1.default,
	        additionalProperties_1.default,
	        dependencies_1.default,
	        properties_1.default,
	        patternProperties_1.default,
	    ];
	    // array
	    if (draft2020)
	        applicator.push(prefixItems_1.default, items2020_1.default);
	    else
	        applicator.push(additionalItems_1.default, items_1.default);
	    applicator.push(contains_1.default);
	    return applicator;
	}
	applicator.default = getApplicator;

	return applicator;
}

var format$1 = {};

var format = {};

var hasRequiredFormat$1;

function requireFormat$1 () {
	if (hasRequiredFormat$1) return format;
	hasRequiredFormat$1 = 1;
	Object.defineProperty(format, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const error = {
	    message: ({ schemaCode }) => (0, codegen_1.str) `must match format "${schemaCode}"`,
	    params: ({ schemaCode }) => (0, codegen_1._) `{format: ${schemaCode}}`,
	};
	const def = {
	    keyword: "format",
	    type: ["number", "string"],
	    schemaType: "string",
	    $data: true,
	    error,
	    code(cxt, ruleType) {
	        const { gen, data, $data, schema, schemaCode, it } = cxt;
	        const { opts, errSchemaPath, schemaEnv, self } = it;
	        if (!opts.validateFormats)
	            return;
	        if ($data)
	            validate$DataFormat();
	        else
	            validateFormat();
	        function validate$DataFormat() {
	            const fmts = gen.scopeValue("formats", {
	                ref: self.formats,
	                code: opts.code.formats,
	            });
	            const fDef = gen.const("fDef", (0, codegen_1._) `${fmts}[${schemaCode}]`);
	            const fType = gen.let("fType");
	            const format = gen.let("format");
	            // TODO simplify
	            gen.if((0, codegen_1._) `typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._) `${fDef}.type || "string"`).assign(format, (0, codegen_1._) `${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._) `"string"`).assign(format, fDef));
	            cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
	            function unknownFmt() {
	                if (opts.strictSchema === false)
	                    return codegen_1.nil;
	                return (0, codegen_1._) `${schemaCode} && !${format}`;
	            }
	            function invalidFmt() {
	                const callFormat = schemaEnv.$async
	                    ? (0, codegen_1._) `(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))`
	                    : (0, codegen_1._) `${format}(${data})`;
	                const validData = (0, codegen_1._) `(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
	                return (0, codegen_1._) `${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
	            }
	        }
	        function validateFormat() {
	            const formatDef = self.formats[schema];
	            if (!formatDef) {
	                unknownFormat();
	                return;
	            }
	            if (formatDef === true)
	                return;
	            const [fmtType, format, fmtRef] = getFormat(formatDef);
	            if (fmtType === ruleType)
	                cxt.pass(validCondition());
	            function unknownFormat() {
	                if (opts.strictSchema === false) {
	                    self.logger.warn(unknownMsg());
	                    return;
	                }
	                throw new Error(unknownMsg());
	                function unknownMsg() {
	                    return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
	                }
	            }
	            function getFormat(fmtDef) {
	                const code = fmtDef instanceof RegExp
	                    ? (0, codegen_1.regexpCode)(fmtDef)
	                    : opts.code.formats
	                        ? (0, codegen_1._) `${opts.code.formats}${(0, codegen_1.getProperty)(schema)}`
	                        : undefined;
	                const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
	                if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
	                    return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._) `${fmt}.validate`];
	                }
	                return ["string", fmtDef, fmt];
	            }
	            function validCondition() {
	                if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
	                    if (!schemaEnv.$async)
	                        throw new Error("async format in sync schema");
	                    return (0, codegen_1._) `await ${fmtRef}(${data})`;
	                }
	                return typeof format == "function" ? (0, codegen_1._) `${fmtRef}(${data})` : (0, codegen_1._) `${fmtRef}.test(${data})`;
	            }
	        }
	    },
	};
	format.default = def;

	return format;
}

var hasRequiredFormat;

function requireFormat () {
	if (hasRequiredFormat) return format$1;
	hasRequiredFormat = 1;
	Object.defineProperty(format$1, "__esModule", { value: true });
	const format_1 = requireFormat$1();
	const format = [format_1.default];
	format$1.default = format;

	return format$1;
}

var metadata = {};

var hasRequiredMetadata;

function requireMetadata () {
	if (hasRequiredMetadata) return metadata;
	hasRequiredMetadata = 1;
	Object.defineProperty(metadata, "__esModule", { value: true });
	metadata.contentVocabulary = metadata.metadataVocabulary = void 0;
	metadata.metadataVocabulary = [
	    "title",
	    "description",
	    "default",
	    "deprecated",
	    "readOnly",
	    "writeOnly",
	    "examples",
	];
	metadata.contentVocabulary = [
	    "contentMediaType",
	    "contentEncoding",
	    "contentSchema",
	];

	return metadata;
}

var hasRequiredDraft7;

function requireDraft7 () {
	if (hasRequiredDraft7) return draft7;
	hasRequiredDraft7 = 1;
	Object.defineProperty(draft7, "__esModule", { value: true });
	const core_1 = requireCore();
	const validation_1 = requireValidation();
	const applicator_1 = requireApplicator();
	const format_1 = requireFormat();
	const metadata_1 = requireMetadata();
	const draft7Vocabularies = [
	    core_1.default,
	    validation_1.default,
	    (0, applicator_1.default)(),
	    format_1.default,
	    metadata_1.metadataVocabulary,
	    metadata_1.contentVocabulary,
	];
	draft7.default = draft7Vocabularies;

	return draft7;
}

var discriminator = {};

var types = {};

var hasRequiredTypes;

function requireTypes () {
	if (hasRequiredTypes) return types;
	hasRequiredTypes = 1;
	Object.defineProperty(types, "__esModule", { value: true });
	types.DiscrError = void 0;
	var DiscrError;
	(function (DiscrError) {
	    DiscrError["Tag"] = "tag";
	    DiscrError["Mapping"] = "mapping";
	})(DiscrError || (types.DiscrError = DiscrError = {}));

	return types;
}

var hasRequiredDiscriminator;

function requireDiscriminator () {
	if (hasRequiredDiscriminator) return discriminator;
	hasRequiredDiscriminator = 1;
	Object.defineProperty(discriminator, "__esModule", { value: true });
	const codegen_1 = requireCodegen();
	const types_1 = requireTypes();
	const compile_1 = requireCompile();
	const ref_error_1 = requireRef_error();
	const util_1 = requireUtil();
	const error = {
	    message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag
	        ? `tag "${tagName}" must be string`
	        : `value of tag "${tagName}" must be in oneOf`,
	    params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._) `{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`,
	};
	const def = {
	    keyword: "discriminator",
	    type: "object",
	    schemaType: "object",
	    error,
	    code(cxt) {
	        const { gen, data, schema, parentSchema, it } = cxt;
	        const { oneOf } = parentSchema;
	        if (!it.opts.discriminator) {
	            throw new Error("discriminator: requires discriminator option");
	        }
	        const tagName = schema.propertyName;
	        if (typeof tagName != "string")
	            throw new Error("discriminator: requires propertyName");
	        if (schema.mapping)
	            throw new Error("discriminator: mapping is not supported");
	        if (!oneOf)
	            throw new Error("discriminator: requires oneOf keyword");
	        const valid = gen.let("valid", false);
	        const tag = gen.const("tag", (0, codegen_1._) `${data}${(0, codegen_1.getProperty)(tagName)}`);
	        gen.if((0, codegen_1._) `typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
	        cxt.ok(valid);
	        function validateMapping() {
	            const mapping = getMapping();
	            gen.if(false);
	            for (const tagValue in mapping) {
	                gen.elseIf((0, codegen_1._) `${tag} === ${tagValue}`);
	                gen.assign(valid, applyTagSchema(mapping[tagValue]));
	            }
	            gen.else();
	            cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
	            gen.endIf();
	        }
	        function applyTagSchema(schemaProp) {
	            const _valid = gen.name("valid");
	            const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
	            cxt.mergeEvaluated(schCxt, codegen_1.Name);
	            return _valid;
	        }
	        function getMapping() {
	            var _a;
	            const oneOfMapping = {};
	            const topRequired = hasRequired(parentSchema);
	            let tagRequired = true;
	            for (let i = 0; i < oneOf.length; i++) {
	                let sch = oneOf[i];
	                if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
	                    const ref = sch.$ref;
	                    sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
	                    if (sch instanceof compile_1.SchemaEnv)
	                        sch = sch.schema;
	                    if (sch === undefined)
	                        throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
	                }
	                const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
	                if (typeof propSch != "object") {
	                    throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
	                }
	                tagRequired = tagRequired && (topRequired || hasRequired(sch));
	                addMappings(propSch, i);
	            }
	            if (!tagRequired)
	                throw new Error(`discriminator: "${tagName}" must be required`);
	            return oneOfMapping;
	            function hasRequired({ required }) {
	                return Array.isArray(required) && required.includes(tagName);
	            }
	            function addMappings(sch, i) {
	                if (sch.const) {
	                    addMapping(sch.const, i);
	                }
	                else if (sch.enum) {
	                    for (const tagValue of sch.enum) {
	                        addMapping(tagValue, i);
	                    }
	                }
	                else {
	                    throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
	                }
	            }
	            function addMapping(tagValue, i) {
	                if (typeof tagValue != "string" || tagValue in oneOfMapping) {
	                    throw new Error(`discriminator: "${tagName}" values must be unique strings`);
	                }
	                oneOfMapping[tagValue] = i;
	            }
	        }
	    },
	};
	discriminator.default = def;

	return discriminator;
}

var $schema$1 = "http://json-schema.org/draft-07/schema#";
var $id = "http://json-schema.org/draft-07/schema#";
var title$1 = "Core schema meta-schema";
var definitions = {
	schemaArray: {
		type: "array",
		minItems: 1,
		items: {
			$ref: "#"
		}
	},
	nonNegativeInteger: {
		type: "integer",
		minimum: 0
	},
	nonNegativeIntegerDefault0: {
		allOf: [
			{
				$ref: "#/definitions/nonNegativeInteger"
			},
			{
				"default": 0
			}
		]
	},
	simpleTypes: {
		"enum": [
			"array",
			"boolean",
			"integer",
			"null",
			"number",
			"object",
			"string"
		]
	},
	stringArray: {
		type: "array",
		items: {
			type: "string"
		},
		uniqueItems: true,
		"default": [
		]
	}
};
var type$1 = [
	"object",
	"boolean"
];
var properties$1 = {
	$id: {
		type: "string",
		format: "uri-reference"
	},
	$schema: {
		type: "string",
		format: "uri"
	},
	$ref: {
		type: "string",
		format: "uri-reference"
	},
	$comment: {
		type: "string"
	},
	title: {
		type: "string"
	},
	description: {
		type: "string"
	},
	"default": true,
	readOnly: {
		type: "boolean",
		"default": false
	},
	examples: {
		type: "array",
		items: true
	},
	multipleOf: {
		type: "number",
		exclusiveMinimum: 0
	},
	maximum: {
		type: "number"
	},
	exclusiveMaximum: {
		type: "number"
	},
	minimum: {
		type: "number"
	},
	exclusiveMinimum: {
		type: "number"
	},
	maxLength: {
		$ref: "#/definitions/nonNegativeInteger"
	},
	minLength: {
		$ref: "#/definitions/nonNegativeIntegerDefault0"
	},
	pattern: {
		type: "string",
		format: "regex"
	},
	additionalItems: {
		$ref: "#"
	},
	items: {
		anyOf: [
			{
				$ref: "#"
			},
			{
				$ref: "#/definitions/schemaArray"
			}
		],
		"default": true
	},
	maxItems: {
		$ref: "#/definitions/nonNegativeInteger"
	},
	minItems: {
		$ref: "#/definitions/nonNegativeIntegerDefault0"
	},
	uniqueItems: {
		type: "boolean",
		"default": false
	},
	contains: {
		$ref: "#"
	},
	maxProperties: {
		$ref: "#/definitions/nonNegativeInteger"
	},
	minProperties: {
		$ref: "#/definitions/nonNegativeIntegerDefault0"
	},
	required: {
		$ref: "#/definitions/stringArray"
	},
	additionalProperties: {
		$ref: "#"
	},
	definitions: {
		type: "object",
		additionalProperties: {
			$ref: "#"
		},
		"default": {
		}
	},
	properties: {
		type: "object",
		additionalProperties: {
			$ref: "#"
		},
		"default": {
		}
	},
	patternProperties: {
		type: "object",
		additionalProperties: {
			$ref: "#"
		},
		propertyNames: {
			format: "regex"
		},
		"default": {
		}
	},
	dependencies: {
		type: "object",
		additionalProperties: {
			anyOf: [
				{
					$ref: "#"
				},
				{
					$ref: "#/definitions/stringArray"
				}
			]
		}
	},
	propertyNames: {
		$ref: "#"
	},
	"const": true,
	"enum": {
		type: "array",
		items: true,
		minItems: 1,
		uniqueItems: true
	},
	type: {
		anyOf: [
			{
				$ref: "#/definitions/simpleTypes"
			},
			{
				type: "array",
				items: {
					$ref: "#/definitions/simpleTypes"
				},
				minItems: 1,
				uniqueItems: true
			}
		]
	},
	format: {
		type: "string"
	},
	contentMediaType: {
		type: "string"
	},
	contentEncoding: {
		type: "string"
	},
	"if": {
		$ref: "#"
	},
	then: {
		$ref: "#"
	},
	"else": {
		$ref: "#"
	},
	allOf: {
		$ref: "#/definitions/schemaArray"
	},
	anyOf: {
		$ref: "#/definitions/schemaArray"
	},
	oneOf: {
		$ref: "#/definitions/schemaArray"
	},
	not: {
		$ref: "#"
	}
};
var require$$3 = {
	$schema: $schema$1,
	$id: $id,
	title: title$1,
	definitions: definitions,
	type: type$1,
	properties: properties$1,
	"default": true
};

var hasRequiredAjv;

function requireAjv () {
	if (hasRequiredAjv) return ajv.exports;
	hasRequiredAjv = 1;
	(function (module, exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
		const core_1 = requireCore$1();
		const draft7_1 = requireDraft7();
		const discriminator_1 = requireDiscriminator();
		const draft7MetaSchema = require$$3;
		const META_SUPPORT_DATA = ["/properties"];
		const META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
		class Ajv extends core_1.default {
		    _addVocabularies() {
		        super._addVocabularies();
		        draft7_1.default.forEach((v) => this.addVocabulary(v));
		        if (this.opts.discriminator)
		            this.addKeyword(discriminator_1.default);
		    }
		    _addDefaultMetaSchema() {
		        super._addDefaultMetaSchema();
		        if (!this.opts.meta)
		            return;
		        const metaSchema = this.opts.$data
		            ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA)
		            : draft7MetaSchema;
		        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
		        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
		    }
		    defaultMeta() {
		        return (this.opts.defaultMeta =
		            super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : undefined));
		    }
		}
		exports.Ajv = Ajv;
		module.exports = exports = Ajv;
		module.exports.Ajv = Ajv;
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.default = Ajv;
		var validate_1 = requireValidate();
		Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function () { return validate_1.KeywordCxt; } });
		var codegen_1 = requireCodegen();
		Object.defineProperty(exports, "_", { enumerable: true, get: function () { return codegen_1._; } });
		Object.defineProperty(exports, "str", { enumerable: true, get: function () { return codegen_1.str; } });
		Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return codegen_1.stringify; } });
		Object.defineProperty(exports, "nil", { enumerable: true, get: function () { return codegen_1.nil; } });
		Object.defineProperty(exports, "Name", { enumerable: true, get: function () { return codegen_1.Name; } });
		Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function () { return codegen_1.CodeGen; } });
		var validation_error_1 = requireValidation_error();
		Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return validation_error_1.default; } });
		var ref_error_1 = requireRef_error();
		Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function () { return ref_error_1.default; } });

	} (ajv, ajv.exports));
	return ajv.exports;
}

var ajvExports = requireAjv();
var Ajv = /*@__PURE__*/getDefaultExportFromCjs(ajvExports);

var $schema = "http://json-schema.org/draft-07/schema#";
var title = "AddonExe Configuration Schema";
var description = "Schema for the config object in AddonExeBP/scripts/config.js.";
var type = "object";
var properties = {
	version: {
		type: "array",
		items: {
			type: "number"
		},
		minItems: 3,
		maxItems: 3,
		description: "The addon version, e.g., [1, 0, 0]. This is typically managed by the release workflow."
	},
	ownerPlayerNames: {
		type: "array",
		items: {
			type: "string"
		},
		description: "An array of exact player names to be considered owners of the addon."
	},
	commandPrefix: {
		type: "string",
		description: "The prefix for chat-based commands (e.g., '!', '.')."
	},
	serverName: {
		type: "string",
		description: "The name of the server, used in welcome messages and other UI elements."
	},
	defaultGamemode: {
		type: "string",
		"enum": [
			"survival",
			"creative",
			"adventure",
			"spectator"
		],
		description: "The default gamemode for players."
	},
	logLevel: {
		type: "number",
		"enum": [
			0,
			1,
			2,
			3
		],
		description: "Logging verbosity level: 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG."
	},
	exeGlobalNotificationsDefaultOn: {
		type: "boolean",
		description: "If true, admins will receive AddonExe notifications by default."
	},
	data: {
		type: "object",
		properties: {
			autoSaveIntervalSeconds: {
				type: "number"
			}
		}
	},
	restart: {
		type: "object",
		properties: {
			countdownSeconds: {
				type: "number"
			},
			kickMessage: {
				type: "string"
			}
		}
	},
	tpa: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			requestTimeoutSeconds: {
				type: "number"
			},
			cooldownSeconds: {
				type: "number"
			},
			teleportWarmupSeconds: {
				type: "number"
			}
		}
	},
	homes: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			maxHomes: {
				type: "number"
			},
			cooldownSeconds: {
				type: "number"
			},
			teleportWarmupSeconds: {
				type: "number"
			}
		}
	},
	warps: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			cooldownSeconds: {
				type: "number"
			},
			teleportWarmupSeconds: {
				type: "number"
			}
		}
	},
	rtp: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			minRange: {
				type: "number"
			},
			maxRange: {
				type: "number"
			},
			cooldownSeconds: {
				type: "number"
			},
			teleportWarmupSeconds: {
				type: "number"
			}
		}
	},
	kits: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			}
		}
	},
	shop: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			}
		}
	},
	reports: {
		type: "object",
		properties: {
			resolvedReportLifetimeDays: {
				type: "number"
			}
		}
	},
	chat: {
		type: "object",
		properties: {
			logToConsole: {
				type: "boolean"
			}
		}
	},
	economy: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			startingBalance: {
				type: "number"
			},
			baltopLimit: {
				type: "number"
			},
			minimumBounty: {
				type: "number"
			},
			paymentConfirmationThreshold: {
				type: "number"
			},
			paymentConfirmationTimeout: {
				type: "number"
			}
		}
	},
	bounties: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			bountyCreditTimeoutSeconds: {
				type: "number"
			}
		}
	},
	announcements: {
		type: "object",
		properties: {
			enabled: {
				type: "boolean"
			},
			message: {
				type: "string"
			},
			interval: {
				type: "number"
			}
		}
	},
	dimensionLock: {
		type: "object",
		properties: {
			allowAdminBypass: {
				type: "boolean"
			},
			netherLock: {
				type: "boolean"
			},
			endLock: {
				type: "boolean"
			}
		}
	},
	playerInfo: {
		type: "object",
		properties: {
			enableWelcomer: {
				type: "boolean"
			},
			welcomeMessage: {
				type: "string"
			},
			notifyAdminOnNewPlayer: {
				type: "boolean"
			},
			enableDeathCoords: {
				type: "boolean"
			},
			deathCoordsMessage: {
				type: "string"
			}
		}
	},
	playerDefaults: {
		type: "object",
		properties: {
			rankId: {
				type: "string"
			},
			permissionLevel: {
				type: "number"
			}
		}
	},
	serverInfo: {
		type: "object",
		properties: {
			discordLink: {
				type: "string",
				format: "uri"
			},
			websiteLink: {
				type: "string",
				format: "uri"
			},
			rules: {
				type: "array",
				items: {
					type: "string"
				}
			},
			helpfulLinks: {
				type: "array",
				items: {
					type: "object",
					properties: {
						title: {
							type: "string"
						},
						url: {
							type: "string",
							format: "uri"
						}
					},
					required: [
						"title",
						"url"
					]
				}
			}
		}
	},
	soundEvents: {
		type: "object",
		patternProperties: {
			"^[a-zA-Z0-9_]+$": {
				type: "object",
				properties: {
					enabled: {
						type: "boolean"
					},
					soundId: {
						type: "string"
					},
					volume: {
						type: "number"
					},
					pitch: {
						type: "number"
					}
				}
			}
		}
	},
	commandSettings: {
		type: "object",
		patternProperties: {
			"^[a-zA-Z0-9_]+$": {
				type: "object",
				properties: {
					enabled: {
						type: "boolean"
					}
				}
			}
		}
	}
};
var required = [
	"version",
	"ownerPlayerNames",
	"commandPrefix",
	"serverName",
	"defaultGamemode",
	"logLevel",
	"exeGlobalNotificationsDefaultOn",
	"data",
	"restart",
	"tpa",
	"homes",
	"warps",
	"rtp",
	"kits",
	"shop",
	"reports",
	"chat",
	"economy",
	"bounties",
	"announcements",
	"dimensionLock",
	"playerInfo",
	"playerDefaults",
	"serverInfo",
	"soundEvents",
	"commandSettings"
];
var configSchema = {
	$schema: $schema,
	title: title,
	description: description,
	type: type,
	properties: properties,
	required: required
};

/**
 * Validates a configuration object against the main config schema.
 * @param {object} configObject The configuration object to validate.
 */
function validateConfig(configObject) {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(configSchema);
    const valid = validate(configObject);

    if (!valid) {
        errorLog('Configuration validation failed. Please check your config.js for the following errors:');
        for (const error of validate.errors) {
            const path = error.instancePath ? error.instancePath.substring(1).replace(/\//g, '.') : 'config';
            errorLog(`- [${path}] ${error.message}`);
        }
        return false;
    }

    debugLog('Main configuration validation successful.');
    return true;
}


function createConfigManager(key, configPath, name, configKey, wrapperKey = null) {
    const lastLoadedKey = `${key}:last_loaded`;
    let currentConfig = null;
    let lastLoadedConfig = null;

    async function _getDefaultConfig() {
        try {
            // Removed cache-busting query as it can be unreliable in this environment.
            const module = await import(configPath);
            if (!module[configKey]) {
                throw new Error(`Config key '${configKey}' not found in module ${configPath}`);
            }

            const configData = deepClone(module[configKey]);

            // If a wrapper key is provided, wrap the imported data in an object.
            // This is used for configs like 'ranks' which are stored as an array but need to be in an object.
            if (wrapperKey) {
                return { [wrapperKey]: configData };
            }

            return configData;
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to dynamically import config from ${configPath}.`, e);
            return {}; // Return empty object on failure to prevent crashes.
        }
    }

    function saveLastLoadedConfig() {
        try {
            world.setDynamicProperty(lastLoadedKey, JSON.stringify(lastLoadedConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save last loaded config.`, e);
        }
    }

    async function loadConfig(isMigration) {
        const newDefaultConfig = await _getDefaultConfig();
        let isFirstInit = false;

        const userSavedConfigStr = world.getDynamicProperty(key);
        const lastLoadedConfigStr = world.getDynamicProperty(lastLoadedKey);

        if (!userSavedConfigStr) {
            // Scenario 1: First Initialization
            isFirstInit = true;
            currentConfig = newDefaultConfig;
            lastLoadedConfig = newDefaultConfig;
            errorLog(`[${name}ConfigManager] No saved config found. Initializing with default values.`);
            saveLastLoadedConfig();
        } else {
            // Config exists, parse it
            let userSavedConfig;
            try {
                userSavedConfig = JSON.parse(userSavedConfigStr);
            } catch (e) {
                errorLog(`[${name}ConfigManager] Failed to parse user-saved config. It will be reset.`, e);
                userSavedConfig = newDefaultConfig;
            }

            // --- Custom Migration Logic ---
            // This section can be expanded with more migration steps as needed.
            if (name === 'Main' && userSavedConfig.spawnLocation && typeof userSavedConfig.spawnLocation === 'object') {
                debugLog(`[${name}ConfigManager] Migrating legacy spawnLocation to spawn.spawnLocation.`);
                if (!userSavedConfig.spawn) {
                    userSavedConfig.spawn = {};
                }
                // Only migrate if the new location doesn't already exist with a valid value
                if (!userSavedConfig.spawn.spawnLocation) {
                    userSavedConfig.spawn.spawnLocation = deepClone(userSavedConfig.spawnLocation);
                }
                delete userSavedConfig.spawnLocation;
            }
            // --- End Custom Migration Logic ---

            if (isMigration) {
                // Scenario: Addon Update (Migration)
                errorLog(`[${name}ConfigManager] Version mismatch detected. Migrating config.`);
                if (name === 'Ranks' || name === 'Kits' || name === 'Shop') {
                    // For these list-based configs, we preserve the user's data as-is during a migration
                    // to prevent deleted items from reappearing. New items must be added manually by admins.
                    debugLog(`[${name}ConfigManager] Preserving user's current config for ${name} during migration.`);
                    currentConfig = userSavedConfig;
                } else {
                    // For other configs, merge the user's settings on top of the new defaults.
                    // This preserves their settings while adding new properties from the update.
                    currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                }
            } else {
                // Scenario: Standard Load / Reload
                // This logic prioritizes manual file edits over in-game changes.
                if (!lastLoadedConfigStr) {
                    // If there's no 'last loaded' snapshot, we can't detect file changes.
                    // Fallback to a simple merge, treating it like a first-time load for this version.
                    errorLog(`[${name}ConfigManager] No last-loaded config found. Merging current settings with default.`);
                    currentConfig = deepMerge(newDefaultConfig, userSavedConfig);
                } else {
                    try {
                        lastLoadedConfig = JSON.parse(lastLoadedConfigStr);
                    } catch (e) {
                        errorLog(`[${name}ConfigManager] Failed to parse last-loaded config. It will be reset.`, e);
                        lastLoadedConfig = newDefaultConfig;
                    }

                    // --- Custom Merging Logic ---
                    if (name === 'Ranks') {
                        const currentUserRanks = userSavedConfig.rankDefinitions;
                        const newFileRanks = newDefaultConfig.rankDefinitions;
                        const lastLoadedRanks = lastLoadedConfig ? lastLoadedConfig.rankDefinitions : [];
                        const mergedRanks = mergeRanks(currentUserRanks, newFileRanks, lastLoadedRanks);
                        // Re-assign to a new object to avoid modifying the original userSavedConfig reference
                        currentConfig = { ...userSavedConfig, rankDefinitions: mergedRanks };
                    } else if (name === 'Kits' || name === 'Shop') {
                        const lastLoaded = lastLoadedConfig || {};
                        currentConfig = mergeObjectMaps(userSavedConfig, newDefaultConfig, lastLoaded);
                    } else {
                        // For standard configs, use the new 3-way merge utility.
                        currentConfig = mergeWithFileChanges(userSavedConfig, newDefaultConfig, lastLoadedConfig, debugLog, name);
                    }
                }
            }
            // After any load/merge scenario, the "last loaded" snapshot is updated to the current file's state.
            lastLoadedConfig = newDefaultConfig;
            saveLastLoadedConfig();
        }

        saveConfig();

        // After loading and merging, validate the final configuration object.
        if (name === 'Main') {
            validateConfig(currentConfig);
        }

        return isFirstInit;
    }

    function getConfig() {
        return currentConfig;
    }

    function saveConfig() {
        try {
            world.setDynamicProperty(key, JSON.stringify(currentConfig));
        } catch (e) {
            errorLog(`[${name}ConfigManager] Failed to save current config.`, e);
        }
    }

    function updateConfig(updateKey, value) {
        updateMultipleConfig({ [updateKey]: value });
    }

    function setConfig(newConfig) {
        currentConfig = newConfig;
        saveConfig();
    }

    async function reloadConfig() {
        debugLog(`[${name}ConfigManager] Reloading configuration...`);
        await loadConfig(false);
        debugLog(`[${name}ConfigManager] Configuration reloaded.`);
    }

    function updateMultipleConfig(updates) {
        if (!currentConfig) {
            errorLog(`[${name}ConfigManager] Attempted to update config before it was loaded.`);
            return;
        }
        for (const path in updates) {
            setValueByPath(currentConfig, path, updates[path]);
        }
        saveConfig();
    }

    async function resetConfig() {
        const defaultConfig = await _getDefaultConfig();
        currentConfig = defaultConfig;
        lastLoadedConfig = defaultConfig;
        saveConfig();
        saveLastLoadedConfig();

        // Use the now-reliable debugLog for other configs.
        debugLog(`[${name}ConfigManager] Configuration has been reset to default.`);
    }

    return {
        load: loadConfig,
        get: getConfig,
        save: saveConfig,
        set: setConfig,
        update: updateConfig,
        reload: reloadConfig,
        updateMultiple: updateMultipleConfig,
        reset: resetConfig
    };
}

const mainConfigManager = createConfigManager('exe:config:current', '../config.js', 'Main', 'config');

const loadConfig = mainConfigManager.load;
const getConfig = mainConfigManager.get;
const updateConfig = mainConfigManager.update;
const updateMultipleConfig = mainConfigManager.updateMultiple;

/**
 * Resets a section of the configuration to its default values.
 * @param {string} sectionKey The key of the config section to reset (e.g., 'tpa', 'homes'). Use 'all' to reset everything.
 * @param {import('@minecraft/server').Player} [player] - The player who initiated the reset, for feedback.
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function resetConfigSection(sectionKey, player) {
    // Dynamically import configurations to break the circular dependency at load time.
    const { configResetRegistry, configResetCallbacks } = await Promise.resolve().then(function () { return configurations; });

    if (sectionKey === 'all') {
        const resetPromises = [mainConfigManager.reset()];
        Object.values(configResetRegistry).forEach(config => resetPromises.push(config.reset()));
        await Promise.all(resetPromises);

        // Trigger all post-reset callbacks
        for (const key in configResetCallbacks) {
            configResetCallbacks[key](player);
        }
        for (const key in configResetRegistry) {
            if (configResetRegistry[key].postResetCallback) {
                configResetRegistry[key].postResetCallback(player);
            }
        }

        return { success: true, message: 'All configuration settings have been reset to default and systems reloaded.' };
    }

    if (configResetRegistry[sectionKey]) {
        await configResetRegistry[sectionKey].reset();
        if (configResetRegistry[sectionKey].postResetCallback) {
            configResetRegistry[sectionKey].postResetCallback(player);
        }
        return { success: true, message: `${configResetRegistry[sectionKey].message} and reloaded.` };
    }

    // Dynamically import the latest default config to compare against
    try {
        const { config: defaultConfig } = await Promise.resolve().then(function () { return config$1; });
        if (Object.prototype.hasOwnProperty.call(defaultConfig, sectionKey)) {
            updateConfig(sectionKey, deepClone(defaultConfig[sectionKey]));

            // After resetting, check if there's a callback to re-initialize the system
            if (configResetCallbacks[sectionKey]) {
                configResetCallbacks[sectionKey](player);
                return { success: true, message: `The '${sectionKey}' configuration has been reset and the system reloaded.` };
            }

            return { success: true, message: `The '${sectionKey}' configuration section has been reset to default.` };
        } else {
            return { success: false, message: `Configuration section '${sectionKey}' not found.` };
        }
    } catch (e) {
        return { success: false, message: `Failed to load default configuration file. Error: ${e.message}` };
    }
}

/**
 * @fileoverview Manages a cache of online players for efficient lookups.
 * Avoids iterating over world.getAllPlayers() repeatedly.
 */

/**
 * @type {Map<string, import('@minecraft/server').Player>}
 */
const playerCacheById = new Map();

/**
 * @type {Set<string>}
 */
const xrayNotificationAdmins = new Set();

/**
 * Adds a player to the cache. Called on player join.
 * @param {import('@minecraft/server').Player} player The player to add.
 */
function addPlayerToCache(player) {
    playerCacheById.set(player.id, player);
}

/**
 * Removes a player from the cache. Called on player leave.
 * @param {string} playerId The ID of the player to remove.
 */
function removePlayerFromCache(playerId) {
    playerCacheById.delete(playerId);
    // Also remove from xray admin cache if they are in it
    removeAdminFromXrayCache(playerId);
}

/**
 * Gets a player from the cache by their ID.
 * @param {string} playerId The ID of the player to get.
 * @returns {import('@minecraft/server').Player | undefined}
 */
function getPlayerFromCache(playerId) {
    return playerCacheById.get(playerId);
}

/**
 * Finds an online player by their name (case-insensitive).
 * @param {string} playerName The name of the player to find.
 * @returns {import('@minecraft/server').Player | undefined}
 */
function findPlayerByName(playerName) {
    const lowerCasePlayerName = playerName.toLowerCase();
    for (const player of playerCacheById.values()) {
        if (player.name.toLowerCase() === lowerCasePlayerName) {
            return player;
        }
    }
    return undefined;
}

/**
 * Gets all cached players.
 * @returns {import('@minecraft/server').Player[]}
 */
function getAllPlayersFromCache() {
    return Array.from(playerCacheById.values());
}

/**
 * Adds a player's ID to the X-ray admin cache.
 * @param {string} playerId The ID of the player to add.
 */
function addAdminToXrayCache(playerId) {
    xrayNotificationAdmins.add(playerId);
}

/**
 * Removes a player's ID from the X-ray admin cache.
 * @param {string} playerId The ID of the player to remove.
 */
function removeAdminFromXrayCache(playerId) {
    xrayNotificationAdmins.delete(playerId);
}

/**
 * Gets all online players who are subscribed to X-ray notifications.
 * @returns {import('@minecraft/server').Player[]}
 */
function getXrayAdmins() {
    const admins = [];
    for (const playerId of xrayNotificationAdmins) {
        const player = getPlayerFromCache(playerId);
        if (player) {
            admins.push(player);
        }
    }
    return admins;
}

/**
 * @typedef {object} HomeLocation
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} dimensionId
 */


const playerPropertyPrefix = 'exe:player.';
const playerNameIdMapKey = 'exe:playerNameIdMap';
const leaderboardKey = 'exe:economyLeaderboard';

/**
 * @typedef {object} LeaderboardEntry
 * @property {string} playerId
 * @property {string} name
 * @property {number} balance
 */

/** @type {LeaderboardEntry[]} */
let leaderboardCache = [];
let isLeaderboardDirty = false;
let isSaveOnCooldown = false;

/** @type {Map<string, PlayerData>} */
const activePlayerData = new Map();

/** @type {Map<string, string>} */
let playerNameIdMap = new Map();
let playerIdNameMap = new Map();

/** A flag indicating that the name-to-ID map has changed and needs to be saved. */
let isNameIdMapDirty = false;

/**
 * Defines the default structure and values for a new player.
 * This is used to ensure all properties exist, especially for backwards compatibility.
 * @type {Omit<PlayerData, 'name' | 'homes' | 'kitCooldowns' | 'tpaBlockedPlayerIds'>}
 */
const defaultPlayerData = {
    rankId: 'member',
    permissionLevel: 1024,
    balance: 0,
    xrayNotifications: true,
    lastDeathLocation: null,
    deathNotificationSent: true,
    tpaRequestsDisabled: false,
    announcementsMuted: false
};


// --- Generic Data Handling ---

/**
 * A generic function to update a player's data. It handles getting the data,
 * running a modification callback, and saving the data.
 * @param {string} playerId The ID of the player to update.
 * @param {(pData: PlayerData) => void} modificationCallback A callback that receives the player data and modifies it.
 */
function updatePlayerData(playerId, modificationCallback) {
    const pData = getPlayer(playerId);
    if (pData) {
        modificationCallback(pData);
        savePlayerData(playerId);
    }
}

/**
 * Resets all in-memory caches and state variables.
 */
function cleanupPlayerDataManager() {
    leaderboardCache = [];
    isLeaderboardDirty = false;
    isSaveOnCooldown = false;
    activePlayerData.clear();
    playerNameIdMap.clear();
    playerIdNameMap.clear();
    isNameIdMapDirty = false;
    debugLog('[PlayerDataManager] All in-memory caches have been cleared.');
}

/**
 * Saves the player name-to-ID map to a dynamic property.
 */
function saveNameIdMap() {
    try {
        const dataToSave = Array.from(playerNameIdMap.entries());
        world.setDynamicProperty(playerNameIdMapKey, JSON.stringify(dataToSave));
        isNameIdMapDirty = false;
        debugLog('[PlayerDataManager] Saved name-to-ID map.');
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save name-to-ID map: ${e.stack}`);
    }
}

function loadNameIdMap() {
    try {
        const dataString = world.getDynamicProperty(playerNameIdMapKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData = JSON.parse(dataString);
            playerNameIdMap = new Map(parsedData);
            debugLog(`[PlayerDataManager] Loaded ${playerNameIdMap.size} entries into name-to-ID map.`);
        }
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to load name-to-ID map: ${e.stack}`);
    }
}

/**
 * Saves a single player's data to a unique dynamic property.
 * @param {string} playerId The ID of the player to save.
 */
function savePlayerData(playerId) {
    if (!activePlayerData.has(playerId)) {
        errorLog(`[PlayerDataManager] Attempted to save data for non-cached player: ${playerId}`);
        return;
    }
    try {
        const playerData = activePlayerData.get(playerId);
        const dataString = JSON.stringify(playerData);
        world.setDynamicProperty(`${playerPropertyPrefix}${playerId}`, dataString);
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save data for player ${playerId}: ${e.stack}`);
    }
}

/**
 * Loads a single player's data from their unique dynamic property into the cache.
 * @param {string} playerId The ID of the player to load.
 * @returns {PlayerData | null} The loaded player data, or null if not found.
 */
function loadPlayerData(playerId) {
    try {
        const dataString = world.getDynamicProperty(`${playerPropertyPrefix}${playerId}`);
        if (dataString && typeof dataString === 'string') {
            /** @type {Partial<PlayerData>} */
            const loadedData = JSON.parse(dataString);

            // Merge with defaults to ensure all properties exist
            const playerData = {
                ...defaultPlayerData,
                homes: {},
                kitCooldowns: {},
                tpaBlockedPlayerIds: [],
                ...loadedData
            };

            activePlayerData.set(playerId, playerData);
            return playerData;
        }
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to load data for player ${playerId}: ${e.stack}`);
    }
    return null;
}

/**
 * Gets a player's data from the cache, or loads/creates it if it doesn't exist.
 * @param {import('@minecraft/server').Player} player
 * @returns {PlayerData}
 */
function getOrCreatePlayer(player) {
    const playerNameLower = player.name.toLowerCase();
    let mapWasModified = false;

    if (playerNameIdMap.get(playerNameLower) !== player.id) {
        const oldName = playerIdNameMap.get(player.id);
        if (oldName) {
            playerNameIdMap.delete(oldName.toLowerCase());
        }
        playerNameIdMap.set(playerNameLower, player.id);
        playerIdNameMap.set(player.id, player.name);
        mapWasModified = true;
    }

    if (mapWasModified) {
        isNameIdMapDirty = true;
    }

    if (activePlayerData.has(player.id)) {
        const pData = activePlayerData.get(player.id);
        if (pData.name !== player.name) {
            updatePlayerData(player.id, data => { data.name = player.name; });
        }
        return pData;
    }

    const loadedData = loadPlayerData(player.id);
    if (loadedData) {
        if (loadedData.name !== player.name) {
            updatePlayerData(player.id, data => { data.name = player.name; });
        }
        return loadedData;
    }

    const config = getConfig();
    const newPlayerData = {
        name: player.name,
        ...defaultPlayerData,
        rankId: config.playerDefaults.rankId,
        permissionLevel: config.playerDefaults.permissionLevel,
        balance: config.economy.startingBalance,
        xrayNotifications: config.playerDefaults.xrayNotifications,
        homes: {},
        kitCooldowns: {},
        tpaBlockedPlayerIds: []
    };

    activePlayerData.set(player.id, newPlayerData);
    savePlayerData(player.id);
    return newPlayerData;
}

/**
 * Gets a player's ID from their name via the lookup map.
 * @param {string} playerName The name of the player.
 * @returns {string | undefined} The player's ID, or undefined if not found.
 */
function getPlayerIdByName(playerName) {
    return playerNameIdMap.get(playerName.toLowerCase());
}

/**
 * Gets a player's data from the in-memory cache.
 * @param {string} playerId
 * @returns {PlayerData | undefined}
 */
function getPlayer(playerId) {
    return activePlayerData.get(playerId);
}

/**
 * Handles a player leaving the server by removing them from the cache.
 * @param {string} playerId
 */
function handlePlayerLeave$1(playerId) {
    if (activePlayerData.has(playerId)) {
        activePlayerData.delete(playerId);
        debugLog(`[PlayerDataManager] Unloaded data for player ${playerId} from cache.`);
    }
}

/**
 * Gets all active (online) player data from the cache.
 * @returns {Map<string, PlayerData>}
 */
function getAllPlayerData() {
    return activePlayerData;
}

/**
 * Gets the map of all known player names and their corresponding IDs.
 * @returns {Map<string, string>}
 */
function getAllPlayerNameIdMap() {
    return playerNameIdMap;
}

// --- Leaderboard Management ---

function getLeaderboard() {
    return leaderboardCache;
}

function initializeLeaderboard() {
    try {
        const dataString = world.getDynamicProperty(leaderboardKey);
        if (dataString && typeof dataString === 'string') {
            leaderboardCache = JSON.parse(dataString);
            debugLog(`[PlayerDataManager] Loaded ${leaderboardCache.length} players into leaderboard cache.`);
            return;
        }
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to load leaderboard from storage: ${e.stack}`);
    }
    leaderboardCache = [];
}

function triggerLeaderboardSave() {
    if (isSaveOnCooldown) {
        isLeaderboardDirty = true;
        return;
    }
    try {
        world.setDynamicProperty(leaderboardKey, JSON.stringify(leaderboardCache));
        isLeaderboardDirty = false;
        isSaveOnCooldown = true;
        system.runTimeout(() => {
            isSaveOnCooldown = false;
            if (isLeaderboardDirty) {
                triggerLeaderboardSave();
            }
        }, 30 * 20);
    } catch (e) {
        errorLog(`[PlayerDataManager] Failed to save leaderboard: ${e.stack}`);
    }
}

function updateAndSaveLeaderboard(playerId, pData) {
    const config = getConfig();
    const cacheSize = (config.economy.baltopLimit ?? 10) + 5;
    const lowestBalanceOnBoard = leaderboardCache.length < cacheSize ? 0 : (leaderboardCache[leaderboardCache.length - 1]?.balance ?? 0);
    const existingIndex = leaderboardCache.findIndex(p => p.playerId === playerId);
    const playerIsOnBoard = existingIndex !== -1;

    if (!playerIsOnBoard && pData.balance <= lowestBalanceOnBoard) {return;}

    if (playerIsOnBoard) {
        if (leaderboardCache[existingIndex].balance === pData.balance) {return;}
        leaderboardCache.splice(existingIndex, 1);
    }

    leaderboardCache.push({ playerId: playerId, name: pData.name, balance: pData.balance });
    leaderboardCache.sort((a, b) => b.balance - a.balance);

    if (leaderboardCache.length > cacheSize) {
        leaderboardCache.length = cacheSize;
    }
    triggerLeaderboardSave();
}


// --- Pending Payment Management ---

/**
 * @typedef {object} PendingPayment
 * @property {string} sourcePlayerId
 * @property {string} targetPlayerId
 * @property {number} amount
 * @property {number} timestamp
 */

/** @type {Map<string, PendingPayment>} */
const pendingPayments = new Map();

function clearExpiredPayments() {
    const config = getConfig();
    const timeout = config.economy.paymentConfirmationTimeout * 1000; // convert to ms
    const now = Date.now();

    for (const [playerId, payment] of pendingPayments.entries()) {
        if (now - payment.timestamp > timeout) {
            pendingPayments.delete(playerId);
            const player = getPlayerFromCache(playerId);
            if (player) {
                player.sendMessage('§cYour pending payment has expired.');
            }
        }
    }
}


// --- Dimension Lock State Management ---

const netherLockKey = 'exe:dimensionLock_nether';
const endLockKey = 'exe:dimensionLock_end';

function getLockState(dimension) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        return !!world.getDynamicProperty(key);
    } catch { return false; }
}

function setLockState(dimension, isLocked) {
    const key = dimension === 'nether' ? netherLockKey : endLockKey;
    try {
        world.setDynamicProperty(key, isLocked);
    } catch {
        errorLog(`[DimensionLock] Failed to set lock state for ${dimension}.`);
    }
}

// --- Data Modification Wrappers ---

function setPlayerRank(playerId, rankId, permissionLevel) {
    updatePlayerData(playerId, pData => {
        pData.rankId = rankId;
        pData.permissionLevel = permissionLevel;
    });
}

function setPlayerAnnouncementsMuted(playerId, isMuted) {
    updatePlayerData(playerId, pData => { pData.announcementsMuted = isMuted; });
}

function incrementPlayerBalance(playerId, amount) {
    updatePlayerData(playerId, pData => {
        pData.balance += amount;
        updateAndSaveLeaderboard(playerId, pData);
    });
}

function setPlayerLastDeathLocation(playerId, location) {
    updatePlayerData(playerId, pData => {
        pData.lastDeathLocation = location;
        if (location) {
            pData.deathNotificationSent = false;
        }
    });
}

function setDeathNotificationSent(playerId, status) {
    updatePlayerData(playerId, pData => { pData.deathNotificationSent = status; });
}

// --- Economy Specific Logic ---

function getBalance(playerId) {
    const pData = getPlayer(playerId);
    return pData?.balance ?? null;
}

const cooldownDbKey = 'exe:cooldowns';
const saveIntervalTicks = 6000; // Every 5 minutes

/** @type {Map<string, number>} */
let cooldowns = new Map();
let needsSave$2 = false;

/**
 * Loads cooldowns from world dynamic properties.
 */
function loadCooldowns() {
    debugLog('[CooldownManager] Loading cooldowns...');
    const dataStr = world.getDynamicProperty(cooldownDbKey);
    if (dataStr) {
        try {
            const parsedData = JSON.parse(dataStr);
            // Reconstruct the Map from the saved array
            cooldowns = new Map(parsedData);
            debugLog(`[CooldownManager] Loaded ${cooldowns.size} cooldowns.`);
        } catch (e) {
            errorLog('[CooldownManager] Failed to parse cooldown data from world property.', e);
            cooldowns = new Map();
        }
    }
}

/**
 * Saves cooldowns to world dynamic properties if a change has occurred.
 */
function saveCooldowns() {
    if (!needsSave$2) {return;}
    try {
        // Convert Map to an array for JSON serialization
        const dataToSave = Array.from(cooldowns.entries());
        world.setDynamicProperty(cooldownDbKey, JSON.stringify(dataToSave));
        needsSave$2 = false;
        debugLog('[CooldownManager] Saved cooldowns to world properties.');
    } catch (e) {
        errorLog('[CooldownManager] Failed to save cooldowns.', e);
    }
}

/**
 * Iterates through all cooldowns and removes any that have expired.
 * This is for proactive cleanup to prevent the cooldown map from growing indefinitely.
 */
function clearExpiredCooldowns() {
    const now = Date.now();
    let clearedCount = 0;
    for (const [key, expiry] of cooldowns.entries()) {
        if (now >= expiry) {
            cooldowns.delete(key);
            clearedCount++;
        }
    }
    if (clearedCount > 0) {
        needsSave$2 = true;
        debugLog(`[CooldownManager] Cleared ${clearedCount} expired cooldowns.`);
    }
}

function getCooldownKey(playerId, identifier) {
    return `${playerId}:${identifier}`;
}

/**
 * Gets the remaining cooldown for a player for a specific identifier.
 * @param {string} playerId
 * @param {string} identifier A unique name for the cooldown (e.g., a command name).
 * @returns {number} Remaining cooldown in seconds, or 0 if available.
 */
function getCooldown(playerId, identifier) {
    const key = getCooldownKey(playerId, identifier);
    const expiry = cooldowns.get(key);

    if (!expiry) {return 0;}

    const now = Date.now();
    if (now >= expiry) {
        cooldowns.delete(key);
        needsSave$2 = true;
        return 0;
    }

    return Math.ceil((expiry - now) / 1000);
}

// Periodically clear expired cooldowns and save to the world
system.runInterval(() => {
    clearExpiredCooldowns();
    saveCooldowns();
}, saveIntervalTicks);

/**
 * Manages the registration and execution of both slash and chat commands.
 */
class CommandManager {
    constructor() {
        this.commands = new Map();
        this.aliases = new Map();
        this.prefix = 'exe'; // Namespace for all custom commands

        system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
            this.commands.forEach(command => {
                if (command.disableSlashCommand) {return;}

                // Register the primary command name
                this._registerSlashCommand(customCommandRegistry, command, command.slashName || command.name);

                // Register all aliases as separate slash commands
                if (command.aliases) {
                    command.aliases.forEach(alias => {
                        if (command.disabledSlashAliases && command.disabledSlashAliases.includes(alias)) {
                            return; // Skip slash command registration for this alias
                        }
                        this._registerSlashCommand(customCommandRegistry, command, alias);
                    });
                }
            });
        });
    }

    /**
     * Registers a new command.
     * @param {object} commandOptions
     */
    register(commandOptions) {
        const command = { permissionLevel: 0, ...commandOptions };
        this.commands.set(command.name.toLowerCase(), command);

        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.name.toLowerCase());
            }
        }
    }

    /**
     * The core command execution logic, shared by slash and chat commands.
     * @param {import('@minecraft/server').Player | object} executor The player or a console identifier.
     * @param {object} command The command to execute.
     * @param {object} args The parsed arguments for the command.
     * @private
     */
    _executeCommand(executor, command, args) {
        const isPlayer = !!executor.id; // Check if it's a player or console object

        // --- Console Execution ---
        if (!isPlayer) {
            if (!command.allowConsole) {
                console.warn(`[CommandManager] Command '${command.name}' cannot be run from the console.`); // eslint-disable-line no-console
                return;
            }
            system.run(() => {
                try {
                    command.execute(executor, args);
                } catch (error) {
                    console.error(`[CommandManager] Error executing console command '${command.name}': ${error.stack}`); // eslint-disable-line no-console
                }
            });
            return;
        }

        // --- Player Execution ---
        const player = executor;

        // Cooldown Check
        if (command.hasCooldown) {
            const cooldownId = command.cooldownId || command.name;
            const remainingCooldown = getCooldown(player.id, cooldownId);
            if (remainingCooldown > 0) {
                player.sendMessage(`§cYou must wait ${remainingCooldown} more second(s) to use this command.`);
                return;
            }
        }

        // Permission Check
        const pData = getPlayer(player.id);
        if (!pData || pData.permissionLevel > command.permissionLevel) {
            player.sendMessage('§cYou do not have permission to use this command.');
            return;
        }

        // Execute Command
        system.run(() => {
            try {
                command.execute(player, args);
            } catch (error) {
                if (getConfig().debug) {
                    errorLog(`[CommandManager] Error executing command '${command.name}' for player '${player.name}': ${error.stack}`);
                }
                player.sendMessage('§cAn unexpected error occurred while running this command.');
            }
        });
    }

    /**
     * Registers a single slash command or alias.
     * @param {object} customCommandRegistry The registry object from the startup event.
     * @param {object} command The command definition.
     * @param {string} name The name to register (either primary or an alias).
     * @private
     */
    _registerSlashCommand(customCommandRegistry, command, name) {
        const commandData = this.prepareCommandData(command, name);

        const commandCallback = (origin, ...rawArgs) => {
            const executor = origin.sourceEntity || { isConsole: true, sendMessage: (msg) => console.log(msg.replace(/§[0-9a-fklmnor]/g, '')) }; // eslint-disable-line no-console

            // Prepare arguments
            const allParams = (command.parameters || []);
            const parsedArgs = {};
            for (let i = 0; i < allParams.length; i++) {
                if (rawArgs[i] !== undefined) {
                    parsedArgs[allParams[i].name] = rawArgs[i];
                }
            }
            this._executeCommand(executor, command, parsedArgs);
        };

        try {
            customCommandRegistry.registerCommand(commandData, commandCallback);
        } catch (e) {
            if (!e.toString().includes('already in use')) {
                if (getConfig().debug) {
                    errorLog(`[CommandManager] Failed to register slash command '${name}':`, e);
                }
            }
        }
    }

    /**
     * Prepares the command data for registration with the Minecraft API.
     * @param {object} command The command definition.
     * @param {string} nameOverride The specific name to use for this registration (main name or alias).
     * @returns {object} The formatted command data.
     * @private
     */
    prepareCommandData(command, nameOverride) {
        const slashCommandName = nameOverride || command.slashName || command.name;
        const mandatoryParameters = (command.parameters || []).filter(p => !p.optional).map(p => this.formatParameter(p));
        const optionalParameters = (command.parameters || []).filter(p => p.optional).map(p => this.formatParameter(p));

        return {
            name: `${this.prefix}:${slashCommandName}`,
            description: command.description,
            permissionLevel: this.translatePermissionLevel(command.permissionLevel),
            mandatoryParameters,
            optionalParameters
        };
    }

    /**
     * Formats a parameter for registration with the Minecraft API.
     * @param {object} param The parameter definition.
     * @returns {object} The formatted parameter data.
     * @private
     */
    formatParameter(param) {
        const paramTypeMap = {
            'player': CustomCommandParamType.PlayerSelector,
            'string': CustomCommandParamType.String,
            'text': CustomCommandParamType.String, // For greedy strings
            'int': CustomCommandParamType.Integer,
            'float': CustomCommandParamType.Float,
            'boolean': CustomCommandParamType.Boolean,
            'block': CustomCommandParamType.BlockType,
            'item': CustomCommandParamType.ItemType,
            'position': CustomCommandParamType.Position,
            'target': CustomCommandParamType.PlayerSelector
        };

        const type = paramTypeMap[param.type.toLowerCase()];

        if (!type) {
            errorLog(`[CommandManager] Unknown parameter type '${param.type}' for parameter '${param.name}'. Defaulting to String.`);
            return {
                name: param.name,
                type: CustomCommandParamType.String
            };
        }

        const formattedParam = {
            name: param.name,
            type: type
        };

        if (param.enumOptions && Array.isArray(param.enumOptions)) {
            // This is how you define an enum for a string parameter
            formattedParam.enumOptions = param.enumOptions;
        }

        return formattedParam;
    }

    /**
     * Translates the numeric permission level to the API's enum.
     * @param {number} level The numeric permission level.
     * @returns {CommandPermissionLevel} The corresponding enum value.
     * @private
     */
    translatePermissionLevel(level) {
        // We will handle all permission checks with our custom rank system.
        // Registering all commands with 'Any' allows our more granular check to be the single source of truth.
        return CommandPermissionLevel.Any;
    }

    // --- Chat Command Management ---

    /**
     * Handles an incoming chat message and schedules it for execution if it's a valid command.
     * @param {import('@minecraft/server').BeforeChatSendEvent} eventData The chat event data.
     * @returns {boolean} `true` if the message was a command, otherwise `false`.
     */
    handleChatCommand(eventData) {
        const config = getConfig();
        const { sender: player, message } = eventData;
        if (!message.startsWith(config.commandPrefix)) {return false;}

        eventData.cancel = true;

        // Using a regex to split by spaces while respecting quoted strings.
        const commandString = message.slice(config.commandPrefix.length).trim();
        const rawArgs = commandString.match(/"[^"]*"|'[^']*'|\S+/g) || [];
        if (rawArgs.length === 0) {return true;}

        const cleanedArgs = rawArgs.map(arg =>
            (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))
                ? arg.slice(1, -1)
                : arg
        );
        let commandName = cleanedArgs.shift().toLowerCase();

        // Resolve alias to primary command name
        commandName = this.aliases.get(commandName) || commandName;
        const command = this.commands.get(commandName);

        if (!command) {
            player.sendMessage(`§cUnknown command: ${commandName}`);
            return true;
        }

        // --- Argument Parsing ---
        const parsedArgs = {};
        const paramDefs = command.parameters || [];
        let currentArgIndex = 0;

        for (const paramDef of paramDefs) {
            if (currentArgIndex >= cleanedArgs.length) {
                if (!paramDef.optional) {
                    player.sendMessage(`§cMissing required argument: ${paramDef.name}.`);
                    return true; // Stop execution
                }
                break; // No more args to process
            }

            if (paramDef.type === 'text') { // Greedy parameter (consumes the rest)
                parsedArgs[paramDef.name] = cleanedArgs.slice(currentArgIndex).join(' ');
                currentArgIndex = cleanedArgs.length; // Mark all as consumed
                break;
            } else {
                parsedArgs[paramDef.name] = cleanedArgs[currentArgIndex];
                currentArgIndex++;
            }
        }

        // Defer to the centralized execution method
        this._executeCommand(player, command, parsedArgs);

        return true;
    }
}

const commandManager = new CommandManager();

const announcementPanelId = 'config_announcements';

// --- Command Registration ---

commandManager.register({
    name: 'announcement',
    aliases: ['broadcast'],
    description: 'Manages server announcements.',
    category: 'Administration',
    permissionLevel: 1, // Admin and above
    allowConsole: true,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true, description: 'Globally enable or disable announcements (true=ON, false=OFF).' }
    ],
    execute: (executor, args) => {
        // This is an admin-only command, so no need to check permissionLevel here.

        // Case 1: Globally enable or disable announcements
        if (args.enabled !== undefined) {
            const announcementsConfig = getConfig().announcements;
            announcementsConfig.enabled = args.enabled;

            // updateConfig saves the changes and triggers persistence
            updateConfig('announcements', announcementsConfig);

            // Manually restart the announcer to apply the change immediately
            restartAnnouncer();

            executor.sendMessage(`§7Announcements have been globally §${args.enabled ? '2enabled' : 'cdisabled'}§7.`);
            return;
        }

        // Case 2: No arguments, open the UI panel
        // The executor must be a player to receive a UI panel.
        if (executor.isConsole) {
            executor.sendMessage('§cThis command must be run by a player to open the UI. Use `/announcement [true|false]` to control announcements from the console.');
            return;
        }

        Promise.resolve().then(function () { return uiManager; }).then(uiManager => {
            uiManager.showPanel(executor, announcementPanelId);
        }).catch(e => errorLog(`Failed to load uiManager for announcements panel: ${e}`));
    }
});


// --- Announcement Broadcasting ---

let announcementIntervalId;

function stopAnnouncer() {
    if (announcementIntervalId) {
        system.clearRun(announcementIntervalId);
        announcementIntervalId = undefined;
    }
}

function restartAnnouncer() {
    stopAnnouncer(); // Ensure no multiple timers are running

    const config = getConfig();
    if (!config.announcements.enabled || !config.announcements.message || config.announcements.interval <= 0) {
        return;
    }

    announcementIntervalId = system.runInterval(() => {
        const currentConfig = getConfig(); // Get the latest config inside the interval
        if (!currentConfig.announcements.enabled) {
            stopAnnouncer();
            return;
        }

        const message = currentConfig.announcements.message;
        world.getAllPlayers().forEach(player => {
            const pData = getPlayer(player.id);
            if (!pData || !pData.announcementsMuted) {
                player.sendMessage(message);
            }
        });
    }, config.announcements.interval * 20); // Interval is in seconds, system.runInterval uses ticks (20 ticks/sec)
}


// --- System Event Hooks ---

// The announcer is started by main.js after all configs are loaded.

// --- Player-Facing Commands ---

commandManager.register({
    name: 'motdnotify',
    aliases: ['togglemotd'],
    description: 'Toggles or sets your personal announcement preference.',
    category: 'General',
    permissionLevel: 1024, // Allow everyone
    allowConsole: false,
    parameters: [
        { name: 'enabled', type: 'boolean', optional: true, description: 'Set your announcement status (true=ON, false=OFF).' }
    ],
    execute: (executor, args) => {
        const pData = getPlayer(executor.id);
        if (!pData) {return;}

        if (args.enabled !== undefined) {
            const announcementsMuted = !args.enabled;
            setPlayerAnnouncementsMuted(executor.id, announcementsMuted);
            executor.sendMessage(`§7Announcements are now §${announcementsMuted ? 'cOFF' : '2ON'}§7 for you.`);
        } else {
            const currentStatus = pData.announcementsMuted ?? false;
            const newStatus = !currentStatus;
            setPlayerAnnouncementsMuted(executor.id, newStatus);
            executor.sendMessage(`§7Announcements are now §${newStatus ? 'cOFF' : '2ON'}§7 for you.`);
        }
    }
});

commandManager.register({
    name: 'startannounce',
    aliases: ['annon'],
    description: 'Force-enables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    parameters: [],
    execute: (executor) => {
        setPlayerAnnouncementsMuted(executor.id, false); // false = not muted
        executor.sendMessage('§7Announcements are now §2ON§7 for you.');
    }
});

commandManager.register({
    name: 'stopannounce',
    aliases: ['annoff'],
    description: 'Force-disables announcements for yourself.',
    category: 'General',
    permissionLevel: 1024,
    allowConsole: false,
    parameters: [],
    execute: (executor) => {
        setPlayerAnnouncementsMuted(executor.id, true); // true = muted
        executor.sendMessage('§7Announcements are now §cOFF§7 for you.');
    }
});

let sortedRanks = [];

/**
 * A map of functions that evaluate rank conditions.
 * @type {Object.<string, (player: import('@minecraft/server').Player, value: any, config: object) => boolean>}
 */
const conditionEvaluators = {
    /**
     * Checks if the player's name is in the owner list.
     * @param {import('@minecraft/server').Player} player
     * @param {*} value - Not used for this condition.
     * @param {object} config
     * @returns {boolean}
     */
    isOwner: (player, value, config) => {
        const ownerNames = (config.ownerPlayerNames || []).map(name => name.toLowerCase());
        return ownerNames.includes(player.name.toLowerCase());
    },
    /**
     * Checks if the player has a specific tag.
     * @param {import('@minecraft/server').Player} player
     * @param {string} value The tag to check for.
     * @returns {boolean}
     */
    hasTag: (player, value) => {
        return player.hasTag(value);
    },
    /**
     * This is a fallback condition that always returns true.
     * @returns {boolean}
     */
    default: () => {
        return true;
    }
};

/**
 * Reloads and sorts the ranks from the config manager cache.
 * This can be called to refresh ranks after they've been modified in the UI.
 */
function reloadRanks() {
    const allRanks = getRanksConfig().rankDefinitions;
    sortedRanks = [...allRanks].sort((a, b) => a.permissionLevel - b.permissionLevel);
    debugLog(`[RankManager] Reloaded and sorted ${sortedRanks.length} ranks.`);
}

/**
 * Initializes the rank manager by loading and sorting ranks.
 * This is called once at startup.
 */
function initialize$2() {
    reloadRanks();
    debugLog(`[RankManager] Initialized ${sortedRanks.length} ranks.`);
}

/**
 * Gets the rank for a given player by evaluating conditions.
 * @param {import('@minecraft/server').Player} player
 * @param {object} config The addon's configuration object.
 * @returns {import('./ranksConfig.js').RankDefinition}
 */
function getPlayerRank(player, config) {
    for (const rank of sortedRanks) {
        let allConditionsMet = true;
        for (const condition of rank.conditions) {
            const evaluator = conditionEvaluators[condition.type];
            if (!evaluator || !evaluator(player, condition.value, config)) {
                allConditionsMet = false;
                break; // Move to the next rank if any condition fails
            }
        }

        if (allConditionsMet) {
            return rank;
        }
    }

    // Fallback to the configured default rank if no conditions are met
    const defaultRank = getRankById$1(config.playerDefaults.rankId);
    if (defaultRank) {
        return defaultRank;
    }

    // If the configured default rank doesn't exist, log an error and return a minimal, safe fallback.
    errorLog(`[RankManager] CRITICAL: The configured default rank with id "${config.playerDefaults.rankId}" was not found. Please check your configuration.`);
    return {
        id: 'fallback',
        name: 'Fallback',
        permissionLevel: 1024,
        conditions: [{ type: 'default' }],
        chatFormatting: { prefixText: '', nameColor: '§7', messageColor: '§r' }
    };
}

/**
 * Gets a rank definition by its ID.
 * @param {string} rankId The ID of the rank to get.
 * @returns {import('./ranksConfig.js').RankDefinition | undefined}
 */
function getRankById$1(rankId) {
    return getRanksConfig().rankDefinitions.find(rank => rank.id === rankId);
}

/**
 * Gets all rank definitions.
 * @returns {import('./ranksConfig.js').RankDefinition[]}
 */
function getAllRanks() {
    return getRanksConfig().rankDefinitions;
}

// State variables to hold subscription handles and timer IDs for cleanup
let eventHandlers = [];
let intervalId = -1;

/**
 * Unsubscribes all event handlers and clears timers to allow for re-initialization.
 */
function cleanup() {
    for (const { event, handler } of eventHandlers) {
        try {
            event.unsubscribe(handler);
        } catch (e) {
            // This might happen if the script reloads and the handler reference is lost.
            // We log it but don't crash, as the goal is to clean up what we can.
            errorLog(`[SpawnProtection] Failed to unsubscribe from an event: ${e.message}`);
        }
    }
    eventHandlers = []; // Reset for the next initialization

    if (intervalId !== -1) {
        system.clearRun(intervalId);
        intervalId = -1;
    }
}

/**
 * A wrapper for subscribing to events that tracks them for later cleanup.
 * @param {any} event The event signal object (e.g., world.beforeEvents.playerBreakBlock)
 * @param {Function} handler The function to subscribe.
 */
function subscribe(event, handler) {
    // Guard against subscribing to events that might not exist in the current API version.
    if (!event) {
        return;
    }
    event.subscribe(handler);
    eventHandlers.push({ event, handler });
}

/**
 * Checks if a location is within the protected spawn area.
 * @param {import('@minecraft/server').Vector3 | undefined} location The location to check.
 * @param {string | undefined} dimensionId The dimension of the location.
 * @returns {boolean} True if the location is within the protected area.
 */
function isWithinSpawnProtection(location, dimensionId) {
    if (!location || !dimensionId) { return false; }

    const spawnConfig = getSpawnConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;
    const spawnLocation = spawnConfig?.spawn?.spawnLocation;

    // Protection is disabled or the spawn location has not been set yet.
    if (!spawnProtectionConfig?.enabled ||
        !spawnLocation?.dimensionId ||
        typeof spawnLocation.x !== 'number' ||
        typeof spawnLocation.y !== 'number' ||
        typeof spawnLocation.z !== 'number') {
        return false;
    }

    if (dimensionId !== spawnLocation.dimensionId) {
        return false;
    }

    const dx = location.x - spawnLocation.x;
    const dz = location.z - spawnLocation.z; // Corrected: was spawnLocation.y
    const distanceSquared = dx * dx + dz * dz;
    const radiusSquared = spawnProtectionConfig.protectionRadius * spawnProtectionConfig.protectionRadius;

    return distanceSquared <= radiusSquared;
}

/**
 * Checks if a player can bypass spawn protection.
 * @param {Player | undefined} player The player to check.
 * @returns {boolean} True if the player can bypass protection.
 */
function canBypass(player) {
    if (!(player instanceof Player)) {return false;}

    const spawnConfig = getSpawnConfig();
    const mainConfig = getConfig();
    const spawnProtectionConfig = spawnConfig?.spawnProtection;

    if (!spawnProtectionConfig?.allowAdminBypass) {
        return false;
    }
    const playerRank = getPlayerRank(player, mainConfig);
    return playerRank.permissionLevel <= 1; // Admin or Owner
}

/**
 * Registers all spawn protection event listeners based on the current config.
 */
function initialize$1() {
    // Always run cleanup first to remove any existing listeners before re-applying them.
    // This makes the function safely re-runnable.
    cleanup();

    const spawnConfig = getSpawnConfig();
    if (!spawnConfig) {
        errorLog('[SpawnProtection] Could not load spawn configuration.');
        return;
    }

    const { spawn, spawnProtection } = spawnConfig;

    // Guard 1: Check if the spawnProtection config section exists and is enabled.
    if (!spawnProtection?.enabled) {
        // Protection is not configured or is disabled. This is a normal state, so we exit silently.
        return;
    }

    const spawnLocation = spawn?.spawnLocation;

    // Guard 2: If enabled, check if a spawn point has been set.
    if (!spawnLocation) {
        // This is an actionable error. Protection is on, but can't function without a location.
        errorLog('[SpawnProtection] Spawn protection is enabled, but no spawn location is set. Protection will not be active until /setspawn is used.');
        return;
    }

    // --- EVENT-BASED PROTECTIONS ---

    if (spawnProtection.preventBlockBreaking) {
        subscribe(world.beforeEvents.playerBreakBlock, (event) => {
            if (!event.player) {return;}
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventBlockPlacing) {
        subscribe(world.beforeEvents.playerPlaceBlock, (event) => {
            if (!event.player) {return;}
            // Corrected: The dimension ID is on event.block.dimension for this event type.
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }

    if (spawnProtection.preventExplosions) {
        subscribe(world.beforeEvents.explosion, (event) => {
            if (event.dimension.id !== spawnLocation.dimensionId) {return;}
            const finalImpactedBlocks = event.getImpactedBlocks().filter(block =>
                // Corrected: Use the block's dimension, not the event's.
                !isWithinSpawnProtection(block.location, block.dimension.id)
            );
            event.setImpactedBlocks(finalImpactedBlocks);
        });
    }

    if (spawnProtection.preventBlockInteraction) {
        subscribe(world.beforeEvents.playerInteractWithBlock, (event) => {
            if (!event.player) {return;}
            if (isWithinSpawnProtection(event.block.location, event.block.dimension.id) && !canBypass(event.player)) {
                event.cancel = true;
            }
        });
    }


    if (spawnProtection.preventPvP) {
        subscribe(world.beforeEvents.entityHurt, (event) => {
            const { hurtEntity, damageSource } = event;
            const attacker = damageSource.damagingEntity;

            // Check if it's a PvP scenario (player hurting another player)
            if (!(hurtEntity instanceof Player) || !(attacker instanceof Player)) { return; }
            if (hurtEntity.id === attacker.id) { return; } // Self-harm is not PvP

            // Check if the victim is in spawn
            if (!isWithinSpawnProtection(hurtEntity.location, hurtEntity.dimension.id)) { return; }

            // If the attacker can bypass, allow the damage. Otherwise, cancel it.
            if (!canBypass(attacker)) {
                event.cancel = true;
            }
        });
    }

    // --- INTERVAL-BASED PROTECTIONS ---

    intervalId = system.runInterval(() => {
        const currentSpawnConfig = getSpawnConfig();
        const protection = currentSpawnConfig?.spawnProtection;
        const loc = currentSpawnConfig?.spawn?.spawnLocation;

        if (!protection?.enabled || !loc) { return; }

        // Guard against running with a null spawn location, which can cause native crashes.
        if (typeof loc.x !== 'number' || typeof loc.y !== 'number' || typeof loc.z !== 'number') {
            return;
        }

        // Mob Spawning Prevention (Cleanup Routine)
        if (protection.preventHostileMobSpawning) {
            try {
                const entitiesInSpawn = world.getDimension(loc.dimensionId).getEntities({
                    location: loc,
                    maxDistance: protection.protectionRadius,
                    families: ['monster'], // Specifically target hostile mobs
                    excludeFamilies: ['player', 'inanimate']
                });

                for (const entity of entitiesInSpawn) {
                    // Double-check the entity is still in spawn before removing
                    if (isWithinSpawnProtection(entity.location, entity.dimension.id)) {
                        entity.remove();
                    }
                }
            } catch (e) {
                errorLog(`[SpawnProtection] Error during mob cleanup: ${e}`);
            }
        }
    }, 40); // Run every 2 seconds
}

const kitsConfigManager = createConfigManager('exe:kitsConfig:current', './kitsConfig.js', 'Kits', 'kitsConfig');
const shopConfigManager = createConfigManager('exe:shopConfig:current', './shopConfig.js', 'Shop', 'shopConfig');
const spawnConfigManager = createConfigManager('exe:spawnConfig:current', './spawnConfig.js', 'Spawn', 'spawnConfig');
// The last parameter 'rankDefinitions' is the wrapperKey. It ensures the imported array
// is wrapped in an object like { rankDefinitions: [...] }, which the addon expects.
const ranksConfigManager = createConfigManager('exe:ranksConfig', './ranksConfig.js', 'Ranks', 'rankDefinitions', 'rankDefinitions');

const loadKitsConfig = kitsConfigManager.load;
const getKitsConfig = kitsConfigManager.get;
const saveKitsConfig = kitsConfigManager.save;
const resetKitsConfig = kitsConfigManager.reset;

const loadShopConfig = shopConfigManager.load;
const getShopConfig = shopConfigManager.get;
const saveShopConfig = shopConfigManager.save;
const resetShopConfig = shopConfigManager.reset;

const loadSpawnConfig = spawnConfigManager.load;
const getSpawnConfig = spawnConfigManager.get;
const saveSpawnConfig = spawnConfigManager.set;
const resetSpawnConfig = spawnConfigManager.reset;

const loadRanksConfig = ranksConfigManager.load;
const getRanksConfig = ranksConfigManager.get;
const saveRanksConfig = ranksConfigManager.save;
const resetRanksConfig = ranksConfigManager.reset;

const configResetRegistry = {
    'kits': {
        reset: resetKitsConfig,
        message: 'The \'kits\' configuration section has been reset to default.'
        // No post-reset callback needed, data is read live.
    },
    'shop': {
        reset: resetShopConfig,
        message: 'The \'shop\' configuration section has been reset to default.'
        // No post-reset callback needed, data is read live.
    },
    'spawn': {
        reset: resetSpawnConfig,
        message: 'The \'spawn\' configuration section has been reset to default.',
        postResetCallback: (player) => {
            initialize$1();
            if (player) {
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }
    },
    'ranks': {
        reset: resetRanksConfig,
        message: 'The \'ranks\' configuration section has been reset to default.',
        postResetCallback: (player) => {
            reloadRanks();
            if (player) {
                player.sendMessage('§aRanks have been reloaded with new settings.');
            }
        }
    }
};

/**
 * A registry of functions to call after a specific config section is reset.
 * This is for sections within the main `config.js` file.
 */
const configResetCallbacks = {
    'announcements': (player) => {
        restartAnnouncer();
        if (player) {
            player.sendMessage('§aAnnouncement system has been updated with new settings.');
        }
    },
    'dimensionLock': (player) => {
        const config = getConfig(); // Get the freshly reset config
        setLockState('nether', !!config.dimensionLock.lockNether);
        setLockState('end', !!config.dimensionLock.lockEnd);
        if (player) {
            player.sendMessage('§aLive dimension lock states have been updated to match config.');
        }
    }
};

var configurations = /*#__PURE__*/Object.freeze({
    __proto__: null,
    configResetCallbacks: configResetCallbacks,
    configResetRegistry: configResetRegistry,
    getKitsConfig: getKitsConfig,
    getRanksConfig: getRanksConfig,
    getShopConfig: getShopConfig,
    getSpawnConfig: getSpawnConfig,
    loadKitsConfig: loadKitsConfig,
    loadRanksConfig: loadRanksConfig,
    loadShopConfig: loadShopConfig,
    loadSpawnConfig: loadSpawnConfig,
    resetKitsConfig: resetKitsConfig,
    resetRanksConfig: resetRanksConfig,
    resetShopConfig: resetShopConfig,
    resetSpawnConfig: resetSpawnConfig,
    saveKitsConfig: saveKitsConfig,
    saveRanksConfig: saveRanksConfig,
    saveShopConfig: saveShopConfig,
    saveSpawnConfig: saveSpawnConfig
});

/**
 * A manager to track and clear system timers (run and runInterval)
 * to prevent orphaned timers during a script reload.
 */

// Use Sets to store the IDs of active timers. Sets provide O(1) for add/delete.
const intervalIds = new Set();
const timeoutIds = new Set();

/**
 * A wrapper for system.runInterval that tracks the interval ID.
 * @param {() => void} callback The function to execute.
 * @param {number} tickInterval The interval in ticks.
 * @returns {number} The ID of the interval.
 */
function setTrackedInterval(callback, tickInterval) {
    const id = system.runInterval(callback, tickInterval);
    intervalIds.add(id);
    return id;
}

/**
 * A wrapper for system.runTimeout that tracks the timeout ID.
 * @param {() => void} callback The function to execute.
 * @param {number} tickDelay The delay in ticks.
 * @returns {number} The ID of the timeout.
 */
function setTrackedTimeout(callback, tickDelay) {
    const id = system.runTimeout(callback, tickDelay);
    timeoutIds.add(id);
    // When the timeout completes, it no longer needs to be tracked.
    system.runTimeout(() => {
        timeoutIds.delete(id);
    }, tickDelay);
    return id;
}

/**
 * Clears a specific interval and removes it from tracking.
 * @param {number} id The ID of the interval to clear.
 */
function clearTrackedInterval(id) {
    if (intervalIds.has(id)) {
        system.clearRun(id);
        intervalIds.delete(id);
    }
}

/**
 * Clears all tracked intervals and timeouts.
 * This is crucial for handling script reloads gracefully.
 */
function cleanupTimers() {
    debugLog(`[TimerManager] Clearing ${intervalIds.size} intervals and ${timeoutIds.size} timeouts.`);

    for (const id of intervalIds) {
        system.clearRun(id);
    }
    intervalIds.clear();

    for (const id of timeoutIds) {
        system.clearRun(id);
    }
    timeoutIds.clear();

    debugLog('[TimerManager] All tracked timers have been cleared.');
}

/**
 * Saves all "dirty" data to world properties.
 * This includes player data flagged with `needsSave` and the name-to-ID map if it has changed.
 * @param {object} [options={}]
 * @param {boolean} [options.log=true] - Whether to log the save event.
 * @returns {boolean} - True if any data was saved, false otherwise.
 */
function saveAllData(options = {}) {
    const { log = true } = options;
    if (log) {
        debugLog('[DataManager] Starting data sync...');
    }

    let anythingWasSaved = false;

    // Save the player name-to-ID map if it's dirty
    if (isNameIdMapDirty) {
        saveNameIdMap(); // This function will log its own success
        anythingWasSaved = true;
    }

    // Save data for online players whose data is dirty
    const allPlayerData = getAllPlayerData();
    let savedPlayerCount = 0;
    for (const [playerId, playerData] of allPlayerData.entries()) {
        if (playerData.needsSave) {
            savePlayerData(playerId);
            savedPlayerCount++;
        }
    }

    if (savedPlayerCount > 0) {
        anythingWasSaved = true;
        if (log) {
            debugLog(`[DataManager] Saved data for ${savedPlayerCount} modified players.`);
        }
    }

    // Reports are saved immediately by the reportManager, so they are not needed here.


    if (log && anythingWasSaved) {
        debugLog('[DataManager] Data sync complete.');
    } else if (log) {
        debugLog('[DataManager] Data sync finished, no changes to save.');
    }
    return anythingWasSaved;
}

/**
 * Initializes the data manager, including setting up the auto-saver.
 */
function initializeDataManager() {
    const config = getConfig();
    const autoSaveIntervalSeconds = config.data?.autoSaveIntervalSeconds ?? 300;

    if (autoSaveIntervalSeconds > 0) {
        const intervalTicks = autoSaveIntervalSeconds * 20; // 20 ticks/sec
        // Use the tracked interval to ensure it's cleaned up on reload
        setTrackedInterval(() => {
            debugLog('[DataManager] Auto-save triggered by interval.');
            const wasAnythingSaved = saveAllData({ log: false }); // Don't spam logs for auto-saves
            if (wasAnythingSaved) {
                debugLog('[Auto-Save] Server data has been saved.');
            }
        }, intervalTicks);
        debugLog(`[DataManager] Auto-save enabled. Interval: ${autoSaveIntervalSeconds} seconds.`);
    } else {
        debugLog('[DataManager] Auto-save is disabled.');
    }

    // Add a handler to save all data before the script shuts down
    system.beforeEvents.watchdogTerminate.subscribe(event => {
        // eslint-disable-next-line no-console
        console.log('[DataManager] Watchdog termination detected. Attempting to save all data...');
        event.cancel = false; // This is a best-effort save, we don't want to prevent termination
        saveAllData({ log: true });
        // eslint-disable-next-line no-console
        console.log('[DataManager] Final save attempt complete.');
    });
}

const punishmentDbKey = 'exe:punishments';

/**
 * @typedef {'mute' | 'ban'} PunishmentType
 */

/**
 * @typedef {object} Punishment
 * @property {PunishmentType} type
 * @property {number} expires - The timestamp (in milliseconds) when the punishment expires.
 * @property {string} reason
 */

/**
 * @type {Map<string, Punishment>}
 */
let punishments = new Map();
let needsSave$1 = false;

/**
 * Loads punishment data from world dynamic properties.
 */
function loadPunishments() {
    debugLog('[PunishmentManager] Loading punishments...');
    const dataStr = world.getDynamicProperty(punishmentDbKey);
    if (dataStr) {
        try {
            const parsedData = JSON.parse(dataStr);
            // JSON stringifies a Map as an array of [key, value] pairs
            punishments = new Map(parsedData);
            debugLog(`[PunishmentManager] Loaded ${punishments.size} punishments.`);
        } catch (e) {
            errorLog('[PunishmentManager] Failed to parse punishment data from world property.', e);
            punishments = new Map();
        }
    }
}

/**
 * Iterates through all punishments and removes any that have expired.
 */
function clearExpiredPunishments() {
    const now = Date.now();
    let clearedCount = 0;
    for (const [playerId, punishment] of punishments.entries()) {
        if (now > punishment.expires) {
            punishments.delete(playerId);
            clearedCount++;
        }
    }
    if (clearedCount > 0) {
        needsSave$1 = true;
        debugLog(`[PunishmentManager] Cleared ${clearedCount} expired punishments.`);
    }
}

/**
 * Saves punishment data to world dynamic properties if a change has occurred.
 */
function savePunishments() {
    if (!needsSave$1) {return;}
    try {
        // JSON can't stringify a Map directly, so convert to an array first.
        const dataToSave = Array.from(punishments.entries());
        world.setDynamicProperty(punishmentDbKey, JSON.stringify(dataToSave));
        needsSave$1 = false;
        debugLog('[PunishmentManager] Saved punishments to world properties.');
    } catch (e) {
        errorLog('[PunishmentManager] Failed to save punishments.', e);
    }
}

/**
 * Adds or updates a punishment for a player.
 * @param {string} playerId The ID of the player.
 * @param {Punishment} punishment The punishment details.
 */
function addPunishment(playerId, punishment) {
    punishments.set(playerId, punishment);
    needsSave$1 = true;
    savePunishments(); // Save immediately for critical actions
    debugLog(`[PunishmentManager] Added ${punishment.type} for player ${playerId}. Expires: ${new Date(punishment.expires).toLocaleString()}`);
}

/**
 * Gets a player's active punishment.
 * It also clears the punishment if it has expired.
 * @param {string} playerId The ID of the player.
 * @returns {Punishment | undefined}
 */
function getPunishment(playerId) {
    const punishment = punishments.get(playerId);
    if (!punishment) {
        return undefined;
    }

    if (Date.now() > punishment.expires) {
        debugLog(`[PunishmentManager] Punishment for player ${playerId} has expired. Removing.`);
        removePunishment(playerId);
        return undefined;
    }

    return punishment;
}

/**
 * Removes a punishment for a player.
 * @param {string} playerId The ID of the player to unpunish.
 */
function removePunishment(playerId) {
    if (punishments.delete(playerId)) {
        needsSave$1 = true;
        savePunishments(); // Save immediately for critical actions
        debugLog(`[PunishmentManager] Removed punishment for player ${playerId}.`);
    }
}

/**
 * Initializes the punishment manager's periodic tasks.
 */
function initializePunishmentManager() {
    // Periodically clear expired punishments and save to the world
    system.runInterval(() => {
        clearExpiredPunishments();
        savePunishments();
    }, (getConfig().data?.autoSaveIntervalSeconds ?? 30) * 20);
}

const reportsDbKey = 'exe:reports';

/**
 * @typedef {object} Report
 * @property {string} id - A unique ID for the report.
 * @property {string} reporterId - The ID of the player who made the report.
 * @property {string} reporterName - The name of the player who made the report.
 * @property {string} reportedPlayerId - The ID of the player who was reported.
 * @property {string} reportedPlayerName - The name of the player who was reported.
 * @property {string} reason - The reason for the report.
 * @property {string} status - The status of the report ('open', 'assigned', 'resolved').
 * @property {string|null} assignedAdminId - The ID of the admin assigned to the report.
 * @property {number} timestamp - The timestamp when the report was created.
 */

/** @type {Report[]} */
let reports = [];
let needsSave = false;

/**
 * Loads reports from world dynamic properties.
 */
function loadReports() {
    debugLog('[ReportManager] Loading reports...');
    const dataStr = world.getDynamicProperty(reportsDbKey);
    if (dataStr) {
        try {
            reports = JSON.parse(dataStr);
            debugLog(`[ReportManager] Loaded ${reports.length} reports.`);
        } catch (e) {
            errorLog('[ReportManager] Failed to parse report data from world property.', e);
            reports = [];
        }
    }
}

/**
 * Saves reports to world dynamic properties.
 * @param {object} [options={}]
 * @param {boolean} [options.force=false] - If true, saves even if the `needsSave` flag is false.
 */
function saveReports(options = {}) {
    const { force = false } = options;
    if (!needsSave && !force) {return;}

    try {
        world.setDynamicProperty(reportsDbKey, JSON.stringify(reports));
        needsSave = false; // Reset flag after saving
        debugLog('[ReportManager] Saved reports to world properties.');
    } catch (e) {
        errorLog('[ReportManager] Failed to save reports.', e);
    }
}

/**
 * Creates a new report and adds it to the list.
 * @param {import('@minecraft/server').Player} reporter The player making the report.
 * @param {string} reportedPlayerId The ID of the player being reported.
 * @param {string} reportedPlayerName The name of the player being reported.
 * @param {string} reason The reason for the report.
 */
function createReport(reporter, reportedPlayerId, reportedPlayerName, reason) {
    const report = {
        id: Math.random().toString(36).substring(2, 9),
        reporterId: reporter.id,
        reporterName: reporter.name,
        reportedPlayerId: reportedPlayerId,
        reportedPlayerName: reportedPlayerName,
        reason: reason,
        status: 'open',
        assignedAdminId: null,
        timestamp: Date.now()
    };
    reports.push(report);
    needsSave = true;
    saveReports({ force: true }); // Save immediately
}

/**
 * Gets all active reports.
 * @returns {Report[]} A copy of the reports array.
 */
function getAllReports() {
    return [...reports];
}

/**
 * Assigns a report to an admin.
 * @param {string} reportId The ID of the report to assign.
 * @param {string} adminId The ID of the admin to assign the report to.
 */
function assignReport(reportId, adminId) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        report.status = 'assigned';
        report.assignedAdminId = adminId;
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Marks a report as resolved.
 * @param {string} reportId The ID of the report to resolve.
 */
function resolveReport(reportId) {
    const report = reports.find(r => r.id === reportId);
    if (report) {
        report.status = 'resolved';
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Clears a report from the list.
 * @param {string} reportId The ID of the report to clear.
 */
function clearReport(reportId) {
    const index = reports.findIndex(r => r.id === reportId);
    if (index !== -1) {
        reports.splice(index, 1);
        needsSave = true;
        saveReports({ force: true });
    }
}

/**
 * Clears old, resolved reports from the system to prevent data bloat.
 */
function clearOldResolvedReports() {
    const config = getConfig();
    const lifetimeDays = config.reports?.resolvedReportLifetimeDays;

    if (typeof lifetimeDays !== 'number' || lifetimeDays <= 0) {
        return; // Feature is disabled or misconfigured
    }

    const lifetimeMs = lifetimeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const originalCount = reports.length;

    reports = reports.filter(report => {
        if (report.status === 'resolved') {
            return (now - report.timestamp) < lifetimeMs;
        }
        return true; // Keep all non-resolved reports
    });

    const clearedCount = originalCount - reports.length;
    if (clearedCount > 0) {
        needsSave = true;
        debugLog(`[ReportManager] Cleared ${clearedCount} old resolved reports.`);
    }
}

// Periodically clean up old reports. Saving is now handled by the central dataManager.
system.runInterval(() => {
    clearOldResolvedReports();
}, 36000); // Clean up every 30 minutes

/**
 * Manages all active player bounties in an efficient, centralized way.
 * @module bountyManager
 */


const bountyDataKey = 'exe:bountyData';

/**
 * @typedef {object} BountyEntry
 * @property {string} playerId
 * @property {string} name - The last known name of the player with the bounty.
 * @property {number} amount
 */

/**
 * A map of active bounties.
 * Key: playerId, Value: BountyEntry
 * @type {Map<string, BountyEntry>}
 */
let activeBounties = new Map();

/**
 * Loads the active bounty list from a dynamic property into memory.
 */
function loadBounties() {
    try {
        const dataString = world.getDynamicProperty(bountyDataKey);
        if (dataString && typeof dataString === 'string') {
            /** @type {[string, BountyEntry][]} */
            const parsedData = JSON.parse(dataString);
            activeBounties = new Map(parsedData);
            debugLog(`[BountyManager] Loaded ${activeBounties.size} active bounties.`);
        } else {
            debugLog('[BountyManager] No bounty data found in storage. Starting fresh.');
        }
    } catch (e) {
        errorLog(`[BountyManager] Failed to load bounty data: ${e.stack}`);
        activeBounties = new Map(); // Start with a clean slate on error
    }
}

/**
 * Saves the active bounty list to a dynamic property.
 */
function saveBounties() {
    try {
        const dataToSave = Array.from(activeBounties.entries());
        world.setDynamicProperty(bountyDataKey, JSON.stringify(dataToSave));
        debugLog('[BountyManager] Saved active bounty data.');
    } catch (e) {
        errorLog(`[BountyManager] Failed to save bounty data: ${e.stack}`);
    }
}

/**
 * Gets the entire map of active bounties.
 * @returns {Map<string, BountyEntry>}
 */
function getAllBounties() {
    return activeBounties;
}

/**
 * Gets the bounty for a specific player.
 * @param {string} playerId
 * @returns {BountyEntry | undefined}
 */
function getBounty(playerId) {
    return activeBounties.get(playerId);
}

/**
 * Sets or updates the bounty for a specific player.
 * If the amount is 0 or less, the bounty is removed.
 * @param {string} playerId
 * @param {number} amount
 */
function setBounty(playerId, amount) {
    if (amount <= 0) {
        removeBounty(playerId);
        return;
    }

    const pData = getPlayer(playerId);
    if (!pData) {
        errorLog(`[BountyManager] Cannot set bounty for unknown player ID: ${playerId}`);
        return;
    }

    const bountyEntry = {
        playerId: playerId,
        name: pData.name,
        amount: amount
    };

    activeBounties.set(playerId, bountyEntry);
    saveBounties();
    debugLog(`[BountyManager] Set bounty for ${pData.name} to ${amount}.`);
}

/**
 * Adds to an existing bounty.
 * @param {string} playerId
 * @param {number} amountToAdd
 */
function incrementBounty(playerId, amountToAdd) {
    const existingBounty = activeBounties.get(playerId)?.amount ?? 0;
    setBounty(playerId, existingBounty + amountToAdd);
}


/**
 * Removes a bounty from a player.
 * @param {string} playerId
 */
function removeBounty(playerId) {
    if (activeBounties.has(playerId)) {
        activeBounties.delete(playerId);
        saveBounties();
        debugLog(`[BountyManager] Removed bounty for player ID ${playerId}.`);
    }
}

let restartInProgress = false;
let countdownTimer = -1;
let countdownIntervalId = -1;

/**
 * Starts the server restart sequence.
 * @param {import('@minecraft/server').Player} initiator The player who started the restart.
 */
function startRestart(initiator) {
    if (restartInProgress) {
        initiator.sendMessage('§cRestart is already in progress.');
        return;
    }

    const config = getConfig();
    const countdownSeconds = config.restart?.countdownSeconds ?? 30;
    const announcer = initiator.isConsole ? 'The Console' : initiator.name;

    restartInProgress = true;
    countdownTimer = countdownSeconds;

    world.sendMessage(`§l§c[SERVER] Attention! Restart initiated by ${announcer}. The server will restart in ${countdownSeconds} seconds.`);
    initiator.sendMessage('§aYou have initiated the server restart sequence.');

    // Use the tracked interval function
    countdownIntervalId = setTrackedInterval(() => {
        if (countdownTimer > 0) {
            const message = `§l§cServer restarting in ${countdownTimer}...`;
            // Use action bar for a less intrusive, constant reminder
            for (const player of world.getAllPlayers()) {
                player.onScreenDisplay.setActionBar(message);
            }

            // Announce in chat at key moments
            if (countdownTimer === 30 || countdownTimer === 15 || countdownTimer === 10 || countdownTimer <= 5) {
                world.sendMessage(message);
            }

            countdownTimer--;
        } else {
            // Time's up
            clearTrackedInterval(countdownIntervalId); // Use the tracked clear function
            countdownIntervalId = -1; // Reset ID
            finalizeRestart();
        }
    }, 20); // Run every second
}

/**
 * Finalizes the restart: saves data, kicks players, and logs to console.
 */
function finalizeRestart() {
    debugLog('[RestartManager] Finalizing server restart...');
    world.sendMessage('§l§c[SERVER] Finalizing restart... saving all data now.');

    saveAllData({ log: true });

    // Use a short delay to allow the "saving" message to be seen
    setTrackedTimeout(() => {
        debugLog('[RestartManager] Kicking non-admin players.');
        const config = getConfig();
        const kickMessage = config.restart?.kickMessage ?? 'Server is restarting.';

        try {
            const ownerNames = config.ownerPlayerNames.map(name => `name=!"${name}"`).join(',');
            const command = `kick @a[tag=!${config.adminTag},${ownerNames}] ${kickMessage}`;

            debugLog(`[RestartManager] Running kick command: /${command}`);
            world.getDimension('overworld').runCommand(command);
            debugLog('[RestartManager] Kick command finished.');

            // Send a message to any remaining (admin/owner) players.
            for (const player of world.getAllPlayers()) {
                player.sendMessage('§aYou were not kicked by the restart sequence because you are an admin/owner.');
            }
        } catch (error) {
            errorLog(`[RestartManager] Failed to execute kick command: ${error}`);
        }

        errorLog('[AddonExe] SERVER IS READY FOR RESTART. Data has been saved and players have been kicked.');

        restartInProgress = false; // Reset the flag
    }, 60); // 3-second delay
}

function handleChatSend(eventData) {
    const player = eventData.sender;

    const punishment = getPunishment(player.id);
    if (punishment?.type === 'mute') {
        eventData.cancel = true;
        const remainingTime = Math.round((punishment.expires - Date.now()) / 1000);
        const durationText = punishment.expires === Infinity ? 'permanently' : `for another ${remainingTime} seconds`;
        player.sendMessage(`§cYou are muted ${durationText}. Reason: ${punishment.reason}`);
        return;
    }

    const wasCommand = commandManager.handleChatCommand(eventData);
    if (wasCommand) { return; }

    eventData.cancel = true;
    const pData = getPlayer(player.id);
    if (!pData) {
        world.sendMessage(`§7${player.name}§r: ${eventData.message}`);
        return;
    }
    const rank = getRankById$1(pData.rankId);
    const formattedMessage = rank
        ? `${rank.chatFormatting.prefixText}${rank.chatFormatting.nameColor}${player.name}§r: ${rank.chatFormatting.messageColor}${eventData.message}`
        : `§7${player.name}§r: ${eventData.message}`;

    // Log to console if enabled
    if (getConfig().chat?.logToConsole) {
        // Using a plain-text version for the console log to avoid clutter from formatting codes
        // eslint-disable-next-line no-console
        console.log(`<${player.name}> ${eventData.message}`);
    }

    world.sendMessage(formattedMessage);
}

/**
 * Parses a duration string (e.g., "10m", "2h", "7d") and returns the duration in milliseconds.
 * @param {string} durationString The duration string to parse.
 * @returns {number} The duration in milliseconds, or 0 if the format is invalid.
 */
function parseDuration(durationString) {
    const durationRegex = /^(\d+)([smhdw])$/;
    const match = durationString.toLowerCase().match(durationRegex);

    if (!match) {
        return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    let multiplier = 0;

    switch (unit) {
        case 's':
            multiplier = 1000;
            break;
        case 'm':
            multiplier = 1000 * 60;
            break;
        case 'h':
            multiplier = 1000 * 60 * 60;
            break;
        case 'd':
            multiplier = 1000 * 60 * 60 * 24;
            break;
        case 'w':
            multiplier = 1000 * 60 * 60 * 24 * 7;
            break;
    }

    return value * multiplier;
}

/**
 * Plays a sound for a specific player.
 * @param {import('@minecraft/server').Player} player The player to play the sound for.
 * @param {string} soundId The ID of the sound to play.
 */
function playSound(player, soundId) {
    try {
        player.playSound(soundId);
    } catch (e) {
        errorLog(`Failed to play sound "${soundId}" for player ${player.name}: ${e}`);
    }
}

/**
 * Shows a form to a player, handling the 'UserBusy' case by sending a one-time message and then retrying.
 * @param {import('@minecraft/server').Player} player The player to show the form to.
 * @param {import('@minecraft/server-ui').ActionFormData | import('@minecraft/server-ui').ModalFormData | import('@minecraft/server-ui').MessageFormData} form The form to show.
 * @returns {Promise<any>} A promise that resolves with the form response, or undefined if it times out or is cancelled for other reasons.
 */
async function uiWait(player, form) {
    let firstAttempt = await form.show(player);
    if (firstAttempt.cancelationReason !== 'UserBusy') {
        return firstAttempt;
    }

    // If the first attempt failed because the UI was busy, send the message and start retrying.
    player.sendMessage('§eOpening UI... please close chat to view.§r');

    const startTick = system.currentTick;
    while ((system.currentTick - startTick) < 1200) { // 1 minute timeout
        const subsequentAttempt = await form.show(player);
        if (subsequentAttempt.cancelationReason !== 'UserBusy') {
            return subsequentAttempt;
        }
    }

    return undefined; // Timeout
}

/**
 * Plays a configured sound for a player if it's enabled in the config.
 * @param {import('@minecraft/server').Player} player The player to play the sound for.
 * @param {keyof import('../config.js').config.soundEvents} soundEventKey The key of the sound event in the config.
 */
function playSoundFromConfig(player, soundEventKey) {
    try {
        const config = getConfig();
        const soundEvent = config.soundEvents?.[soundEventKey];
        if (soundEvent && soundEvent.enabled) {
            player.playSound(soundEvent.soundId, {
                volume: soundEvent.volume,
                pitch: soundEvent.pitch
            });
        }
    } catch (error) {
        errorLog(`Failed to play sound from config for key "${soundEventKey}": ${error}`);
    }
}

/**
 * Formats a string by replacing placeholders with values from a context object.
 * @param {string} template The string template with placeholders like {key}.
 * @param {object} context An object containing the values to substitute.
 * @returns {string} The formatted string.
 */
function formatString(template, context) {
    if (!template) {
        return '';
    }
    // Replace \n with actual newlines first
    let message = template.replace(/\\n/g, '\n');

    // Replace placeholders
    for (const key in context) {
        if (Object.prototype.hasOwnProperty.call(context, key)) {
            const placeholder = new RegExp(`{${key}}`, 'g');
            message = message.replace(placeholder, context[key]);
        }
    }
    return message;
}

async function handlePlayerSpawn(event) {
    const { player, initialSpawn } = event;
    addPlayerToCache(player);

    // Ban check
    const punishment = getPunishment(player.id);
    if (punishment?.type === 'ban') {
        const remainingTime = Math.round((punishment.expires - Date.now()) / 1000);
        const durationText = punishment.expires === Infinity ? 'permanently' : `for another ${remainingTime} seconds`;

        system.run(() => {
            try {
                const sanitizedReason = punishment.reason.replace(/"/g, '\\"');
                world.getDimension('overworld').runCommand(`kick "${player.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
            } catch (error) {
                errorLog(`[BanCheck] Failed to kick banned player ${player.name}:`, error);
            }
        });
        return;
    }

    const pData = getOrCreatePlayer(player);
    updatePlayerRank(player); // Check and update rank on join

    if (initialSpawn) {
        const rank = getRankById$1(pData.rankId);
        debugLog(`[AddonExe] Player ${player.name} joined with rank ${rank?.name ?? 'unknown'}.`);

        const config = getConfig();
        if (config.playerInfo.enableWelcomer) {
            const context = {
                playerName: player.name,
                serverName: config.serverName,
                discordLink: config.serverInfo.discordLink,
                websiteLink: config.serverInfo.websiteLink
            };
            const welcomeMessage = formatString(config.playerInfo.welcomeMessage, context);
            player.sendMessage(welcomeMessage);
        }
    }

    // Update X-ray notification cache for admins
    if (pData.permissionLevel <= 1 && pData.xrayNotifications) {
        addAdminToXrayCache(player.id);
    }

    // Check for a death location to message the player after a brief delay.
    system.runTimeout(() => {
        const freshPlayer = world.getAllPlayers().find(p => p.id === player.id);
        if (!freshPlayer) { return; }

        const freshPData = getPlayer(player.id);

        if (freshPData && freshPData.lastDeathLocation && !freshPData.deathNotificationSent) {
            const location = freshPData.lastDeathLocation;
            const config = getConfig();
            const context = {
                x: location.x.toFixed(2),
                y: location.y.toFixed(2),
                z: location.z.toFixed(2),
                dimensionId: location.dimensionId.replace('minecraft:', '')
            };
            const message = formatString(config.playerInfo.deathCoordsMessage, context);
            freshPlayer.sendMessage(message);

            setDeathNotificationSent(player.id, true);
        }
    }, 1);
}

/**
 * @fileoverview Manages tracking the last player who damaged another player.
 * This is used to determine the killer when the `damageCause` in the `entityDie`
 * event is unreliable.
 */

/**
 * @typedef {object} LastHitInfo
 * @property {string} attackerId - The ID of the player who was the attacker.
 * @property {number} timestamp - The timestamp of when the hit occurred (in milliseconds).
 */

/**
 * A map of player IDs to their last hit information.
 * Key: Victim's Player ID, Value: LastHitInfo
 * @type {Map<string, LastHitInfo>}
 */
const lastHitData = new Map();

/**
 * Records a hit from an attacker to a victim.
 * @param {string} victimId The ID of the player who was hit.
 * @param {string} attackerId The ID of the player who performed the hit.
 */
function setLastHit(victimId, attackerId) {
    lastHitData.set(victimId, {
        attackerId: attackerId,
        timestamp: Date.now()
    });
}

/**
 * Retrieves the last hit information for a given player.
 * @param {string} victimId The ID of the player to get the last hit info for.
 * @returns {LastHitInfo | undefined}
 */
function getLastHit(victimId) {
    return lastHitData.get(victimId);
}

/**
 * Clears the last hit data for a player. This should be called after a bounty
 * is processed to prevent the data from being used again.
 * @param {string} victimId The ID of the player whose last hit data should be cleared.
 */
function clearLastHit(victimId) {
    lastHitData.delete(victimId);
}

function handleEntityHurt(event) {
    const { hurtEntity, damageSource } = event;
    const victim = hurtEntity;

    if (victim?.typeId !== 'minecraft:player') {
        return;
    }

    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) {
        return;
    }

    const attacker = damagingEntity.owner ?? damagingEntity;

    if (attacker?.typeId === 'minecraft:player' && attacker.id !== victim.id) {
        setLastHit(victim.id, attacker.id);
    }
}

function handlePlayerLeave(event) {
    handlePlayerLeave$1(event.playerId);
    removePlayerFromCache(event.playerId);
    debugLog(`[AddonExe] Player ${event.playerName} left.`);
}

function handlePlayerDimensionChange(event) {
    const { player, toDimension, fromLocation, fromDimension } = event;
    const config = getConfig();

    let dimensionId;
    if (toDimension.id === 'minecraft:nether') {
        dimensionId = 'nether';
    } else if (toDimension.id === 'minecraft:the_end') {
        dimensionId = 'end';
    } else {
        return;
    }

    const isLocked = getLockState(dimensionId);
    if (!isLocked) {
        return;
    }

    if (config.dimensionLock?.allowAdminBypass) {
        const pData = getPlayer(player.id);
        if (pData && pData.permissionLevel <= 1) {
            debugLog(`[DimensionLock] Allowing admin ${player.name} to enter locked ${dimensionId} dimension.`);
            return;
        }
    }

    try {
        const returnLocation = {
            x: fromLocation.x + 3,
            y: fromLocation.y,
            z: fromLocation.z + 3
        };
        player.teleport(returnLocation, { dimension: fromDimension });
        player.sendMessage(`§cThe ${dimensionId} dimension is currently locked.`);
    } catch (e) {
        errorLog(`[DimensionLock] Failed to teleport player ${player.name} from locked dimension: ${e.stack}`);
    }
}

/**
 * @fileoverview This file defines the schema for all UI panels in the addon.
 * It is used by the uiManager and its sub-modules to dynamically generate UI forms.
 */

// --- TYPE DEFINITIONS ---

/**
 * @typedef {'toggle' | 'textField' | 'dropdown'} UIControlType
 */

/**
 * @typedef {object} ConfigSetting
 * @property {string} key - The dot-separated path to the setting in the config object (e.g., 'tpa.enabled').
 * @property {string} label - The user-friendly label for the setting in the UI.
 * @property {UIControlType} type - The type of UI control to use for this setting.
 * @property {string[]} [options] - For 'dropdown' type, the list of available option strings.
 * @property {string} [description] - A short description of the setting, shown as a tooltip or help text.
 */

/**
 * @typedef {object} ConfigCategory
 * @property {string} id - A unique identifier for the category.
 * @property {string} title - The title of the category panel.
 * @property {string} icon - The icon texture path for the category button.
 * @property {string} [configSource] - The source of the configuration (e.g., 'spawn'). Defaults to 'main'.
 * @property {ConfigSetting[]} settings - An array of settings within this category.
 */

/**
 * @typedef {object} PanelItem
 * @property {string} id - A unique identifier for the button.
 * @property {string} text - The display text for the button.
 * @property {string} [icon] - An optional icon texture path.
 * @property {number} permissionLevel - The minimum permission level required to see this button.
 * @property {'openPanel' | 'functionCall'} actionType - The action to perform when clicked.
 * @property {string} actionValue - The ID of the panel to open or the function to call.
 * @property {number} [sortId] - An optional number to control the order of items. Lower numbers appear first.
 */

/**
 * @typedef {object} PanelDefinition
 * @property {string} title - The title of the panel.
 * @property {string | null} parentPanelId - The ID of the parent panel for back navigation. null for top-level panels.
 * @property {PanelItem[]} items - The buttons to display on this panel.
 */

// --- PANEL REGISTRIES ---

/**
 * @type {Record<string, PanelDefinition>}
 */
const panelDefinitions = {
    mainPanel: {
        title: '§l§3Panel§r',
        parentPanelId: null,
        items: [
            {
                id: 'reportManagement',
                text: '§cReport Management',
                icon: 'textures/ui/WarningGlyph',
                permissionLevel: 2,
                actionType: 'openPanel',
                actionValue: 'reportListPanel',
                sortId: 10
            },
            {
                id: 'playerManagement',
                text: '§4Player Management',
                icon: 'textures/ui/icon_multiplayer.png',
                permissionLevel: 2, // Admin only
                actionType: 'openPanel',
                actionValue: 'playerManagementPanel',
                sortId: 15
            },
            {
                id: 'moderation',
                text: '§cModeration',
                icon: 'textures/ui/hammer_l.png',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'moderationPanel',
                sortId: 20
            },
            {
                id: 'floatingText',
                text: '§bFloating Text',
                icon: 'textures/ui/text_color_paintbrush',
                permissionLevel: 1, // Admin and above
                actionType: 'openPanel',
                actionValue: 'floatingTextListPanel',
                sortId: 25
            },
            {
                id: 'config',
                text: '§3Config',
                icon: 'textures/ui/settings_glyph_color_2x',
                permissionLevel: 1, // Admin and above
                actionType: 'openPanel',
                actionValue: 'configCategoryPanel',
                sortId: 30
            },
            {
                id: 'bountyList',
                text: '§6Bounty List',
                icon: 'textures/items/netherite_sword.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'bountyListPanel',
                sortId: 40
            },
            {
                id: 'playerList',
                text: '§2Player List',
                icon: 'textures/ui/icon_steve.png',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'playerListPanel',
                sortId: 45
            },
            {
                id: 'rules',
                text: '§cRules',
                icon: 'textures/items/book_enchanted.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showRules',
                sortId: 50
            },
            {
                id: 'myStats',
                text: '§3My Stats',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'myStatsPanel',
                sortId: 60
            },
            {
                id: 'helpfulLinks',
                text: '§9Helpful Links',
                icon: 'textures/items/chain',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'showHelpfulLinks',
                sortId: 70
            },
            {
                id: 'shop',
                text: '§2Shop',
                icon: 'textures/ui/trade_icon',
                permissionLevel: 1024, // Everyone
                actionType: 'openPanel',
                actionValue: 'shopMainPanel',
                sortId: 5
            }
        ]
    },
    shopMainPanel: {
        title: '§l§aShop Categories§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    configResetPanel: {
        title: '§l§cReset Configuration§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    shopManagementPanel: {
        title: '§l§2Shop System§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    reportListPanel: {
        title: '§l§4Active Reports§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    reportActionsPanel: {
        title: '§l§4Report Details§r',
        parentPanelId: 'reportListPanel',
        items: [
            {
                id: 'assignReport',
                text: '§eAssign to Me',
                icon: 'textures/ui/profile_glyph_color.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'assignReport'
            },
            {
                id: 'resolveReport',
                text: '§2Mark as Resolved',
                icon: 'textures/ui/check.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'resolveReport'
            },
            {
                id: 'clearReport',
                text: '§cClear Report',
                icon: 'textures/ui/trash.png',
                permissionLevel: 2,
                actionType: 'functionCall',
                actionValue: 'clearReport'
            }
        ]
    },
    bountyListPanel: {
        title: '§l§6Bounty List§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    myStatsPanel: {
        title: '§l§3Your Stats§r',
        parentPanelId: 'mainPanel',
        items: [] // Body is dynamically generated
    },
    helpfulLinksPanel: {
        title: '§l§9Helpful Links§r',
        parentPanelId: 'mainPanel',
        items: [] // Body is dynamically generated
    },
    moderationPanel: {
        title: '§l§cModeration Tools§r',
        parentPanelId: 'mainPanel',
        items: [
            {
                id: 'unbanPlayer',
                text: '§2Unban Player',
                icon: 'textures/ui/check.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnbanForm'
            },
            {
                id: 'unmutePlayer',
                text: '§2Unmute Player',
                icon: 'textures/ui/mute_off.png',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'showUnmuteForm'
            }
        ]
    },
    configCategoryPanel: {
        title: '§l§3Configuration§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    kitManagementPanel: {
        title: '§l§dKit System§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    rankManagementPanel: {
        title: '§l§4Rank System§r',
        parentPanelId: 'configCategoryPanel',
        items: [] // Dynamically populated
    },
    editRankPanel: {
        title: '§l§3Edit Rank§r',
        parentPanelId: 'rankManagementPanel',
        items: [] // Dynamically populated
    },
    addRankPanel: {
        title: '§l§2Add New Rank§r',
        parentPanelId: 'rankManagementPanel',
        items: [] // Dynamically populated
    },
    playerManagementPanel: {
        title: '§l§4Player Management§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    playerListPanel: {
        title: '§l§2Online Players§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    bountyActionsPanel: {
        title: '§l§6Bounty Actions§r',
        parentPanelId: 'playerActionsPanel',
        items: [
            {
                id: 'setBounty',
                text: '§eSet Bounty',
                icon: 'textures/ui/realms_green_check.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'bountyPlayer',
                sortId: 10
            },
            {
                id: 'removePlayerBounty',
                text: '§cRemove Bounty',
                icon: 'textures/ui/cancel.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'removePlayerBounty',
                sortId: 20
            }
        ]
    },
    playerActionsPanel: {
        title: '§l§e{playerName}§r', // Title will be dynamic
        parentPanelId: 'mainPanel', // This will be dynamically overridden
        items: [
            // Admin Actions (for Player Management panel)
            { id: 'kick', text: '§cKick', icon: 'textures/ui/cancel.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'kickPlayer' },
            { id: 'mute', text: '§6Mute', icon: 'textures/ui/mute_on.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'mutePlayer' },
            { id: 'unmute', text: '§aUnmute', icon: 'textures/ui/mute_off.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'unmutePlayer' },
            { id: 'ban', text: '§4Ban', icon: 'textures/ui/hammer_l.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'banPlayer' },
            { id: 'freeze', text: '§bFreeze', icon: 'textures/ui/icon_lock.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'freezePlayer' },
            { id: 'unfreeze', text: '§bUnfreeze', icon: 'textures/ui/icon_unlocked.png', permissionLevel: 2, actionType: 'functionCall', actionValue: 'unfreezePlayer' },
            // Player Actions (for Player List panel)
            { id: 'tpa', text: '§eTPA', icon: 'textures/gui/controls/jump.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaPlayer', sortId: 10 },
            { id: 'tpahere', text: '§9TPAHere', icon: 'textures/gui/controls/sneak.png', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'tpaherePlayer', sortId: 20 },
            { id: 'bounty', text: '§6Bounty', icon: 'textures/items/netherite_sword.png', permissionLevel: 1024, actionType: 'openPanel', actionValue: 'bountyActionsPanel', sortId: 30 },
            { id: 'report', text: '§cReport Player', icon: 'textures/ui/WarningGlyph', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'reportPlayer', sortId: 40 }
        ]
    },
    rulesManagementPanel: {
        title: '§l§4Rules Management',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    addRulePanel: {
        title: 'Add New Rule',
        parentPanelId: 'rulesManagementPanel',
        items: [] // Modal form, no items needed
    },
    ruleActionPanel: {
        title: 'Manage Rule',
        parentPanelId: 'rulesManagementPanel',
        items: [] // Dynamically populated
    },
    helpfulLinksManagementPanel: {
        title: '§l§9Links Management',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    addHelpfulLinkPanel: {
        title: 'Add New Link',
        parentPanelId: 'helpfulLinksManagementPanel',
        items: [] // Modal form, no items needed
    },
    helpfulLinkActionPanel: {
        title: 'Manage Link',
        parentPanelId: 'helpfulLinksManagementPanel',
        items: [] // Dynamically populated
    },
    shopAdminCategoryActionPanel: {
        title: 'Manage Category',
        parentPanelId: 'shopManagementPanel',
        items: [] // Dynamically populated
    },
    shopAdminSubCategoryItemPanel: {
        title: 'Manage Subcategory Items',
        parentPanelId: 'shopAdminCategoryPanel', // This will be dynamic
        items: [] // Dynamically populated
    },
    shopAdminSubCategoryActionPanel: {
        title: 'Manage Subcategory',
        parentPanelId: 'shopAdminSubCategoryItemPanel', // This will be dynamic
        items: [] // Dynamically populated
    },
    floatingTextListPanel: {
        title: '§l§bFloating Text§r',
        parentPanelId: 'mainPanel',
        items: [] // Dynamically populated
    },
    floatingTextEditPanel: {
        title: '§l§bEdit Floating Text§r',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Modal form, no items needed
    },
    floatingTextCreatePanel: {
        title: '§l§bCreate Floating Text§r',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Modal form, no items needed
    },
    floatingTextActionPanel: {
        title: '§l§bFloating Text Actions§r',
        parentPanelId: 'floatingTextListPanel',
        items: [] // Dynamically populated
    }
};

/**
 * @type {ConfigCategory[]}
 */
const configPanelSchema = [
    {
        id: 'general',
        title: '§l§3General System§r',
        icon: 'textures/ui/settings_glyph_color_2x',
        settings: [
            {
                key: 'serverName',
                label: 'Server Name',
                type: 'textField',
                description: 'The name of the server, displayed in various messages.'
            },
            {
                key: 'commandPrefix',
                label: 'Command Prefix',
                type: 'textField',
                description: 'The prefix used for chat-based commands (e.g., !).'
            },
            {
                key: 'defaultGamemode',
                label: 'Default Gamemode',
                type: 'dropdown',
                options: ['survival', 'creative', 'adventure', 'spectator'],
                description: 'The default gamemode for new players.'
            },
            {
                key: 'debug',
                label: 'Debug Mode',
                type: 'toggle',
                description: 'Enables detailed logging for development and troubleshooting.'
            },
            {
                key: 'data.autoSaveIntervalSeconds',
                label: 'Autosave Interval (s)',
                type: 'textField',
                description: 'How often to save player data, in seconds. Set to 0 to disable.'
            }
        ]
    },
    {
        id: 'announcements',
        title: '§l§2Announcement System§r',
        icon: 'textures/ui/icon_bell',
        settings: [
            {
                key: 'announcements.enabled',
                label: 'Announcements Enabled',
                type: 'toggle',
                description: 'Enables or disables the periodic announcement broadcast.'
            },
            {
                key: 'announcements.message',
                label: 'Announcement Message',
                type: 'textField',
                description: 'The message to be broadcast. Use color codes for formatting.'
            },
            {
                key: 'announcements.interval',
                label: 'Interval (seconds)',
                type: 'textField',
                description: 'How often the message is broadcast, in seconds. A reload is required for changes to take effect.'
            }
        ]
    },
    {
        id: 'warps',
        title: '§l§dWarp System§r',
        icon: 'textures/blocks/portal_placeholder',
        settings: [
            {
                key: 'warps.enabled',
                label: 'Warps Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire warp system.'
            },
            {
                key: 'warps.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /warp.'
            },
            {
                key: 'warps.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'bounties',
        title: '§l§cBounty System§r',
        icon: 'textures/items/diamond_sword',
        settings: [
            {
                key: 'bounties.enabled',
                label: 'Bounties Enabled',
                type: 'toggle',
                description: 'Enables or disables the bounty system.'
            },
            {
                key: 'bounties.bountyCreditTimeoutSeconds',
                label: 'Credit Timeout (s)',
                type: 'textField',
                description: 'How long a player is credited for a kill after their last hit.'
            },
            {
                key: 'bounties.minimumBounty',
                label: 'Minimum Bounty',
                type: 'textField',
                description: 'The minimum amount for setting a bounty.'
            }
        ]
    },
    {
        id: 'chat',
        title: '§l§2Chat Settings§r',
        icon: 'textures/ui/chat_send',
        settings: [
            {
                key: 'chat.logToConsole',
                label: 'Log Chat to Console',
                type: 'toggle',
                description: 'Prints player chat messages to the server console.'
            }
        ]
    },
    {
        id: 'spawn',
        title: '§l§eSpawn System§r',
        icon: 'textures/blocks/beacon',
        configSource: 'spawn',
        settings: [
            {
                key: 'spawn.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /spawn.'
            },
            {
                key: 'spawn.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting to spawn.'
            },
            {
                key: 'spawn.spawnLocation.x',
                label: 'Spawn X Coordinate',
                type: 'textField',
                description: 'Leave blank or set with /setspawn.'
            },
            {
                key: 'spawn.spawnLocation.y',
                label: 'Spawn Y Coordinate',
                type: 'textField',
                description: 'Leave blank or set with /setspawn.'
            },
            {
                key: 'spawn.spawnLocation.z',
                label: 'Spawn Z Coordinate',
                type: 'textField',
                description: 'Leave blank or set with /setspawn.'
            },
            {
                key: 'spawnProtection.enabled',
                label: 'Protection Enabled',
                type: 'toggle',
                description: 'Master switch for all spawn protection features.'
            },
            {
                key: 'spawnProtection.protectionRadius',
                label: 'Protection Radius',
                type: 'textField',
                description: 'The radius (in blocks) from spawn to protect.'
            },
            {
                key: 'spawnProtection.allowAdminBypass',
                label: 'Admin Bypass',
                type: 'toggle',
                description: 'Allows admins to bypass all spawn protection rules.'
            },
            {
                key: 'spawnProtection.preventPvP',
                label: 'Prevent PvP',
                type: 'toggle',
                description: 'Prevents players from damaging other players in spawn.'
            },
            {
                key: 'spawnProtection.preventHostileMobSpawning',
                label: 'Prevent Hostile Mob Spawning',
                type: 'toggle',
                description: 'Removes hostile mobs that spawn in the protected area.'
            },
            {
                key: 'spawnProtection.preventBlockBreaking',
                label: 'Prevent Block Breaking',
                type: 'toggle',
                description: 'Prevents players from breaking blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventBlockPlacing',
                label: 'Prevent Block Placing',
                type: 'toggle',
                description: 'Prevents players from placing blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventExplosions',
                label: 'Prevent Explosions',
                type: 'toggle',
                description: 'Prevents explosions from destroying blocks in spawn.'
            },
            {
                key: 'spawnProtection.preventBlockInteraction',
                label: 'Prevent Block Interaction',
                type: 'toggle',
                description: 'Prevents interaction with chests, doors, etc., in spawn.'
            }
        ]
    },
    {
        id: 'tpa',
        title: '§l§bTPA System§r',
        icon: 'textures/ui/icon_multiplayer',
        settings: [
            {
                key: 'tpa.enabled',
                label: 'TPA Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire TPA system.'
            },
            {
                key: 'tpa.requestTimeoutSeconds',
                label: 'Request Timeout (s)',
                type: 'textField',
                description: 'How long a TPA request remains valid before expiring.'
            },
            {
                key: 'tpa.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between TPA uses.'
            },
            {
                key: 'tpa.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'homes',
        title: '§l§2Home System§r',
        icon: 'textures/ui/icon_recipe_item',
        settings: [
            {
                key: 'homes.enabled',
                label: 'Homes Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire home system.'
            },
            {
                key: 'homes.maxHomes',
                label: 'Max Homes',
                type: 'textField',
                description: 'The maximum number of homes a player can set.'
            },
            {
                key: 'homes.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /home.'
            },
            {
                key: 'homes.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'rtp',
        title: '§l§9Random Teleport§r',
        icon: 'textures/items/ender_pearl',
        settings: [
            {
                key: 'rtp.enabled',
                label: 'RTP Enabled',
                type: 'toggle',
                description: 'Enables or disables the /rtp command.'
            },
            {
                key: 'rtp.minRange',
                label: 'Minimum Range',
                type: 'textField',
                description: 'The minimum distance a player can be teleported.'
            },
            {
                key: 'rtp.maxRange',
                label: 'Maximum Range',
                type: 'textField',
                description: 'The maximum distance a player can be teleported.'
            },
            {
                key: 'rtp.cooldownSeconds',
                label: 'Cooldown (s)',
                type: 'textField',
                description: 'How long a player must wait between using /rtp.'
            },
            {
                key: 'rtp.teleportWarmupSeconds',
                label: 'Warmup (s)',
                type: 'textField',
                description: 'How long a player must stand still before teleporting.'
            }
        ]
    },
    {
        id: 'economy',
        title: '§l§6Economy System§r',
        icon: 'textures/items/gold_ingot.png',
        settings: [
            {
                key: 'economy.enabled',
                label: 'Economy Enabled',
                type: 'toggle',
                description: 'Enables or disables the entire economy system.'
            },
            {
                key: 'economy.startingBalance',
                label: 'Starting Balance',
                type: 'textField',
                description: 'The amount of money new players start with.'
            }
        ]
    },
    {
        id: 'playerInfo',
        title: '§l§ePlayer Info System§r',
        icon: 'textures/ui/icon_multiplayer',
        settings: [
            {
                key: 'playerInfo.enableWelcomer',
                label: 'Enable Welcomer',
                type: 'toggle',
                description: 'Sends a welcome message to new players.'
            },
            {
                key: 'playerInfo.welcomeMessage',
                label: 'Welcome Message',
                type: 'textField',
                description: 'The message sent to new players. Use {playerName}, etc.'
            },
            {
                key: 'playerInfo.notifyAdminOnNewPlayer',
                label: 'Notify Admin on New Player',
                type: 'toggle',
                description: 'Alerts admins when a new player joins for the first time.'
            },
            {
                key: 'playerInfo.enableDeathCoords',
                label: 'Enable Death Coords',
                type: 'toggle',
                description: 'Tells players their coordinates upon respawning after death.'
            }
        ]
    },
    {
        id: 'dimensionLock',
        title: '§l§5Dimension Locking§r',
        icon: 'textures/ui/realmPortalSmall',
        settings: [
            {
                key: 'dimensionLock.netherLock',
                label: 'Lock Nether Dimension',
                type: 'toggle',
                description: 'Prevents non-admins from entering the Nether.'
            },
            {
                key: 'dimensionLock.endLock',
                label: 'Lock End Dimension',
                type: 'toggle',
                description: 'Prevents non-admins from entering the End.'
            },
            {
                key: 'dimensionLock.allowAdminBypass',
                label: 'Allow Admin Bypass',
                type: 'toggle',
                description: 'If enabled, admins can enter locked dimensions.'
            }
        ]
    }
];

var panelRegistry = /*#__PURE__*/Object.freeze({
    __proto__: null,
    configPanelSchema: configPanelSchema,
    panelDefinitions: panelDefinitions
});

/**
 * Gets the current list of rules from the main configuration.
 * @returns {string[]} The array of rules.
 */
function getRules() {
    const config = getConfig();
    return config.serverInfo.rules || [];
}

/**
 * Saves the entire rules array back to the configuration.
 * @param {string[]} rules The full array of rules to save.
 */
function saveRules(rules) {
    updateMultipleConfig({ 'serverInfo.rules': rules });
    debugLog('[RulesManager] Updated rules saved to config.');
}

/**
 * Adds a new rule to the end of the list and saves.
 * @param {string} ruleText The text of the new rule.
 */
function addRule(ruleText) {
    if (!ruleText || typeof ruleText !== 'string') {return;}
    const rules = getRules();
    rules.push(ruleText);
    saveRules(rules);
    debugLog(`[RulesManager] Added rule: "${ruleText}"`);
}

/**
 * Updates the rule at a specific index and saves.
 * @param {number} index The index of the rule to edit.
 * @param {string} newText The new text for the rule.
 */
function editRule(index, newText) {
    const rules = getRules();
    if (index < 0 || index >= rules.length || !newText) {return;}
    const oldText = rules[index];
    rules[index] = newText;
    saveRules(rules);
    debugLog(`[RulesManager] Edited rule at index ${index}: from "${oldText}" to "${newText}"`);
}

/**
 * Deletes a rule at a specific index and saves.
 * @param {number} index The index of the rule to delete.
 */
function deleteRule(index) {
    const rules = getRules();
    if (index < 0 || index >= rules.length) {return;}
    const deletedRule = rules.splice(index, 1);
    saveRules(rules);
    debugLog(`[RulesManager] Deleted rule at index ${index}: "${deletedRule[0]}"`);
}

/**
 * Moves a rule up or down in the list and saves.
 * @param {number} index The index of the rule to move.
 * @param {'up' | 'down'} direction The direction to move the rule.
 */
function moveRule(index, direction) {
    const rules = getRules();
    if (index < 0 || index >= rules.length) {return;}

    if (direction === 'up') {
        if (index === 0) {return;} // Can't move up if already at the top
        [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]];
        debugLog(`[RulesManager] Moved rule up at index ${index}`);
    } else if (direction === 'down') {
        if (index === rules.length - 1) {return;} // Can't move down if already at the bottom
        [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]];
        debugLog(`[RulesManager] Moved rule down at index ${index}`);
    }

    saveRules(rules);
}

/**
 * @typedef {object} HelpfulLink
 * @property {string} title - The display text for the link.
 * @property {string} url - The URL the link points to.
 */

/**
 * Gets the current list of helpful links from the main configuration.
 * @returns {HelpfulLink[]} The array of link objects.
 */
function getHelpfulLinks() {
    const config = getConfig();
    return config.serverInfo.helpfulLinks || [];
}

/**
 * Saves the entire helpful links array back to the configuration.
 * @param {HelpfulLink[]} links The full array of links to save.
 */
function saveHelpfulLinks(links) {
    updateMultipleConfig({ 'serverInfo.helpfulLinks': links });
    debugLog('[HelpfulLinksManager] Updated helpful links saved to config.');
}

/**
 * Adds a new link to the end of the list and saves.
 * @param {string} title The title of the new link.
 * @param {string} url The URL of the new link.
 */
function addHelpfulLink(title, url) {
    if (!title || !url) { return; }
    const links = getHelpfulLinks();
    links.push({ title, url });
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Added link: "${title}" (${url})`);
}

/**
 * Updates the link at a specific index and saves.
 * @param {number} index The index of the link to edit.
 * @param {string} newTitle The new title for the link.
 * @param {string} newUrl The new URL for the link.
 */
function editHelpfulLink(index, newTitle, newUrl) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length || !newTitle || !newUrl) { return; }
    const oldLink = links[index];
    links[index] = { title: newTitle, url: newUrl };
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Edited link at index ${index}: from "${oldLink.title}" to "${newTitle}"`);
}

/**
 * Deletes a link at a specific index and saves.
 * @param {number} index The index of the link to delete.
 */
function deleteHelpfulLink(index) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length) { return; }
    const deletedLink = links.splice(index, 1);
    saveHelpfulLinks(links);
    debugLog(`[HelpfulLinksManager] Deleted link at index ${index}: "${deletedLink[0].title}"`);
}

/**
 * Moves a link up or down in the list and saves.
 * @param {number} index The index of the link to move.
 * @param {'up' | 'down'} direction The direction to move the link.
 */
function moveHelpfulLink(index, direction) {
    const links = getHelpfulLinks();
    if (index < 0 || index >= links.length) { return; }

    if (direction === 'up') {
        if (index === 0) { return; } // Can't move up if already at the top
        [links[index - 1], links[index]] = [links[index], links[index - 1]];
        debugLog(`[HelpfulLinksManager] Moved link up at index ${index}`);
    } else if (direction === 'down') {
        if (index === links.length - 1) { return; } // Can't move down if already at the bottom
        [links[index], links[index + 1]] = [links[index + 1], links[index]];
        debugLog(`[HelpfulLinksManager] Moved link down at index ${index}`);
    }

    saveHelpfulLinks(links);
}

/**
 * Defines all possible items that can be available in the shop.
 * The 'edit shop' panel will allow admins to enable/disable these items
 * and override their default prices.
 *
 * Structure for each item:
 * {
 *   itemId: string,        // The Minecraft item type ID (e.g., 'minecraft:diamond').
 *   icon: string,          // The texture path for the icon (e.g., 'textures/items/diamond').
 *   buyPrice: number,      // Default buy price. -1 to disable buying.
 *   sellPrice: number,     // Default sell price. -1 to disable selling.
 *   category: string,      // The main category for the item.
 *   subCategory?: string,   // Optional sub-category for more detailed sorting.
 *   displayName?: string    // Optional display name for items like enchanted books.
 * }
 */
const items = {
    // == Ores & Minerals ==
    diamond: {
        itemId: 'minecraft:diamond',
        icon: 'textures/items/diamond',
        buyPrice: 1000,
        sellPrice: 500,
        category: 'Ores & Minerals',
        displayName: 'Diamond'
    },
    emerald: {
        itemId: 'minecraft:emerald',
        icon: 'textures/items/emerald',
        buyPrice: 800,
        sellPrice: 400,
        category: 'Ores & Minerals',
        displayName: 'Emerald'
    },
    goldIngot: {
        itemId: 'minecraft:gold_ingot',
        icon: 'textures/items/gold_ingot',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Ores & Minerals',
        displayName: 'Gold Ingot'
    },
    ironIngot: {
        itemId: 'minecraft:iron_ingot',
        icon: 'textures/items/iron_ingot',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Ores & Minerals',
        displayName: 'Iron Ingot'
    },
    netheriteIngot: {
        itemId: 'minecraft:netherite_ingot',
        icon: 'textures/items/netherite_ingot',
        buyPrice: 10000,
        sellPrice: 5000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Ingot'
    },
    netheriteScrap: {
        itemId: 'minecraft:netherite_scrap',
        icon: 'textures/items/netherite_scrap',
        buyPrice: 2000,
        sellPrice: 1000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Scrap'
    },
    ancientDebris: {
        itemId: 'minecraft:ancient_debris',
        icon: 'textures/blocks/ancient_debris_side',
        buyPrice: 1800,
        sellPrice: 900,
        category: 'Ores & Minerals',
        displayName: 'Ancient Debris'
    },
    lapisLazuli: {
        itemId: 'minecraft:lapis_lazuli',
        icon: 'textures/blocks/lapis_ore',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Ores & Minerals',
        displayName: 'Lapis Lazuli'
    },
    quartz: {
        itemId: 'minecraft:quartz',
        icon: 'textures/items/quartz',
        buyPrice: 30,
        sellPrice: 15,
        category: 'Ores & Minerals',
        displayName: 'Quartz'
    },

    // == Special Items ==
    totemOfUndying: {
        itemId: 'minecraft:totem_of_undying',
        icon: 'textures/items/totem',
        buyPrice: 5000,
        sellPrice: 2500,
        category: 'Special Items',
        displayName: 'Totem Of Undying'
    },
    netherStar: {
        itemId: 'minecraft:nether_star',
        icon: 'textures/items/nether_star',
        buyPrice: 20000,
        sellPrice: -1, // Cannot be sold
        category: 'Special Items',
        displayName: 'Nether Star'
    },
    shulkerShell: {
        itemId: 'minecraft:shulker_shell',
        icon: 'textures/items/shulker_shell',
        buyPrice: 750,
        sellPrice: 300,
        category: 'Special Items',
        displayName: 'Shulker Shell'
    },
    elytra: {
        itemId: 'minecraft:elytra',
        icon: 'textures/items/elytra',
        buyPrice: 15000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Elytra'
    },
    witherSkeletonSkull: {
        itemId: 'minecraft:wither_skeleton_skull',
        icon: 'textures/items/spawn_eggs/spawn_egg_wither_skeleton',
        buyPrice: 8000,
        sellPrice: 2000,
        category: 'Special Items',
        displayName: 'Wither Skeleton Skull'
    },
    enchantedGoldenApple: {
        itemId: 'minecraft:enchanted_golden_apple',
        icon: 'textures/items/apple_golden',
        buyPrice: 25000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Enchanted Golden Apple'
    },

    // == Tools & Weapons ==
    diamondSword: {
        itemId: 'minecraft:diamond_sword',
        icon: 'textures/items/diamond_sword',
        buyPrice: 2500,
        sellPrice: 1000,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Sword'
    },
    diamondPickaxe: {
        itemId: 'minecraft:diamond_pickaxe',
        icon: 'textures/items/diamond_pickaxe',
        buyPrice: 3500,
        sellPrice: 1200,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Pickaxe'
    },
    diamondAxe: {
        itemId: 'minecraft:diamond_axe',
        icon: 'textures/items/diamond_axe',
        buyPrice: 3500,
        sellPrice: 1200,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Axe'
    },
    diamondShovel: {
        itemId: 'minecraft:diamond_shovel',
        icon: 'textures/items/diamond_shovel',
        buyPrice: 1500,
        sellPrice: 600,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Shovel'
    },
    diamondHoe: {
        itemId: 'minecraft:diamond_hoe',
        icon: 'textures/items/diamond_hoe',
        buyPrice: 2500,
        sellPrice: 1000,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Hoe'
    },
    netheriteSword: {
        itemId: 'minecraft:netherite_sword',
        icon: 'textures/items/netherite_sword',
        buyPrice: 15000,
        sellPrice: 7500,
        category: 'Tools & Weapons',
        subCategory: 'Netherite',
        displayName: 'Netherite Sword'
    },
    netheritePickaxe: {
        itemId: 'minecraft:netherite_pickaxe',
        icon: 'textures/items/netherite_pickaxe',
        buyPrice: 18000,
        sellPrice: 8000,
        category: 'Tools & Weapons',
        subCategory: 'Netherite',
        displayName: 'Netherite Pickaxe'
    },

    // == Armor ==
    diamondHelmet: {
        itemId: 'minecraft:diamond_helmet',
        icon: 'textures/items/diamond_helmet',
        buyPrice: 5000,
        sellPrice: 2000,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Helmet'
    },
    diamondChestplate: {
        itemId: 'minecraft:diamond_chestplate',
        icon: 'textures/items/diamond_chestplate',
        buyPrice: 8000,
        sellPrice: 3500,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Chestplate'
    },
    diamondLeggings: {
        itemId: 'minecraft:diamond_leggings',
        icon: 'textures/items/diamond_leggings',
        buyPrice: 7000,
        sellPrice: 3000,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Leggings'
    },
    diamondBoots: {
        itemId: 'minecraft:diamond_boots',
        icon: 'textures/items/diamond_boots',
        buyPrice: 4000,
        sellPrice: 1800,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Boots'
    },
    netheriteHelmet: {
        itemId: 'minecraft:netherite_helmet',
        icon: 'textures/items/netherite_helmet',
        buyPrice: 20000,
        sellPrice: 10000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Helmet'
    },
    netheriteChestplate: {
        itemId: 'minecraft:netherite_chestplate',
        icon: 'textures/items/netherite_chestplate',
        buyPrice: 30000,
        sellPrice: 15000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Chestplate'
    },
    netheriteLeggings: {
        itemId: 'minecraft:netherite_leggings',
        icon: 'textures/items/netherite_leggings',
        buyPrice: 25000,
        sellPrice: 12000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Leggings'
    },
    netheriteBoots: {
        itemId: 'minecraft:netherite_boots',
        icon: 'textures/items/netherite_boots',
        buyPrice: 18000,
        sellPrice: 9000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Boots'
    },

    // == Logs ==
    oakLog: {
        itemId: 'minecraft:oak_log',
        icon: 'textures/blocks/log_oak_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Oak Log'
    },
    spruceLog: {
        itemId: 'minecraft:spruce_log',
        icon: 'textures/blocks/log_spruce_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Spruce Log'
    },
    birchLog: {
        itemId: 'minecraft:birch_log',
        icon: 'textures/blocks/log_birch_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Birch Log'
    },
    jungleLog: {
        itemId: 'minecraft:jungle_log',
        icon: 'textures/blocks/log_jungle_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Jungle Log'
    },
    acaciaLog: {
        itemId: 'minecraft:acacia_log',
        icon: 'textures/blocks/log_acacia_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Acacia Log'
    },
    darkOakLog: {
        itemId: 'minecraft:dark_oak_log',
        icon: 'textures/blocks/log_big_oak_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Dark Oak Log'
    },
    mangroveLog: {
        itemId: 'minecraft:mangrove_log',
        icon: 'textures/blocks/mangrove_log_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Mangrove Log'
    },
    cherryLog: {
        itemId: 'minecraft:cherry_log',
        icon: 'textures/blocks/cherry_log_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Cherry Log'
    },
    crimsonStem: {
        itemId: 'minecraft:crimson_stem',
        icon: 'textures/blocks/huge_fungus/crimson_log_top',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Crimson Stem'
    },
    warpedStem: {
        itemId: 'minecraft:warped_stem',
        icon: 'textures/blocks/huge_fungus/warped_stem_top',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Warped Stem'
    },

    // == Building Blocks ==
    stone: {
        itemId: 'minecraft:stone',
        icon: 'textures/blocks/stone',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Stone'
    },
    cobblestone: {
        itemId: 'minecraft:cobblestone',
        icon: 'textures/blocks/cobblestone',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Cobblestone'
    },
    dirt: {
        itemId: 'minecraft:dirt',
        icon: 'textures/blocks/dirt',
        buyPrice: 2,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Dirt'
    },
    sand: {
        itemId: 'minecraft:sand',
        icon: 'textures/blocks/sand',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Sand'
    },
    gravel: {
        itemId: 'minecraft:gravel',
        icon: 'textures/blocks/gravel',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Gravel'
    },
    glass: {
        itemId: 'minecraft:glass',
        icon: 'textures/blocks/glass',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Glass'
    },
    terracotta: {
        itemId: 'minecraft:terracotta',
        icon: 'textures/blocks/hardened_clay',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Terracotta'
    },
    whiteConcrete: {
        itemId: 'minecraft:white_concrete',
        icon: 'textures/blocks/concrete_white',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Building Blocks',
        displayName: 'White Concrete'
    },
    stoneBricks: {
        itemId: 'minecraft:stone_bricks',
        icon: 'textures/blocks/stonebrick',
        buyPrice: 12,
        sellPrice: 6,
        category: 'Building Blocks',
        displayName: 'Stone Bricks'
    },
    obsidian: {
        itemId: 'minecraft:obsidian',
        icon: 'textures/blocks/obsidian',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Building Blocks',
        displayName: 'Obsidian'
    },
    glowstone: {
        itemId: 'minecraft:glowstone',
        icon: 'textures/blocks/glowstone',
        buyPrice: 80,
        sellPrice: 40,
        category: 'Building Blocks',
        displayName: 'Glowstone'
    },
    netherrack: {
        itemId: 'minecraft:netherrack',
        icon: 'textures/blocks/netherrack',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Netherrack'
    },
    endStone: {
        itemId: 'minecraft:end_stone',
        icon: 'textures/blocks/end_stone',
        buyPrice: 10,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'End Stone'
    },
    purpurBlock: {
        itemId: 'minecraft:purpur_block',
        icon: 'textures/blocks/purpur_block',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Purpur Block'
    },

    // == Food ==
    steak: {
        itemId: 'minecraft:cooked_beef',
        icon: 'textures/items/beef_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Steak'
    },
    cookedPorkchop: {
        itemId: 'minecraft:cooked_porkchop',
        icon: 'textures/items/porkchop_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Porkchop'
    },
    bread: {
        itemId: 'minecraft:bread',
        icon: 'textures/items/bread',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Food',
        displayName: 'Bread'
    },
    goldenCarrot: {
        itemId: 'minecraft:golden_carrot',
        icon: 'textures/items/carrot_golden',
        buyPrice: 100,
        sellPrice: 40,
        category: 'Food',
        displayName: 'Golden Carrot'
    },
    cookedSalmon: {
        itemId: 'minecraft:cooked_salmon',
        icon: 'textures/items/fish_salmon_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Salmon'
    },
    cookedCod: {
        itemId: 'minecraft:cooked_cod',
        icon: 'textures/items/fish_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Cod'
    },
    chorusFruit: {
        itemId: 'minecraft:chorus_fruit',
        icon: 'textures/items/chorus_fruit',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Food',
        displayName: 'Chorus Fruit'
    },

    // == Farming ==
    wheat: {
        itemId: 'minecraft:wheat',
        icon: 'textures/items/wheat',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Wheat'
    },
    carrot: {
        itemId: 'minecraft:carrot',
        icon: 'textures/items/carrot',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Carrot'
    },
    potato: {
        itemId: 'minecraft:potato',
        icon: 'textures/items/potato',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Potato'
    },
    melonSlice: {
        itemId: 'minecraft:melon_slice',
        icon: 'textures/items/melon',
        buyPrice: 3,
        sellPrice: 1,
        category: 'Farming',
        displayName: 'Melon Slice'
    },
    pumpkin: {
        itemId: 'minecraft:pumpkin',
        icon: 'textures/blocks/pumpkin_face_off',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Farming',
        displayName: 'Pumpkin'
    },
    sugarCane: {
        itemId: 'minecraft:sugar_cane',
        icon: 'textures/items/reeds',
        buyPrice: 8,
        sellPrice: 4,
        category: 'Farming',
        displayName: 'Sugar Cane'
    },
    netherWart: {
        itemId: 'minecraft:nether_wart',
        icon: 'textures/items/nether_wart',
        buyPrice: 25,
        sellPrice: 10,
        category: 'Farming',
        subCategory: 'Potions',
        displayName: 'Nether Wart'
    },

    // == Enchantment Books ==
    // General
    enchantMending: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 8000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Mending',
        enchantment: { id: 'mending', level: 1 }
    },
    enchantUnbreaking3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Unbreaking III',
        enchantment: { id: 'unbreaking', level: 3 }
    },

    // Sword
    enchantSharpness5: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Sharpness V',
        enchantment: { id: 'sharpness', level: 5 }
    },
    enchantLooting3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Looting III',
        enchantment: { id: 'looting', level: 3 }
    },
    enchantFireAspect2: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Fire Aspect II',
        enchantment: { id: 'fire_aspect', level: 2 }
    },

    // Armour
    enchantProtection4: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Protection IV',
        enchantment: { id: 'protection', level: 4 }
    },
    enchantFeatherFalling4: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Feather Falling IV',
        enchantment: { id: 'feather_falling', level: 4 }
    },

    // Tools
    enchantEfficiency5: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Efficiency V',
        enchantment: { id: 'efficiency', level: 5 }
    },
    enchantFortune3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Fortune III',
        enchantment: { id: 'fortune', level: 3 }
    },
    enchantSilkTouch: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Silk Touch',
        enchantment: { id: 'silk_touch', level: 1 }
    },

    // Bow
    enchantPower5: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Power V',
        enchantment: { id: 'power', level: 5 }
    },
    enchantInfinity: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 7000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Infinity',
        enchantment: { id: 'infinity', level: 1 }
    },
    enchantFlame: {
        _comment: 'Note: sellPrice changed from 500 to -1',
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Flame',
        enchantment: { id: 'flame', level: 1 }
    },

    // Trident
    enchantImpaling5: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Impaling V',
        enchantment: { id: 'impaling', level: 5 }
    },
    enchantLoyalty3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 2500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Loyalty III',
        enchantment: { id: 'loyalty', level: 3 }
    },
    enchantChanneling: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Channeling',
        enchantment: { id: 'channeling', level: 1 }
    },
    enchantRiptide3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Riptide III',
        enchantment: { id: 'riptide', level: 3 }
    },

    // Mace
    enchantDensity5: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Mace',
        displayName: 'Density V',
        enchantment: { id: 'density', level: 5 }
    },
    enchantBreach4: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Mace',
        displayName: 'Breach IV',
        enchantment: { id: 'breach', level: 4 }
    },
    enchantWindBurst3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Mace',
        displayName: 'Wind Burst III',
        enchantment: { id: 'wind_burst', level: 3 }
    },

    // Crossbow
    enchantMultishot1: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Crossbow',
        displayName: 'Multishot',
        enchantment: { id: 'multishot', level: 1 }
    },
    enchantPiercing4: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Crossbow',
        displayName: 'Piercing IV',
        enchantment: { id: 'piercing', level: 4 }
    },
    enchantQuickCharge3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Crossbow',
        displayName: 'Quick Charge III',
        enchantment: { id: 'quick_charge', level: 3 }
    }
};

/**
 * Creates a new, empty kit with default settings.
 * @param {string} kitName - The name for the new kit. Must be unique.
 * @param {object} options - The initial settings for the kit.
 * @param {number} [options.cooldown=3600] - Cooldown in seconds.
 * @param {number} [options.permissionLevel=0] - Permission level required to use.
 * @param {number} [options.price=0] - Cost to claim the kit.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function createKit(kitName, options = {}) {
    const config = getKitsConfig();
    const lowerCaseKitName = kitName.toLowerCase();

    const {
        cooldown = 3600,
        permissionLevel = 1024, // Default to Member
        price = 0,
        icon = 'textures/ui/inventory_icon',
        description = 'A new custom kit.'
    } = options;

    if (config.kitDefinitions[lowerCaseKitName]) {
        return { success: false, message: `A kit with the name '${kitName}' already exists.` };
    }

    config.kitDefinitions[lowerCaseKitName] = {
        enabled: false, // Disabled by default
        description: description,
        cooldownSeconds: cooldown,
        permissionLevel: permissionLevel,
        price: price,
        icon: icon,
        items: []
    };

    saveKitsConfig();
    debugLog(`[KitAdminManager] Created new kit: ${lowerCaseKitName}`);
    return { success: true, message: `Successfully created kit '${kitName}'.` };
}

/**
 * Deletes a kit from the configuration.
 * @param {string} kitName - The name of the kit to delete.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function deleteKit(kitName) {
    const config = getKitsConfig();

    if (!config.kitDefinitions[kitName]) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    delete config.kitDefinitions[kitName];
    saveKitsConfig();
    debugLog(`[KitAdminManager] Deleted kit: ${kitName}`);
    return { success: true, message: `Successfully deleted kit '${kitName}'.` };
}

/**
 * Updates the settings of a kit.
 * @param {string} kitName - The name of the kit to update.
 * @param {object} newSettings - The new settings for the kit.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function updateKitSettings(kitName, newSettings) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    // Update the kit object with the new settings
    Object.assign(kit, newSettings);

    saveKitsConfig();
    debugLog(`[KitAdminManager] Updated settings for kit: ${kitName}`);
    return { success: true, message: `Successfully updated settings for kit '${kitName}'.` };
}

/**
 * Gets all kits from the configuration.
 * @returns {object} The kit definitions object.
 */
function getAllKits() {
    const config = getKitsConfig();
    return config.kitDefinitions;
}

/**
 * Renames a kit.
 * @param {string} oldName - The current name of the kit.
 * @param {string} newName - The new name for the kit.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function renameKit(oldName, newName) {
    const config = getKitsConfig();
    const allKits = config.kitDefinitions;

    if (!allKits[oldName]) {
        return { success: false, message: `Kit '${oldName}' not found.` };
    }

    if (allKits[newName]) {
        return { success: false, message: `A kit with the name '${newName}' already exists.` };
    }

    // Copy the old kit's data to the new name
    allKits[newName] = allKits[oldName];
    // Delete the old kit
    delete allKits[oldName];

    saveKitsConfig();
    debugLog(`[KitAdminManager] Renamed kit from '${oldName}' to '${newName}'.`);
    return { success: true, message: `Successfully renamed kit to '${newName}'.` };
}

const itemsPerPage$1 = 8;

const configHandlers$1 = {
    'main': {
        get: getConfig
    },
    'spawn': {
        get: getSpawnConfig
    }
};

function getPaginatedItems$1(items, page) {
    const startIndex = (page - 1) * itemsPerPage$1;
    const endIndex = startIndex + itemsPerPage$1;
    return items.slice(startIndex, endIndex);
}

function addPaginationButtons(form, page, totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage$1);
    if (page > 1) {
        form.button('§l§4< §1Previous');
    }
    if (page < totalPages) {
        form.button('§l§1Next §4>');
    }
}

function getMenuItems(panelDef, permissionLevel) {
    const config = getConfig();
    const items = (panelDef.items || [])
        .filter(item => {
            if (item.actionValue === 'shopMainPanel' && !config.shop.enabled) {
                return false;
            }
            return permissionLevel <= item.permissionLevel;
        })
        .sort((a, b) => (a.sortId || 0) - (b.sortId || 0));

    if (panelDef.parentPanelId) {
        items.unshift({ id: '__back__', text: '§l§8< Back', icon: 'textures/gui/controls/left.png', permissionLevel: 1024, actionType: 'openPanel', actionValue: panelDef.parentPanelId });
    }
    return items;
}

function addPanelBody(form, player, panelId, context) {
    const config = getConfig();
    if (panelId === 'myStatsPanel') {
        const pData = getPlayer(player.id);
        const rank = getPlayerRank(player, config);
        if (!pData || !rank) {
            form.body('§cCould not retrieve your stats.');
            return;
        }
        const bounty = getBounty(player.id)?.amount ?? 0;
        form.body([
            `§fRank: §r${rank.chatFormatting?.nameColor ?? '§7'}${rank.name}`,
            `§fBalance: §2$${pData.balance.toFixed(2)}`,
            `§fBounty on you: §6$${bounty.toFixed(2)}`
        ].join('\n'));
    } else if (panelId === 'playerActionsPanel' && context.targetPlayerId) {
        const pData = context.targetData || loadPlayerData(context.targetPlayerId);
        if (!pData) {
            form.body('§cCould not load player data.');
            return;
        }
        const rank = getRankById$1(pData.rankId);
        const bounty = getBounty(context.targetPlayerId)?.amount ?? 0;
        form.body([
            `§fRank: §r${rank?.chatFormatting?.nameColor ?? '§7'}${rank?.name ?? 'Unknown'}`,
            `§fBalance: §2$${pData.balance.toFixed(2)}`,
            `§fBounty: §6$${bounty.toFixed(2)}`
        ].join('\n'));
    } else if (panelId === 'reportActionsPanel' && context.targetReport) {
        const { targetReport } = context;
        form.body([
            `§fReport ID: §6${targetReport.id}`,
            `§fReported Player: §6${targetReport.reportedPlayerName}`,
            `§fReporter: §6${targetReport.reporterName}`,
            `§fReason: §6${targetReport.reason}`,
            `§fStatus: §6${targetReport.status}`,
            `§fDate: §6${new Date(targetReport.timestamp).toLocaleString()}`
        ].join('\n'));
    }
}

function getVisiblePlayerActionItems(context, permissionLevel) {
    const panelDef = panelDefinitions.playerActionsPanel;
    const config = getConfig();
    const allItems = getMenuItems(panelDef, permissionLevel);
    let visibleItems = [];
    for (const item of allItems) {
        if (item.id === '__back__') {
            visibleItems.push(item);
            continue;
        }
        const commandName = item.id;
        if (config.commandSettings[commandName]?.enabled === false) {continue;}
        if (context.fromPanel === 'playerManagementPanel' && item.permissionLevel < 1024) {
            visibleItems.push(item);
        } else if (context.fromPanel === 'playerListPanel' && item.permissionLevel >= 1024) {
            visibleItems.push(item);
        }
    }
    return visibleItems;
}

function buildShopMainPanel(form, context) {
    const shopConfig = getShopConfig();

    const validCategories = Object.keys(shopConfig.categories).filter(categoryName => {
        const category = shopConfig.categories[categoryName];
        const hasItems = Object.keys(category.items).length > 0;
        const hasSubCategories = Object.keys(category.subCategories).length > 0;
        return hasItems || hasSubCategories;
    }).sort();

    if (validCategories.length === 0) {
        form.body('§cThe shop is currently empty.');
        return;
    }

    for (const categoryName of validCategories) {
        const category = shopConfig.categories[categoryName];
        form.button(categoryName, category.icon);
    }
}

function buildShopCategoryPanel(form, context) {
    const { categoryName, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];

    if (!category) {
        form.body('§cCategory not found.');
        return;
    }

    const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));
    const items$1 = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));

    const allEntries = [...subCategories, ...items$1];
    const paginatedEntries = getPaginatedItems$1(allEntries, page);

    for (const entry of paginatedEntries) {
        if (entry.type === 'subCategory') {
            form.button(`§e${entry.name}`, entry.icon);
        } else {
            const masterItem = items[entry.id] || {};
            const displayName = entry.displayName || masterItem.displayName || entry.id;
            const icon = entry.icon || masterItem.icon;
            let priceString = '';
            if (view === 'buy' && entry.buyPrice > 0) {
                priceString = `§2Buy: $${entry.buyPrice}`;
            } else if (view === 'sell' && entry.sellPrice > 0) {
                priceString = `§cSell: $${entry.sellPrice}`;
            } else {
                const buy = entry.buyPrice > 0 ? `§2B: $${entry.buyPrice}` : '';
                const sell = entry.sellPrice > 0 ? `§cS: $${entry.sellPrice}` : '';
                priceString = [buy, sell].filter(Boolean).join(' ');
            }
            form.button(`${displayName}\n${priceString}`, icon);
        }
    }
    addPaginationButtons(form, page, allEntries.length);
}

function buildShopItemListPanel(form, context) {
    const { categoryName, subCategoryName, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        form.body('§cCategory not found.');
        return;
    }
    const subCategory = category.subCategories[subCategoryName];
    if (!subCategory) {
        form.body('§cSubcategory not found.');
        return;
    }

    const items$1 = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
    const paginatedItems = getPaginatedItems$1(items$1, page);

    for (const item of paginatedItems) {
        const masterItem = items[item.id] || {};
        const displayName = item.displayName || masterItem.displayName || item.id;
        const icon = item.icon || masterItem.icon;
        let priceString = '';
        if (view === 'buy' && item.buyPrice > 0) {
            priceString = `§2Buy: $${item.buyPrice}`;
        } else if (view === 'sell' && item.sellPrice > 0) {
            priceString = `§cSell: $${item.sellPrice}`;
        } else {
            const buy = item.buyPrice > 0 ? `§2B: $${item.buyPrice}` : '';
            const sell = item.sellPrice > 0 ? `§cS: $${item.sellPrice}` : '';
            priceString = [buy, sell].filter(Boolean).join(' ');
        }
        form.button(`${displayName}\n${priceString}`, icon);
    }
    addPaginationButtons(form, page, items$1.length);
}

function buildShopAdminMainPanel(form, context) {
    const { page = 1 } = context;
    const mainConfig = getConfig();

    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const isEnabled = mainConfig.shop.enabled;
    const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§cShop System: DISABLED';
    form.button(toggleText, isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel');

    form.button('§l§2+ Add Category', 'textures/ui/color_plus');

    const shopConfig = getShopConfig();
    const categories = Object.keys(shopConfig.categories).sort();
    const paginatedCategories = getPaginatedItems$1(categories, page);

    for (const categoryName of paginatedCategories) {
        const category = shopConfig.categories[categoryName];
        form.button(categoryName, category.icon);
    }

    addPaginationButtons(form, page, categories.length);
}

function buildShopAdminCategoryPanel(form, context) {
    const { categoryName, page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Item', 'textures/ui/color_plus');
    form.button('§l§2+ Add Subcategory', 'textures/ui/color_plus');
    form.button('§l§9* Edit Category', 'textures/ui/icon_setting');

    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];

    if (!category) {
        form.body('§cCategory not found.');
        return;
    }

    const items$1 = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));
    const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));

    const allEntries = [...subCategories, ...items$1];
    const paginatedEntries = getPaginatedItems$1(allEntries, page);

    for (const entry of paginatedEntries) {
        if (entry.type === 'item') {
            const masterItem = items[entry.id] || {};
            const displayName = entry.displayName || masterItem.displayName || entry.id;
            const icon = entry.icon || masterItem.icon;
            form.button(displayName, icon);
        } else { // subCategory
            form.button(`§e${entry.name}`, entry.icon);
        }
    }

    addPaginationButtons(form, page, allEntries.length);
}

function buildShopAdminSubCategoryItemPanel(form, context) {
    const { categoryName, subCategoryName, page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Item', 'textures/ui/color_plus');
    form.button('§l§9* Edit Subcategory', 'textures/ui/icon_setting');

    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        form.body('§cCategory not found.');
        return;
    }
    const subCategory = category.subCategories[subCategoryName];
    if (!subCategory) {
        form.body('§cSubcategory not found.');
        return;
    }

    const items$1 = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
    const paginatedItems = getPaginatedItems$1(items$1, page);

    for (const item of paginatedItems) {
        const masterItem = items[item.id] || {};
        const displayName = item.displayName || masterItem.displayName || item.id;
        const icon = item.icon || masterItem.icon;
        form.button(displayName, icon);
    }

    addPaginationButtons(form, page, items$1.length);
}

function buildShopAddItemPanel(form, context) {
    const { page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Custom Item', 'textures/ui/color_plus');

    const allPossibleItems = Object.keys(items);
    const paginatedItems = getPaginatedItems$1(allPossibleItems, page);

    for (const itemId of paginatedItems) {
        const masterItem = items[itemId];
        form.button(masterItem.displayName ?? itemId, masterItem.icon);
    }

    addPaginationButtons(form, page, allPossibleItems.length);
}

async function buildPlayerManagementForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allPlayersMap = getAllPlayerNameIdMap();
    const playerEntries = Array.from(allPlayersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const totalPages = Math.ceil(playerEntries.length / itemsPerPage$1);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (playerEntries.length === 0) {
        form.body('§cNo player data found.');
    } else {
        const paginatedEntries = getPaginatedItems$1(playerEntries, page);
        for (const [lowerCaseName, id] of paginatedEntries) {
            const pData = loadPlayerData(id); // Load data for the player on the current page
            const rank = pData ? getRankById$1(pData.rankId) : null;
            const prefix = rank?.chatFormatting?.prefixText ?? '';
            const properName = pData ? pData.name : lowerCaseName; // Fallback to lowercase name if data fails to load
            form.button(`${prefix}${properName}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildPlayerListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const onlinePlayers = getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
    const totalPages = Math.ceil(onlinePlayers.length / itemsPerPage$1);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (onlinePlayers.length === 0) {
        form.body('§cNo players are currently online.');
    } else {
        const paginatedPlayers = getPaginatedItems$1(onlinePlayers, page);
        const config = getConfig();
        for (const player of paginatedPlayers) {
            const rank = getPlayerRank(player, config);
            const prefix = rank.chatFormatting?.prefixText ?? '';
            form.button(`${prefix}${player.name}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildBountyListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allBounties = Array.from(getAllBounties().values()).sort((a, b) => b.amount - a.amount);
    const totalPages = Math.ceil(allBounties.length / itemsPerPage$1);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (allBounties.length === 0) {
        form.body('§2There are currently no active bounties.');
    } else {
        const paginatedBounties = getPaginatedItems$1(allBounties, page);
        for (const bounty of paginatedBounties) {
            form.button(`${bounty.name}\n§6$${bounty.amount.toFixed(2)}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

function buildReportListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const reports = getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
    const totalPages = Math.ceil(reports.length / itemsPerPage$1);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (reports.length === 0) {
        form.body('§2There are no active reports.');
    } else {
        const paginatedReports = getPaginatedItems$1(reports, page);
        for (const report of paginatedReports) {
            const statusColor = report.status === 'assigned' ? '§6' : '§c';
            form.button(`[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

function buildRankManagementPanel(form, context) {
    const { page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add New Rank', 'textures/ui/color_plus');

    const allRanks = getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);

    if (allRanks.length === 0) {
        form.body('§cNo ranks have been defined.');
        return;
    }

    const paginatedRanks = getPaginatedItems$1(allRanks, page);

    for (const rank of paginatedRanks) {
        const prefix = rank.chatFormatting?.prefixText ?? '';
        const name = rank.name;
        const permLevel = rank.permissionLevel;
        form.button(`${prefix}${name}\n§8(ID: ${rank.id}, Level: ${permLevel})`);
    }

    addPaginationButtons(form, page, allRanks.length);
}

function buildKitManagementPanel(form, context) {
    const { page = 1 } = context;
    const mainConfig = getConfig();

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    // Add the global toggle button
    const isEnabled = mainConfig.kits.enabled;
    const toggleText = isEnabled ? '§2Kit System: ENABLED' : '§cKit System: DISABLED';
    form.button(toggleText, isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel');

    // Add Create New Kit button
    form.button('§l§2+ Create New Kit', 'textures/ui/color_plus');

    // Get all kit names and paginate them
    const allKits = getAllKits();
    const kitNames = Object.keys(allKits);

    if (kitNames.length === 0) {
        form.body('§cNo kits have been defined.');
        return;
    }

    const paginatedKits = getPaginatedItems$1(kitNames, page);

    for (const kitName of paginatedKits) {
        const kit = allKits[kitName];
        const status = kit.enabled ? '§2[Enabled]' : '§c[Disabled]';
        form.button(`${kitName}\n${status}`, 'textures/ui/inventory_icon');
    }

    addPaginationButtons(form, page, kitNames.length);
}

async function buildPanelForm(player, panelId, context) {
    try {
        debugLog(`[UIManager] Building form for panel '${panelId}' for player ${player.name}.`);

        if (panelId.startsWith('config_')) {
            const categoryId = panelId.replace('config_', '');
            const category = configPanelSchema.find(c => c.id === categoryId);
            if (!category) {
                errorLog(`[UIManager] Could not find config category for ID: ${categoryId}`);
                return null;
            }
            debugLog(`[UIManager] Building config settings form for category: ${categoryId}`);
            const form = new ModalFormData().title(category.title);

            const configSource = category.configSource || 'main';
            const handler = configHandlers$1[configSource];
            if (!handler) {
                errorLog(`[UIManager] No config handler found for source: ${configSource}`);
                return null;
            }
            const config = handler.get();


            for (const setting of category.settings) {
                const currentValue = getValueFromPath(config, setting.key);
                switch (setting.type) {
                    case 'toggle':
                        form.toggle(setting.label, { defaultValue: !!currentValue });
                        break;
                    case 'textField':
                        form.textField(setting.label, setting.description || '', { defaultValue: String(currentValue ?? '') });
                        break;
                    case 'dropdown':
                    {
                        const index = setting.options.indexOf(currentValue);
                        form.dropdown(setting.label, setting.options, { defaultValueIndex: index === -1 ? 0 : index });
                        break;
                    }
                }
            }
            return form;
        }

        if (panelId === 'floatingTextActionPanel') {
            const { id } = context;
            const form = new ActionFormData()
                .title(`Actions for: ${id}`)
                .button('Edit', 'textures/ui/icon_setting')
                .button('Respawn', 'textures/ui/refresh_light')
                .button('Despawn', 'textures/ui/cancel')
                .button('§cDelete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        // Handle dynamic shop panels before falling back to static definitions
        if (panelId.startsWith('shopCategoryPanel_')) {
            const category = panelId.replace('shopCategoryPanel_', '');
            const form = new ActionFormData().title(`§l§2Shop - ${category}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopCategoryPanel(form, { ...context, category, page: context.page || 1 });
            return form;
        }
        if (panelId.startsWith('shopItemListPanel_')) {
            const parts = panelId.replace('shopItemListPanel_', '').split('_');
            const category = parts[0];
            const subCategory = parts.slice(1).join('_');
            const form = new ActionFormData().title(`§l§2Shop - ${subCategory}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopItemListPanel(form, { ...context, category, subCategory, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryPanel_', '');
            const form = new ActionFormData().title(`Edit: ${categoryName}`);
            buildShopAdminCategoryPanel(form, { ...context, categoryName, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAddItemPanel_')) {
            const form = new ActionFormData().title('Add Item');
            buildShopAddItemPanel(form, { ...context, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
            const form = new ActionFormData()
                .title(`Manage Category: ${categoryName}`)
                .button('Edit', 'textures/ui/icon_setting')
                .button('§cDelete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const { categoryName, subCategoryName } = context;
            const form = new ActionFormData().title(`Edit: ${categoryName} > ${subCategoryName}`);
            buildShopAdminSubCategoryItemPanel(form, { ...context, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const { subCategoryName } = context;
            const form = new ActionFormData()
                .title(`Manage Subcategory: ${subCategoryName}`)
                .button('Edit', 'textures/ui/icon_setting')
                .button('§cDelete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitItemsPanel_')) {
            const kitName = panelId.replace('kitItemsPanel_', '');
            const allKits = getAllKits();
            const kit = allKits[kitName];
            const page = context.page || 1;

            if (!kit) {
                errorLog(`[UIManager] Could not find kit for items panel: ${kitName}`);
                return null;
            }

            const form = new ActionFormData()
                .title(`Edit Items: ${kitName}`)
                .button('§l§2+ Add New Item', 'textures/ui/color_plus');

            const paginatedItems = getPaginatedItems$1(kit.items, page);

            for (let i = 0; i < paginatedItems.length; i++) {
                const item = paginatedItems[i];
                const itemIndex = ((page - 1) * itemsPerPage$1) + i;
                form.button(`${itemIndex + 1}. ${item.typeId.replace('minecraft:', '')} x${item.amount}`, 'textures/items/item_frame');
            }

            addPaginationButtons(form, page, kit.items.length);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitSettingsPanel_')) {
            const kitName = panelId.replace('kitSettingsPanel_', '');
            const allKits = getAllKits();
            const kit = allKits[kitName];

            if (!kit) {
                errorLog(`[UIManager] Could not find kit for settings panel: ${kitName}`);
                return null;
            }

            const form = new ModalFormData()
                .title(`Edit Settings: ${kitName}`)
                .toggle('Enabled', { defaultValue: kit.enabled })
                .textField('Name', 'The name of the kit.', { defaultValue: kitName })
                .textField('Description', 'A short description of the kit.', { defaultValue: kit.description || '' })
                .textField('Icon', 'Texture path for the icon (e.g., textures/items/diamond_sword).', { defaultValue: kit.icon || '' })
                .textField('Cooldown (seconds)', 'Time between uses.', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission Level', '0=Admin, 1024=Member.', { defaultValue: String(kit.permissionLevel) })
                .textField('Price', 'Cost to claim the kit.', { defaultValue: String(kit.price || 0) });

            form.submitButton('§l§2Save Settings');
            return form;
        }

        if (panelId.startsWith('rankActionMenu_')) {
            const rankId = panelId.replace('rankActionMenu_', '');
            const rank = getRankById$1(rankId);
            const form = new ActionFormData()
                .title(`Manage Rank: ${rank.name}`)
                .button('Edit Rank', 'textures/ui/icon_setting')
                .button('§cDelete Rank', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId === 'helpfulLinksManagementPanel') {
            const panelDef = panelDefinitions[panelId];
            const page = context.page || 1;
            const form = new ActionFormData().title(`${panelDef.title} (Page ${page})`);
            const links = getHelpfulLinks();
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add Link', 'textures/ui/color_plus');

            const paginatedLinks = getPaginatedItems$1(links, page);

            paginatedLinks.forEach((link, index) => {
                const itemIndex = ((page - 1) * itemsPerPage$1) + index;
                form.button(`${itemIndex + 1}. ${link.title}`);
            });

            if (links.length > itemsPerPage$1) {
                addPaginationButtons(form, page, links.length);
            }

            return form;
        }

        if (panelId === 'floatingTextListPanel') {
            const { floatingTextManager } = await Promise.resolve().then(function () { return floatingTextManager$1; });
            const form = new ActionFormData()
                .title(panelDefinitions[panelId].title)
                .button('§l§8< Back', 'textures/gui/controls/left.png')
                .button('§l§2+ Create New', 'textures/ui/color_plus');

            const texts = floatingTextManager.getAllTexts();
            if (texts.length === 0) {
                form.body('No floating texts have been created yet.');
            } else {
                for (const text of texts) {
                    form.button(text.id);
                }
            }
            return form;
        }

        if (panelId === 'floatingTextEditPanel') {
            const { floatingTextManager } = await Promise.resolve().then(function () { return floatingTextManager$1; });
            const { id } = context;
            const text = floatingTextManager.getTextById(id);
            if (!text) {
                errorLog(`[UIManager] floatingTextEditPanel: Text with ID ${id} not found.`);
                return null;
            }

            // Ensure defaults for properties that might be missing from older configs
            const isDynamic = text.isDynamic ?? false;

            // Robust handling for update interval to prevent crashes with legacy data
            let updateIntervalInTicks = text.updateInterval ?? 100;
            if (typeof updateIntervalInTicks !== 'number' || !Number.isFinite(updateIntervalInTicks) || updateIntervalInTicks <= 0) {
                updateIntervalInTicks = 100; // Default to 5 seconds (100 ticks)
            }
            const updateIntervalInSeconds = updateIntervalInTicks / 20;
            const sliderDefaultValue = Math.max(1, Math.min(60, updateIntervalInSeconds));

            const expiresAt = text.expiresAt ?? null;
            const snapRotation = text.snapRotation ?? false;
            const hover = text.hover ?? false;
            const sway = text.sway ?? false;

            const { getPlaceholderKeys } = await Promise.resolve().then(function () { return placeholderManager; });
            const placeholders = getPlaceholderKeys();
            const placeholderText = placeholders.length > 0 ? `\nAvailable Placeholders: {${placeholders.join('}, {')}}` : '';

            const form = new ModalFormData()
                .title(`Edit: ${id}`)
                .textField(`Text Content${placeholderText}`, 'Enter the text to display', { defaultValue: text.text ?? '' })
                .textField('X Coordinate', 'Enter the X coordinate', { defaultValue: String(+(text.location?.x ?? 0).toFixed(2)) })
                .textField('Y Coordinate', 'Enter the Y coordinate', { defaultValue: String(+(text.location?.y ?? 0).toFixed(2)) })
                .textField('Z Coordinate', 'Enter the Z coordinate', { defaultValue: String(+(text.location?.z ?? 0).toFixed(2)) })
                .toggle('Is Dynamic (use placeholders)', { defaultValue: isDynamic })
                .slider('Update Interval (seconds)', 1, 60, { valueStep: 1, defaultValue: sliderDefaultValue })
                .toggle('Enable Expiration Timer', { defaultValue: !!expiresAt })
                .textField('Expiration (minutes from now)', 'e.g., 60 for 1 hour', { defaultValue: expiresAt ? String(Math.round((expiresAt - Date.now()) / 60000)) : '0' })
                .toggle('Snap to Cardinal Direction', { defaultValue: snapRotation })
                .toggle('Hovering Motion', { defaultValue: hover })
                .toggle('Swaying Motion', { defaultValue: sway });
            return form;
        }

        if (panelId === 'floatingTextCreatePanel') {
            const { getPlaceholderKeys } = await Promise.resolve().then(function () { return placeholderManager; });
            const placeholders = getPlaceholderKeys();
            const placeholderText = placeholders.length > 0 ? `\nAvailable Placeholders: {${placeholders.join('}, {')}}` : '';

            const form = new ModalFormData()
                .title('Create New Floating Text')
                .textField('Unique ID', 'e.g., "welcome_message"')
                .textField(`Text Content${placeholderText}`, 'Enter text to display');
            return form;
        }

        if (panelId === 'addHelpfulLinkPanel') {
            const panelDef = panelDefinitions[panelId];
            const form = new ModalFormData()
                .title(panelDef.title)
                .textField('Link Title', 'Enter the link title (e.g., Discord)')
                .textField('Link URL', 'Enter the full URL (e.g., https://discord.gg/example)');
            return form;
        }

        if (panelId === 'helpfulLinkActionPanel') {
            const panelDef = panelDefinitions[panelId];
            const { linkIndex } = context;
            const links = getHelpfulLinks();
            const link = links[linkIndex];

            if (!link) {
                errorLog(`[UIManager] Invalid link index for helpfulLinkActionPanel: ${linkIndex}`);
                Promise.resolve().then(function () { return uiManager; }).then(({ showPanel }) => showPanel(player, 'helpfulLinksManagementPanel', context));
                return null;
            }


            const form = new ActionFormData()
                .title(panelDef.title)
                .body(`Selected Link:\nTitle: ${link.title}\nURL: ${link.url}`)
                .button('Edit', 'textures/ui/editIcon')
                .button('Move Up', 'textures/gui/controls/up')
                .button('Move Down', 'textures/gui/controls/down')
                .button('§cDelete Link', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitActionMenu_')) {
            const kitName = panelId.replace('kitActionMenu_', '');
            const form = new ActionFormData()
                .title(`Manage Kit: ${kitName}`)
                .button('Edit Settings', 'textures/ui/icon_setting')
                .button('Edit Items', 'textures/ui/inventory_icon')
                .button('§cDelete Kit', 'textures/ui/cancel')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitDetailPanel_')) {
            const kitName = panelId.replace('kitDetailPanel_', '');
            const kitsConfig = getKitsConfig();
            const kit = kitsConfig.kitDefinitions[kitName];

            if (!kit) {
                errorLog(`[UIManager] Could not find kit for detail panel: ${kitName}`);
                return null;
            }

            const form = new ModalFormData()
                .title(`Edit Kit: ${kitName}`)
                .toggle('Enable this kit', { defaultValue: kit.enabled })
                .textField('Cooldown (seconds)', 'The time a player must wait between claiming this kit.', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission Level', '0=Owner, 1=Admin, 2=Mod, 1024=Member. Lower is higher rank.', { defaultValue: String(kit.permissionLevel ?? 1024) });

            form.submitButton('§l§2Save and Close');

            return form;
        }

        const panelDef = panelDefinitions[panelId];
        if (!panelDef) {
            debugLog(`[UIManager] Panel definition not found for '${panelId}'.`);
            return null;
        }
        const pData = getPlayer(player.id);
        if (!pData) {
            debugLog(`[UIManager] Player data not found for ${player.name} (viewer). Cannot build panel.`);
            player.sendMessage('§cCould not find your player data. Please rejoin and try again.');
            return null;
        }
        let title = panelDef.title.replace('{playerName}', context.targetPlayerName ?? '');

        if (panelId === 'mainPanel') {
            const config = getConfig();
            title = config.serverName || panelDef.title;
        }

        if (panelId === 'bountyListPanel') {return buildBountyListForm(title, context);}
        if (panelId === 'reportListPanel') {return buildReportListForm(title, context);}
        if (panelId === 'playerManagementPanel') {return buildPlayerManagementForm(title, context);}
        if (panelId === 'playerListPanel') {return buildPlayerListForm(title, context);}

        if (panelId === 'rulesManagementPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            const rules = getRules();
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add Rule', 'textures/ui/color_plus');

            const paginatedRules = getPaginatedItems$1(rules, page);

            paginatedRules.forEach((rule, index) => {
                const itemIndex = ((page - 1) * itemsPerPage$1) + index;
                form.button(`${itemIndex + 1}. ${rule}`);
            });

            if (rules.length > itemsPerPage$1) {
                addPaginationButtons(form, page, rules.length);
            }

            return form;
        }

        if (panelId === 'addRulePanel') {
            const form = new ModalFormData()
                .title(panelDef.title)
                .textField('New rule text', 'Enter the new rule');
            return form;
        }

        if (panelId === 'ruleActionPanel') {
            const { ruleIndex } = context;
            const rules = getRules();
            const ruleText = rules[ruleIndex] || 'Invalid Rule';

            const form = new ActionFormData()
                .title(panelDef.title)
                .body(`Selected Rule: ${ruleText}`)
                .button('Edit Text', 'textures/ui/editIcon')
                .button('Move Up', 'textures/gui/controls/up')
                .button('Move Down', 'textures/gui/controls/down')
                .button('§cDelete Rule', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId === 'shopMainPanel') {
            const form = new ActionFormData().title(title);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopMainPanel(form, context);
            return form;
        }
        // --- Admin Edit Shop Panels ---
        if (panelId === 'shopManagementPanel') {
            const panelDef = panelDefinitions[panelId];
            const title = panelDef.title;
            const form = new ActionFormData().title(title);
            buildShopAdminMainPanel(form, context);
            return form;
        }

        if (panelId === 'kitManagementPanel') {
            const form = new ActionFormData().title(title);
            buildKitManagementPanel(form, context);
            return form;
        }

        if (panelId === 'rankManagementPanel') {
            const panelDef = panelDefinitions[panelId];
            const title = panelDef.title;
            const form = new ActionFormData().title(title);
            buildRankManagementPanel(form, context);
            return form;
        }

        if (panelId === 'addRankPanel') {
            const form = new ModalFormData().title('§l§2Add New Rank');
            form.textField('Rank Name', 'e.g., VIP');
            form.textField('Rank ID (tag)', 'e.g., vip (lowercase, no spaces)');
            form.textField('Permission Level', '0-1024 (lower is more powerful)');
            form.textField('Name Color', 'e.g., §6');
            form.textField('Chat Color', 'e.g., §6');
            form.textField('Chat Prefix', 'e.g., §8[§6VIP§8]');
            return form;
        }

        if (panelId === 'editRankPanel') {
            const rank = getRankById$1(context.rankId);
            if (!rank) {
                errorLog(`[UIManager] Edit rank panel: rank with ID ${context.rankId} not found.`);
                return null;
            }
            const isSpecialRank = rank.conditions.some(c => c.type === 'isOwner' || c.type === 'default');

            const form = new ModalFormData().title(`§l§3Edit Rank: ${rank.name}`);
            form.textField('Rank Name', 'e.g., VIP', { defaultValue: rank.name });
            form.textField('Rank ID (tag)', 'e.g., vip', { defaultValue: rank.id, disabled: isSpecialRank });
            form.textField('Permission Level', '0-1024', { defaultValue: String(rank.permissionLevel), disabled: isSpecialRank });
            form.textField('Name Color', 'e.g., §6', { defaultValue: rank.chatFormatting?.nameColor ?? '' });
            form.textField('Chat Color', 'e.g., §6', { defaultValue: rank.chatFormatting?.messageColor ?? '' });
            form.textField('Chat Prefix', 'e.g., §8[§6VIP§8]', { defaultValue: rank.chatFormatting?.prefixText ?? '' });
            form.textField('Nametag Prefix', 'e.g., §6VIP', { defaultValue: rank.nametagPrefix ?? '' });
            return form;
        }

        if (panelId === 'configCategoryPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            let allSystems = [
                ...configPanelSchema.map(c => ({ id: `config_${c.id}`, title: c.title, icon: c.icon }))
            ];

            if (pData.permissionLevel <= 1) {
                allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
                allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
                allSystems.push({ id: 'rankManagementPanel', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' });
            }
            if (pData.permissionLevel === 0) {
                allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
            }

            // Custom sorting: General first, Reset last, rest alphabetical
            const generalSystem = allSystems.find(s => s.id === 'config_general');
            const resetSystem = allSystems.find(s => s.id === 'configResetPanel');
            let otherSystems = allSystems.filter(s => s.id !== 'config_general' && s.id !== 'configResetPanel');
            otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

            const sortedSystems = [];
            if (generalSystem) {sortedSystems.push(generalSystem);}
            sortedSystems.push(...otherSystems);
            if (resetSystem) {sortedSystems.push(resetSystem);}

            const paginatedSystems = getPaginatedItems$1(sortedSystems, page);

            for (const system of paginatedSystems) {
                form.button(system.title, system.icon);
            }

            addPaginationButtons(form, page, allSystems.length);
            return form;
        }

        if (panelId === 'configResetPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            const resettableSystems = [
                ...configPanelSchema.filter(c => c.id !== 'general').map(c => ({ id: c.id, title: c.title, icon: c.icon })),
                { id: 'kits', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' },
                { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
                { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
            ];
            resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

            const sortedSystems = resettableSystems;

            const paginatedSystems = getPaginatedItems$1(sortedSystems, page);

            for (const system of paginatedSystems) {
                form.button(`§cReset ${system.title}`, system.icon);
            }

            if (page >= Math.ceil(resettableSystems.length / itemsPerPage$1)) {
                form.button('§l§cReset All Systems', 'textures/ui/trash');
            }

            addPaginationButtons(form, page, resettableSystems.length);
            return form;
        }

        if (panelId === 'playerActionsPanel') {
            panelDef.parentPanelId = context.fromPanel || 'mainPanel';
            const form = new ActionFormData().title(title);
            addPanelBody(form, player, panelId, context);

            const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel);
            for (const item of visibleItems) {
                form.button(item.text, item.icon);
            }
            return form;
        }

        const form = new ActionFormData().title(title);
        addPanelBody(form, player, panelId, context);
        const menuItems = getMenuItems(panelDef, pData.permissionLevel);
        for (const item of menuItems) {
            form.button(item.text, item.icon);
        }
        debugLog(`[UIManager] Successfully built form for panel '${panelId}' with ${menuItems.length} items.`);
        return form;
    } catch (e) {
        const textConfig = panelId === 'floatingTextEditPanel' && context.id ? (await Promise.resolve().then(function () { return floatingTextManager$1; })).floatingTextManager.getTextById(context.id) : null;
        errorLog(`[UIManager] Critical error while building form '${panelId}'.`, {
            error: e,
            context: context,
            textConfig: textConfig
        });
        return null;
    }
}

/**
 * Gets all ranks from the config.
 * @returns {import('./ranksConfig.js').RankDefinition[]}
 */
function getRanks() {
    return getRanksConfig().rankDefinitions;
}

/**
 * Gets a single rank by its ID.
 * @param {string} rankId The ID of the rank to find.
 * @returns {import('./ranksConfig.js').RankDefinition | undefined}
 */
function getRankById(rankId) {
    return getRanks().find(r => r.id === rankId);
}

/**
 * Adds a new rank to the database.
 * @param {import('./ranksConfig.js').RankDefinition} rankData
 * @returns {{success: boolean, message: string}}
 */
function addRank(rankData) {
    const ranksConfig = getRanksConfig();
    if (getRankById(rankData.id)) {
        return { success: false, message: `Rank with ID '${rankData.id}' already exists.` };
    }
    ranksConfig.rankDefinitions.push(rankData);
    saveRanksConfig();
    return { success: true, message: `Rank '${rankData.name}' added successfully.` };
}

/**
 * Updates an existing rank.
 * @param {string} rankId The ID of the rank to update.
 * @param {Partial<import('./ranksConfig.js').RankDefinition>} updatedData
 * @returns {{success: boolean, message: string}}
 */
function updateRank(rankId, updatedData) {
    const ranksConfig = getRanksConfig();
    const rankIndex = ranksConfig.rankDefinitions.findIndex(r => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    const originalRank = ranksConfig.rankDefinitions[rankIndex];
    if (originalRank.locked) {
        if (updatedData.id && updatedData.id !== originalRank.id) {
            return { success: false, message: 'Cannot change the ID of a locked rank.' };
        }
        if (updatedData.permissionLevel && updatedData.permissionLevel !== originalRank.permissionLevel) {
            return { success: false, message: 'Cannot change the permission level of a locked rank.' };
        }
    }

    // Ensure the ID is not changed if a new ID is passed in updatedData that already exists
    if (updatedData.id && updatedData.id !== rankId && getRankById(updatedData.id)) {
        return { success: false, message: `Cannot rename rank ID to '${updatedData.id}' as it already exists.` };
    }

    let message = `Rank '${updatedData.name || originalRank.name}' updated successfully.`;

    // Add a warning if the rank ID (tag) is changed.
    if (updatedData.id && updatedData.id !== rankId) {
        message += `\n§eWARNING:§r The rank ID (tag) was changed from '${rankId}' to '${updatedData.id}'. Players with the old rank tag will need to be updated manually.`;
    }

    ranksConfig.rankDefinitions[rankIndex] = { ...ranksConfig.rankDefinitions[rankIndex], ...updatedData };
    saveRanksConfig();
    return { success: true, message };
}

/**
 * Deletes a rank from the database.
 * @param {string} rankId The ID of the rank to delete.
 * @returns {{success: boolean, message: string}}
 */
function deleteRank(rankId) {
    const ranksConfig = getRanksConfig();
    const rankIndex = ranksConfig.rankDefinitions.findIndex(r => r.id === rankId);
    if (rankIndex === -1) {
        return { success: false, message: `Rank with ID '${rankId}' not found.` };
    }

    const rank = ranksConfig.rankDefinitions[rankIndex];
    if (rank.locked) {
        return { success: false, message: `Cannot delete locked rank '${rank.name}'.` };
    }

    const deletedRankName = ranksConfig.rankDefinitions[rankIndex].name;
    ranksConfig.rankDefinitions.splice(rankIndex, 1);
    saveRanksConfig();
    return { success: true, message: `Rank '${deletedRankName}' deleted successfully.` };
}

/**
 * Creates an ItemStack for a given item ID, handling enchantments.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount of items.
 * @returns {ItemStack | null}
 */
function createShopItemStack(itemInfo, quantity) {
    if (!itemInfo) {
        errorLog('[ShopManager] Could not find item info for creating item stack.');
        return null;
    }

    const itemType = ItemTypes.get(itemInfo.itemId);
    if (!itemType) {
        errorLog(`[ShopManager] Could not find item type for itemId: ${itemInfo.itemId}`);
        return null;
    }

    const itemStack = new ItemStack(itemType, quantity);

    // Handle enchantments
    if (itemInfo.enchantment) {
        try {
            const enchantable = itemStack.getComponent('minecraft:enchantable');
            if (enchantable) {
                enchantable.addEnchantment({
                    type: EnchantmentTypes.get(itemInfo.enchantment.id),
                    level: itemInfo.enchantment.level
                });
            }
        } catch (e) {
            errorLog(`[ShopManager] Failed to apply enchantment for ${itemInfo.itemId}:`, e);
        }
    }

    if (itemInfo.displayName) {
        itemStack.nameTag = `§r${itemInfo.displayName}`;
    }

    return itemStack;
}

/**
 * Handles a player's request to buy an item from the shop.
 * @param {import('@minecraft/server').Player} player The player buying the item.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount to buy.
 * @returns {{success: boolean, message: string}}
 */
function findShopItem(itemId) {
    const shopConfig = getShopConfig();
    for (const categoryName in shopConfig.categories) {
        const category = shopConfig.categories[categoryName];
        if (category.items[itemId]) {
            return { ...items[itemId], ...category.items[itemId] };
        }
        for (const subCategoryName in category.subCategories) {
            const subCategory = category.subCategories[subCategoryName];
            if (subCategory.items[itemId]) {
                return { ...items[itemId], ...subCategory.items[itemId] };
            }
        }
    }
    return null;
}

function buyItem(player, itemId, quantity) {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!shopItem) {
        return { success: false, message: '§cThis item is not available in the shop.' };
    }

    const buyPrice = shopItem.buyPrice;
    if (buyPrice <= 0) {
        return { success: false, message: '§cThis item cannot be purchased.' };
    }

    const initialCost = buyPrice * quantity;
    const playerBalance = getBalance(player.id);

    if (playerBalance < initialCost) {
        return { success: false, message: `§cInsufficient funds. You need §e$${initialCost.toFixed(2)}§c to attempt this purchase.` };
    }

    const inventory = player.getComponent('inventory').container;
    const itemStackTemplate = createShopItemStack(shopItem, 1);

    if (!itemStackTemplate) {
        return { success: false, message: '§cThere was an error creating the item. Please report this to an admin.' };
    }

    // 1. Calculate true available space in inventory
    let spaceFound = 0;
    const maxStackSize = itemStackTemplate.maxAmount;

    if (maxStackSize > 1) { // Item is stackable
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (!item) {
                spaceFound += maxStackSize;
            } else if (item.isStackableWith(itemStackTemplate)) {
                spaceFound += maxStackSize - item.amount;
            }
        }
    } else { // Item is not stackable
        // We assume emptySlotsCount exists. If not, this will need a manual loop.
        spaceFound = inventory.emptySlotsCount;
    }

    // 2. Validate and adjust quantity based on space
    if (spaceFound === 0) {
        return { success: false, message: '§cYou have no space for this item.' };
    }

    let finalQuantity = quantity;
    if (finalQuantity > spaceFound) {
        player.sendMessage(`§eNotice: You only have space for ${spaceFound}. Buying that amount instead.`);
        finalQuantity = spaceFound;
    }

    // 3. Recalculate cost and perform final transaction
    const finalCost = buyPrice * finalQuantity;
    if (playerBalance < finalCost) {
        // This can happen if the adjusted quantity is still too expensive, though unlikely if the initial check passed.
        return { success: false, message: `§cInsufficient funds. You need §e$${finalCost.toFixed(2)}§c to buy ${finalQuantity}.` };
    }

    incrementPlayerBalance(player.id, -finalCost);

    // 4. Give items one by one to avoid stack bugs
    for (let i = 0; i < finalQuantity; i++) {
        const singleItemStack = createShopItemStack(shopItem, 1);
        if (singleItemStack) {
            inventory.addItem(singleItemStack);
        }
    }

    return { success: true, message: `§2Successfully purchased ${finalQuantity}x ${shopItem.displayName ?? itemId} for §e$${finalCost.toFixed(2)}§2.` };
}

/**
 * Handles a player's request to sell an item to the shop.
 * @param {import('@minecraft/server').Player} player The player selling the item.
 * @param {string} itemId The ID of the item from itemsConfig.js.
 * @param {number} quantity The amount to sell.
 * @returns {{success: boolean, message: string}}
 */
function sellItem(player, itemId, quantity) {
    if (quantity <= 0) {
        return { success: false, message: '§cQuantity must be a positive number.' };
    }

    const shopItem = findShopItem(itemId);

    if (!shopItem) {
        return { success: false, message: '§cThis item cannot be sold to the shop.' };
    }

    const sellPrice = shopItem.sellPrice;
    if (sellPrice <= 0) {
        return { success: false, message: '§cThis item cannot be sold.' };
    }

    const inventory = player.getComponent('inventory').container;
    const itemType = ItemTypes.get(shopItem.itemId);
    if (!itemType) {
        return { success: false, message: '§cInternal server error: Item type not found.' };
    }

    // Check if player has enough items
    let count = 0;
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item && item.typeId === itemType.id) {
            // Note: This does not check for special names or enchantments.
            count += item.amount;
        }
    }

    if (count < quantity) {
        return { success: false, message: `§cYou do not have enough of this item. You only have ${count}.` };
    }

    // Remove items
    player.runCommand(`clear "${player.name}" ${shopItem.itemId.replace('minecraft:', '')} 0 ${quantity}`);

    // Success
    const totalGain = sellPrice * quantity;
    incrementPlayerBalance(player.id, totalGain);

    return { success: true, message: `§2Successfully sold ${quantity}x ${shopItem.displayName ?? itemId} for §e$${totalGain.toFixed(2)}§2.` };
}

const MAX_KIT_SLOTS = 36;

/**
 * Adds an item to a kit.
 * @param {string} kitName - The name of the kit.
 * @param {object} itemInfo - The item to add.
 * @param {string} itemInfo.typeId - The item's type ID.
 * @param {number} itemInfo.amount - The amount of the item.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function addItemToKit(kitName, itemInfo) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    if (kit.items.length >= MAX_KIT_SLOTS) {
        return { success: false, message: `Kit '${kitName}' is full. Cannot add more items.` };
    }

    try {
        // Use an item stack to validate the item and get its max stack size
        const itemStack = new ItemStack(itemInfo.typeId, 1);
        const maxAmount = itemStack.maxAmount;

        if (itemInfo.amount > maxAmount) {
            itemInfo.amount = maxAmount;
            debugLog(`[KitItemsManager] Item amount for ${itemInfo.typeId} in kit ${kitName} exceeded max stack size. Capping at ${maxAmount}.`);
        }

        if (itemInfo.amount <= 0) {
            return { success: false, message: 'Item amount must be greater than 0.' };
        }

        kit.items.push(itemInfo);
        saveKitsConfig();
        debugLog(`[KitItemsManager] Added item ${itemInfo.typeId} x${itemInfo.amount} to kit ${kitName}`);
        return { success: true, message: 'Item added successfully.' };
    } catch (e) {
        errorLog(`[KitItemsManager] Failed to add item to kit: ${e.stack}`);
        return { success: false, message: `Invalid item type ID: ${itemInfo.typeId}` };
    }
}

/**
 * Removes an item from a kit by its index.
 * @param {string} kitName - The name of the kit.
 * @param {number} itemIndex - The index of the item to remove.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function removeItemFromKit(kitName, itemIndex) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    if (itemIndex < 0 || itemIndex >= kit.items.length) {
        return { success: false, message: 'Invalid item index.' };
    }

    kit.items.splice(itemIndex, 1);
    saveKitsConfig();
    debugLog(`[KitItemsManager] Removed item at index ${itemIndex} from kit ${kitName}`);
    return { success: true, message: 'Item removed successfully.' };
}

/**
 * Updates an item in a kit.
 * @param {string} kitName - The name of the kit.
 * @param {number} itemIndex - The index of the item to update.
 * @param {object} newItemInfo - The new item info.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function updateItemInKit(kitName, itemIndex, newItemInfo) {
    const config = getKitsConfig();
    const kit = config.kitDefinitions[kitName];

    if (!kit) {
        return { success: false, message: `Kit '${kitName}' not found.` };
    }

    if (itemIndex < 0 || itemIndex >= kit.items.length) {
        return { success: false, message: 'Invalid item index.' };
    }

    if (newItemInfo.amount <= 0) {
        // If amount is 0 or less, remove the item
        return removeItemFromKit(kitName, itemIndex);
    }

    try {
        const itemStack = new ItemStack(newItemInfo.typeId, 1);
        const maxAmount = itemStack.maxAmount;

        if (newItemInfo.amount > maxAmount) {
            newItemInfo.amount = maxAmount;
            debugLog(`[KitItemsManager] Item amount for ${newItemInfo.typeId} in kit ${kitName} exceeded max stack size. Capping at ${maxAmount}.`);
        }

        kit.items[itemIndex] = newItemInfo;
        saveKitsConfig();
        debugLog(`[KitItemsManager] Updated item at index ${itemIndex} in kit ${kitName}`);
        return { success: true, message: 'Item updated successfully.' };
    } catch (e) {
        errorLog(`[KitItemsManager] Failed to update item in kit: ${e.stack}`);
        return { success: false, message: `Invalid item type ID: ${newItemInfo.typeId}` };
    }
}

/**
 * Adds a new category to the shop.
 * @param {string} categoryName - The name for the new category.
 * @param {string} icon - The icon for the new category.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function addCategory(categoryName, icon) {
    const config = getShopConfig();
    if (config.categories[categoryName]) {
        return { success: false, message: `A category with the name '${categoryName}' already exists.` };
    }

    config.categories[categoryName] = {
        icon: icon || 'textures/ui/folder_glyph',
        items: {},
        subCategories: {}
    };

    saveShopConfig();
    debugLog(`[ShopAdminManager] Added new category: ${categoryName}`);
    return { success: true, message: `Successfully added category '${categoryName}'.` };
}

/**
 * Edits a subcategory's name and icon.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} oldSubCategoryName - The current name of the subcategory.
 * @param {string} newSubCategoryName - The new name for the subcategory.
 * @param {string} newIcon - The new icon for the subcategory.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function editSubCategory(categoryName, oldSubCategoryName, newSubCategoryName, newIcon) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!category.subCategories[oldSubCategoryName]) {
        return { success: false, message: `Subcategory '${oldSubCategoryName}' not found in '${categoryName}'.` };
    }
    if (oldSubCategoryName !== newSubCategoryName && category.subCategories[newSubCategoryName]) {
        return { success: false, message: `A subcategory with the name '${newSubCategoryName}' already exists in '${categoryName}'.` };
    }

    const subCategoryData = category.subCategories[oldSubCategoryName];
    subCategoryData.icon = newIcon;

    if (oldSubCategoryName !== newSubCategoryName) {
        category.subCategories[newSubCategoryName] = subCategoryData;
        delete category.subCategories[oldSubCategoryName];
    }

    saveShopConfig();
    debugLog(`[ShopAdminManager] Edited subcategory '${oldSubCategoryName}' to '${newSubCategoryName}' in '${categoryName}'.`);
    return { success: true, message: `Successfully edited subcategory '${newSubCategoryName}'.` };
}

/**
 * Edits a category's name and icon.
 * @param {string} oldCategoryName - The current name of the category.
 * @param {string} newCategoryName - The new name for the category.
 * @param {string} newIcon - The new icon for the category.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function editCategory(oldCategoryName, newCategoryName, newIcon) {
    const config = getShopConfig();
    if (!config.categories[oldCategoryName]) {
        return { success: false, message: `Category '${oldCategoryName}' not found.` };
    }
    if (oldCategoryName !== newCategoryName && config.categories[newCategoryName]) {
        return { success: false, message: `A category with the name '${newCategoryName}' already exists.` };
    }

    const categoryData = config.categories[oldCategoryName];
    categoryData.icon = newIcon;

    if (oldCategoryName !== newCategoryName) {
        config.categories[newCategoryName] = categoryData;
        delete config.categories[oldCategoryName];
    }

    saveShopConfig();
    debugLog(`[ShopAdminManager] Edited category '${oldCategoryName}' to '${newCategoryName}'.`);
    return { success: true, message: `Successfully edited category '${newCategoryName}'.` };
}

/**
 * Deletes a category from the shop.
 * @param {string} categoryName - The name of the category to delete.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function deleteCategory(categoryName) {
    const config = getShopConfig();
    if (!config.categories[categoryName]) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    delete config.categories[categoryName];
    saveShopConfig();
    debugLog(`[ShopAdminManager] Deleted category: ${categoryName}`);
    return { success: true, message: `Successfully deleted category '${categoryName}'.` };
}

/**
 * Adds a new subcategory to a category.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} subCategoryName - The name for the new subcategory.
 * @param {string} icon - The icon for the new subcategory.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function addSubCategory(categoryName, subCategoryName, icon) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (category.subCategories[subCategoryName]) {
        return { success: false, message: `A subcategory with the name '${subCategoryName}' already exists in '${categoryName}'.` };
    }

    category.subCategories[subCategoryName] = {
        icon: icon || 'textures/ui/folder_glyph',
        items: {}
    };

    saveShopConfig();
    debugLog(`[ShopAdminManager] Added new subcategory '${subCategoryName}' to '${categoryName}'.`);
    return { success: true, message: `Successfully added subcategory '${subCategoryName}'.` };
}

/**
 * Deletes a subcategory from a category.
 * @param {string} categoryName - The name of the parent category.
 * @param {string} subCategoryName - The name of the subcategory to delete.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function deleteSubCategory(categoryName, subCategoryName) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }
    if (!category.subCategories[subCategoryName]) {
        return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
    }

    delete category.subCategories[subCategoryName];
    saveShopConfig();
    debugLog(`[ShopAdminManager] Deleted subcategory '${subCategoryName}' from '${categoryName}'.`);
    return { success: true, message: `Successfully deleted subcategory '${subCategoryName}'.` };
}

/**
 * Adds or updates an item in the shop.
 * @param {string} categoryName - The name of the category.
 * @param {string|null} subCategoryName - The name of the subcategory, or null for the main category.
 * @param {string} itemId - The ID of the item to add/update.
 * @param {object} itemData - The data for the item (buyPrice, sellPrice, permissionLevel).
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function setItem(categoryName, subCategoryName, itemId, itemData) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer = category;

    targetContainer.items[itemId] = {
        buyPrice: itemData.buyPrice,
        sellPrice: itemData.sellPrice,
        permissionLevel: itemData.permissionLevel,
        icon: itemData.icon,
        displayName: itemData.displayName
    };

    saveShopConfig();
    debugLog(`[ShopAdminManager] Set item '${itemId}' in '${categoryName}/${''}'.`);
    return { success: true, message: `Successfully set item '${itemId}'.` };
}

/**
 * Adds a custom item to the in-memory items config.
 * @param {string} itemId - The unique ID for the new item.
 * @param {object} itemData - The data for the new item.
 * @returns {{success: boolean, message: string}}
 */
function addCustomItemToConfig(itemId, itemData) {
    if (items[itemId]) {
        return { success: false, message: `An item with the ID '${itemId}' already exists.` };
    }
    items[itemId] = {
        itemId: itemData.itemId,
        icon: itemData.icon,
        buyPrice: itemData.buyPrice,
        sellPrice: itemData.sellPrice,
        displayName: itemData.displayName,
        category: 'Custom'
    };
    return { success: true, message: 'Custom item added to in-memory config.' };
}

/**
 * Removes an item from the shop.
 * @param {string} categoryName - The name of the category.
 * @param {string|null} subCategoryName - The name of the subcategory, or null for the main category.
 * @param {string} itemId - The ID of the item to remove.
 * @returns {{success: boolean, message: string}} - The result of the operation.
 */
function removeItem(categoryName, subCategoryName, itemId) {
    const config = getShopConfig();
    const category = config.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer = category;
    if (subCategoryName) {
        targetContainer = category.subCategories[subCategoryName];
        if (!targetContainer) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found in '${categoryName}'.` };
        }
    }

    if (!targetContainer.items[itemId]) {
        return { success: false, message: `Item '${itemId}' not found.` };
    }

    delete targetContainer.items[itemId];
    saveShopConfig();
    debugLog(`[ShopAdminManager] Removed item '${itemId}' from '${categoryName}/${subCategoryName || ''}'.`);
    return { success: true, message: `Successfully removed item '${itemId}'.` };
}

/**
 * Updates a shop item's details in both the shop config and the master item list.
 * @param {string} categoryName The category of the item.
 * @param {string|null} subCategoryName The subcategory of the item.
 * @param {string} itemId The ID of the item to update.
 * @param {object} newData The new data for the item.
 * @returns {{success: boolean, message: string}} The result of the operation.
 */
function updateShopItem(categoryName, subCategoryName, itemId, newData) {
    // 1. Update the master item list (items.js)
    if (items[itemId]) {
        items[itemId].displayName = newData.displayName;
        items[itemId].itemId = newData.minecraftId;
        items[itemId].icon = newData.icon;
    } else {
        // This case should ideally not happen if the item was added correctly
        addCustomItemToConfig(itemId, {
            displayName: newData.displayName,
            itemId: newData.minecraftId,
            icon: newData.icon,
            buyPrice: newData.buyPrice,
            sellPrice: newData.sellPrice
        });
    }

    // 2. Update the shop-specific configuration (shop.json)
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        return { success: false, message: `Category '${categoryName}' not found.` };
    }

    let targetContainer = category;
    if (subCategoryName) {
        targetContainer = category.subCategories[subCategoryName];
        if (!targetContainer) {
            return { success: false, message: `Subcategory '${subCategoryName}' not found.` };
        }
    }

    if (!targetContainer.items[itemId]) {
        return { success: false, message: `Item '${itemId}' not found in shop config.` };
    }

    // Update shop-specific properties
    targetContainer.items[itemId].buyPrice = newData.buyPrice;
    targetContainer.items[itemId].sellPrice = newData.sellPrice;
    targetContainer.items[itemId].permissionLevel = newData.permissionLevel;
    // Also update denormalized data like icon and displayName for consistency
    targetContainer.items[itemId].icon = newData.icon;
    targetContainer.items[itemId].displayName = newData.displayName;

    saveShopConfig();
    debugLog(`[ShopAdminManager] Updated item '${itemId}' in shop and master list.`);
    return { success: true, message: `Successfully updated item '${itemId}'.` };
}

/**
 * Shows a confirmation dialog to the player.
 * @param {import('@minecraft/server').Player} player The player to show the dialog to.
 * @param {object} options
 * @param {string} options.title The title of the confirmation dialog.
 * @param {string} options.body The body text of the confirmation dialog.
 * @param {() => void} options.onConfirm A callback function to execute when the user confirms.
 * @param {() => void} [options.onCancel] A callback function to execute when the user cancels.
 * @param {string} [options.confirmButtonText='§aConfirm'] Text for the confirm button.
 * @param {string} [options.cancelButtonText='§cCancel'] Text for the cancel button.
 */
function showConfirmationDialog(player, { title, body, onConfirm, onCancel, confirmButtonText = '§aConfirm', cancelButtonText = '§cCancel' }) {
    const form = new MessageFormData()
        .title(title)
        .body(body)
        .button1(confirmButtonText)
        .button2(cancelButtonText);

    form.show(player).then(({ canceled, selection }) => {
        if (canceled) {
            if (onCancel) {onCancel();}
            return;
        }

        // selection is 1 for button1, 0 for button2 on Bedrock, but docs say 0 and 1.
        // Let's check the result of show. The promise returns an object with a `selection` property.
        // The first button added (button1) corresponds to selection value 0.
        // The second button added (button2) corresponds to selection value 1.
        // The documentation seems to be conflicting in different places, but `selection: 0` for `button1` is the common understanding.
        // Let's stick to the official API docs: button1 is selection 0.
        // Wait, the docs say `MessageFormResponse.selection` is the index of the button pressed.
        // So button1 is 0, button2 is 1.
        // However, I recall from experience that button1 is `true` and button2 is `false` in the `formValues` of ModalFormData.
        // For MessageFormData, the `selection` property is the index.
        // Let's re-read the docs.
        // `MessageFormResponse.selection`: `number` - Index of the button that was pushed.
        // So `button1` is `0`, `button2` is `1`.
        // My previous implementation was wrong.

        if (selection === 0) { // button1 was pressed
            onConfirm();
        } else { // button2 was pressed
            if (onCancel) {onCancel();}
        }
    });
}

/**
 * @typedef {'tpa' | 'tpahere'} TpaRequestType
 */

/**
 * @typedef {object} TpaRequest
 * @property {string} sourcePlayerId
 * @property {string} sourcePlayerName
 * @property {string} targetPlayerId
 * @property {string} targetPlayerName
 * @property {TpaRequestType} type
 * @property {number} expiryTimestamp
 * @property {number} timeoutId
 */

/** @type {Map<string, TpaRequest>} */
const outgoingRequests = new Map();
/** @type {Map<string, TpaRequest[]>} */
const incomingRequests = new Map();

/**
 * Clears a TPA request from the system.
 * @param {TpaRequest} request The request to clear.
 */
function clearRequest(request) {
    if (!request) {return;}
    system.clearRun(request.timeoutId);
    outgoingRequests.delete(request.sourcePlayerId);
    const targetRequests = incomingRequests.get(request.targetPlayerId);
    if (targetRequests) {
        const index = targetRequests.findIndex(r => r.sourcePlayerId === request.sourcePlayerId);
        if (index !== -1) {
            targetRequests.splice(index, 1);
        }
        if (targetRequests.length === 0) {
            incomingRequests.delete(request.targetPlayerId);
        }
    }
}

/**
 * Creates a new TPA request.
 * @param {import('@minecraft/server').Player} sourcePlayer
 * @param {import('@minecraft/server').Player} targetPlayer
 * @param {TpaRequestType} type
 * @returns {{success: boolean, message: string}}
 */
function createRequest(sourcePlayer, targetPlayer, type) {
    if (outgoingRequests.has(sourcePlayer.id)) {
        return { success: false, message: 'You already have an outgoing TPA request. Use !tpacancel to cancel it.' };
    }

    // Check if the target player has disabled TPA requests
    const targetPlayerData = getOrCreatePlayer(targetPlayer);
    if (targetPlayerData.tpaRequestsDisabled) {
        return { success: false, message: `§c${targetPlayer.name} is not accepting TPA requests.` };
    }

    // Check if the source player is in the target's blocked list
    if (targetPlayerData.tpaBlockedPlayerIds?.includes(sourcePlayer.id)) {
        return { success: false, message: `§cYou are blocked from sending TPA requests to ${targetPlayer.name}.` };
    }

    const config = getConfig();
    const timeoutSeconds = config.tpa.requestTimeoutSeconds;
    const expiryTimestamp = Date.now() + timeoutSeconds * 1000;

    const timeoutId = system.runTimeout(() => {
        const existingRequest = outgoingRequests.get(sourcePlayer.id);
        if (existingRequest && existingRequest.expiryTimestamp <= Date.now()) {
            sourcePlayer.sendMessage('§cYour TPA request has expired.');
            targetPlayer.sendMessage(`§cThe TPA request from ${sourcePlayer.name} has expired.`);
            clearRequest(existingRequest);
        }
    }, timeoutSeconds * 20); // Convert seconds to ticks

    /** @type {TpaRequest} */
    const request = {
        sourcePlayerId: sourcePlayer.id,
        sourcePlayerName: sourcePlayer.name,
        targetPlayerId: targetPlayer.id,
        targetPlayerName: targetPlayer.name,
        type,
        expiryTimestamp,
        timeoutId
    };

    outgoingRequests.set(sourcePlayer.id, request);
    if (!incomingRequests.has(targetPlayer.id)) {
        incomingRequests.set(targetPlayer.id, []);
    }
    incomingRequests.get(targetPlayer.id).push(request);

    return { success: true, message: 'TPA request sent.' };
}

/**
 * Sends a consistently formatted message to a player or the entire world.
 * @param {string} message The message to send. Can include color codes.
 * @param {import('@minecraft/server').Player | 'all'} [target=world] - The player to send the message to, or 'all' to broadcast to everyone. Defaults to a world broadcast.
 * @param {object} [options={}] Optional parameters.
 * @param {boolean} [options.raw=false] If true, sends the message without the server name prefix.
 * @param {string} [options.title=null] An optional title to replace the default server name.
 */
function sendMessage(message, target = world, options = {}) {
    const { raw = false, title = null } = options;
    const serverName = title ?? getConfig()?.serverName ?? 'Server';
    const finalMessage = raw ? message : `${serverName} §8»§r ${message}`;

    try {
        if (target === 'all' || target === world) {
            world.sendMessage(finalMessage);
        } else if (target && typeof target.sendMessage === 'function') {
            target.sendMessage(finalMessage);
        } else {
            warnLog(`[sendMessage] Invalid target provided: ${target}`);
        }
    } catch {
        // Suppress potential errors if the target player is invalid or has left.
    }
}

/**
 * This file contains centralized constants for the addon.
 * Using constants helps prevent "magic strings" and makes the code easier to maintain.
 */

const constants = {
    // --- Entity Identifiers ---
    floatingTextId: 'addonexe:floating_text',

    // --- Common Tags ---
    adminTag: 'admin',
    vanishedTag: 'vanished',
    frozenTag: 'frozen',

    // --- UI Form Titles ---
    mainPanelTitle: '§l§bAddonExe Control Panel',

    // --- Command Prefixes ---
    commandPrefix: '!', // This will be read from config later

    // --- Default Messages ---
    noPermission: '§cYou do not have permission to use this command.',
    homesDisabled: '§cThe homes system is currently disabled.',
    tpaDisabled: '§cThe TPA system is currently disabled.',
    economyDisabled: '§cThe economy system is currently disabled.',
    rtpDisabled: '§cThe Random Teleport system is currently disabled.',
    warpsDisabled: '§cThe warps system is currently disabled.',

    // --- Sound Events ---
    soundTeleport: 'random.orb',
    soundError: 'note.bass'
};

/**
 * Kicks a player from the server.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {import('@minecraft/server').Player} targetPlayer The player to kick.
 * @param {string} reason The reason for the kick.
 */
function kickPlayer(player, targetPlayer, reason) {
    if (!targetPlayer) {
        sendMessage('§cPlayer not found.', player);
        if (!player.isConsole) { playSound(player, constants.soundError); }
        return;
    }

    if (player.id && player.id === targetPlayer.id) {
        sendMessage('§cYou cannot kick yourself.', player);
        playSound(player, constants.soundError);
        return;
    }

    if (!player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            playSound(player, constants.soundError);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot kick a player with the same or higher rank than you.', player);
            playSound(player, constants.soundError);
            return;
        }
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        const commandToRun = `kick "${targetPlayer.name}" ${sanitizedReason}`;
        if (player.isConsole) {
            world.getDimension('overworld').runCommand(commandToRun);
        } else {
            player.runCommand(commandToRun);
        }
        sendMessage(`§aSuccessfully kicked ${targetPlayer.name}. Reason: ${reason}`, player);
        if (!player.isConsole) { playSound(player, constants.soundTeleport); }
    } catch (error) {
        sendMessage(`§cFailed to kick ${targetPlayer.name}. See console for details.`, player);
        if (!player.isConsole) { playSound(player, constants.soundError); }
        errorLog(`[/kick] Failed to run kick command for ${targetPlayer.name}:`, error);
    }
}

commandManager.register({
    name: 'kick',
    slashName: 'xkick',
    description: 'Kicks a player from the server.',
    aliases: ['boot'],
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to kick.' },
        { name: 'reason', type: 'text', description: 'The reason for kicking the player.', optional: true }
    ],
    /**
     * Executes the /kick command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {string} args.target The name of the player to kick.
     * @param {string} [args.reason] The reason for the kick.
     */
    execute: (player, args) => {
        const { target: targetName, reason = 'No reason provided' } = args;
        const targetPlayer = findPlayerByName(targetName);
        kickPlayer(player, targetPlayer, reason);
    }
});

/**
 * Mutes a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {import('@minecraft/server').Player} targetPlayer The player to mute.
 * @param {string} [duration] The duration of the mute.
 * @param {string} reason The reason for the mute.
 */
function mutePlayer(player, targetPlayer, duration, reason) {
    if (!targetPlayer) {
        sendMessage('§cPlayer not found.', player);
        playSound(player, constants.soundError);
        return;
    }
    if (!player.isConsole) {
        if (player.id === targetPlayer.id) {
            sendMessage('§cYou cannot mute yourself.', player);
            playSound(player, constants.soundError);
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            playSound(player, constants.soundError);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot mute a player with the same or higher rank than you.', player);
            playSound(player, constants.soundError);
            return;
        }
    }
    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;
    addPunishment(targetPlayer.id, {
        type: 'mute',
        expires,
        reason
    });
    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    const announcer = player.isConsole ? 'the Console' : player.name;
    sendMessage(`§aSuccessfully muted ${targetPlayer.name} ${durationText}. Reason: ${reason}`, player);
    sendMessage(`§cYou have been muted ${durationText} by ${announcer}.`, targetPlayer);
    if (!player.isConsole) {
        playSound(player, constants.soundTeleport);
    }
}

commandManager.register({
    name: 'mute',
    description: 'Mutes a player for a specified duration with a reason.',
    aliases: ['silence'],
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to mute.' },
        { name: 'duration', type: 'string', description: 'The duration of the mute (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the mute.', optional: true }
    ],
    /**
     * Executes the /mute command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const targetPlayer = Array.isArray(args.target) ? args.target[0] : findPlayerByName(args.target);

        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        mutePlayer(player, targetPlayer, duration, reason || 'No reason provided.');
    }
});

/**
 * Unmutes a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {string} targetName The name of the player to unmute.
 */
function unmutePlayer(player, targetName) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        sendMessage(`§cPlayer "${targetName}" has never joined the server or name is misspelled.`, player);
        return;
    }
    if (!player.isConsole) {
        if (targetId === player.id) {
            sendMessage('§cYou cannot unmute yourself.', player);
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);
        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot unmute a player with the same or higher rank than you.', player);
            return;
        }
    }
    const success = removePunishment(targetId);

    if (!success) {
        sendMessage(`§cPlayer "${targetName}" is not currently muted.`, player);
        if (!player.isConsole) { playSound(player, constants.soundError); }
        return;
    }

    sendMessage(`§aSuccessfully unmuted ${targetName}.`, player);
    if (!player.isConsole) {
        playSound(player, constants.soundTeleport);
    }

    const targetPlayer = findPlayerByName(targetName);
    if (targetPlayer) {
        sendMessage('§aYou have been unmuted and can now chat again.', targetPlayer);
        playSound(targetPlayer, 'random.levelup');
    }
}

commandManager.register({
    name: 'unmute',
    description: 'Unmutes a player.',
    aliases: ['um'],
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to unmute.' }
    ],
    /**
     * Executes the /unmute command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        unmutePlayer(player, args.target);
    }
});

/**
 * Bans a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {import('@minecraft/server').Player} targetPlayer The player to ban.
 * @param {string} [duration] The duration of the ban.
 * @param {string} reason The reason for the ban.
 */
function banPlayer(player, targetPlayer, duration, reason) {
    if (player && player.id === targetPlayer.id) {
        sendMessage('§cYou cannot ban yourself.', player);
        return;
    }

    if (player && !player.isConsole) {
        const executorData = getPlayer(player.id);
        const targetData = getPlayer(targetPlayer.id);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', player);
            return;
        }
    }

    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;

    addPunishment(targetPlayer.id, {
        type: 'ban',
        expires,
        reason
    });

    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    sendMessage(`§aSuccessfully banned ${targetPlayer.name} ${durationText}. Reason: ${reason}`, player);

    if (player && !player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
        try {
            const sanitizedReason = reason.replace(/"/g, '\\"');
            player.runCommand(`kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
        } catch (error) {
            sendMessage(`§eWarning: Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`, player);
            errorLog(`[/ban] Failed to run kick command for ${targetPlayer.name} after banning:`, error);
        }
    } else {
        try {
            const sanitizedReason = reason.replace(/"/g, '\\"');
            const command = `kick "${targetPlayer.name}" You have been banned ${durationText}. Reason: ${sanitizedReason}`;
            world.getDimension('overworld').runCommand(command);
        } catch (error) {
            warnLog(`[Commands:Ban] Could not kick ${targetPlayer.name} after banning. They will be kicked on next join.`);
            errorLog(`[/ban] Failed to run kick command from console for ${targetPlayer.name}:`, error);
        }
    }
}

commandManager.register({
    name: 'ban',
    description: 'Bans a player for a specified duration with a reason.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to ban.' },
        { name: 'duration', type: 'string', description: 'The duration of the ban (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the ban.', optional: true }
    ],
    /**
     * Executes the /ban command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const targetPlayer = Array.isArray(args.target) ? args.target[0] : findPlayerByName(args.target);

        if (!targetPlayer) {
            sendMessage('§cPlayer not found. If they are offline, use the /offlineban command.', player);
            return;
        }

        if (player.isConsole && !targetPlayer.id) {
            sendMessage('§cCannot target the console for a ban.', player);
            return;
        }

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        banPlayer(player, targetPlayer, duration, reason || 'No reason provided.');
    }
});

/**
 * Unbans a player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {string} targetName The name of the player to unban.
 */
function unbanPlayer(player, targetName) {
    const targetId = getPlayerIdByName(targetName);

    if (!targetId) {
        sendMessage(`§cPlayer "${targetName}" not found in the database. Make sure the name is correct (case-insensitive).`, player);
        return;
    }

    if (!player.isConsole) {
        if (player.id === targetId) {
            sendMessage('§cYou cannot unban yourself.', player);
            return;
        }
        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }
        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot unban a player with the same or higher rank than you.', player);
            return;
        }
    }

    removePunishment(targetId);
    sendMessage(`§aSuccessfully unbanned ${targetName}. They can now rejoin the server.`, player);
    if (!player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
    }
}

commandManager.register({
    name: 'unban',
    aliases: ['pardon'],
    description: 'Unbans a player.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to unban.' }
    ],
    /**
     * Executes the /unban command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        unbanPlayer(player, args.target);
    }
});

/**
 * Bans an offline player.
 * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
 * @param {string} targetId The ID of the player to ban.
 * @param {string} targetName The name of the player to ban.
 * @param {string} [duration] The duration of the ban.
 * @param {string} reason The reason for the ban.
 */
function offlineBanPlayer(player, targetId, targetName, duration, reason) {
    if (!player.isConsole) {
        if (player.id === targetId) {
            sendMessage('§cYou cannot ban yourself.', player);
            return;
        }

        const executorData = getPlayer(player.id);
        const targetData = loadPlayerData(targetId);

        if (!executorData || !targetData) {
            sendMessage('§cCould not retrieve player data for permission check.', player);
            return;
        }

        if (executorData.permissionLevel >= targetData.permissionLevel) {
            sendMessage('§cYou cannot ban a player with the same or higher rank than you.', player);
            return;
        }
    }

    const durationString = duration || 'perm';
    const durationMs = duration ? parseDuration(duration) : Infinity;
    const expires = durationMs === Infinity ? Infinity : Date.now() + durationMs;

    addPunishment(targetId, {
        type: 'ban',
        expires,
        reason
    });

    const durationText = durationMs === Infinity ? 'permanently' : `for ${durationString}`;
    sendMessage(`§aSuccessfully banned ${targetName} ${durationText}. Reason: ${reason}`, player);
    if (!player.isConsole) {
        playSoundFromConfig(player, 'adminNotificationReceived');
    }

    try {
        const sanitizedReason = reason.replace(/"/g, '\\"');
        player.runCommand(`kick "${targetName}" You have been banned ${durationText}. Reason: ${sanitizedReason}`);
    } catch {
        // Player is likely offline, which is fine.
    }
}

commandManager.register({
    name: 'offlineban',
    aliases: ['oban'],
    description: 'Bans a player who is currently offline.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to ban.' },
        { name: 'duration', type: 'string', description: 'The duration of the ban (e.g., 1d, 2h, 30m). Default: perm', optional: true },
        { name: 'reason', type: 'text', description: 'The reason for the ban.', optional: true }
    ],
    /**
     * Executes the /offlineban command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     */
    execute: (player, args) => {
        const { target: targetName } = args;

        const targetId = getPlayerIdByName(targetName);
        if (!targetId) {
            sendMessage(`§cPlayer "${targetName}" has never joined this server.`, player);
            return;
        }

        const targetData = loadPlayerData(targetId);
        const correctTargetName = targetData ? targetData.name : targetName;

        let duration = args.duration;
        let reason = args.reason;

        if (duration && parseDuration(duration) === 0) {
            reason = `${duration}${reason ? ' ' + reason : ''}`;
            duration = undefined;
        }

        offlineBanPlayer(player, targetId, correctTargetName, duration, reason || 'No reason provided.');
    }
});

/**
 * Freezes a player by disabling their input permissions.
 * @param {import('@minecraft/server').Player | object} executor
 * @param {import('@minecraft/server').Player} targetPlayer
 */
function freezePlayer(executor, targetPlayer) {
    if (targetPlayer.hasTag(constants.frozenTag)) {
        sendMessage(`§ePlayer ${targetPlayer.name} is already frozen.`, executor);
        return;
    }
    try {
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" camera disabled`);
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" movement disabled`);
        targetPlayer.addTag(constants.frozenTag);

        const announcer = executor.isConsole ? 'the Console' : executor.name;
        sendMessage(`§aSuccessfully froze ${targetPlayer.name}.`, executor);
        sendMessage(`§cYou have been frozen by ${announcer}.`, targetPlayer);
    } catch (error) {
        sendMessage(`§cFailed to freeze ${targetPlayer.name}.`, executor);
        errorLog(`[Freeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error}`);
    }
}

/**
 * Unfreezes a player by enabling their input permissions.
 * @param {import('@minecraft/server').Player | object} executor
 * @param {import('@minecraft/server').Player} targetPlayer
 */
function unfreezePlayer(executor, targetPlayer) {
    if (!targetPlayer.hasTag(constants.frozenTag)) {
        sendMessage(`§ePlayer ${targetPlayer.name} is not frozen.`, executor);
        return;
    }
    try {
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" camera enabled`);
        targetPlayer.dimension.runCommand(`inputpermission set "${targetPlayer.name}" movement enabled`);
        targetPlayer.removeTag(constants.frozenTag);

        sendMessage(`§aSuccessfully unfroze ${targetPlayer.name}.`, executor);
        sendMessage('§aYou have been unfrozen.', targetPlayer);
    } catch (error) {
        sendMessage(`§cFailed to unfreeze ${targetPlayer.name}.`, executor);
        errorLog(`[Unfreeze] Failed to run /inputpermission on ${targetPlayer.name}: ${error}`);
    }
}

commandManager.register({
    name: 'freeze',
    description: 'Freezes a player, preventing them from moving or looking around.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to freeze.' }
    ],
    /**
     * Executes the /freeze command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }
        if (!player.isConsole && player.id === targetPlayer.id) {
            sendMessage('§cYou cannot freeze yourself.', player);
            return;
        }
        freezePlayer(player, targetPlayer);
    }
});

commandManager.register({
    name: 'unfreeze',
    description: 'Unfreezes a player, allowing them to move and look around again.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    parameters: [
        { name: 'target', type: 'player', description: 'The player to unfreeze.' }
    ],
    /**
     * Executes the /unfreeze command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     * @param {object} args The command arguments.
     * @param {import('@minecraft/server').Player[]} args.target The target player array.
     */
    execute: (player, args) => {
        const targetPlayer = args.target[0];
        if (!targetPlayer) {
            sendMessage('§cPlayer not found.', player);
            return;
        }
        unfreezePlayer(player, targetPlayer);
    }
});

const uiActionFunctions = {
    showRules: async (player) => {
        const rules = getRules();
        const pData = getPlayer(player.id);

        const rulesForm = new ActionFormData()
            .title('§l§6Server Rules')
            .body(rules.join('\n'));

        if (pData && pData.permissionLevel <= 1) {
            rulesForm.button('§l§4Edit Rules', 'textures/ui/icon_setting');
        }

        rulesForm.button('§l§8Close', 'textures/ui/cancel');

        const response = await uiWait(player, rulesForm);

        if (response.canceled) { return; }

        if (pData && pData.permissionLevel <= 1 && response.selection === 0) {
            return showPanel(player, 'rulesManagementPanel');
        }
    },

    showHelpfulLinks: async (player) => {
        const links = getHelpfulLinks();
        const pData = getPlayer(player.id);

        const form = new ActionFormData()
            .title('§l§9Helpful Links');

        if (links.length === 0) {
            form.body('§cNo helpful links have been configured by the admin.');
        } else {
            const bodyText = links.map(link => `§f${link.title}: §r${link.url}`).join('\n\n');
            form.body(bodyText);
        }

        if (pData && pData.permissionLevel <= 1) {
            form.button('§l§4Edit Links', 'textures/ui/icon_setting');
        }

        form.button('§l§8Close', 'textures/ui/cancel');

        const response = await uiWait(player, form);

        if (response.canceled) { return; }

        if (pData && pData.permissionLevel <= 1 && response.selection === 0) {
            return showPanel(player, 'helpfulLinksManagementPanel');
        }
    },

    assignReport: (player, context, panelId) => {
        assignReport(context.targetReport.id, player.id);
        player.sendMessage(`§2Report ${context.targetReport.id} has been assigned to you.`);
        showPanel(player, panelId, context);
    },

    resolveReport: (player, context) => {
        resolveReport(context.targetReport.id);
        player.sendMessage(`§2Report ${context.targetReport.id} has been marked as resolved.`);
        showPanel(player, 'reportListPanel');
    },

    clearReport: (player, context) => {
        clearReport(context.targetReport.id);
        player.sendMessage(`§2Report ${context.targetReport.id} has been cleared.`);
        showPanel(player, 'reportListPanel');
    },

    showUnbanForm: async (player) => {
        const form = new ModalFormData().title('Unban Player').textField('Player Name', 'Enter player name');
        const response = await uiWait(player, form);
        if (!response || response.canceled) { return true; }
        const [targetName] = response.formValues;
        if (!targetName) {
            player.sendMessage('§cYou must enter a player name.');
            return true;
        }
        unbanPlayer(player, targetName);
        return true;
    },

    showUnmuteForm: async (player) => {
        const form = new ModalFormData().title('Unmute Player').textField('Player Name', 'Enter player name');
        const response = await uiWait(player, form);
        if (!response || response.canceled) { return true; }
        const [targetName] = response.formValues;
        if (!targetName) {
            player.sendMessage('§cYou must enter a player name.');
            return true;
        }
        unmutePlayer(player, targetName);
        return true;
    },

    removeBounty: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const existingBounty = getBounty(targetPlayerId);

        if (!existingBounty) {
            player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
            return true;
        }

        removeBounty(targetPlayerId);
        player.sendMessage(`§2Successfully removed the bounty from ${targetPlayerName}.`);
        world.sendMessage(`§2The bounty on ${targetPlayerName} has been removed!`);

        return true;
    },

    kickPlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        const form = new ModalFormData().title(`Kick ${targetPlayerName}`).textField('Reason', 'Enter reason for kicking', { defaultValue: 'No reason provided.' });
        const response = await uiWait(player, form);
        if (response && !response.canceled) {
            const [reason] = response.formValues;
            kickPlayer(player, targetPlayer, reason);
        }
        return true;
    },

    freezePlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        freezePlayer(player, targetPlayer);
        return true;
    },

    unfreezePlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        unfreezePlayer(player, targetPlayer);
        return true;
    },

    unmutePlayer: async (player, context) => {
        const { targetPlayerName } = context;
        unmutePlayer(player, targetPlayerName);
        return true;
    },

    mutePlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online. Use /offlinemute instead.`);
            return true;
        }
        const form = new ModalFormData().title(`Mute ${targetPlayerName}`).textField('Duration', 'e.g., 30m, 2h, 7d. Default: perm', { defaultValue: 'perm' }).textField('Reason', 'Enter reason for muting', { defaultValue: 'No reason provided.' });
        const response = await uiWait(player, form);
        if (response && !response.canceled) {
            const [duration, reason] = response.formValues;
            mutePlayer(player, targetPlayer, duration, reason);
        }
        return true;
    },

    banPlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const form = new ModalFormData().title(`Ban ${targetPlayerName}`).textField('Duration', 'e.g., 30m, 2h, 7d. Default: perm', { defaultValue: 'perm' }).textField('Reason', 'Enter reason for banning', { defaultValue: 'No reason provided.' });
        const response = await uiWait(player, form);
        if (response && !response.canceled) {
            const [duration, reason] = response.formValues;
            const targetPlayer = getPlayerFromCache(targetPlayerId);
            if (targetPlayer) {
                banPlayer(player, targetPlayer, duration, reason);
            } else {
                offlineBanPlayer(player, targetPlayerId, targetPlayerName, duration, reason);
            }
        }
        return true;
    },

    tpaPlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        if (player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot send a TPA request to yourself.');
            return true;
        }
        const result = createRequest(player, targetPlayer, 'tpa');
        if (result.success) {
            player.sendMessage(`§2TPA request sent to ${targetPlayerName}.`);
            targetPlayer.sendMessage(`§2${player.name} has requested to teleport to you. Use !tpaccept or !tpadeny.`);
        } else {
            player.sendMessage(`§cError: ${result.message}`);
        }
        return true;
    },

    tpaherePlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetPlayer = getPlayerFromCache(targetPlayerId);
        if (!targetPlayer) {
            player.sendMessage(`§c${targetPlayerName} is not online.`);
            return true;
        }
        if (player.id === targetPlayer.id) {
            player.sendMessage('§cYou cannot send a TPAHere request to yourself.');
            return true;
        }
        const result = createRequest(player, targetPlayer, 'tpahere');
        if (result.success) {
            player.sendMessage(`§2TPAHere request sent to ${targetPlayerName}.`);
            targetPlayer.sendMessage(`§2${player.name} has requested for you to teleport to them. Use !tpaccept or !tpadeny.`);
        } else {
            player.sendMessage(`§cError: ${result.message}`);
        }
        return true;
    },

    bountyPlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const form = new ModalFormData().title(`Set Bounty on ${targetPlayerName}`).textField('Amount', 'Enter amount');
        const response = await uiWait(player, form);
        if (response && !response.canceled) {
            const [amountStr] = response.formValues;
            const amount = Number(amountStr);
            const config = getConfig();
            if (isNaN(amount) || amount < config.bounties.minimumBounty) {
                player.sendMessage(`§cInvalid amount. The minimum bounty is $${config.bounties.minimumBounty}.`);
                return true;
            }
            if (getBalance(player.id) < amount) {
                player.sendMessage('§cYou do not have enough money for this bounty.');
                return true;
            }

            incrementPlayerBalance(player.id, -amount);
            incrementBounty(targetPlayerId, amount);
            player.sendMessage(`§2You have placed a bounty of §6$${amount}§2 on ${targetPlayerName}.`);
            world.sendMessage(`§cSomeone has placed a bounty of §6$${amount}§c on ${targetPlayerName}!`);
        }
        return true;
    },

    reportPlayer: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const form = new ModalFormData().title(`Report ${targetPlayerName}`).textField('Reason for report:', 'Enter the reason here');
        const response = await uiWait(player, form);
        if (response.canceled) {
            player.sendMessage('§cReport canceled.');
            return true;
        }
        const [reason] = response.formValues;
        if (!reason || reason.trim().length === 0) {
            player.sendMessage('§cYou must provide a reason.');
            return true;
        }
        createReport(player, targetPlayerId, targetPlayerName, reason);
        player.sendMessage('§2Report submitted. Thank you for your help.');
        return true;
    },

    removePlayerBounty: async (player, context) => {
        const { targetPlayerId, targetPlayerName } = context;
        const targetBounty = getBounty(targetPlayerId);

        if (!targetBounty) {
            player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
            return true;
        }

        const form = new ModalFormData()
            .title(`Remove Bounty from ${targetPlayerName}`)
            .textField(`Bounty Amount: $${targetBounty.amount.toFixed(2)}\nEnter amount to remove:`, 'Enter amount');

        const response = await uiWait(player, form);

        if (response && !response.canceled) {
            const [amountStr] = response.formValues;
            const amount = Number(amountStr);

            if (isNaN(amount) || amount <= 0) {
                player.sendMessage('§cInvalid amount. Please enter a positive number.');
                return true;
            }

            if (amount > targetBounty.amount) {
                player.sendMessage(`§cYou cannot remove more than the bounty amount ($${targetBounty.amount.toFixed(2)}).`);
                return true;
            }

            if (getBalance(player.id) < amount) {
                player.sendMessage('§cYou dont have enough money for this!');
                return true;
            }

            incrementPlayerBalance(player.id, -amount);
            incrementBounty(targetPlayerId, -amount);
            player.sendMessage(`§2You have removed $${amount.toFixed(2)} from ${targetPlayerName}'s bounty.`);
            world.sendMessage(`§2${player.name} has removed $${amount.toFixed(2)} from ${targetPlayerName}'s bounty!`);
        }

        return true;
    }
};

const placeholders = new Map();

function getPlaceholderKeys() {
    return Array.from(placeholders.keys());
}

function registerPlaceholder(key, resolver) {
    if (placeholders.has(key)) {
        debugLog(`[PlaceholderManager] Placeholder with key "${key}" is already registered. Overwriting.`);
    }
    placeholders.set(key, resolver);
}

function resolvePlaceholders(text) {
    // Regex to find all placeholders in the format {key} or {key_index}
    const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;
    return text.replace(placeholderRegex, (match, key) => {
        let resolver;
        let baseKey = '';

        // Find the longest matching registered placeholder key that is a prefix
        for (const registeredKey of placeholders.keys()) {
            if (key.startsWith(registeredKey) && registeredKey.length > baseKey.length) {
                baseKey = registeredKey;
            }
        }

        if (baseKey) {
            resolver = placeholders.get(baseKey);
        }

        if (resolver) {
            const remainingKey = key.substring(baseKey.length); // e.g., "_1", "_value_1", or ""
            const parts = remainingKey.split('_').filter(p => p); // e.g., ["1"], ["value", "1"]

            let index = 0;
            let valueKey = 'name'; // Default value

            if (parts.length > 0) {
                const lastPart = parts[parts.length - 1];
                const potentialIndex = parseInt(lastPart, 10);

                if (!isNaN(potentialIndex)) {
                    index = potentialIndex - 1;
                    if (parts.length > 1) {
                        valueKey = parts.slice(0, -1).join('_');
                    }
                } else {
                    // No index, so all parts are the value key
                    valueKey = parts.join('_');
                }
            }

            const result = resolver({ index, valueKey });
            if (result === undefined || result === null) {return '';}
            return String(result);
        }

        return match; // Return the original placeholder if no resolver is found
    });
}

function initializeDefaultPlaceholders() {
    registerPlaceholder('topbal', ({ index, valueKey }) => {
        const leaderboard = getLeaderboard();

        // Validate leaderboard data and index
        if (!Array.isArray(leaderboard) || index < 0 || index >= leaderboard.length) {
            return '';
        }

        const playerData = leaderboard[index];

        // Validate player data object
        if (!playerData || typeof playerData !== 'object') {
            return '';
        }

        if (valueKey === 'name') {
            return playerData.name ?? ''; // Nullish coalescing for safety
        }
        if (valueKey === 'value') {
            return String(playerData.balance ?? '0'); // Nullish coalescing for safety
        }

        return '';
    });

    // Add more placeholders here in the future
    // e.g., registerPlaceholder('online_players', () => world.getAllPlayers().length);
}

// Initialize default placeholders when the module is loaded
initializeDefaultPlaceholders();

var placeholderManager = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getPlaceholderKeys: getPlaceholderKeys,
    resolvePlaceholders: resolvePlaceholders
});

const floatingTextDataKey = 'exe:floatingTextData';
let floatingTexts = new Map(); // Use a Map for efficient lookups by ID
const activeEntities = new Map(); // Map<textId, entity>
const pendingDespawns = new Map(); // Map<textId, timeoutId>

function loadTexts() {
    try {
        const dataString = world.getDynamicProperty(floatingTextDataKey);
        if (dataString && typeof dataString === 'string') {
            const parsedData = JSON.parse(dataString);
            floatingTexts = new Map(parsedData);
            debugLog(`[FloatingText] Loaded ${floatingTexts.size} floating texts.`);
        } else {
            debugLog('[FloatingText] No floating text data found. Starting fresh.');
        }
    } catch (e) {
        errorLog(`[FloatingText] Failed to load floating text data: ${e.stack}`);
        floatingTexts = new Map();
    }
}

function saveTexts() {
    try {
        const dataToSave = Array.from(floatingTexts.entries());
        world.setDynamicProperty(floatingTextDataKey, JSON.stringify(dataToSave));
    } catch (e) {
        errorLog(`[FloatingText] Failed to save floating text data: ${e.stack}`);
    }
}

function initialize() {
    loadTexts();
    spawnAllTexts();

    system.runInterval(() => {
        updateDynamicTexts();
        // Also check for expired texts
        const now = Date.now();
        for (const [id, textConfig] of floatingTexts.entries()) {
            if (textConfig.expiresAt && now >= textConfig.expiresAt) {
                deleteText(null, id); // No player context for automatic deletion
                debugLog(`[FloatingText] Expired and removed text with ID: ${id}`);
            }
        }
    }, 40);
}

function spawnAllTexts() {
    for (const textConfig of floatingTexts.values()) {
        spawnText(textConfig);
    }
}

function spawnText(textConfig) {
    try {
        const dimension = world.getDimension(textConfig.dimension);
        const entity = dimension.spawnEntity('addonexe:floating_text', textConfig.location);
        entity.nameTag = textConfig.text;
        entity.addTag(`ft_${textConfig.id}`);

        if (textConfig.snapRotation) {
            entity.triggerEvent('enable_snap_rotation');
        }
        if (textConfig.hover) {
            entity.triggerEvent('enable_hover');
        }
        if (textConfig.sway) {
            entity.triggerEvent('enable_sway');
        }
        activeEntities.set(textConfig.id, entity);
    } catch (error) {
        if (error.toString().includes('LocationInUnloadedChunkError')) {
            debugLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id} because the chunk is not loaded. It will be spawned when the chunk is loaded.`);
        } else {
            errorLog(`[FloatingText] Failed to spawn text with ID: ${textConfig.id}`, error);
        }
    }
}


function updateDynamicTexts() {
    for (const textConfig of floatingTexts.values()) {
        if (textConfig.isDynamic) {
            const entity = activeEntities.get(textConfig.id);
            if (entity && entity.isValid()) {
                const newText = getUpdatedText(textConfig);
                if (entity.nameTag !== newText) {
                    entity.nameTag = newText;
                }
            }
        }
    }
}

function getUpdatedText(textConfig) {
    return resolvePlaceholders(textConfig.text);
}

function getAllTexts() {
    return Array.from(floatingTexts.values());
}

function getTextById(id) {
    return floatingTexts.get(id);
}

async function updateText(id, updates) {
    const textConfig = getTextById(id);
    if (!textConfig) { return; }

    // Cancel any pending command-based despawn from a PREVIOUS operation
    if (pendingDespawns.has(id)) {
        system.clearTimeout(pendingDespawns.get(id));
        pendingDespawns.delete(id);
        debugLog(`[FloatingText] Canceled pending despawn for ID: ${id} due to update.`);
    }

    // Despawn the old entity. This might schedule a NEW pending despawn.
    await despawnText(id);

    // Apply updates to the configuration
    Object.assign(textConfig, updates);
    // Ensure expiresAt is explicitly set to null if not provided in the update,
    // preventing an old timer from persisting across edits.
    if (!Object.prototype.hasOwnProperty.call(updates, 'expiresAt')) {
        textConfig.expiresAt = null;
    }
    floatingTexts.set(id, textConfig);
    saveTexts();

    // Spawn a new entity after a delay long enough for the async despawn to complete.
    system.runTimeout(() => {
        spawnText(textConfig);
    }, 20); // 20 ticks > 5+10 ticks used by despawnText fallback
}

function createText(player, id, text) {
    if (floatingTexts.has(id)) {
        player.sendMessage(`§cFloating text with ID "${id}" already exists.`);
        return false;
    }

    const newTextConfig = {
        id,
        text,
        location: {
            x: Math.round(player.location.x * 100) / 100,
            y: Math.round(player.location.y * 100) / 100,
            z: Math.round(player.location.z * 100) / 100
        },
        dimension: player.dimension.id,
        isDynamic: text.includes('{'),
        updateInterval: 100,
        expiresAt: null,
        snapRotation: false,
        hover: false,
        sway: false
    };

    floatingTexts.set(id, newTextConfig);
    saveTexts();
    spawnText(newTextConfig);
    player.sendMessage(`§aSuccessfully created floating text with ID "${id}".`);
    return true;
}

function despawnText(id) {
    return new Promise((resolve) => {
        const entity = activeEntities.get(id);
        if (entity && entity.isValid()) {
            entity.remove();
            activeEntities.delete(id);
            resolve();
            return;
        }

        const textConfig = getTextById(id);
        if (!textConfig || !textConfig.location) {
            errorLog(`[FloatingText] Cannot despawn text with ID: ${id} due to missing config or location.`);
            resolve();
            return;
        }

        if (pendingDespawns.has(id)) {
            resolve();
            return;
        }

        const tickingAreaName = `ft_${id}`;
        const { x, y, z } = textConfig.location;
        const dimension = world.getDimension(textConfig.dimension);

        const timeoutId = system.runTimeout(() => {
            try {
                dimension.runCommand(`tickingarea add ${x} ${y} ${z} ${x} ${y} ${z} ${tickingAreaName}`);
                system.runTimeout(() => {
                    try {
                        const entities = dimension.getEntities({ type: 'addonexe:floating_text', tags: [`ft_${id}`] });
                        for (const entity of entities) {
                            entity.remove();
                        }
                        activeEntities.delete(id);
                    } catch (scriptError) {
                        errorLog(`[FloatingText] Failed during entity.remove() for ID: ${id}`, scriptError);
                    } finally {
                        dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                        pendingDespawns.delete(id);
                        resolve();
                    }
                }, 10);
            } catch (error) {
                errorLog(`[FloatingText] Failed to despawn text with ID: ${id}`, error);
                try {
                    dimension.runCommand(`tickingarea remove ${tickingAreaName}`);
                } catch {
                // Ignore cleanup
                }
                pendingDespawns.delete(id);
                resolve();
            }
        }, 5);

        pendingDespawns.set(id, timeoutId);
    });
}

async function respawnText(id) {
    // Cancel any pending command-based despawn to prevent race conditions
    if (pendingDespawns.has(id)) {
        system.clearTimeout(pendingDespawns.get(id));
        pendingDespawns.delete(id);
        debugLog(`[FloatingText] Canceled pending despawn for ID: ${id} due to respawn.`);
    }

    const textConfig = getTextById(id);
    if (textConfig) {
        // Clear any expiration timer when manually respawning
        if (textConfig.expiresAt) {
            textConfig.expiresAt = null;
            saveTexts();
        }
        await despawnText(id); // Despawn the current entity if it exists
        system.runTimeout(() => {
            spawnText(textConfig); // Spawn the new one after a short delay
        }, 20); // 20 ticks > 5+10 ticks used by despawnText fallback
    }
}

async function deleteText(player, id) {
    if (!floatingTexts.has(id)) {
        if (player) {
            player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        }
        return;
    }

    await despawnText(id);

    floatingTexts.delete(id);
    saveTexts();

    if (player) {
        player.sendMessage(`§aSuccessfully deleted floating text with ID "${id}".`);
    }
}

function listTexts(player) {
    if (floatingTexts.size === 0) {
        player.sendMessage('§eThere are no floating texts.');
        return;
    }

    player.sendMessage('§a--- Floating Texts ---');
    for (const text of floatingTexts.values()) {
        player.sendMessage(`- ID: ${text.id}, Text: "${text.text}"`);
    }
}

function teleportToText(player, id) {
    const textConfig = floatingTexts.get(id);
    if (!textConfig) {
        player.sendMessage(`§cFloating text with ID "${id}" not found.`);
        return;
    }

    player.teleport(textConfig.location, { dimension: world.getDimension(textConfig.dimension) });
    player.sendMessage(`§aTeleported to floating text with ID "${id}".`);
}


// Public API for the manager
const floatingTextManager = {
    initialize,
    createText,
    deleteText,
    listTexts,
    teleportToText,
    getAllTexts,
    getTextById,
    updateText,
    despawnText,
    respawnText
};

var floatingTextManager$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    floatingTextManager: floatingTextManager
});

const itemsPerPage = 8;
const configHandlers = {
    'main': {
        get: getConfig,
        save: (updates) => updateMultipleConfig(updates)
    },
    'spawn': {
        get: getSpawnConfig,
        save: (config) => saveSpawnConfig(config)
    }
};

function getPaginatedItems(items, page) {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

async function handleFormResponse(player, panelId, response, context) {
    const { selection, canceled, formValues } = response;
    const pData = getPlayer(player.id);
    if (!pData) {return;}

    if (panelId === 'floatingTextListPanel') {
        if (selection === 0) { // Back
            return showPanel(player, 'mainPanel', context);
        }
        if (selection === 1) { // Create New
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        const texts = floatingTextManager.getAllTexts();
        const selectedText = texts[selection - 2];
        if (selectedText) {
            return showPanel(player, 'floatingTextActionPanel', { ...context, id: selectedText.id });
        }
        return;
    }

    if (panelId === 'floatingTextActionPanel') {
        const { id } = context;
        switch (selection) {
            case 0: // Edit
                return showPanel(player, 'floatingTextEditPanel', context);
            case 1: // Respawn
                floatingTextManager.respawnText(id);
                player.sendMessage(`§aRespawned floating text: ${id}`);
                return showPanel(player, 'floatingTextListPanel', context);
            case 2: // Despawn
                floatingTextManager.despawnText(id);
                player.sendMessage(`§aDespawned floating text: ${id}`);
                return showPanel(player, 'floatingTextListPanel', context);
            case 3: // Delete
                await floatingTextManager.deleteText(player, id);
                return showPanel(player, 'floatingTextListPanel', context);
            case 4: // Back
                return showPanel(player, 'floatingTextListPanel', context);
        }
        return;
    }

    if (panelId === 'floatingTextEditPanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextActionPanel', context);
        }
        const { id } = context;
        const [textContent, x, y, z, isDynamic, updateInterval, useExpiration, expirationMinutes, snapRotation, hover, sway] = formValues;
        const updatedConfig = {
            text: textContent,
            location: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
            isDynamic: isDynamic,
            updateInterval: updateInterval * 20,
            expiresAt: useExpiration && Number(expirationMinutes) > 0 ? Date.now() + Number(expirationMinutes) * 60000 : null,
            snapRotation,
            hover,
            sway
        };
        floatingTextManager.updateText(id, updatedConfig);
        player.sendMessage(`§aSuccessfully updated floating text: ${id}`);
        return showPanel(player, 'floatingTextActionPanel', context);
    }

    if (panelId === 'floatingTextCreatePanel') {
        if (canceled) {
            return showPanel(player, 'floatingTextListPanel', context);
        }
        const [id, text] = formValues;
        if (!id) {
            player.sendMessage('§cID cannot be empty.');
            return showPanel(player, 'floatingTextCreatePanel', context);
        }
        if (floatingTextManager.createText(player, id, text)) {
            player.sendMessage(`§aSuccessfully created floating text: ${id}`);
        }
        return showPanel(player, 'floatingTextListPanel', context);
    }

    if (panelId === 'rulesManagementPanel') {
        const page = context.page || 1;
        const rules = getRules();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }
        // "Add Rule" button
        if (selection === 1) {
            return showPanel(player, 'addRulePanel', context);
        }

        const paginatedRules = getPaginatedItems(rules, page);
        const selectionIndex = selection - 2;

        // Handle rule selection
        if (selectionIndex < paginatedRules.length) {
            const ruleIndex = ((page - 1) * itemsPerPage) + selectionIndex;
            return showPanel(player, 'ruleActionPanel', { ...context, ruleIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedRules.length;
        const totalPages = Math.ceil(rules.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (rules.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {buttonIndex--;}

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) {buttonIndex--;}
        }
        return;
    }

    if (panelId === 'addRulePanel') {
        if (canceled) {
            return showPanel(player, 'rulesManagementPanel', context);
        }
        const [newRuleText] = formValues;
        if (newRuleText) {
            addRule(newRuleText);
            player.sendMessage('§2Rule added successfully.');
        }
        return showPanel(player, 'rulesManagementPanel', context);
    }

    if (panelId === 'helpfulLinksManagementPanel') {
        const page = context.page || 1;
        const links = getHelpfulLinks();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }
        // Add Link button
        if (selection === 1) {
            return showPanel(player, 'addHelpfulLinkPanel', context);
        }

        const paginatedLinks = getPaginatedItems(links, page);
        const selectionIndex = selection - 2;

        // Handle link selection
        if (selectionIndex < paginatedLinks.length) {
            const linkIndex = ((page - 1) * itemsPerPage) + selectionIndex;
            return showPanel(player, 'helpfulLinkActionPanel', { ...context, linkIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedLinks.length;
        const totalPages = Math.ceil(links.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (links.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) {buttonIndex--;}

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) {buttonIndex--;}
        }
        return;
    }

    if (panelId === 'addHelpfulLinkPanel') {
        if (canceled) {
            return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        const [title, url] = formValues;
        if (title && url) {
            addHelpfulLink(title, url);
            player.sendMessage('§2Link added successfully.');
        }
        return showPanel(player, 'helpfulLinksManagementPanel', context);
    }

    if (panelId === 'helpfulLinkActionPanel') {
        const { linkIndex } = context;
        switch (selection) {
            case 0: { // Edit
                const links = getHelpfulLinks();
                const currentLink = links[linkIndex];
                const editForm = new ModalFormData()
                    .title('Edit Link')
                    .textField('Link Title', 'Enter the new title', { defaultValue: currentLink.title })
                    .textField('Link URL', 'Enter the new URL', { defaultValue: currentLink.url });
                const editResponse = await uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'helpfulLinkActionPanel', context);
                }
                const [newTitle, newUrl] = editResponse.formValues;
                if (newTitle && newUrl) {
                    editHelpfulLink(linkIndex, newTitle, newUrl);
                    player.sendMessage('§2Link updated successfully.');
                }
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            }
            case 1: // Move Up
                moveHelpfulLink(linkIndex, 'up');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 2: // Move Down
                moveHelpfulLink(linkIndex, 'down');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 3: { // Delete Link
                showConfirmationDialog(player, {
                    title: '§cConfirm Deletion',
                    body: 'Are you sure you want to delete this link?',
                    confirmButtonText: '§cYes, Delete',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: () => {
                        deleteHelpfulLink(linkIndex);
                        player.sendMessage('§2Link deleted successfully.');
                        showPanel(player, 'helpfulLinksManagementPanel', context);
                    },
                    onCancel: () => {
                        showPanel(player, 'helpfulLinksManagementPanel', context);
                    }
                });
                return;
            }
            case 4: // Back
                return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        return;
    }

    if (panelId === 'ruleActionPanel') {
        const { ruleIndex } = context;

        switch (selection) {
            case 0: { // Edit Text
                const rules = getRules();
                const currentText = rules[ruleIndex];
                const editForm = new ModalFormData()
                    .title('Edit Rule Text')
                    .textField('Rule text', 'Enter the new text', { defaultValue: currentText });

                const editResponse = await uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'ruleActionPanel', context);
                }

                const [newText] = editResponse.formValues;
                if (newText) {
                    editRule(ruleIndex, newText);
                    player.sendMessage('§2Rule updated successfully.');
                }
                return showPanel(player, 'rulesManagementPanel', context);
            }
            case 1: // Move Up
                moveRule(ruleIndex, 'up');
                return showPanel(player, 'rulesManagementPanel', context);
            case 2: // Move Down
                moveRule(ruleIndex, 'down');
                return showPanel(player, 'rulesManagementPanel', context);
            case 3: { // Delete Rule
                showConfirmationDialog(player, {
                    title: '§cConfirm Deletion',
                    body: 'Are you sure you want to delete this rule?',
                    confirmButtonText: '§cYes, Delete',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: () => {
                        deleteRule(ruleIndex);
                        player.sendMessage('§2Rule deleted successfully.');
                        showPanel(player, 'rulesManagementPanel', context);
                    },
                    onCancel: () => {
                        showPanel(player, 'rulesManagementPanel', context);
                    }
                });
                return;
            }
            case 4: // Back
                return showPanel(player, 'rulesManagementPanel', context);
        }
        return;
    }

    // --- Shop Panel Handlers ---
    if (panelId === 'shopMainPanel') {
        if (selection === 0) { return showPanel(player, 'mainPanel'); }
        const shopConfig = getShopConfig();
        const validCategories = Object.keys(shopConfig.categories).filter(categoryName => {
            const category = shopConfig.categories[categoryName];
            const hasItems = Object.keys(category.items).length > 0;
            const hasSubCategories = Object.keys(category.subCategories).length > 0;
            return hasItems || hasSubCategories;
        }).sort();
        const selectedCategoryName = validCategories[selection - 1];
        if (selectedCategoryName) {
            return showPanel(player, `shopCategoryPanel_${selectedCategoryName}`, { ...context, categoryName: selectedCategoryName });
        }
        return;
    }

    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const resettableSystems = [
            ...configPanelSchema.filter(c => c.id !== 'general').map(c => ({ id: c.id, title: c.title, icon: c.icon })),
            { id: 'kits', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' },
            { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
            { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
        ];
        resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        const sortedSystems = resettableSystems;

        if (selection === 0) { // Back button
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            showConfirmationDialog(player, {
                title: `Confirm Reset: ${selectedSystem.title}`,
                body: `This action cannot be undone. Are you sure you want to reset the ${selectedSystem.title} configuration to its default values?`,
                confirmButtonText: '§cYes, Reset',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    const finalConfirmForm = new ModalFormData()
                        .title('Final Confirmation')
                        .textField(`Type "confirm" to reset ${selectedSystem.title}.`, 'Case-insensitive');

                    const finalConfirmResponse = await uiWait(player, finalConfirmForm);

                    if (finalConfirmResponse.canceled || finalConfirmResponse.formValues[0].trim().toLowerCase() !== 'confirm') {
                        player.sendMessage('§cFinal confirmation failed. Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }

                    const result = await resetConfigSection(selectedSystem.id, player);
                    if (result.success) {
                        player.sendMessage(`§2${result.message}`);
                    } else {
                        player.sendMessage('§cFailed to reset the configuration. Please check the console for details.');
                        errorLog(`[UIManager] Failed to reset config section '${selectedSystem.id}': ${result.message}`);
                    }
                    return showPanel(player, 'configResetPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    player.sendMessage('§2Reset canceled.');
                    return showPanel(player, 'configResetPanel', { ...context, page });
                }
            });
            return;
        }

        let buttonIndex = selectionIndex - paginatedSystems.length;

        const totalPages = Math.ceil(resettableSystems.length / itemsPerPage);

        if (page >= totalPages) {
            if (buttonIndex === 0) {
                showConfirmationDialog(player, {
                    title: 'Confirm Reset All',
                    body: 'This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?',
                    confirmButtonText: '§cYes, Reset All',
                    cancelButtonText: '§2No, Cancel',
                    onConfirm: async () => {
                        const finalConfirmForm = new ModalFormData()
                            .title('Final Confirmation')
                            .textField('Type "confirm" to reset ALL systems.', 'Case-insensitive');

                        const finalConfirmResponse = await uiWait(player, finalConfirmForm);

                        if (finalConfirmResponse.canceled || finalConfirmResponse.formValues[0].trim().toLowerCase() !== 'confirm') {
                            player.sendMessage('§cFinal confirmation failed. Reset canceled.');
                            return showPanel(player, 'configResetPanel', { ...context, page });
                        }

                        const result = await resetConfigSection('all', player);
                        if (result.success) {
                            player.sendMessage(`§2${result.message}`);
                        } else {
                            player.sendMessage('§cFailed to reset all configurations. Please check the console for details.');
                            errorLog(`[UIManager] Failed to reset all config sections: ${result.message}`);
                        }
                        return showPanel(player, 'configResetPanel', { ...context, page: 1 });
                    },
                    onCancel: () => {
                        player.sendMessage('§2Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }
                });
                return;
            }
            buttonIndex--;
        }

        // Handle pagination
        const hasPrev = page > 1;

        if (hasPrev && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }
        if (buttonIndex >= 0) { // Should be next page
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }

        return;
    }

    if (panelId.startsWith('shopCategoryPanel_') || panelId.startsWith('shopItemListPanel_')) {
        const isItemList = panelId.startsWith('shopItemListPanel_');
        const prefix = isItemList ? 'shopItemListPanel_' : 'shopCategoryPanel_';
        const rawId = panelId.replace(prefix, '');
        const parts = rawId.split('_');
        const categoryName = parts[0];
        const subCategoryName = isItemList ? parts.slice(1).join('_') : undefined;
        const page = context.page || 1;
        const view = context.view || 'shop';

        if (selection === 0) { // Back button
            const parentPanel = isItemList ? `shopCategoryPanel_${categoryName}` : 'shopMainPanel';
            return showPanel(player, parentPanel, { ...context, page: 1 });
        }

        // Reconstruct the list of entries that was shown to the player
        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        let allEntries = [];
        if (isItemList) {
            const subCategory = category.subCategories[subCategoryName];
            allEntries = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
        } else { // shopCategoryPanel
            const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));
            const items = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));
            allEntries = [...subCategories, ...items];
        }

        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectionIndex = selection - 1;

        // Handle pagination
        if (selectionIndex >= paginatedEntries.length) {
            let newPage = page;
            const totalPages = Math.ceil(allEntries.length / itemsPerPage);
            const hasPrev = page > 1;
            const hasNext = page < totalPages;
            let buttonIndex = selectionIndex - paginatedEntries.length;

            if (hasPrev && buttonIndex === 0) {
                newPage--;
            } else if (hasNext) {
                newPage++;
            }
            return showPanel(player, panelId, { ...context, page: newPage });
        }

        const selectedEntry = paginatedEntries[selectionIndex];

        if (selectedEntry.type === 'subCategory') {
            return showPanel(player, `shopItemListPanel_${categoryName}_${selectedEntry.name}`, { ...context, categoryName, subCategoryName: selectedEntry.name, page: 1 });
        }

        // It's an item
        const itemId = selectedEntry.id;
        const masterItem = items[itemId];
        const shopItem = selectedEntry;

        const canBuy = view !== 'sell' && shopItem.buyPrice > 0;
        const canSell = view !== 'buy' && shopItem.sellPrice > 0;

        if (!canBuy && !canSell) {
            player.sendMessage('§cThis item cannot be bought or sold currently.');
            return showPanel(player, panelId, context);
        }

        const modal = new ModalFormData().title(masterItem.displayName ?? itemId);
        let action;
        let hasDropdown = false;

        if (canBuy && canSell) {
            modal.textField('Amount', 'Enter the amount', { defaultValue: '1' });
            const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
            modal.dropdown('Action', options, { defaultValueIndex: 0 });
            hasDropdown = true;
        } else if (canBuy) {
            modal.textField(`Amount to Buy (Price: $${shopItem.buyPrice})`, 'Enter a numeric value', { defaultValue: '1' });
            action = 'buy';
        } else { // canSell
            modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', { defaultValue: '1' });
            action = 'sell';
        }

        const modalResponse = await uiWait(player, modal);

        if (modalResponse.canceled) {
            return showPanel(player, panelId, context);
        }

        let amount;
        if (hasDropdown) {
            const [amountStr, actionIndex] = modalResponse.formValues;
            amount = parseInt(amountStr, 10);
            const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
            const selectedActionString = options[actionIndex];
            action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
        } else {
            const [amountStr] = modalResponse.formValues;
            amount = parseInt(amountStr, 10);
        }

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount.');
            return showPanel(player, panelId, context);
        }

        let result;
        if (action === 'buy') {
            result = buyItem(player, itemId, amount);
        } else { // action === 'sell'
            result = sellItem(player, itemId, amount);
        }
        player.sendMessage(result.message);

        return showPanel(player, panelId, context); // Refresh the panel
    }

    // --- Admin Edit Shop Panel Handlers ---
    if (panelId.startsWith('shopAddItemPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) { return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context); }

        if (selection === 1) { // Add Custom Item
            const form = new ModalFormData().title('Add Custom Item')
                .textField('Item ID (unique key)', 'e.g., custom_sword')
                .textField('Display Name', 'e.g., Sword of Awesome')
                .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [customId, displayName, mcId, icon, buyPriceStr, sellPriceStr, permLevelStr] = response.formValues;
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);

            if (customId && displayName && mcId && icon && !isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                addCustomItemToConfig(customId, { itemId: mcId, icon, buyPrice, sellPrice, displayName });
                setItem(categoryName, null, customId, { buyPrice, sellPrice, permissionLevel, icon, displayName });
                player.sendMessage(`§2Successfully added custom item '${displayName}'.`);
            } else {
                player.sendMessage('§cInvalid custom item data.');
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        const allPossibleItems = Object.keys(items);
        const paginatedItems = getPaginatedItems(allPossibleItems, page);
        const selectedItemId = paginatedItems[selection - 2];

        if (selectedItemId) {
            const masterItem = items[selectedItemId];
            const form = new ModalFormData().title(`Add ${masterItem.displayName}`)
                .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: masterItem.icon })
                .textField('Buy Price', '-1 to disable', { defaultValue: `${masterItem.buyPrice}` })
                .textField('Sell Price', '-1 to disable', { defaultValue: `${masterItem.sellPrice}` })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [icon, buyPriceStr, sellPriceStr, permLevelStr] = response.formValues;
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);
            if (!isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                const result = setItem(categoryName, null, selectedItemId, { buyPrice, sellPrice, permissionLevel, icon });
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allPossibleItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 2 - paginatedItems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId === 'shopManagementPanel') {
        const page = context.page || 1;
        if (selection === 0) { return showPanel(player, 'configCategoryPanel'); }

        if (selection === 1) {
            const mainConfig = getConfig();
            const newStatus = !mainConfig.shop.enabled;
            updateMultipleConfig({ 'shop.enabled': newStatus });
            player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (selection === 2) { // Add Category
            const form = new ModalFormData().title('Add Category').textField('Category Name', 'Enter category name').textField('Icon', 'Enter icon texture path');
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [name, icon] = response.formValues;
            if (name) {
                const result = addCategory(name, icon);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const shopConfig = getShopConfig();
        const categories = Object.keys(shopConfig.categories).sort();
        const paginatedCategories = getPaginatedItems(categories, page);
        const selectedCategoryName = paginatedCategories[selection - 3];

        if (selectedCategoryName) {
            return showPanel(player, `shopAdminCategoryPanel_${selectedCategoryName}`, { categoryName: selectedCategoryName });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(categories.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 3 - paginatedCategories.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) { return showPanel(player, 'shopManagementPanel'); }
        if (selection === 1) { // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
        }
        if (selection === 2) { // Add Subcategory
            const form = new ModalFormData().title('Add Subcategory').textField('Subcategory Name', 'Enter subcategory name').textField('Icon', 'Enter icon texture path');
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [name, icon] = response.formValues;
            if (name) {
                const result = addSubCategory(categoryName, name, icon);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        if (selection === 3) { // Edit Category
            return showPanel(player, `shopAdminCategoryActionPanel_${categoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));
        const items$1 = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));
        const allEntries = [...subCategories, ...items$1];
        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectedEntry = paginatedEntries[selection - 4];

        if (selectedEntry) {
            if (selectedEntry.type === 'item') {
                const form = new ActionFormData().title('Edit Item')
                    .button('Edit', 'textures/ui/icon_setting')
                    .button('Delete', 'textures/ui/trash');
                const response = await uiWait(player, form);
                if (response.canceled) { return showPanel(player, panelId, context); }
                if (response.selection === 0) { // Edit
                    const masterItem = items[selectedEntry.id] || {};
                    const editForm = new ModalFormData().title(`Edit Item: ${selectedEntry.id}`)
                        .textField('Display Name', 'e.g., Magical Sword', { defaultValue: selectedEntry.displayName || masterItem.displayName })
                        .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', { defaultValue: masterItem.itemId })
                        .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: selectedEntry.icon || masterItem.icon })
                        .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedEntry.buyPrice) })
                        .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedEntry.sellPrice) })
                        .textField('Permission Level', 'e.g., 1024', { defaultValue: String(selectedEntry.permissionLevel) });

                    const editResponse = await uiWait(player, editForm);
                    if (editResponse.canceled) { return showPanel(player, panelId, context); }

                    const [displayName, minecraftId, icon, buyPriceStr, sellPriceStr, permLevelStr] = editResponse.formValues;
                    const buyPrice = Number(buyPriceStr);
                    const sellPrice = Number(sellPriceStr);
                    const permissionLevel = Number(permLevelStr);

                    if (displayName && minecraftId && icon && !isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                        const result = updateShopItem(categoryName, null, selectedEntry.id, {
                            buyPrice, sellPrice, permissionLevel, icon, minecraftId, displayName
                        });
                        player.sendMessage(result.message);
                    } else {
                        player.sendMessage('§cInvalid data. Please check all fields.');
                    }
                } else { // Delete
                    const result = removeItem(categoryName, null, selectedEntry.id);
                    player.sendMessage(result.message);
                }
            } else { // subCategory
                return showPanel(player, `shopAdminSubCategoryItemPanel_${selectedEntry.name}`, { ...context, subCategoryName: selectedEntry.name });
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allEntries.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 4 - paginatedEntries.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
        const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');

        if (selection === 0) { // Edit
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            const form = new ModalFormData().title('Edit Category')
                .textField('Category Name', 'Enter new name', { defaultValue: categoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context); }
            const [newName, newIcon] = response.formValues;
            if (newName) {
                const result = editCategory(categoryName, newName, newIcon);
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }
        if (selection === 1) { // Delete
            showConfirmationDialog(player, {
                title: 'Confirm Deletion',
                body: 'Are you sure?',
                confirmButtonText: '§cYes, Delete',
                cancelButtonText: '§2No, Cancel',
                onConfirm: () => {
                    const result = deleteCategory(categoryName);
                    player.sendMessage(result.message);
                    return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
                }
            });
            return;
        }
        if (selection === 2) { // Back
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }
    }

    if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
        const { categoryName, subCategoryName, page = 1 } = context;
        if (selection === 0) { return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context); }
        if (selection === 1) { // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, { ...context, subCategoryName });
        }
        if (selection === 2) { // Edit Subcategory
            return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
        const items$1 = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
        const paginatedItems = getPaginatedItems(items$1, page);
        const selectedItem = paginatedItems[selection - 3];

        if (selectedItem) {
            const form = new ActionFormData().title('Edit Item')
                .button('Edit', 'textures/ui/icon_setting')
                .button('Delete', 'textures/ui/trash');
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            if (response.selection === 0) { // Edit
                const masterItem = items[selectedItem.id] || {};
                const editForm = new ModalFormData().title(`Edit Item: ${selectedItem.id}`)
                    .textField('Display Name', 'e.g., Magical Sword', { defaultValue: selectedItem.displayName || masterItem.displayName })
                    .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', { defaultValue: masterItem.itemId })
                    .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: selectedItem.icon || masterItem.icon })
                    .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedItem.buyPrice) })
                    .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedItem.sellPrice) })
                    .textField('Permission Level', 'e.g., 1024', { defaultValue: String(selectedItem.permissionLevel) });

                const editResponse = await uiWait(player, editForm);
                if (editResponse.canceled) { return showPanel(player, panelId, context); }

                const [displayName, minecraftId, icon, buyPriceStr, sellPriceStr, permLevelStr] = editResponse.formValues;
                const buyPrice = Number(buyPriceStr);
                const sellPrice = Number(sellPriceStr);
                const permissionLevel = Number(permLevelStr);

                if (displayName && minecraftId && icon && !isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                    const result = updateShopItem(categoryName, subCategoryName, selectedItem.id, {
                        buyPrice, sellPrice, permissionLevel, icon, minecraftId, displayName
                    });
                    player.sendMessage(result.message);
                } else {
                    player.sendMessage('§cInvalid data. Please check all fields.');
                }
            } else { // Delete
                const result = removeItem(categoryName, subCategoryName, selectedItem.id);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(items$1.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 3 - paginatedItems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
        const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        const { categoryName } = context;
        if (selection === 0) { // Edit
            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
            const form = new ModalFormData().title('Edit Subcategory')
                .textField('Subcategory Name', 'Enter new name', { defaultValue: subCategoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
            const response = await uiWait(player, form);
            if (response.canceled) { return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context); }
            const [newName, newIcon] = response.formValues;
            if (newName) {
                const result = editSubCategory(categoryName, subCategoryName, newName, newIcon);
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        if (selection === 1) { // Delete
            showConfirmationDialog(player, {
                title: 'Confirm Deletion',
                body: 'Are you sure?',
                confirmButtonText: '§cYes, Delete',
                cancelButtonText: '§2No, Cancel',
                onConfirm: () => {
                    const result = deleteSubCategory(categoryName, subCategoryName);
                    player.sendMessage(result.message);
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
                },
                onCancel: () => {
                    return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
                }
            });
            return;
        }
        if (selection === 2) { // Back
            return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context);
        }
    }

    if (panelId === 'kitManagementPanel') {
        const mainConfig = getConfig();
        const page = context.page || 1;

        // Handle Back button
        if (selection === 0) { return showPanel(player, 'configCategoryPanel'); }

        // Handle global toggle button
        if (selection === 1) {
            const newStatus = !mainConfig.kits.enabled;
            updateMultipleConfig({ 'kits.enabled': newStatus });
            player.sendMessage(`§2Kit system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'kitManagementPanel', { ...context, page: 1 }); // Reload
        }

        // Handle Create New Kit button
        if (selection === 2) {
            const form = new ModalFormData()
                .title('Create New Kit')
                .textField('Kit Name', 'Enter a unique name for the kit')
                .textField('Cooldown (seconds)', 'e.g., 3600', { defaultValue: '3600' })
                .textField('Permission Level', '0=Admin, 1024=Member', { defaultValue: '1024' })
                .textField('Price', 'Cost to claim', { defaultValue: '0' });

            const createResponse = await uiWait(player, form);
            if (createResponse.canceled) {
                return showPanel(player, 'kitManagementPanel', context);
            }

            const [kitName, cooldownStr, permissionLevelStr, priceStr] = createResponse.formValues;
            const cooldown = Number(cooldownStr);
            const permissionLevel = Number(permissionLevelStr);
            const price = Number(priceStr);

            if (!kitName || isNaN(cooldown) || isNaN(permissionLevel) || isNaN(price)) {
                player.sendMessage('§cInvalid input. Please check your values.');
                return showPanel(player, 'kitManagementPanel', context);
            }

            const result = createKit(kitName, { cooldown, permissionLevel, price });
            player.sendMessage(result.message);

            if (result.success) {
                return showPanel(player, `kitActionMenu_${kitName}`, context);
            } else {
                return showPanel(player, 'kitManagementPanel', context);
            }
        }

        const allKits = getAllKits();
        const kitNames = Object.keys(allKits);
        const paginatedKits = getPaginatedItems(kitNames, page);
        const totalPages = Math.ceil(kitNames.length / itemsPerPage);

        const kitStartIndex = 3; // Adjusted for the new buttons
        const kitEndIndex = kitStartIndex + paginatedKits.length - 1;

        if (selection >= kitStartIndex && selection <= kitEndIndex) {
            const selectedKitName = paginatedKits[selection - kitStartIndex];
            return showPanel(player, `kitActionMenu_${selectedKitName}`, {});
        }

        // After kit items, check for pagination buttons
        let currentButtonIndex = kitEndIndex + 1;

        if (page > 1) { // Previous Page button exists
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            currentButtonIndex++;
        }
        if (page < totalPages) { // Next Page button exists
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }

        return; // Should not be reached
    }




    if (panelId.startsWith('kitSettingsPanel_')) {
        const kitName = panelId.replace('kitSettingsPanel_', ''); // This is the original (lowercase) name
        if (canceled) {
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }

        const [isEnabled, newKitName, description, icon, cooldownStr, permissionLevelStr, priceStr] = formValues;

        let finalKitName = kitName;
        // Check if the name has changed (case-insensitive)
        if (newKitName.toLowerCase() !== kitName) {
            const renameResult = renameKit(kitName, newKitName);
            if (!renameResult.success) {
                player.sendMessage(`§c${renameResult.message}`);
                // Re-show the panel with the original name
                return showPanel(player, `kitSettingsPanel_${kitName}`, context);
            }
            player.sendMessage(`§2Kit '${kitName}' has been renamed to '${newKitName}'.`);
            finalKitName = newKitName.toLowerCase();
        }

        const newSettings = {
            enabled: isEnabled,
            description: description,
            icon: icon,
            cooldownSeconds: Number(cooldownStr),
            permissionLevel: Number(permissionLevelStr),
            price: Number(priceStr)
        };

        updateKitSettings(finalKitName, newSettings);

        player.sendMessage(`§2Successfully updated settings for kit '${finalKitName}'.`);
        return showPanel(player, `kitActionMenu_${finalKitName}`, context);
    }

    if (panelId.startsWith('kitActionMenu_')) {
        const kitName = panelId.replace('kitActionMenu_', '');

        switch (selection) {
            case 0: // Edit Settings
                return showPanel(player, `kitSettingsPanel_${kitName}`, context);
            case 1: // Edit Items
                return showPanel(player, `kitItemsPanel_${kitName}`, context);
            case 2: { // Delete Kit
                showConfirmationDialog(player, {
                    title: `Delete Kit: ${kitName}?`,
                    body: 'This action cannot be undone.',
                    confirmButtonText: '§cYes, delete this kit',
                    cancelButtonText: '§2No, go back',
                    onConfirm: () => {
                        deleteKit(kitName);
                        player.sendMessage(`§2Kit '${kitName}' has been deleted.`);
                        showPanel(player, 'kitManagementPanel', {});
                    },
                    onCancel: () => {
                        showPanel(player, `kitActionMenu_${kitName}`, context);
                    }
                });
                return;
            }
            case 3: // Back
                return showPanel(player, 'kitManagementPanel', {});
        }
        return;
    }

    if (panelId.startsWith('kitItemsPanel_')) {
        const kitName = panelId.replace('kitItemsPanel_', '');
        const allKits = getAllKits();
        const kit = allKits[kitName];
        const page = context.page || 1;

        if (selection === 0) { // Add New Item
            const form = new ModalFormData()
                .title('Add New Item')
                .textField('Item ID', 'e.g., minecraft:diamond')
                .textField('Amount', 'e.g., 16');

            const addResponse = await uiWait(player, form);
            if (addResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            const [typeId, amountStr] = addResponse.formValues;
            const amount = Number(amountStr);

            if (!typeId || isNaN(amount) || amount <= 0) {
                player.sendMessage('§cInvalid item ID or amount.');
                return showPanel(player, panelId, context);
            }

            const result = addItemToKit(kitName, { typeId, amount });
            player.sendMessage(result.message);
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const paginatedItems = getPaginatedItems(kit.items, page);
        const itemStartIndex = 1;
        const itemEndIndex = itemStartIndex + paginatedItems.length - 1;

        if (selection >= itemStartIndex && selection <= itemEndIndex) {
            const selectedItemIndexInPage = selection - itemStartIndex;
            const selectedItemIndex = ((page - 1) * itemsPerPage) + selectedItemIndexInPage;
            const selectedItem = kit.items[selectedItemIndex];

            const form = new ModalFormData()
                .title('Edit Item')
                .textField('Item ID', 'e.g., minecraft:diamond', { defaultValue: selectedItem.typeId })
                .textField('Amount', 'Set to 0 to delete.', { defaultValue: String(selectedItem.amount) });

            const editResponse = await uiWait(player, form);
            if (editResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            const [typeId, amountStr] = editResponse.formValues;
            const amount = Number(amountStr);

            if (!typeId || isNaN(amount)) {
                player.sendMessage('§cInvalid item ID or amount.');
                return showPanel(player, panelId, context);
            }

            const result = updateItemInKit(kitName, selectedItemIndex, { typeId, amount });
            player.sendMessage(result.message);
            return showPanel(player, panelId, { ...context, page: 1 }); // Go back to first page
        }

        // Handle pagination and back button
        let buttonIndex = itemEndIndex + 1;
        const totalPages = Math.ceil(kit.items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev) {
            if (selection === buttonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            buttonIndex++;
        }
        if (hasNext) {
            if (selection === buttonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            buttonIndex++;
        }
        if (selection === buttonIndex) { // Back button
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }
        return;
    }

    if (panelId.startsWith('kitDetailPanel_')) {
        const kitName = panelId.replace('kitDetailPanel_', '');
        if (canceled) {
            return showPanel(player, 'kitManagementPanel', context);
        }

        // The last form value is the decorative item display, which we ignore.
        const [isEnabled, cooldownStr, permissionLevelStr] = formValues;
        const cooldown = Number(cooldownStr);
        const permissionLevel = Number(permissionLevelStr);

        if (isNaN(cooldown) || cooldown < 0) {
            player.sendMessage('§cInvalid cooldown. Please enter a non-negative number.');
            return showPanel(player, panelId, context); // Re-show the detail panel
        }
        if (isNaN(permissionLevel) || permissionLevel < 0) {
            player.sendMessage('§cInvalid permission level. Please enter a non-negative number.');
            return showPanel(player, panelId, context);
        }


        const kitsConfig = getKitsConfig();
        if (kitsConfig.kitDefinitions[kitName]) {
            kitsConfig.kitDefinitions[kitName].enabled = isEnabled;
            kitsConfig.kitDefinitions[kitName].cooldownSeconds = cooldown;
            kitsConfig.kitDefinitions[kitName].permissionLevel = permissionLevel;
            saveKitsConfig();
            player.sendMessage(`§2Successfully updated kit '${kitName}'.`);
        }

        return showPanel(player, 'kitManagementPanel', context); // Go back to the list
    }

    if (panelId === 'bountyListPanel' || panelId === 'reportListPanel' || panelId === 'playerManagementPanel' || panelId === 'playerListPanel') {
        const page = context.page || 1;

        if (selection === 0) { return showPanel(player, 'mainPanel'); }

        let allItems = [];
        if (panelId === 'bountyListPanel') {
            allItems = Array.from(getAllBounties().values()).sort((a, b) => b.amount - a.amount);
        } else if (panelId === 'reportListPanel') {
            allItems = getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
        } else if (panelId === 'playerManagementPanel') {
            allItems = Array.from(getAllPlayerNameIdMap().entries()).sort((a, b) => a[0].localeCompare(b[0]));
        } else if (panelId === 'playerListPanel') {
            allItems = getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
        }

        const paginatedItems = getPaginatedItems(allItems, page);
        const totalPages = Math.ceil(allItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        const itemStartIndex = hasPrev ? 2 : 1;
        const itemEndIndex = itemStartIndex + paginatedItems.length - 1;

        // Handle Previous button click
        if (hasPrev && selection === 1) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }

        // Handle Item click
        if (selection >= itemStartIndex && selection <= itemEndIndex) {
            const selectedItemIndex = selection - itemStartIndex;
            const selectedItem = paginatedItems[selectedItemIndex];

            if (panelId === 'bountyListPanel') {
                return showPanel(player, panelId, context); // No action yet
            }
            if (panelId === 'reportListPanel') {
                return showPanel(player, 'reportActionsPanel', { ...context, targetReport: selectedItem });
            }
            if (panelId === 'playerManagementPanel') {
                const [selectedName, selectedId] = selectedItem;
                const targetData = loadPlayerData(selectedId);
                const contextName = targetData ? targetData.name : selectedName;
                return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: contextName, targetPlayerId: selectedId, fromPanel: panelId, targetData });
            }
            if (panelId === 'playerListPanel') {
                const targetData = getPlayer(selectedItem.id);
                return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: selectedItem.name, targetPlayerId: selectedItem.id, fromPanel: panelId, targetData });
            }
        }

        // Handle Next button click
        const nextButtonIndex = itemEndIndex + 1;
        if (hasNext && selection === nextButtonIndex) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return showPanel(player, panelId, context); // Fallback
    }

    if (panelId.startsWith('rankActionMenu_')) {
        const rankId = panelId.replace('rankActionMenu_', '');
        const rank = getRankById$1(rankId);

        switch (selection) {
            case 0: // Edit Rank
                return showPanel(player, 'editRankPanel', { ...context, rankId: rank.id });
            case 1: { // Delete Rank
                showConfirmationDialog(player, {
                    title: `§cDelete ${rank.name}?`,
                    body: 'This action cannot be undone.',
                    confirmButtonText: '§cYes, Delete Rank',
                    cancelButtonText: '§2No, Keep Rank',
                    onConfirm: () => {
                        const result = deleteRank(rank.id);
                        player.sendMessage(result.message);
                        if (result.success) {
                            reloadRanks();
                        }
                        return showPanel(player, 'rankManagementPanel', { ...context, page: 1 });
                    },
                    onCancel: () => {
                        return showPanel(player, `rankActionMenu_${rank.id}`, context);
                    }
                });
                return;
            }
            case 2: // Back
                return showPanel(player, 'rankManagementPanel', context);
        }
        return;
    }

    if (panelId === 'rankManagementPanel') {
        const page = context.page || 1;
        // Back button
        if (selection === 0) { return showPanel(player, 'configCategoryPanel'); }
        // Add New Rank button
        if (selection === 1) {
            return showPanel(player, 'addRankPanel', context);
        }

        const allRanks = getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);
        const paginatedRanks = getPaginatedItems(allRanks, page);
        const totalPages = Math.ceil(allRanks.length / itemsPerPage);

        const rankStartIndex = 2;
        const rankEndIndex = rankStartIndex + paginatedRanks.length - 1;

        if (selection >= rankStartIndex && selection <= rankEndIndex) {
            const selectedRank = paginatedRanks[selection - rankStartIndex];
            const isSpecialRank = selectedRank.conditions.some(c => c.type === 'isOwner' || c.type === 'default');

            if (isSpecialRank) {
                return showPanel(player, 'editRankPanel', { ...context, rankId: selectedRank.id });
            } else {
                return showPanel(player, `rankActionMenu_${selectedRank.id}`, { ...context, rankId: selectedRank.id });
            }
        }

        // Handle pagination
        let currentButtonIndex = rankEndIndex + 1;
        if (page > 1) { // Previous Page
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            currentButtonIndex++;
        }
        if (page < totalPages) { // Next Page
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }
        return;
    }

    if (panelId === 'addRankPanel') {
        if (canceled) { return showPanel(player, 'rankManagementPanel', context); }

        const [name, id, permLevelStr, nameColor, chatColor, prefix] = formValues;
        const permissionLevel = parseInt(permLevelStr, 10);

        if (!name || !id || isNaN(permissionLevel)) {
            player.sendMessage('§cRank Name, ID, and Permission Level are required.');
            return showPanel(player, panelId, context);
        }
        if (permissionLevel === 0) {
            player.sendMessage('§cPermission level 0 is reserved for the Owner rank.');
            return showPanel(player, panelId, context);
        }
        if (getRankById$1(id)) {
            player.sendMessage(`§cRank ID '${id}' already exists.`);
            return showPanel(player, panelId, context);
        }

        const newRank = {
            id,
            name,
            permissionLevel,
            chatFormatting: {
                prefixText: prefix,
                nameColor: nameColor,
                messageColor: chatColor
            },
            nametagPrefix: prefix, // Assuming prefix is used for nametag as well
            conditions: [{ type: 'hasTag', value: id }]
        };

        const result = addRank(newRank);
        player.sendMessage(result.message);

        if (result.success) {
            reloadRanks();
            return showPanel(player, 'rankManagementPanel', { ...context, page: 1 });
        } else {
            return showPanel(player, panelId, context);
        }
    }

    if (panelId === 'editRankPanel') {
        const rank = getRankById$1(context.rankId);
        if (!rank) {
            player.sendMessage('§cRank not found.');
            return showPanel(player, 'rankManagementPanel', context);
        }
        const isSpecialRank = rank.conditions.some(c => c.type === 'isOwner' || c.type === 'default');

        if (canceled) {
            const fromPanel = isSpecialRank ? 'rankManagementPanel' : `rankActionMenu_${rank.id}`;
            return showPanel(player, fromPanel, context);
        }

        const [name, id, permLevelStr, nameColor, chatColor, prefix, nametagPrefix] = formValues;
        const permissionLevel = parseInt(permLevelStr, 10);

        if (!name) {
            player.sendMessage('§cRank Name cannot be empty.');
            return showPanel(player, panelId, context);
        }
        if (isSpecialRank && (id !== rank.id || permissionLevel !== rank.permissionLevel)) {
            player.sendMessage('§cCannot change the ID or Permission Level of a special rank.');
            return showPanel(player, panelId, context);
        }
        if (!isSpecialRank && permissionLevel === 0) {
            player.sendMessage('§cPermission level 0 is reserved for the Owner rank.');
            return showPanel(player, panelId, context);
        }

        const updatedData = {
            name,
            id,
            permissionLevel,
            chatFormatting: {
                prefixText: prefix,
                nameColor: nameColor,
                messageColor: chatColor
            },
            nametagPrefix: nametagPrefix
        };

        const result = updateRank(rank.id, updatedData);
        player.sendMessage(result.message);

        if (result.success) {
            reloadRanks();
            // After editing, the rank ID might have changed. We need to use the new ID.
            const newRankId = isSpecialRank ? rank.id : id;
            const fromPanel = isSpecialRank ? 'rankManagementPanel' : `rankActionMenu_${newRankId}`;
            const newContext = { ...context, rankId: newRankId, page: 1 };
            return showPanel(player, fromPanel, newContext);
        } else {
            return showPanel(player, panelId, context);
        }
    }

    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        if (selection === 0) { return showPanel(player, 'mainPanel'); }

        let allSystems = [
            ...configPanelSchema.map(c => ({ id: `config_${c.id}`, title: c.title, icon: c.icon }))
        ];
        if (pData.permissionLevel <= 1) {
            allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
            allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
            allSystems.push({ id: 'rankManagementPanel', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' });
        }
        if (pData.permissionLevel === 0) {
            allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
        }
        allSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        // Re-apply the same custom sort from the build function
        const generalSystem = allSystems.find(s => s.id === 'config_general');
        const resetSystem = allSystems.find(s => s.id === 'configResetPanel');
        let otherSystems = allSystems.filter(s => s.id !== 'config_general' && s.id !== 'configResetPanel');
        otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));
        const sortedSystems = [];
        if (generalSystem) {sortedSystems.push(generalSystem);}
        sortedSystems.push(...otherSystems);
        if (resetSystem) {sortedSystems.push(resetSystem);}

        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            // Reset context to ensure pagination starts from 1 on the new panel
            return showPanel(player, selectedSystem.id, {});
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allSystems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selectionIndex - paginatedSystems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }


    if (panelId.startsWith('config_')) {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find(c => c.id === categoryId);
        if (!category) { return; }

        const configSource = category.configSource || 'main';
        const handler = configHandlers[configSource];
        if (!handler) {
            errorLog(`[UIManager] No config handler found for source: ${configSource}`);
            return;
        }

        const newValues = formValues;
        let validationFailed = false;

        const processAndValidate = (setting, value) => {
            if (setting.type === 'toggle') {
                return !!value;
            }
            if (setting.type === 'dropdown') {
                return setting.options[value];
            }

            const isNumericField = setting.key.includes('Seconds') ||
                                   setting.key.includes('Balance') ||
                                   setting.key.includes('maxHomes') ||
                                   setting.key.includes('Interval') ||
                                   setting.key.includes('Radius') ||
                                   setting.key.endsWith('.x') ||
                                   setting.key.endsWith('.y') ||
                                   setting.key.endsWith('.z');

            if (setting.type === 'textField' && isNumericField) {
                // For coordinate fields, an empty string should be treated as null (not set).
                if (value.trim() === '' && (setting.key.endsWith('.x') || setting.key.endsWith('.y') || setting.key.endsWith('.z'))) {
                    return null;
                }

                const numValue = Number(value);
                if (isNaN(numValue)) {
                    player.sendMessage(`§cInvalid number provided for ${setting.label}. Changes not saved.`);
                    validationFailed = true;
                    return value; // Return original invalid value to prevent further errors
                }
                return numValue;
            }
            return value;
        };

        if (configSource === 'main') {
            const updates = {};
            category.settings.forEach((setting, index) => {
                if (validationFailed) { return; }
                const newValue = processAndValidate(setting, newValues[index]);
                if (!validationFailed) {
                    updates[setting.key] = newValue;
                }
            });
            if (validationFailed) { return showPanel(player, panelId); }
            handler.save(updates);
        } else {
            const configToSave = handler.get();
            category.settings.forEach((setting, index) => {
                if (validationFailed) { return; }
                const newValue = processAndValidate(setting, newValues[index]);
                if (!validationFailed) {
                    setValueByPath(configToSave, setting.key, newValue);
                }
            });
            if (validationFailed) { return showPanel(player, panelId); }
            handler.save(configToSave);

            // If the spawn config was just updated, re-initialize spawn protection
            // to apply the new settings immediately.
            if (configSource === 'spawn') {
                initialize$1();
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }

        player.sendMessage(`§2Successfully saved settings for ${category.title}§2.`);

        // Post-save actions for specific config panels
        if (categoryId === 'dimensionLock') {
            const [netherLock, endLock] = newValues;
            setLockState('nether', !!netherLock);
            setLockState('end', !!endLock);
            player.sendMessage('§aLive dimension lock states have been updated to match config.');
        }
        if (categoryId === 'announcements') {
            restartAnnouncer();
            player.sendMessage('§2Announcement system has been updated with new settings.');
        }

        return showPanel(player, 'configCategoryPanel');
    }

    if (panelId === 'playerActionsPanel') {
        const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel);
        const selectedItem = visibleItems[selection];
        if (!selectedItem) {
            return;
        }

        if (selectedItem.id === '__back__') {
            return showPanel(player, context.fromPanel || 'mainPanel', context);
        }

        if (selectedItem.actionType === 'openPanel') {
            return showPanel(player, selectedItem.actionValue, context);
        }

        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {
                showPanel(player, panelId, context);
            }
        }
        return;
    }

    const panelDef = panelDefinitions[panelId];
    const menuItems = getMenuItems(panelDef, pData.permissionLevel);
    const selectedItem = menuItems[selection];
    if (!selectedItem) {return;}

    if (selectedItem.id === '__back__') {return showPanel(player, selectedItem.actionValue, context);}
    if (selectedItem.actionType === 'openPanel') {return showPanel(player, selectedItem.actionValue, context);}
    if (selectedItem.actionType === 'functionCall') {
        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {showPanel(player, panelId, context);}
        }
    }
}

/**
 * Main entry point for showing a UI panel to a player.
 * This function coordinates the building of the form, showing it to the player,
 * and handling the subsequent response.
 * @param {import('@minecraft/server').Player} player The player to show the panel to.
 * @param {string} panelId The unique identifier for the panel to show.
 * @param {object} [context={}] An optional context object to pass data between panels.
 */
async function showPanel(player, panelId, context = {}) {
    try {
        debugLog(`[UIManager] Showing panel '${panelId}' to ${player.name} with context: ${JSON.stringify(context)}`);

        const form = await buildPanelForm(player, panelId, context);
        if (!form) {
            debugLog(`[UIManager] buildPanelForm returned null for panel '${panelId}'. Aborting.`);
            return;
        }

        const response = await uiWait(player, form);
        if (!response || response.canceled) {
            debugLog(`[UIManager] Panel '${panelId}' was canceled by ${player.name}.`);
            // Show the parent panel if the user cancels and a parent is defined
            const { panelDefinitions } = await Promise.resolve().then(function () { return panelRegistry; });
            const panelDef = panelDefinitions[panelId];
            if (panelDef?.parentPanelId) {
                return showPanel(player, panelDef.parentPanelId, context);
            }
            return;
        }

        await handleFormResponse(player, panelId, response, context);
    } catch (e) {
        errorLog(`[UIManager] showPanel failed for panel '${panelId}': ${e.stack || e}`);
        player.sendMessage('§cAn unexpected error occurred while trying to open the UI. Please check the content log for details.');
    }
}

var uiManager = /*#__PURE__*/Object.freeze({
    __proto__: null,
    showPanel: showPanel
});

function handleItemUse(event) {
    const { source: player, itemStack } = event;
    if (itemStack.typeId === 'exe:panel') {
        const pData = getPlayer(player.id);
        if (pData) {
            showPanel(player, 'mainPanel');
        }
    }
}

function handleEntityDie(event) {
    const { deadEntity } = event;
    if (deadEntity.typeId !== 'minecraft:player') {
        return;
    }

    const deadPlayer = deadEntity;
    const config = getConfig();

    if (config.playerInfo.enableDeathCoords) {
        const pData = getPlayer(deadPlayer.id);
        if (pData) {
            const deathLocation = {
                x: deadPlayer.location.x,
                y: deadPlayer.location.y,
                z: deadPlayer.location.z,
                dimensionId: deadPlayer.dimension.id
            };
            setPlayerLastDeathLocation(deadPlayer.id, deathLocation);
        }
    }

    try {
        const lastHit = getLastHit(deadPlayer.id);
        if (!lastHit) {
            return;
        }

        clearLastHit(deadPlayer.id);

        const timeSinceHit = (Date.now() - lastHit.timestamp) / 1000;
        const creditTimeout = config.bounties?.bountyCreditTimeoutSeconds ?? 15;

        if (timeSinceHit > creditTimeout) {
            debugLog(`[BountyClaim] Kill credit for ${deadPlayer.name} expired. Time since last hit: ${timeSinceHit}s`);
            return;
        }

        const killer = getPlayerFromCache(lastHit.attackerId);
        if (killer && killer.isValid && killer.id !== deadPlayer.id) {
            const bounty = getBounty(deadPlayer.id);
            if (bounty && bounty.amount > 0) {
                incrementPlayerBalance(killer.id, bounty.amount);
                removeBounty(deadPlayer.id);

                world.sendMessage(`§a${killer.name} has claimed the bounty of §e$${bounty.amount.toFixed(2)}§a on ${deadPlayer.name}!`);
                debugLog(`[BountyClaim] ${killer.name} claimed bounty on ${deadPlayer.name} for $${bounty.amount}.`);
            }
        }
    } catch (e) {
        errorLog('[BountyClaim] A fatal error occurred during bounty processing.');
        try {
            errorLog(`[BountyClaim] Raw Error: ${JSON.stringify(e, Object.getOwnPropertyNames(e))}`);
        } catch {
            errorLog(`[BountyClaim] Could not stringify error object. Message: ${e?.message}`);
        }
        errorLog(`[BountyClaim] Error Stack: ${e?.stack}`);
    }
}

/**
 * Handles the `playerBreakBlock` event to notify admins of valuable ore mining.
 * @param {import('@minecraft/server').PlayerBreakBlockAfterEvent} event The event data.
 */
function handlePlayerBreakBlock(event) {
    // The event properties are `player` and `block` for `playerBreakBlock`.
    const { block, player } = event;
    const valuableOres = [
        'minecraft:diamond_ore',
        'minecraft:deepslate_diamond_ore',
        'minecraft:ancient_debris'
    ];

    if (valuableOres.includes(block.typeId)) {
        const onlineAdmins = getXrayAdmins();
        if (onlineAdmins.length === 0) { return; }

        const location = block.location;
        const message = `§e${player.name}§r mined §e${block.typeId.replace('minecraft:', '')}§r at §bX: ${location.x.toFixed(2)}, Y: ${location.y.toFixed(2)}, Z: ${location.z.toFixed(2)}`;

        onlineAdmins.forEach(admin => {
            // Don't send the notification to the player who mined the ore.
            if (admin.id !== player.id) {
                admin.sendMessage(message);
            }
        });
    }
}

/**
 * An array of all event handlers and their corresponding event subscriptions.
 * This approach ensures that all modules are loaded with static imports,
 * and the subscriptions happen predictably.
 */
const events = [
    { event: world.beforeEvents.chatSend, handler: handleChatSend, name: 'beforeChatSend' },
    { event: world.afterEvents.playerSpawn, handler: handlePlayerSpawn, name: 'playerSpawn' },
    { event: world.afterEvents.entityHurt, handler: handleEntityHurt, name: 'entityHurt' },
    { event: world.afterEvents.playerLeave, handler: handlePlayerLeave, name: 'playerLeave' },
    { event: world.afterEvents.playerDimensionChange, handler: handlePlayerDimensionChange, name: 'playerDimensionChange' },
    { event: world.afterEvents.itemUse, handler: handleItemUse, name: 'itemUse' },
    { event: world.afterEvents.entityDie, handler: handleEntityDie, name: 'entityDie' },
    { event: world.afterEvents.playerBreakBlock, handler: handlePlayerBreakBlock, name: 'playerBreakBlock' }
];

/**
 * Initializes the event manager by subscribing all handlers to their corresponding world events.
 * This function is now synchronous.
 */
function initializeEventManager() {
    for (const { event, handler, name } of events) {
        // Check if the event object exists before subscribing.
        // This handles cases where an event might be behind an experimental flag.
        if (event) {
            try {
                event.subscribe(handler);
            } catch (e) {
                // Log the error with more detail for easier debugging in the future.
                errorLog(`[EventManager] Failed to subscribe to event '${name}'. Error: ${e.message}\nStack: ${e.stack}`);
            }
        } else {
            errorLog(`[EventManager] Event subscription for '${name}' was skipped because the event is not available in this version of Minecraft.`);
        }
    }
}

/**
 * Unsubscribes all event handlers to prevent duplicates during a script reload.
 */
function cleanupEventManager() {
    for (const { event, handler, name } of events) {
        if (event) {
            try {
                event.unsubscribe(handler);
            } catch (e) {
                // It's possible the handler was never subscribed, so errors here might not be critical.
                // Log it for debugging purposes but don't treat it as a fatal error.
                errorLog(`[EventManager] Failed to unsubscribe from event '${name}'. It may have not been subscribed. Error: ${e.message}`);
            }
        }
    }
}

// This file is used to load all command modules.
// By importing this single file, all commands within the imported modules will be registered.

const commandFiles = [
    // --- General Commands ---
    'help.js',
    'panel.js',
    'rules.js',
    'links.js',
    'status.js',
    'version.js',
    'deathcoords.js',
    'spawn.js',       // Contains /setspawn (admin)
    'rtp.js',

    // --- TPA System ---
    'tpa.js',         // Contains /tpa, /tpahere, /tpaccept, /tpadeny, /tpacancel, /tpastatus

    // --- Home System ---
    'home.js',        // Contains /sethome, /delhome, /homes
    'warp.js',        // Contains /warp, /addwarp, /delwarp

    // --- Economy System ---
    'balance.js',     // Contains /baltop
    'pay.js',         // Contains /payconfirm
    'bounty.js',      // Contains /listbounty, /removebounty
    'kit.js',
    'shop.js',

    // --- Moderation Commands ---
    'report.js',      // Contains /reports, /clearreports (admin)
    'kick.js',
    'ban.js',         // Contains /unban, /offlineban
    'mute.js',        // Contains /unmute
    'freeze.js',
    'vanish.js',
    'clear.js',
    'ecwipe.js',
    'invsee.js',
    'copyinv.js',
    'clearchat.js',

    // --- Administration Commands ---
    'announcement.js',
    'dimensionLock.js',
    'log.js',
    'gamemode.js',
    'rank.js',
    'reload.js',
    'restart.js',
    'save.js',
    'setbalance.js',
    'tp.js',
    'chattoconsole.js',
    'xraynotify.js',
    'floatingtext.js'
];

async function loadCommands() {
    for (const file of commandFiles) {
        try {
            await import('./' + file);
        } catch (e) {
            errorLog(`[CommandLoader] Failed to load command file '${file}': ${e.message}`);
            if (e.stack) {
                errorLog(`[CommandLoader] Stack trace: ${e.stack}`);
            }
        }
    }
}

loadCommands();

/**
 * Checks a player's rank and updates it if necessary.
 * @param {import('@minecraft/server').Player} player The player to check.
 */
function updatePlayerRank(player) {
    const pData = getPlayer(player.id);
    if (!pData) { return; }

    const config = getConfig();
    if (!config) {return;} // Guard against config not being loaded
    const oldRankId = pData.rankId;
    const newRank = getPlayerRank(player, config);

    if (oldRankId !== newRank.id) {
        setPlayerRank(player.id, newRank.id, newRank.permissionLevel);
        infoLog(`[AddonExe] Player ${player.name}'s rank updated from ${oldRankId} to ${newRank.name}.`);
        player.sendMessage(`§aYour rank has been updated to ${newRank.name}.`);
    }
}

/**
 * Iterates through all online players and updates their ranks.
 */
function updateAllPlayerRanks() {
    for (const player of world.getAllPlayers()) {
        updatePlayerRank(player);
    }
}

/**
 * Re-initializes the state for all players currently online.
 * This is crucial for restoring player data after a script reload.
 */
function reinitializeOnlinePlayers() {
    infoLog(`[AddonExe] Re-initializing state for ${world.getAllPlayers().length} online players...`);
    for (const player of world.getAllPlayers()) {
        // Ensure the player's data is loaded into the system
        getOrCreatePlayer(player);
        // Then, update their rank based on the loaded data and config
        updatePlayerRank(player);
    }
    infoLog('[AddonExe] Player re-initialization complete.');
}

/**
 * Loads all persistent data from dynamic properties.
 */
function loadPersistentData() {
    infoLog('[AddonExe] Loading persistent data...');
    loadNameIdMap();
    loadPunishments();
    loadReports();
    loadCooldowns();
    loadBounties();
    initializeLeaderboard();
}

/**
 * Initializes all core managers and performs startup data clearing.
 */
function initializeManagers() {
    infoLog('[AddonExe] Initializing managers...');
    initialize$2();
    initializePunishmentManager();
    floatingTextManager.initialize();
    // Clear any expired data on startup
    clearExpiredPunishments();
    clearOldResolvedReports();
    clearExpiredCooldowns();
    clearExpiredPayments();
}

/**
 * Checks for critical configuration issues.
 */
function checkConfiguration() {
    const config = getConfig();
    const spawnConfig = getSpawnConfig();
    // Add a guard in case config hasn't loaded yet, though the init flow should prevent this.
    if (!config || !config.ownerPlayerNames || !config.ownerPlayerNames.length || config.ownerPlayerNames[0] === 'Your•Name•Here') {
        const warningMessage = '§l§c[AddonExe] WARNING: No owner is configured. Please set `ownerPlayerNames` in `scripts/config.js` to gain access to admin commands.';
        system.runTimeout(() => world.sendMessage(warningMessage), 20);
        errorLog('[AddonExe] No owner configured.');
    }

    if (!spawnConfig.spawn || !spawnConfig.spawn.spawnLocation) {
        const spawnWarning = '§l§e[AddonExe] NOTICE: The server spawn has not been set. Spawn protection and the /spawn command will not function until an admin runs /setspawn.';
        system.runTimeout(() => world.sendMessage(spawnWarning), 40);
        errorLog('[AddonExe] Server spawn not set.');
    }
}

/**
 * Starts all recurring system timers.
 */
function startSystemTimers() {
    // Periodically clear expired payment confirmations
    setTrackedInterval(clearExpiredPayments, 6000); // 5 minutes
    // Rank updates are now handled by events (e.g., !admin command)
    infoLog('[AddonExe] System timers started.');
}

/**
 * Main entry point for addon initialization.
 */
async function initializeAddon() {
    infoLog('[AddonExe] Initializing addon...');

    // Dynamically import the main config file to get the version number.
    // This is necessary because we need to know if it's a migration before loading all configs.
    const { config: tempConfig } = await Promise.resolve().then(function () { return config$1; });
    const newVersion = String(tempConfig.version);
    const lastVersion = world.getDynamicProperty('exe:lastVersion');
    const isMigration = !lastVersion || lastVersion !== newVersion;

    // Load all configurations with the correct migration flag.
    const loadPromises = [
        loadConfig(isMigration),
        loadKitsConfig(isMigration),
        loadShopConfig(isMigration),
        loadRanksConfig(isMigration),
        loadSpawnConfig(isMigration)
    ];
    await Promise.all(loadPromises);

    // Set the log level from the newly loaded config
    const config = getConfig();
    setLogLevel(config.logLevel);

    world.setDynamicProperty('exe:lastVersion', newVersion);

    initializeDataManager();
    loadPersistentData();
    initializeManagers();
    checkConfiguration();
    initializeEventManager();
    initialize$1();
    restartAnnouncer(); // Start the announcement system

    // Restore state for any players who were online during the reload
    reinitializeOnlinePlayers();

    startSystemTimers();
    infoLog('[AddonExe] Addon initialized successfully.');
}

/**
 * Cleans up all registered events and timers.
 * This is essential for a clean script reload.
 */
function cleanupAddon() {
    // Using console.log for raw output that is not affected by logger settings.
    // This is crucial for debugging script unload.
    // eslint-disable-next-line no-console
    console.log('[AddonExe] SCRIPT_UNLOAD detected. Cleaning up timers and events...');
    cleanupPlayerDataManager();
    cleanupEventManager();
    cleanupTimers();
    // eslint-disable-next-line no-console
    console.log('[AddonExe] Cleanup complete. The script will now unload.');
}

// Run the initialization logic on the next tick after the script is loaded.
system.run(async () => {
    try {
        await initializeAddon();
    } catch (e) {
        errorLog('[AddonExe] A critical error occurred during addon initialization:');
        errorLog(e.stack);
        world.sendMessage('§l§c[AddonExe] A critical error occurred during startup. Please check the content log for details.');
    }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
    const { id, sourceEntity } = event;

    // Handle script unload event
    if (id === 'minecraft:script_unload') {
        cleanupAddon();
        return;
    }

    const config = getConfig(); // Config should be loaded by the time this event fires for custom events.
    if (!config) { return; }


    switch (id) {
        case 'exe:restart':
            startRestart(sourceEntity);
            break;

        case 'exe:toggle_chat_log': {
            const chatConfig = config.chat || { logToConsole: false };
            const newValue = !chatConfig.logToConsole;
            chatConfig.logToConsole = newValue;
            updateConfig('chat', chatConfig);

            const feedbackMessage = `§aChat-to-console has been ${newValue ? '§aenabled' : '§cdisabled'}§a.`;
            if (sourceEntity && sourceEntity.sendMessage) {
                sourceEntity.sendMessage(feedbackMessage);
            }
            // eslint-disable-next-line no-console
            console.log(`[AddonExe] ${feedbackMessage}`);
            break;
        }

        case 'exe:grant_admin_self': {
            if (sourceEntity && sourceEntity.addTag) {
                const adminRank = getRankById$1('admin');
                if (!adminRank) {
                    errorLog('[AddonExe] Could not grant admin rank because the "admin" rank definition was not found.');
                    sourceEntity.sendMessage('§cError: The admin rank is not configured.');
                    return;
                }

                const adminTagCondition = adminRank.conditions.find(c => c.type === 'hasTag');
                if (!adminTagCondition || !adminTagCondition.value) {
                    errorLog('[AddonExe] Could not grant admin rank because it lacks a valid "hasTag" condition.');
                    sourceEntity.sendMessage('§cError: The admin rank is not configured with a valid tag.');
                    return;
                }

                sourceEntity.addTag(adminTagCondition.value);
                sourceEntity.sendMessage('§aYou have been promoted to Admin.');
                updateAllPlayerRanks();
            }
            break;
        }
    }
});

const config = {
    // --- System & Core Settings ---
    version: [1, 0, 0], // This will be replaced by the release workflow
    ownerPlayerNames: ['Your•Name•Here'], // Default : ['Your•Name•Here']
    commandPrefix: '!',
    serverName: '§cServerExe§r',
    defaultGamemode: 'survival',
    logLevel: 2, // 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG
    exeGlobalNotificationsDefaultOn: true,

    // --- Data Management ---
    data: {
        autoSaveIntervalSeconds: 30 // Time in seconds. Set to 0 to disable. Default is 30 seconds.
    },

    // --- Restart Settings ---
    restart: {
        countdownSeconds: 30,
        kickMessage: 'Server is restarting. Please rejoin in a moment.'
    },

    // --- Feature Toggles & Settings ---
    tpa: {
        enabled: true,
        requestTimeoutSeconds: 60,
        cooldownSeconds: 30,
        teleportWarmupSeconds: 10
    },
    homes: {
        enabled: true,
        maxHomes: 5,
        cooldownSeconds: 60, // 1 minute
        teleportWarmupSeconds: 10
    },
    warps: {
        enabled: false,
        cooldownSeconds: 60, // 1 minute
        teleportWarmupSeconds: 10
    },
    rtp: {
        enabled: false,
        minRange: 1000,
        maxRange: 10000,
        cooldownSeconds: 600, // 10 minutes
        teleportWarmupSeconds: 10
    },
    kits: {
        enabled: false
    },
    shop: {
        enabled: true
    },
    reports: {
        resolvedReportLifetimeDays: 7
    },
    chat: {
        logToConsole: true
    },
    economy: {
        enabled: true,
        startingBalance: 50,
        baltopLimit: 10,
        minimumBounty: 10,
        paymentConfirmationThreshold: 10000, // Payments over this amount require confirmation
        paymentConfirmationTimeout: 60 // Seconds to confirm a payment
    },
    bounties: {
        enabled: true,
        // How long (in seconds) after the last hit from a player that they can still be credited for the kill.
        bountyCreditTimeoutSeconds: 15
    },
    announcements: {
        enabled: false,
        message: '§2Welcome to the server! Enjoy your stay.',
        interval: 300 // Time in seconds
    },
    dimensionLock: {
        allowAdminBypass: true,
        netherLock: false,
        endLock: false
    },
    playerInfo: {
        enableWelcomer: true,
        // Available placeholders: {playerName}, {serverName}, {discordLink}, {websiteLink}. Use \n for a new line.
        welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.',
        notifyAdminOnNewPlayer: true,
        enableDeathCoords: true,
        deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.'
    },

    // --- Player Defaults ---
    playerDefaults: {
        rankId: 'member',
        permissionLevel: 1024
    },

    // --- Server Information ---
    serverInfo: {
        discordLink: 'https://discord.gg/example',
        websiteLink: 'https://example.com',
        rules: [
            '§e1. §rBe respectful to all players and staff.',
            '§e2. §rNo cheating, hacking, or using exploits (e.g., §cX-Ray§r, §cduping§r).',
            '§e3. §rDo not spam chat or use excessive caps.',
            '§e4. §rNo griefing or stealing from other players.',
            '§e5. §rRespect player builds. Do not alter or destroy them without permission.',
            '§e6. §rNo advertising other servers or websites.',
            '§e7. §rKeep conversations in English.',
            '§e8. §rFollow directions from staff members.',
            '§e9. §rDo not use offensive language, skins, or usernames.'
        ],
        helpfulLinks: [
            {
                title: '§9Discord Server',
                url: 'https://discord.gg/example'
            },
            {
                title: '§aWebsite',
                url: 'https://example.com'
            }
        ]
    },

    // --- Miscellaneous ---

    // --- Sound Events ---
    soundEvents: {
        tpaRequestReceived: { enabled: true, soundId: 'random.orb', volume: 1.0, pitch: 1.2 },
        adminNotificationReceived: { enabled: true, soundId: 'note.pling', volume: 0.8, pitch: 1.5 },
        playerWarningReceived: { enabled: true, soundId: 'note.bass', volume: 1.0, pitch: 0.8 },
        commandError: { enabled: true, soundId: 'mob.villager.no', volume: 1.0, pitch: 0.9 }
    },

    // --- Command Enable/Disable ---
    commandSettings: {
        'admin': { enabled: true },
        'balance': { enabled: true },
        'baltop': { enabled: true },
        'ban': { enabled: true },
        'bounty': { enabled: true },
        'buy': { enabled: true },
        'chattoconsole': { enabled: true },
        'clear': { enabled: true },
        'clearchat': { enabled: true },
        'clearreports': { enabled: true },
        'copyinv': { enabled: true },
        'deathcoords': { enabled: true },
        'debug': { enabled: true },
        'delhome': { enabled: true },
        'ecwipe': { enabled: true },
        'freeze': { enabled: true },
        'gm': { enabled: true },
        'gma': { enabled: true },
        'gmc': { enabled: true },
        'gms': { enabled: true },
        'gmsp': { enabled: true },
        'help': { enabled: true },
        'home': { enabled: true },
        'homes': { enabled: true },
        'invsee': { enabled: true },
        'kick': { enabled: true },
        'kit': { enabled: true },
        'listbounty': { enabled: true },
        'mute': { enabled: true },
        'offlineban': { enabled: true },
        'panel': { enabled: true },
        'pay': { enabled: true },
        'payconfirm': { enabled: true },
        'rank': { enabled: true },
        'rbounty': { enabled: true },
        'reload': { enabled: true },
        'report': { enabled: true },
        'reports': { enabled: true },
        'restart': { enabled: true },
        'rtp': { enabled: true },
        'rules': { enabled: true },
        'save': { enabled: true },
        'sell': { enabled: true },
        'sellhand': { enabled: true },
        'setbalance': { enabled: true },
        'sethome': { enabled: true },
        'setspawn': { enabled: true },
        'shop': { enabled: true },
        'spawn': { enabled: true },
        'status': { enabled: true },
        'tp': { enabled: true },
        'tpa': { enabled: true },
        'tpacancel': { enabled: true },
        'tpaccept': { enabled: true },
        'tpadeny': { enabled: true },
        'tpahere': { enabled: true },
        'tpastatus': { enabled: true },
        'unban': { enabled: true },
        'unmute': { enabled: true },
        'vanish': { enabled: true },
        'version': { enabled: true },
        'xraynotify': { enabled: true }
    }
};

var config$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    config: config
});

export { updateAllPlayerRanks, updatePlayerRank };
