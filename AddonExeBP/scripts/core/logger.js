// Log level constants, ordered by verbosity
export const LogLevels = {
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
export function setLogLevel(level) {
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
export function debugLog(message) {
    if (currentLogLevel >= LogLevels.DEBUG) {
        // eslint-disable-next-line no-console
        console.log(`[DEBUG] ${message}`);
    }
}

/**
 * Logs an informational message to the console if the log level is INFO or lower.
 * @param {string} message The message to log.
 */
export function infoLog(message) {
    if (currentLogLevel >= LogLevels.INFO) {
        // eslint-disable-next-line no-console
        console.info(`[INFO] ${message}`);
    }
}

/**
 * Logs a warning message to the console if the log level is WARN or lower.
 * @param {string} message The message to log.
 */
export function warnLog(message) {
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
export function errorLog(message, error) {
    if (currentLogLevel >= LogLevels.ERROR) {
        let fullMessage = `[ERROR] ${message}`;
        if (error !== undefined) {
            fullMessage += `\n  Details: ${formatError(error)}`;
        }
        // eslint-disable-next-line no-console
        console.error(fullMessage);
    }
}