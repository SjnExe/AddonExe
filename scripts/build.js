import chokidar from 'chokidar';
import esbuild from 'esbuild';
import { globSync } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.join(__dirname, '../src/core/main.ts');
const outfile = path.join(__dirname, '../packs/behavior/scripts/main.js');
const scriptsDir = path.join(__dirname, '../packs/behavior/scripts');

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify');

// Function to minify files recursively
function minifyFiles(dir) {
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
                // Simple regex for stripping comments (not perfect but often sufficient for MC):
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
                const minifiedLines = lines
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
                fs.writeFileSync(filePath, minifiedLines.join('\n'));
                console.log(`Minified Lang: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        } else if (file.endsWith('.mcfunction')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const minifiedLines = lines
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0 && !line.startsWith('#'));
                fs.writeFileSync(filePath, minifiedLines.join('\n'));
                console.log(`Minified MCFunction: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        }
    }
}

// Automatically discover configuration files
const srcDir = path.join(__dirname, '../src');
const configFiles = globSync(['**/*Config{.ts,.default.ts}', 'config.default.ts'], {
    cwd: srcDir,
    ignore: [
        '**/__tests__/**',
        '**/__mocks__/**',
        'core/configManager*.ts',
        'core/configurations.ts',
        'core/configLoader.ts',
        'features/anticheat/anticheatConfigLoader.ts'
    ]
});

const configsToCompile = configFiles.map((file) => {
    const srcPath = path.join('../src', file);
    // Relative path inside src/ to maintain structure in scripts/
    // e.g. features/games/gamesConfig.default.ts -> features/games/gamesConfig.js
    let destPath = file.replace('.default.ts', '.js').replace('.ts', '.js');

    // Special case for root config.default.ts -> config.js
    if (file === 'config.default.ts') {
        destPath = 'config.js';
    }

    return {
        src: srcPath,
        dest: destPath
    };
});

// Dependencies that are provided by the game engine and should NOT be bundled
// We also exclude the config files so they can be loaded externally
const external = [
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/debug-utilities',
    '@minecraft/diagnostics',
    '@minecraft/common',
    ...configsToCompile.map((c) => `./${c.dest}`)
];

// Simple path alias plugin for esbuild
const pathAliasPlugin = {
    name: 'path-alias',
    setup(build) {
        const aliases = {
            '@core': path.join(srcDir, 'core'),
            '@features': path.join(srcDir, 'features'),
            '@ui': path.join(srcDir, 'core/ui'),
            '@commands': path.join(srcDir, 'core/commands'),
            '@lib': path.join(srcDir, 'lib')
        };

        const keys = Object.keys(aliases);

        build.onResolve({ filter: new RegExp(`^(${keys.join('|')})`) }, (args) => {
            for (const key of keys) {
                if (args.path.startsWith(key)) {
                    const remainder = args.path.slice(key.length);
                    // Handle @lib/guards.js -> /src/lib/guards.ts or .js
                    // Since we are compiling, we want to point to the source file
                    let targetPath = path.join(aliases[key], remainder);

                    // If it ends in .js, try to find the .ts source
                    if (targetPath.endsWith('.js')) {
                        const tsPath = targetPath.replace(/\.js$/, '.ts');
                        if (fs.existsSync(tsPath)) {
                            targetPath = tsPath;
                        }
                    }

                    return { path: targetPath };
                }
            }
            return null;
        });
    }
};

async function compileConfig(configEntry) {
    const defaultSrcPath = path.join(__dirname, configEntry.src);
    let sourcePathToUse = defaultSrcPath;
    let customSrcPath = null;

    if (configEntry.src.endsWith('.default.ts')) {
        customSrcPath = path.join(__dirname, configEntry.src.replace('.default.ts', '.ts'));
    }

    if (customSrcPath && fs.existsSync(customSrcPath)) {
        console.log(`Found custom config: ${path.basename(customSrcPath)}, using it instead of default.`);
        sourcePathToUse = customSrcPath;
    }

    const destPath = path.join(scriptsDir, configEntry.dest);

    try {
        await esbuild.build({
            entryPoints: [sourcePathToUse],
            outfile: destPath,
            bundle: false, // Do not bundle configs
            format: 'esm',
            target: 'es2020',
            sourcemap: false
        });
        console.log(`Compiled config: ${configEntry.dest} (from ${path.basename(sourcePathToUse)})`);
    } catch (error) {
        console.error(`Failed to compile config: ${configEntry.src}`, error);
    }
}

async function build() {
    try {
        console.log('Preparing build directory...');
        const outDir = path.dirname(outfile);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        console.log(`Found ${configsToCompile.length} configuration files.`);
        console.log('Compiling default configuration files...');
        for (const config of configsToCompile) {
            await compileConfig(config);
        }

        console.log('Starting esbuild for main bundle...');
        const ctx = await esbuild.context({
            entryPoints: [entryPoint],
            outfile: outfile,
            bundle: true,
            format: 'esm',
            target: 'es2020',
            external: external,
            sourcemap: true,
            minify: isMinify,
            treeShaking: true,
            logLevel: 'info',
            plugins: [pathAliasPlugin]
        });

        if (isWatch) {
            await ctx.watch();
            console.log('Watching for changes...');

            const configPaths = configsToCompile.map((c) => path.join(__dirname, c.src));
            const customConfigPaths = configsToCompile
                .filter((c) => c.src.endsWith('.default.ts'))
                .map((c) => path.join(__dirname, c.src.replace('.default.ts', '.ts')));

            const watcher = chokidar.watch([...configPaths, ...customConfigPaths], {
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 100,
                    pollInterval: 100
                }
            });

            watcher.on('change', async (filePath) => {
                let configEntry = configsToCompile.find(
                    (c) => path.resolve(__dirname, c.src) === path.resolve(filePath)
                );

                if (!configEntry) {
                    configEntry = configsToCompile.find(
                        (c) =>
                            c.src.endsWith('.default.ts') &&
                            path.resolve(__dirname, c.src.replace('.default.ts', '.ts')) === path.resolve(filePath)
                    );
                }

                if (configEntry) {
                    console.log(`Config changed: ${path.basename(filePath)}, recompiling...`);
                    await compileConfig(configEntry);
                }
            });
        } else {
            await ctx.rebuild();
            await ctx.dispose();
            if (isMinify) {
                console.log('Minifying assets...');
                const packsDir = path.join(__dirname, '../packs');
                minifyFiles(packsDir);
            }
            console.log('Build successful!');
        }
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();
