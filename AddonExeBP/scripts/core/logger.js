let isDebugEnabled = false;

/**
 * Enables or disables debug logging.
 * This is called by the config manager to avoid circular dependencies.
 * @param {boolean} enabled
 */
export function setDebug(enabled) {
    isDebugEnabled = !!enabled;
}

/**
 * Logs a message to the console only if debug logging is enabled.
 * @param {string} message The message to log.
 */
export function debugLog(message) {
    if (isDebugEnabled) {
        // eslint-disable-next-line no-console
        console.log(message);
    }
}

/**
 * Logs an error message to the console.
 * @param {string} message The message to log.
 * @param {any} [error] Optional error object or additional info.
 */
export function errorLog(message, error) {
    if (error) {
        // eslint-disable-next-line no-console
        console.error(message, error);
    } else {
        // eslint-disable-next-line no-console
        console.error(message);
    }
}