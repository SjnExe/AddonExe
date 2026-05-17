import { globSync } from 'glob';
import { defineConfig } from 'tsup';

// Find all config files
const configFiles = globSync('src/**/*Config{.ts,.default.ts}', {
    ignore: ['**/__tests__/**', '**/__mocks__/**', 'src/core/configManager*.ts', 'src/core/configurations.ts', 'src/core/configLoader.ts', 'src/features/anticheat/anticheatConfigLoader.ts']
});

configFiles.push('src/config.default.ts');

export default defineConfig({
    entry: ['src/core/main.ts', ...configFiles],
    outDir: 'build/behavior/scripts',
    format: ['esm'],
    target: 'es2022',
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
    outExtension({ format }) {
        return {
            js: '.js'
        };
    },
    async onSuccess() {
        // We need to rename the generated `.default.js` files to `.js`
        const { renameSync, existsSync } = await import('fs');
        const { join } = await import('path');
        const { globSync } = await import('glob');

        const outDir = 'build/behavior/scripts';
        const generatedFiles = globSync('**/*.default.js', { cwd: outDir });

        for (const file of generatedFiles) {
            const oldPath = join(outDir, file);
            const newPath = oldPath.replace('.default.js', '.js');
            renameSync(oldPath, newPath);

            // Also rename maps if they exist
            if (existsSync(oldPath + '.map')) {
                renameSync(oldPath + '.map', newPath + '.map');
            }
        }
    }
});
