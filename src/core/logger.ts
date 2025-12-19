// Log level constants, ordered by verbosity
// (Refreshed for deployment)
export const LogLevels = {
    ERROR: 0, // Critical errors
    WARN: 1, // Warnings, potential issues
    INFO: 2, // General information, status updates
    DEBUG: 3 // Verbose debugging for developers
} as const;

type LogLevelKey = keyof typeof LogLevels;

// Default log level
let currentLogLevel: number = LogLevels.INFO;

// External error handler (e.g., Sentry)
let externalErrorHandler: ((error: unknown, context?: string) => void) | undefined;
// External debug handler
let externalDebugHandler: ((message: string) => void) | undefined;
// External info/warn handlers
let externalInfoHandler: ((message: string) => void) | undefined;
let externalWarnHandler: ((message: string) => void) | undefined;

/**
 * Register an external error handler to capture critical errors.
 */
export function setExternalErrorHandler(handler: (error: unknown, context?: string) => void): void {
    externalErrorHandler = handler;
}

/**
 * Register an external debug handler.
 */
export function setExternalDebugHandler(handler: (message: string) => void): void {
    externalDebugHandler = handler;
}

/**
 * Register an external info handler.
 */
export function setExternalInfoHandler(handler: (message: string) => void): void {
    externalInfoHandler = handler;
}

/**
 * Register an external warn handler.
 */
export function setExternalWarnHandler(handler: (message: string) => void): void {
    externalWarnHandler = handler;
}

/**
 * Gets the current log level.
 */
export function getLogLevel(): number {
    return currentLogLevel;
}

/**
 * Sets the current log level for the entire application.
 * Messages below this level will not be logged.
 * @param {number | string} level The log level to set (use LogLevels enum).
 */
export function setLogLevel(level: number | string): void {
    const numericLevel = typeof level === 'string' ? Number.parseInt(level, 10) : level;
    if (!Number.isNaN(numericLevel) && numericLevel >= LogLevels.ERROR && numericLevel <= LogLevels.DEBUG) {
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
                (_key: string, value: unknown) => {
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

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error';

/**
 * Internal helper to perform the actual console call.
 * This centralizes the linter suppression.
 * @param method The console method to use.
 * @param message The message to log.
 */
function internalLog(method: ConsoleMethod, message: string): void {
    console[method](message);
}

/**
 * Logs a debug message to the console if the log level is DEBUG.
 * @param {string} message The message to log.
 */
export function debugLog(message: string): void {
    if (externalDebugHandler) {
        externalDebugHandler(message);
    }
    if (currentLogLevel >= LogLevels.DEBUG) {
        internalLog('log', `[DEBUG] ${message}`);
    }
}

/**
 * Logs an informational message to the console if the log level is INFO or lower.
 * @param {string} message The message to log.
 */
export function infoLog(message: string): void {
    if (externalInfoHandler) {
        externalInfoHandler(message);
    }
    if (currentLogLevel >= LogLevels.INFO) {
        internalLog('info', message);
    }
}

/**
 * Logs a warning message to the console if the log level is WARN or lower.
 * @param {string} message The message to log.
 */
export function warnLog(message: string): void {
    if (externalWarnHandler) {
        externalWarnHandler(message);
    }
    if (currentLogLevel >= LogLevels.WARN) {
        internalLog('warn', message);
    }
}

/**
 * Logs an error message to the console. Errors are always logged unless the level is > ERROR.
 * @param {string} message The primary error message.
 * @param {unknown} [error] Optional error object or additional info to serialize.
 */
export function errorLog(message: string, error?: unknown): void {
    if (currentLogLevel >= LogLevels.ERROR) {
        let fullMessage = message;
        if (error !== undefined) {
            fullMessage += `\n  Details: ${formatError(error)}`;
        }
        internalLog('error', fullMessage);

        if (externalErrorHandler) {
            // If an explicit error object is provided, use it. Otherwise, use the message as the error.
            externalErrorHandler(error ?? new Error(message), message);
        }
    }
}

/**
 * Logs a raw message to the console without any prefix.
 * Useful for chat logging where the prefix is undesired.
 * @param {string} message The message to log.
 */
export function rawLog(message: string): void {
    internalLog('log', message);
}
