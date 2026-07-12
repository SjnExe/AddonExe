import { $ } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isRelease = args.includes('--release');
const isNightly = args.includes('--nightly');
const isMinify = args.includes('--minify') || isRelease;

let buildNumber = 0;
const buildNumIndex = args.indexOf('--build-number');
if (buildNumIndex !== -1 && buildNumIndex + 1 < args.length) {
    buildNumber = Number.parseInt(args[buildNumIndex + 1], 10);
    if (isNaN(buildNumber)) buildNumber = 0;
}

const pkgPath = path.resolve(__dirname, '../package.json');

async function getVersionParts() {
    const pkg = await Bun.file(pkgPath).json();
    const versionStr = pkg.version || '0.0.1';

    const parts = versionStr.split('.').map(Number);
    let major = parts[0] || 0;
    let minor = parts[1] || 0;
    let patch = parts[2] || 0;

    if (isNaN(major)) major = 0;
    if (isNaN(minor)) minor = 0;
    if (isNaN(patch)) patch = 0;

    let finalParts = [major, minor, patch];
    let finalStr = `${major}.${minor}.${patch}`;

    if (isNightly) {
        finalParts = [major, minor, buildNumber];
        finalStr = `${major}.${minor}.${buildNumber}`;
        console.log(`[Build] Mode: Nightly Build`);
    } else if (isRelease) {
        console.log(`[Build] Mode: Public Release`);
    } else {
        console.log(`[Build] Mode: Local Build`);
    }

    console.log(`[Build] Version Resolved: ${finalStr} -> [${finalParts.join(', ')}]`);
    return { versionStr: finalStr, versionArray: finalParts };
}

export const commandIndexPlugin = {
    name: 'generate-command-index',
    setup(build: import('bun').PluginBuilder) {
        build.onResolve({ filter: /^virtual:command-index$/ }, (args) => {
            return {
                path: args.path,
                namespace: 'virtual-command-index'
            };
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual-command-index' }, async () => {
            console.log('[Plugin] Generating virtual command index...');
            const SRC_DIR = path.resolve(__dirname, '../src');
            const FEATURES_DIR = path.join(SRC_DIR, 'features');

            const featureDirs: string[] = [];
            try {
                const registryTsPath = path.resolve(SRC_DIR, 'core/featureRegistry.ts');
                const content = await Bun.file(registryTsPath).text();
                const regex = /\{\s*id:\s*'([^']+)'/g;
                let match;
                while ((match = regex.exec(content)) !== null) {
                    const featureName = match[1];
                    if (featureName === 'test' && !isNightly) continue;
                    featureDirs.push(featureName);
                }
            } catch (error: any) {
                console.warn(`[Plugin] Error reading featureRegistry.ts: ${error.message}`);
            }

            const commandList: { varName: string; importPath: string }[] = [];

            if (featureDirs.length > 0) {
                await Promise.all(
                    featureDirs.map(async (feature) => {
                        const cmdDir = path.join(FEATURES_DIR, feature, 'commands');
                        try {
                            const entries = await fs.readdir(cmdDir);
                            const files = entries.filter((file) => file.endsWith('.ts') && file !== 'index.ts');

                            for (const file of files) {
                                const baseName = path.basename(file, '.ts');
                                const safeFeature = feature.replaceAll(/[^a-zA-Z0-9]/g, '');
                                const safeFile = baseName.replaceAll(/[^a-zA-Z0-9]/g, '');
                                const varName = `cmd${safeFeature.charAt(0).toUpperCase() + safeFeature.slice(1)}${safeFile.charAt(0).toUpperCase() + safeFile.slice(1)}`;
                                const importPath = `@features/${feature}/commands/${baseName}.js`;

                                commandList.push({
                                    varName,
                                    importPath
                                });
                            }
                        } catch {
                            // Directory might not exist or be unreadable
                        }
                    })
                );
            }

            commandList.sort((a, b) => a.varName.localeCompare(b.varName));
            console.log(`[Plugin] Found ${commandList.length} command files.`);

            const imports = commandList.map((cmd) => `import ${cmd.varName} from '${cmd.importPath}';`).join('\n');
            const list = commandList.map((cmd) => cmd.varName).join(',\n        ');

            const content = `// Auto-generated virtual module
import { isDefined } from '@lib/guards.js';
import { commandManager } from '@core/commands/commandManager.js';

${imports}

export function loadCommands() {
    const commandModules = [
        ${list}
    ];

    for (const mod of commandModules) {
        if (isDefined(mod)) {
            if (Array.isArray(mod)) {
                for (const cmd of mod) commandManager.register(cmd);
            } else {
                commandManager.register(mod);
            }
        }
    }
}
`;
            return {
                contents: content,
                loader: 'ts'
            };
        });
    }
};

