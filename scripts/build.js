import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

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
    './core/kitsConfig.js',
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
    './features/dailyRewards/dailyRewardsConfig.js'
];

const isWatch = process.argv.includes('--watch');

// Map of source file -> destination relative to scripts/
const configsToCompile = [
    { src: '../src/config.default.ts', dest: 'config.js' },
    { src: '../src/core/kitsConfig.default.ts', dest: 'core/kitsConfig.js' },
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
    }
];

async function compileConfig(configEntry) {
    const srcPath = path.join(__dirname, configEntry.src);
    const destPath = path.join(scriptsDir, configEntry.dest);

    try {
        await esbuild.build({
            entryPoints: [srcPath],
            outfile: destPath,
            bundle: false, // Do not bundle configs
            format: 'esm',
            target: 'es2020',
            sourcemap: false
        });
        console.log(`Compiled config: ${configEntry.dest}`);
    } catch (e) {
        console.error(`Failed to compile config: ${configEntry.src}`, e);
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
            minify: false,
            treeShaking: true,
            logLevel: 'info'
        });

        if (isWatch) {
            await ctx.watch();
            console.log('Watching for changes...');

            // Watch config files using chokidar for better performance
            const configPaths = configsToCompile.map((c) => path.join(__dirname, c.src));
            const watcher = chokidar.watch(configPaths, {
                ignoreInitial: true,
                awaitWriteFinish: {
                    stabilityThreshold: 100,
                    pollInterval: 100
                }
            });

            watcher.on('change', async (filePath) => {
                // Find which config entry matches
                const configEntry = configsToCompile.find((c) => path.resolve(__dirname, c.src) === path.resolve(filePath));
                if (configEntry) {
                    console.log(`Config changed: ${configEntry.src}, recompiling...`);
                    await compileConfig(configEntry);
                }
            });
        } else {
            await ctx.rebuild();
            await ctx.dispose();
            console.log('Build successful!');
        }
    } catch (e) {
        console.error('Build failed:', e);
        process.exit(1);
    }
}

build();
