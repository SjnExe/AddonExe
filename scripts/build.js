import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.join(__dirname, '../src/core/main.ts');
const outfile = path.join(__dirname, '../packs/behavior/scripts/main.js');
const configsSrcDir = path.join(__dirname, '../src/configs');
const configsDestDir = path.join(__dirname, '../packs/behavior/scripts/configs');

// Dependencies that are provided by the game engine and should NOT be bundled
const external = [
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/debug-utilities',
    '@minecraft/diagnostics',
    '@minecraft/common',
    '@minecraft/vanilla-data',
    './configs/*'
];

const isWatch = process.argv.includes('--watch');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function build() {
    try {
        console.log('Preparing build directory...');
        const outDir = path.dirname(outfile);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        console.log('Copying configs...');
        if (fs.existsSync(configsSrcDir)) {
            copyDir(configsSrcDir, configsDestDir);
        } else {
            console.warn('Warning: src/configs directory not found.');
        }

        console.log('Starting esbuild...');
        const ctx = await esbuild.context({
            entryPoints: [entryPoint],
            outfile: outfile,
            bundle: true,
            format: 'esm',
            target: 'es2020',
            external: external,
            sourcemap: true,
            minify: true,
            treeShaking: true,
            logLevel: 'info',
        });

        if (isWatch) {
            await ctx.watch();
            console.log('Watching for changes...');

            // Watch configs folder
            const watcher = fs.watch(configsSrcDir, (eventType, filename) => {
                if (filename) {
                    console.log(`Config changed: ${filename}, copying...`);
                    copyDir(configsSrcDir, configsDestDir);
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
