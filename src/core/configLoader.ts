import { errorLog } from './logger';

/**
 * Dynamically loads a configuration module.
 * It first tries to load the user-provided version (e.g., `config.js`).
 * If that fails, it silently falls back to loading the default version (e.g., `config.default.js`).
 * Throws a fatal error if neither can be found.
 * @param modulePath The relative path to the config module from the compiled `scripts` directory.
 * For example, for a file at `src/core/economyConfig.ts`, the path would be `./core/economyConfig.js`.
 * @returns A promise that resolves with the loaded config module's default export.
 */
export async function loadConfig<T>(modulePath: string): Promise<T> {
    const userPath = modulePath;
    const defaultPath = modulePath.replace(/\.js$/, '.default.js');

    try {
        // Try loading user config
        const module = await import(userPath);
        return module.default as T;
    } catch (e: unknown) {
        const err = e as Error;
        // Check if it's a 'Module not found' error
        if (
            (err.message && err.message.includes('Module not found')) ||
            (err.stack && err.stack.includes('Module not found'))
        ) {
            try {
                // Fallback to default config
                const module = await import(defaultPath);
                return module.default as T;
            } catch (defaultError) {
                errorLog(`[ConfigLoader] FATAL: Could not load default config file: ${defaultPath}`);
                throw defaultError;
            }
        } else {
            // A different error occurred (e.g., syntax error in user's file)
            errorLog(`[ConfigLoader] Error loading user config file: ${userPath}`, err);
            throw err;
        }
    }
}
