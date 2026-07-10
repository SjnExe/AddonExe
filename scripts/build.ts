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

async function compileScripts(versionArray: number[]) {
    console.log(`[Build] Compiling Scripts...`);

    const entrypoints = ['src/main.ts'];
    const srcDir = path.resolve(__dirname, '../src');
    const featuresDir = path.resolve(srcDir, 'features');

    entrypoints.push('src/config.ts');

    const featureDirs = await fs.readdir(featuresDir);
    for (const dir of featureDirs) {
        const fullPath = path.join(featuresDir, dir);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
            const files = await fs.readdir(fullPath);
            for (const file of files) {
                if (file.endsWith('Config.ts')) {
                    entrypoints.push(`src/features/${dir}/${file}`);
                }
            }
        }
    }

    const externalConfigs = entrypoints.map((ep) => ep.replace('src/', './').replace('.ts', '.js'));
    const outDir = path.resolve(__dirname, `../packs/behavior/scripts`);

    const externalModules = ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities', '@minecraft/common'];

    const result = await Bun.build({
        entrypoints,
        outdir: outDir,
        root: './src',
        target: 'browser',
        format: 'esm',
        minify: isMinify,
        sourcemap: 'external',
        splitting: false,
        naming: '[dir]/[name].[ext]',
        define: {
            __IS_NIGHTLY__: String(isNightly)
        },
        plugins: [
            commandIndexPlugin,
            {
                name: 'config-replacer',
                setup(build) {
                    build.onLoad({ filter: /src[\\/]config\.ts$/ }, async (args) => {
                        let content = await Bun.file(args.path).text();
                        content = content.replace(/version:\s*\[\s*1\s*,\s*0\s*,\s*0\s*\]/g, `version: [${versionArray.join(', ')}]`);

                        if (process.env.IS_BETA_RELEASE === 'true') {
                            content = content.replace(/ownerPlayerNames:\s*\[\s*'Your•Name•Here'\s*\]/g, "ownerPlayerNames: ['SjnTechMlmYT']");
                            content = content.replace(/logLevel:\s*2/g, 'logLevel: 3');
                        }
                        return {
                            contents: content,
                            loader: 'ts'
                        };
                    });
                }
            }
        ],
        external: [...externalModules, ...externalConfigs]
    });

    if (!result.success) {
        console.error(`[Build] Script compilation failed:`);
        for (const msg of result.logs) {
            console.error(msg);
        }
        process.exit(1);
    }
    console.log(`[Build] Scripts compiled successfully.`);
}

async function main() {
    console.log('--- Starting Build Pipeline ---');

    // Ensure manifests are updated
    const updateArgs = [];
    if (isNightly) updateArgs.push('--nightly');
    if (buildNumber > 0) updateArgs.push('--build-number', String(buildNumber));

    await $`bun scripts/update-manifests.ts ${updateArgs}`;

    const { versionArray } = await getVersionParts();

    await compileScripts(versionArray);

    console.log('--- Build Complete ---');

    if (isWatch) {
        console.log('[Watch] Watching for file changes...');
        let buildTimeout: any = null;
        const debounceBuild = () => {
            if (buildTimeout) clearTimeout(buildTimeout);
            buildTimeout = setTimeout(async () => {
                console.log('[Watch] Change detected, rebuilding...');
                try {
                    await compileScripts(versionArray);
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
