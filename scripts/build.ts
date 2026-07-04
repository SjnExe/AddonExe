import { $ } from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');

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

// Version Parsing
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
    return { versionStr: finalStr, versionArray: finalParts, pkg };
}

// Helper for minifying text files
function minifyContent(filePath: string, content: string): string {
    if (filePath.endsWith('.json')) {
        try {
            const jsonWithoutComments = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
            return JSON.stringify(JSON.parse(jsonWithoutComments));
        } catch (error: any) {
            console.warn(`[Build] Skipped minification for ${filePath}: ${error.message}`);
            return content;
        }
    } else if (filePath.endsWith('.lang') || filePath.endsWith('.mcfunction')) {
        return content
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'))
            .join('\n');
    }
    return content;
}

/**
 * Fetches the latest stable version of a package from npm.
 * @param pkgName The name of the package.
 * @returns The latest version.
 */
async function fetchLatestVersion(pkgName: string): Promise<string> {
    try {
        console.log(`[Build] Fetching latest version for ${pkgName}...`);
        const output = await $`npm view ${pkgName} version`.text();
        return output.trim();
    } catch (error: any) {
        console.warn(`[Build] Failed to fetch version for ${pkgName}, defaulting to 1.0.0. Error: ${error.message}`);
        return '1.0.0';
    }
}

/**
 * Resolves the module version from the NPM version string.
 */
async function resolveModuleVersion(pkgName: string, npmVersion: string): Promise<string> {
    if (!npmVersion) return '1.0.0';

    if (npmVersion === 'beta') return 'beta';

    if (npmVersion === 'latest') {
        const version = await fetchLatestVersion(pkgName);
        return version;
    }

    // Strip range characters like ^, ~, >= if explicit version provided
    return npmVersion.replace(/^[^\d]*/, '');
}

// Asset Processing
async function processAssets() {
    console.log('[Build] Processing Assets...');
    const srcDir = path.join(__dirname, '../packs');
    const buildDir = path.join(__dirname, '../build');

    async function scanAndProcess(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await scanAndProcess(fullPath);
            } else {
                const relPath = path.relative(srcDir, fullPath);

                // Skip scripts, we use Bun.build for them
                if (relPath.startsWith('behavior/scripts/') || relPath.startsWith('behavior/scripts\\')) {
                    continue;
                }

                // Skip manifests, we generate dynamically
                if (relPath === 'behavior/manifest.json' || relPath === 'behavior\\manifest.json' || relPath === 'resource/manifest.json' || relPath === 'resource\\manifest.json') {
                    continue;
                }

                const destPath = path.join(buildDir, relPath);
                await fs.mkdir(path.dirname(destPath), { recursive: true });

                if (isMinify && (fullPath.endsWith('.json') || fullPath.endsWith('.lang') || fullPath.endsWith('.mcfunction'))) {
                    const content = await Bun.file(fullPath).text();
                    await Bun.write(destPath, minifyContent(fullPath, content));
                } else {
                    await Bun.write(destPath, Bun.file(fullPath));
                }
            }
        }
    }

    await scanAndProcess(srcDir);
}