async function compileScripts(versionArray: number[], outDirSuffix: string = '') {
    console.log(`[Build] Compiling Scripts...`);

    const coreEntrypoints = ['src/main.ts'];
    const configPaths: { src: string; dest: string }[] = [];
    const srcDir = path.resolve(__dirname, '../src');
    const featuresDir = path.join(srcDir, 'features');
    const outDir = path.resolve(__dirname, `../packs/behavior/scripts${outDirSuffix}`);

    // Map main config path
    configPaths.push({
        src: path.join(srcDir, 'config.ts'),
        dest: path.join(outDir, 'config.js')
    });

    try {
        const featureDirs = await fs.readdir(featuresDir);
        for (const dir of featureDirs) {
            const fullPath = path.join(featuresDir, dir);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                const files = await fs.readdir(fullPath);
                for (const file of files) {
                    if (file.endsWith('Config.ts')) {
                        const outName = file.replace('.ts', '.js');
                        configPaths.push({
                            src: path.join(fullPath, file),
                            dest: path.join(outDir, 'features', dir, outName)
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.warn('[Build] Optional features module sweep skipped or directory unreadable.', error);
    }

    const allConfigEntrypoints = ['src/config.ts'];
    try {
        const featureDirs = await fs.readdir(featuresDir);
        for (const dir of featureDirs) {
            const fullPath = path.join(featuresDir, dir);
            if ((await fs.stat(fullPath)).isDirectory()) {
                const files = await fs.readdir(fullPath);
                for (const file of files) {
                    if (file.endsWith('Config.ts')) allConfigEntrypoints.push(`src/features/${dir}/${file}`);
                }
            }
        }
    } catch {
        console.warn('[Build] Dynamic feature configuration checkpoint skipped.');
    }

    const externalConfigs = ['src/main.ts', ...allConfigEntrypoints].map((ep) => ep.replace('src/', './').replace('.ts', '.js'));
    const externalModules = ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities', '@minecraft/common'];

    // Pass 1: Bundle Core Engine Modules (Optimized & Minified)
    const coreResult = await Bun.build({
        entrypoints: coreEntrypoints,
        outdir: outDir,
        root: './src',
        target: 'browser',
        format: 'esm',
        minify: isMinify,
        sourcemap: isRelease ? 'none' : 'external',
        drop: isRelease ? ['debugger'] : [],
        splitting: false,
        naming: '[dir]/[name].[ext]',
        define: {
            __IS_NIGHTLY__: String(isNightly)
        },
        plugins: [commandIndexPlugin],
        external: [...externalModules, ...externalConfigs]
    });

    if (!coreResult.success) {
        console.error(`[Build] Core script compilation failed:`);
        for (const msg of coreResult.logs) console.error(msg);
        process.exit(1);
    }

    // Pass 2: Stream-Translation Pass for User Configs (Preserves Comments, Spacing, and 10_000 Formats)
    for (const conf of configPaths) {
        try {
            let content = await Bun.file(conf.src).text();

            if (conf.src.endsWith('config.ts')) {
                content = content.replace(/version:\s*\[\s*1\s*,\s*0\s*,\s*0\s*\]/g, `version: [${versionArray.join(', ')}]`);
                if (process.env.IS_BETA_RELEASE === 'true') {
                    content = content.replace(/ownerPlayerNames:\s*\[\s*'Your•Name•Here'\s*\]/g, "ownerPlayerNames: ['SjnTechMlmYT']");
                    content = content.replace(/logLevel:\s*2/g, 'logLevel: 3');
                }
            }

            // Inline translate all nominal registry tokens directly into exact readable string literals
            content = content.replace(/(?:Minecraft[A-Za-z]+Types|ItemComponentTypes|EntityComponentTypes)\.([A-Za-z0-9_]+)/g, (match, prop) => {
                if (prop === 'BowInfinity') return "'minecraft:infinity'";
                if (prop === 'EvocationIllager') return "'minecraft:evocation_illager'";
                if (prop === 'HardenedClay') return "'minecraft:terracotta'";
                if (prop === 'UndyedShulkerBox') return "'minecraft:shulker_box'";

                const snake = prop.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
                return `'minecraft:${snake}'`;
            });

            // Strip out strict TypeScript compilation types cleanly
            content = content.replace(/\s+as\s+number\s*\|\s*undefined/g, '');
            content = content.replace(/import\s*\{[^}]*\}\s*from\s*['"]@minecraft\/vanilla-data['"]\s*;?\n?/g, '');

            await fs.mkdir(path.dirname(conf.dest), { recursive: true });
            await fs.writeFile(conf.dest, content, 'utf8');
        } catch (err: any) {
            console.error(`[Build] Failed to process configuration asset ${conf.src}: ${err.message}`);
            process.exit(1);
        }
    }

    console.log(`[Build] Scripts compiled successfully.`);
}

async function main() {
    console.log('--- Starting Build Pipeline ---');

    const updateArgs = [];
    if (isNightly) updateArgs.push('--nightly');
    if (buildNumber > 0) updateArgs.push('--build-number', String(buildNumber));

    await $`bun scripts/update-manifests.ts ${updateArgs}`;

    const { versionArray } = await getVersionParts();

    await compileScripts(versionArray, '');

    console.log('--- Build Complete ---');

    if (isWatch) {
        console.log('[Watch] Watching for file changes...');
        let buildTimeout: any = null;
        const debounceBuild = () => {
            if (buildTimeout) clearTimeout(buildTimeout);
            buildTimeout = setTimeout(async () => {
                console.log('[Watch] Change detected, rebuilding...');
                try {
                    await compileScripts(versionArray, '');
                    console.log('[Watch] Rebuild complete.');
                } catch (e: any) {
                    console.error(`[Watch] Rebuild failed: ${e.message}`);
                }
            }, 300);
        };

        const watchDir = async (dir: string) => {
            try {
                const watcher = fs.watch(dir, { recursive: true });
                for await (const event of watcher) {
                    if (event.filename && !event.filename.startsWith('packs') && !event.filename.startsWith('.git') && !event.filename.startsWith('node_modules')) {
                        debounceBuild();
                    }
                }
            } catch (err) {
                console.warn(`[Watch] Error watching ${dir}:`, err);
            }
        };

        watchDir(path.resolve(__dirname, '../src'));
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
