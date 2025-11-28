import { errorLog } from './logger.js';

/**
 * Dynamically loads a configuration module.
 * It strictly attempts to load the requested configuration file (e.g., `config.js`).
 * If the file is missing, it will throw an error, as the build process guarantees
 * the existence of these files (copying defaults if necessary).
 * @param modulePath The relative path to the config module from the compiled `scripts` directory.
 * For example, for a file at `src/core/economyConfig.ts`, the path would be `./core/economyConfig.js`.
 * @param suppressError If true, errors will be thrown but not logged as FATAL.
 * @returns A promise that resolves with the loaded config module's default export.
 */
export async function loadConfig<T>(modulePath: string, suppressError?: boolean): Promise<T> {
    const shouldSuppress = suppressError ?? false;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const module = (await import(modulePath)) as any;
        if (module.default) {
            return module.default as T;
        }

        // Fallback for user configs that might lack 'export default'
        // Strategy 1: Look for an export matching the filename (e.g. config.js -> export const config)
        const fileName = modulePath.split('/').pop();
        if (fileName) {
            const name = fileName.replace('.js', '');
            if (module[name]) {
                return module[name] as T;
            }
        }

        // Strategy 2: If there's exactly one export, use it
        const keys = Object.keys(module);
        if (keys.length === 1 && keys[0] !== 'default') {
            return module[keys[0]] as T;
        }

        throw new Error(`Module '${modulePath}' has no default export and auto-discovery failed.`);
    } catch (e: unknown) {
        const err = e as Error;
        if (!shouldSuppress) {
            errorLog(`[ConfigLoader] FATAL: Failed to load config file: ${modulePath}`, err);
        }
        throw err;
    }
}
