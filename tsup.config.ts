import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'tsup';

// Asset minification from build.js
function minifyFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'scripts') {
                minifyFiles(filePath);
            }
        } else if (file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const jsonWithoutComments = content.replaceAll(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
                const json = JSON.parse(jsonWithoutComments);
                const minified = JSON.stringify(json);
                fs.writeFileSync(filePath, minified);
                console.log(`Minified JSON: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        } else if (file.endsWith('.lang')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
                fs.writeFileSync(filePath, minifiedLines.join('\n'));
                console.log(`Minified Lang: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        } else if (file.endsWith('.mcfunction')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#'));
                fs.writeFileSync(filePath, minifiedLines.join('\n'));
                console.log(`Minified MCFunction: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        }
    }
}

// Automatically discover configuration files
const srcDir = path.join(__dirname, 'src');
const configFiles = globSync(['**/*Config{.ts,.default.ts}', 'config.default.ts'], {
    cwd: srcDir,
    ignore: ['**/__tests__/**', '**/__mocks__/**', 'core/configManager*.ts', 'core/configurations.ts', 'core/configLoader.ts', 'features/anticheat/anticheatConfigLoader.ts']
});

const configsToCompile = configFiles.map((file) => {
    const srcPath = path.join('src', file);
    let destPath = file.replace('.default.ts', '').replace('.ts', '');

    if (file === 'config.default.ts') {
        destPath = 'config';
    }

    return {
        src: srcPath,
        dest: destPath,
        originalDestPathJS: destPath + '.js'
    };
});

// Configure custom configs if they exist, instead of the default ones
const entryPoints = {
    main: 'src/core/main.ts'
};

const external = ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities', '@minecraft/common'];

for (const config of configsToCompile) {
    let sourcePathToUse = config.src;
    if (config.src.endsWith('.default.ts')) {
        const customSrcPath = config.src.replace('.default.ts', '.ts');
        if (fs.existsSync(customSrcPath)) {
            console.log(`Found custom config: ${path.basename(customSrcPath)}, using it instead of default.`);
            sourcePathToUse = customSrcPath;
        }
    }

    entryPoints[config.dest] = sourcePathToUse;
    // Add custom configs to external list to ensure they aren't bundled into main
    external.push(`./${config.originalDestPathJS}`);
}

export default defineConfig((options) => {
    // When doing tsup with multiple entries and bundle: true, tsup creates shared chunks
    // We want the configs to be unbundled. Since tsup does not easily support
    // mixed bundle=true and bundle=false entries without multiple configs, we return an array of configs.

    const configEntries = { ...entryPoints };
    delete configEntries['main'];

    return [
        {
            entry: configEntries,
            outDir: 'packs/behavior/scripts',
            format: ['esm'],
            target: 'es2022',
            bundle: false, // DO NOT bundle configs
            minify: false, // Minification of configs breaks user editability, or we just want them readable
            sourcemap: false, // The original script did sourcemap: false for configs
            clean: false, // Handled by npm run clean
            external: external,
            tsconfig: 'tsconfig.json'
        },
        {
            entry: { main: 'src/core/main.ts' },
            outDir: 'packs/behavior/scripts',
            format: ['esm'],
            target: 'es2022',
            bundle: true,
            minify: options.minify,
            sourcemap: !!options.watch, // Disable sourcemaps outside watch mode to pass validation
            clean: false, // Handled by npm run clean
            treeshake: true,
            external: external,
            tsconfig: 'tsconfig.json',
            async onSuccess() {
                if (options.minify && (process.env.CI || process.env.GITHUB_ACTIONS)) {
                    console.log('CI environment detected, minifying assets...');
                    const packsDir = path.join(__dirname, 'packs');
                    minifyFiles(packsDir);
                }
            }
        }
    ];
});
