// Log level constants, ordered by verbosity
export const LogLevels = {
    ERROR: 0, // Critical errors
    WARN: 1, // Warnings, potential issues
    INFO: 2, // General information, status updates
    DEBUG: 3 // Verbose debugging for developers
} as const;

type LogLevelKey = keyof typeof LogLevels;

// Default log level
let currentLogLevel: number = LogLevels.INFO;

/**
 * Sets the current log level for the entire application.
 * Messages below this level will not be logged.
 * @param {number | string} level The log level to set (use LogLevels enum).
 */
export function setLogLevel(level: number | string): void {
    const numericLevel = typeof level === 'string' ? parseInt(level, 10) : level;
    if (!isNaN(numericLevel) && numericLevel >= LogLevels.ERROR && numericLevel <= LogLevels.DEBUG) {
        currentLogLevel = numericLevel;
        // Provide feedback on the new log level for clarity during startup
        const levelName = (Object.keys(LogLevels) as LogLevelKey[]).find((key) => LogLevels[key] === numericLevel);
        infoLog(`[Logger] Log level set to: ${levelName}`);
    } else {
        errorLog(`[Logger] Invalid log level provided: '${level}'. Defaulting to INFO.`);
        currentLogLevel = LogLevels.INFO;
    }
}

/**
 * Formats an error object or any value into a readable string.
 * @param {unknown} error The error or object to format.
 * @returns {string} A string representation of the error.
 */
function formatError(error: unknown): string {
    if (error instanceof Error) {
        return `\n  Message: ${error.message}\n  Stack: ${error.stack}`;
    }
    if (typeof error === 'object' && error !== null) {
        try {
            // For other objects, attempt to stringify them.
            return JSON.stringify(
                error,
                (key, value) => {
                    if (value instanceof Error) {
                        return { message: value.message, stack: value.stack };
                    }
                    return value;
                },
                2
            );
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
export function debugLog(message: string): void {
    if (currentLogLevel >= LogLevels.DEBUG) {
        // eslint-disable-next-line no-console
        console.log(`[DEBUG] ${message}`);
    }
}

/**
 * Logs an informational message to the console if the log level is INFO or lower.
 * @param {string} message The message to log.
 */
export function infoLog(message: string): void {
    if (currentLogLevel >= LogLevels.INFO) {
        // eslint-disable-next-line no-console
        console.info(`[INFO] ${message}`);
    }
}

/**
 * Logs a warning message to the console if the log level is WARN or lower.
 * @param {string} message The message to log.
 */
export function warnLog(message: string): void {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorLog(message: string, error?: any): void {
    if (currentLogLevel >= LogLevels.ERROR) {
        let fullMessage = `[ERROR] ${message}`;
        if (error !== undefined) {
            fullMessage += `\n  Details: ${formatError(error)}`;
        }
        // eslint-disable-next-line no-console
        console.error(fullMessage);
    }
}
