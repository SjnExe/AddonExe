import { copy } from 'esbuild-plugin-copy';
import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsup';

const srcDir = path.join(__dirname, 'src');

const configFiles = globSync(['**/*Config{.ts,.default.ts}', 'config.default.ts'], {
    cwd: srcDir,
    ignore: ['**/__tests__/**', '**/__mocks__/**', 'core/configManager*.ts', 'core/configurations.ts', 'core/configLoader.ts', 'features/anticheat/anticheatConfigLoader.ts']
});

// For config files, we resolve the appropriate source path
const configEntries = configFiles.reduce((acc, file) => {
    let sourcePath = path.join('src', file);
    if (file.endsWith('.default.ts')) {
        const customPath = path.join('src', file.replace('.default.ts', '.ts'));
        if (fs.existsSync(customPath)) {
            sourcePath = customPath;
            console.log(`Using custom config: ${customPath}`);
        }
    }

    // We want the output path to drop the src directory and use the name matching the original build.js
    let destName = file.replace('.default.ts', '').replace('.ts', '');
    if (file === 'config.default.ts') {
        destName = 'config';
    }

    // destName is like features/games/gamesConfig
    acc[destName] = sourcePath;
    return acc;
}, {});

// Generate externals from dest paths for our configs, to match old build.js behaviour
const configExternals = Object.keys(configEntries).map((dest) => `./${dest}.js`);

export default defineConfig((options) => {
    const isMinify = options.minify || process.argv.includes('--minify');

    return {
        entry: {
            main: 'src/core/main.ts',
            ...configEntries
        },
        outDir: 'build/behavior/scripts',
        target: 'es2022',
        format: ['esm'],
        sourcemap: !isMinify,
        clean: false, // We'll clean `build/` entirely via npm script, so tsup doesn't wipe `build/behavior/` while copying
        minify: !!isMinify,
        bundle: true,
        treeshake: true,
        external: ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities', '@minecraft/common', ...configExternals],
        esbuildPlugins: [
            copy({
                resolveFrom: 'cwd',
                assets: [
                    {
                        from: ['./packs/behavior/**/*'],
                        to: ['./build/behavior'],
                        keepStructure: true
                    },
                    {
                        from: ['./packs/resource/**/*'],
                        to: ['./build/resource'],
                        keepStructure: true
                    }
                ],
                watch: options.watch
            })
        ],
        onSuccess: async () => {
            // In watch mode or standard mode, after build we can minify files in build directory if needed
            if (isMinify && (process.env.CI || process.env.GITHUB_ACTIONS || process.argv.includes('--minify'))) {
                console.log('Minifying JSON, LANG, MCFUNCTION assets...');
                // We will define a helper script or call one here
                const { execSync } = require('child_process');
                try {
                    execSync('node scripts/minify-assets.js', { stdio: 'inherit' });
                } catch (e) {
                    console.error('Failed to minify assets:', e);
                }
            }
        }
    };
});
