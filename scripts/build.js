import chokidar from 'chokidar';
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.join(__dirname, '../src/core/main.ts');
const outfile = path.join(__dirname, '../packs/behavior/scripts/main.js');
const scriptsDir = path.join(__dirname, '../packs/behavior/scripts');

// Dependencies that are provided by the game engine and should NOT be bundled
// We also exclude the config files so they can be loaded externally
const external = [
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/debug-utilities',
    '@minecraft/diagnostics',
    '@minecraft/common',
    './config.js',
    './features/kits/kitsConfig.js',
    './core/spawnConfig.js',
    './core/itemsConfig.js',
    './core/sidebarConfig.js',
    './core/xrayConfig.js',
    './core/ranksConfig.js',
    './features/economy/economyConfig.js',
    './features/shop/shopConfig.js',
    './features/teams/teamConfig.js',
    './features/anticheat/anticheatConfig.js',
    './features/auctionHouse/auctionHouseConfig.js',
    './features/dailyRewards/dailyRewardsConfig.js',
    './features/games/gamesConfig.js',
    './features/games/rpsConfig.js',
    './features/games/ticTacToeConfig.js',
    './features/games/wordGuessConfig.js'
];

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

// Map of source file -> destination relative to scripts/
const configsToCompile = [
    { src: '../src/config.default.ts', dest: 'config.js' },
    { src: '../src/features/kits/kitsConfig.default.ts', dest: 'features/kits/kitsConfig.js' },
    { src: '../src/core/spawnConfig.default.ts', dest: 'core/spawnConfig.js' },
    { src: '../src/core/itemsConfig.default.ts', dest: 'core/itemsConfig.js' },
    { src: '../src/core/sidebarConfig.default.ts', dest: 'core/sidebarConfig.js' },
    { src: '../src/core/xrayConfig.default.ts', dest: 'core/xrayConfig.js' },
    { src: '../src/core/ranksConfig.default.ts', dest: 'core/ranksConfig.js' },
    { src: '../src/features/economy/economyConfig.ts', dest: 'features/economy/economyConfig.js' },
    { src: '../src/features/shop/shopConfig.ts', dest: 'features/shop/shopConfig.js' },
    { src: '../src/features/teams/teamConfig.ts', dest: 'features/teams/teamConfig.js' },
    { src: '../src/features/anticheat/anticheatConfig.ts', dest: 'features/anticheat/anticheatConfig.js' },
    {
        src: '../src/features/auctionHouse/auctionHouseConfig.default.ts',
        dest: 'features/auctionHouse/auctionHouseConfig.js'
    },
    {
        src: '../src/features/dailyRewards/dailyRewardsConfig.default.ts',
        dest: 'features/dailyRewards/dailyRewardsConfig.js'
    },
    {
        src: '../src/features/games/gamesConfig.default.ts',
        dest: 'features/games/gamesConfig.js'
    },
    {
        src: '../src/features/games/rpsConfig.default.ts',
        dest: 'features/games/rpsConfig.js'
    },
    {
        src: '../src/features/games/ticTacToeConfig.default.ts',
        dest: 'features/games/ticTacToeConfig.js'
    },
    {
        src: '../src/features/games/wordGuessConfig.default.ts',
        dest: 'features/games/wordGuessConfig.js'
    }
];

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
            logLevel: 'info'
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
                        (c) => c.src.endsWith('.default.ts') && path.resolve(__dirname, c.src.replace('.default.ts', '.ts')) === path.resolve(filePath)
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
