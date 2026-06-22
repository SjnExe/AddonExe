import { globSync } from 'glob';
import { defineConfig } from 'tsup';
import { generateCommandIndexPlugin } from './scripts/esbuild-plugin-command-index.js';

// Find all config files
const configFiles = globSync('src/**/*Config{.ts,.default.ts}', {
    ignore: ['**/__tests__/**', '**/__mocks__/**', 'src/core/configManager*.ts', 'src/core/configurations.ts', 'src/core/configLoader.ts', 'src/features/anticheat/anticheatConfigLoader.ts']
});

configFiles.push('src/config.default.ts');

export default defineConfig({
    entry: ['src/core/main.ts', ...configFiles],
    outDir: 'build/behavior/scripts',
    format: ['esm'],
    target: 'es2023',
    bundle: true,
    splitting: false,
    clean: false, // We clean it with rimraf beforehand
    sourcemap: true,
    external: [
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/debug-utilities',
        '@minecraft/common',
        ...configFiles.map((file) => {
            let relativePath = file.replace('src/', './').replace('.ts', '.js');
            if (relativePath.endsWith('.default.js')) {
                relativePath = relativePath.replace('.default.js', '.js');
            }
            return relativePath;
        })
    ],
    esbuildOptions(options) {
        options.chunkNames = '[name]';
    },
    esbuildPlugins: [generateCommandIndexPlugin],
    outExtension({ format }) {
        return {
            js: '.js'
        };
    },
    async onSuccess() {
        // We need to rename the generated `.default.js` files to `.js`
        // However, if the user has defined a custom configuration file (e.g. config.ts),
        // we should not overwrite it with the default one.
        const { renameSync, existsSync, rmSync } = await import('fs');
        const { join } = await import('path');
        const { globSync } = await import('glob');

        const outDir = 'build/behavior/scripts';
        const generatedFiles = globSync('**/*.default.js', { cwd: outDir });

        for (const file of generatedFiles) {
            const oldPath = join(outDir, file);
            const newPath = oldPath.replace('.default.js', '.js');

            if (existsSync(newPath)) {
                // A custom config was compiled. Delete the default one instead of overwriting.
                rmSync(oldPath);
                if (existsSync(oldPath + '.map')) {
                    rmSync(oldPath + '.map');
                }
            } else {
                // Rename default to standard
                renameSync(oldPath, newPath);

                // Also rename maps if they exist
                if (existsSync(oldPath + '.map')) {
                    renameSync(oldPath + '.map', newPath + '.map');
                }
            }
        }
    }
});
