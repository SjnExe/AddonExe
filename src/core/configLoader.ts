import { errorLog } from '@core/logger.js';

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
export async function loadConfig<T>(modulePath: string, suppressError = false): Promise<T> {
    try {
        // If we are in vitest context, try to resolve from .default.ts or .ts
        let finalPath = modulePath;
        if (typeof process !== 'undefined' && process.env.BUN_ENV === 'test') {
            const pathParts = modulePath.split('/');
            const filename = pathParts.pop();
            if (filename) {
                const basename = filename.replace('.js', '');
                // Build an absolute path or correct relative path to src/
                // modulePath comes as e.g. './features/shop/shopConfig.js'
                // But in vitest, the cwd is the project root /app, so relative paths from configLoader are tricky.
                // We're inside /app/src/core/configLoader.ts
                const relativeToCore = pathParts.join('/');
                const tryTs = `${relativeToCore}/${basename}.ts`;
                const tryDefaultTs = `${relativeToCore}/${basename}.default.ts`;

                try {
                    await import(tryTs);
                    finalPath = tryTs;
                } catch {
                    try {
                        await import(tryDefaultTs);
                        finalPath = tryDefaultTs;
                    } catch {
                        // If it fails, maybe it needs a path relative to root or src
                        try {
                            const tryRootTs = `../${relativeToCore.replace('./', '')}/${basename}.ts`;
                            await import(tryRootTs);
                            finalPath = tryRootTs;
                        } catch {
                            finalPath = `../${relativeToCore.replace('./', '')}/${basename}.default.ts`;
                        }
                    }
                }
            }
        }

        const module = (await import(finalPath)) as Record<string, unknown>;

        if (module.default) {
            return module.default as T;
        }

        // Fallback for user configs that might lack 'export default'
        // Strategy 1: Look for an export matching the filename (e.g. config.js -> export const config)
        const fileName = modulePath.split('/').pop();
        if (fileName !== undefined && fileName.length > 0) {
            const name = fileName.replace('.js', '');
            if (Object.prototype.hasOwnProperty.call(module, name)) {
                return module[name] as T;
            }
        }

        // Strategy 2: If there's exactly one export, use it
        const keys = Object.keys(module);
        const firstKey = keys[0];
        if (keys.length === 1 && firstKey !== 'default' && firstKey !== undefined) {
            return module[firstKey] as T;
        }

        throw new Error(`Module '${modulePath}' has no default export and auto-discovery failed.`);
    } catch (error: unknown) {
        const err = error as Error;
        if (!suppressError) {
            errorLog(`[ConfigLoader] FATAL: Failed to load config file: ${modulePath}`, err);
        }
        throw err;
    }
}
