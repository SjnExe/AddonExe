import { errorLog } from './logger.js';

/**
 * Dynamically loads a configuration module.
 * It strictly attempts to load the requested configuration file (e.g., `config.js`).
 * If the file is missing, it will throw an error, as the build process guarantees
 * the existence of these files (copying defaults if necessary).
 * @param modulePath The relative path to the config module from the compiled `scripts` directory.
 * For example, for a file at `src/core/economyConfig.ts`, the path would be `./core/economyConfig.js`.
 * @returns A promise that resolves with the loaded config module's default export.
 */
export async function loadConfig<T>(modulePath: string): Promise<T> {
    try {
        const module = await import(modulePath);
        return module.default as T;
    } catch (e: unknown) {
        const err = e as Error;
        errorLog(`[ConfigLoader] FATAL: Failed to load config file: ${modulePath}`, err);
        throw err;
    }
}