// Manifest Generation
async function generateManifests(versionArray: number[], versionStr: string, pkg: any) {
    console.log('[Build] Generating Manifests...');

    const UUIDS = {
        bp: {
            header: '1564bfa3-6796-4b67-826a-03ca1ac2f3c1',
            dataModule: '623bbed8-14c8-45c3-893b-c0492855b668',
            scriptModule: 'ecb49e35-ade4-459d-83ff-85c3770c1e74'
        },
        rp: {
            header: '9dca0c93-f6ec-4701-a74c-a774600640a4',
            module: 'da4ec34d-3a7a-4b10-bd5d-909810558a51'
        }
    };

    const devDeps = pkg.devDependencies || {};
    const modulesToInclude = ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities'];

    const dependencies: any[] = [];

    const modulePromises = modulesToInclude
        .filter((mod) => devDeps[mod])
        .map(async (mod) => {
            const version = await resolveModuleVersion(mod, devDeps[mod]);
            return {
                module_name: mod,
                version: version
            };
        });

    const resolvedModules = await Promise.all(modulePromises);
    dependencies.push(...resolvedModules, {
        uuid: UUIDS.rp.header,
        version: versionArray
    });

    const minEngineVersion = [1, 21, 50];

    const bpManifest = {
        format_version: 2,
        header: {
            name: `§l§cAddonExe§6 §2BP§r`,
            description: `§aThe core behavior pack for AddonExe. Version §uv${versionStr}§r`,
            uuid: UUIDS.bp.header,
            version: versionArray,
            min_engine_version: minEngineVersion
        },
        modules: [
            {
                description: `Scripting module`,
                type: 'script',
                language: 'javascript',
                entry: 'scripts/main.js',
                uuid: UUIDS.bp.scriptModule,
                version: versionArray
            }
        ],
        dependencies,
        metadata: {
            authors: ['SjnExe'],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    const rpManifest = {
        format_version: 2,
        header: {
            name: `§l§cAddonExe§6 §9RP§r`,
            description: `§bThe resource pack for AddonExe. Version §uv${versionStr}§r`,
            uuid: UUIDS.rp.header,
            version: versionArray,
            min_engine_version: minEngineVersion
        },
        modules: [
            {
                description: `Resources`,
                type: 'resources',
                uuid: UUIDS.rp.module,
                version: versionArray
            }
        ],
        dependencies: [
            {
                uuid: UUIDS.bp.header,
                version: versionArray
            }
        ],
        metadata: {
            authors: ['SjnExe'],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    const buildDir = path.join(__dirname, '../build');
    await fs.mkdir(path.join(buildDir, 'behavior'), { recursive: true });
    await fs.mkdir(path.join(buildDir, 'resource'), { recursive: true });

    await Bun.write(path.join(buildDir, 'behavior/manifest.json'), JSON.stringify(bpManifest, null, 4));
    await Bun.write(path.join(buildDir, 'resource/manifest.json'), JSON.stringify(rpManifest, null, 4));
}

// Compile TypeScript with Bun
async function compileScripts(versionArray: number[]) {
    console.log('[Build] Compiling Scripts...');

    const entrypoints = ['src/main.ts'];

    // Config files check
    const srcDir = path.resolve(__dirname, '../src');
    const featuresDir = path.resolve(srcDir, 'features');

    // Base config
    entrypoints.push('src/config.ts');

    // Feature configs
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

    const versionArrayStr = `[${versionArray.join(', ')}]`;

    // Compress word pool plugin
    const wordPoolCompressPlugin = {
        name: 'wordpool-compress',
        setup(build: import('bun').PluginBuilder) {
            build.onLoad({ filter: /src[\\/]features[\\/]games[\\/]wordle[\\/]wordPool\.ts$/ }, async (args) => {
                const content = await Bun.file(args.path).text();
                const replaced = content.replace(/(\d+):\s*'([a-z]+)'/g, (match, lenStr, plainWords) => {
                    const wordLen = parseInt(lenStr, 10);
                    const words = [];
                    for (let i = 0; i < plainWords.length; i += wordLen) {
                        words.push(plainWords.substring(i, i + wordLen));
                    }

                    const SOLUTION_LIMIT = 500;
                    const solutions = words.slice(0, SOLUTION_LIMIT).sort();
                    const rest = words.slice(SOLUTION_LIMIT).sort();
                    const combined = [...solutions, ...rest];

                    if (combined.length === 0) return match;

                    let compressed = combined[0];
                    for (let i = 1; i < combined.length; i++) {
                        const prev = combined[i - 1];
                        const curr = combined[i];
                        let shared = 0;
                        while (shared < wordLen && prev[shared] === curr[shared]) {
                            shared++;
                        }
                        compressed += shared.toString(36) + curr.substring(shared);
                    }
                    return `${lenStr}: '${compressed}'`;
                });
                return {
                    contents: replaced,
                    loader: 'ts'
                };
            });
        }
    };

    // Dynamic import interceptor
    const dynamicImportPlugin = {
        name: 'dynamic-import-resolver',
        setup(build: import('bun').PluginBuilder) {
            build.onResolve({ filter: /.*/ }, (args) => {
                if (args.importer && args.path.startsWith('.')) {
                    // This prevents bundler from trying to resolve dynamic string imports at build time if they exist
                }
                return undefined;
            });

            // Text replace version in src/config.ts dynamically
            build.onLoad({ filter: /src[\\/]config\.ts$/ }, async (args) => {
                let content = await Bun.file(args.path).text();
                content = content.replace(/version:\s*\[\s*1\s*,\s*0\s*,\s*0\s*\]/g, `version: ${versionArrayStr}`);

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
    };

    const outDir = path.resolve(__dirname, '../build/behavior/scripts');

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
        plugins: [commandIndexPlugin, dynamicImportPlugin, wordPoolCompressPlugin],
        external: ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities', '@minecraft/common', ...externalConfigs]
    });

    if (!result.success) {
        console.error('[Build] Script compilation failed:');
        for (const msg of result.logs) {
            console.error(msg);
        }
        process.exit(1);
    }
    console.log(`[Build] Scripts compiled successfully.`);
}

async function main() {
    console.log('--- Starting Build Pipeline ---');

    await fs.rm(path.join(__dirname, '../build'), { recursive: true, force: true });

    const { versionStr, versionArray, pkg } = await getVersionParts();

    await processAssets();
    await generateManifests(versionArray, versionStr, pkg);
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
                    await processAssets();
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
                    if (event.filename && !event.filename.startsWith('build') && !event.filename.startsWith('.git') && !event.filename.startsWith('node_modules')) {
                        debounceBuild();
                    }
                }
            } catch (err) {
                console.warn(`[Watch] Error watching ${dir}:`, err);
            }
        };

        // Watch src and packs natively
        watchDir(path.resolve(__dirname, '../src'));
        watchDir(path.resolve(__dirname, '../packs'));
    }
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

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
