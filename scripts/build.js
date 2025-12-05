import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entryPoint = path.join(__dirname, '../src/core/main.ts');
const outfile = path.join(__dirname, '../packs/behavior/scripts/main.js');

// Dependencies that are provided by the game engine and should NOT be bundled
const external = [
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/debug-utilities',
    '@minecraft/diagnostics',
    '@minecraft/common',
    '@minecraft/vanilla-data'
];

const isWatch = process.argv.includes('--watch');

async function build() {
    try {
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
