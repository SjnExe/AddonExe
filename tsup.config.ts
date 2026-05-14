import { defineConfig } from 'tsup';
import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.join(__dirname, 'src');
const configFiles = globSync(['**/*Config{.ts,.default.ts}', 'config.default.ts'], {
    cwd: srcDir,
    ignore: ['**/__tests__/**', '**/__mocks__/**', 'core/configManager*.ts', 'core/configurations.ts', 'core/configLoader.ts', 'features/anticheat/anticheatConfigLoader.ts']
});

const entryPoints = {
    main: 'src/core/main.ts'
};

const externalConfigs = [];

for (const file of configFiles) {
    let destPath = file.replace('.default.ts', '').replace('.ts', '');
    if (file === 'config.default.ts') {
        destPath = 'config';
    }

    let srcPathToUse = path.join('src', file);
    if (file.endsWith('.default.ts')) {
        const customSrcPath = path.join(__dirname, 'src', file.replace('.default.ts', '.ts'));
        if (fs.existsSync(customSrcPath)) {
            srcPathToUse = path.join('src', file.replace('.default.ts', '.ts'));
        }
    }

    entryPoints[destPath] = srcPathToUse;
    externalConfigs.push(`./${destPath}.js`);
}

export default defineConfig([
    {
        entry: { main: entryPoints.main },
        outDir: 'packs/behavior/scripts',
        format: ['esm'],
        target: 'es2022',
        bundle: true,
        clean: false,
        minify: process.argv.includes('--minify'),
        sourcemap: true,
        external: [
            '@minecraft/server',
            '@minecraft/server-ui',
            '@minecraft/server-gametest',
            '@minecraft/debug-utilities',
            '@minecraft/common',
            ...externalConfigs
        ],
        noExternal: ['@minecraft/vanilla-data', '@minecraft/math']
    },
    {
        // Treat configs separately so they don't get bundled with utils/etc.
        entry: Object.fromEntries(Object.entries(entryPoints).filter(([k, v]) => k !== 'main')),
        outDir: 'packs/behavior/scripts',
        format: ['esm'],
        target: 'es2022',
        bundle: false, // Ensure configs stay readable and modular
        clean: false,
        minify: process.argv.includes('--minify'),
        sourcemap: false
    }
]);
