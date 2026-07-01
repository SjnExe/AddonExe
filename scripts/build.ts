import { Glob } from 'bun';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify') || process.env.CI || process.env.GITHUB_ACTIONS;
const isRelease = process.argv.includes('--release');
const isNightly = process.argv.includes('--nightly');

let buildNumber = 0;
const buildNumIndex = process.argv.indexOf('--build-number');
if (buildNumIndex !== -1 && buildNumIndex + 1 < process.argv.length) {
    buildNumber = Number.parseInt(process.argv[buildNumIndex + 1], 10);
}

const buildDir = path.join(__dirname, '../build');
const srcDir = path.join(__dirname, '../packs');

// --- 1. Clean ---
async function clean() {
    console.log('Cleaning build directory...');
    await fsPromises.rm(buildDir, { recursive: true, force: true });
    await fsPromises.rm(path.join(__dirname, '../out'), { recursive: true, force: true });
    console.log('Clean complete.');
}

// --- 2. Manifest Generation ---
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

const CONFIG = {
    minEngineVersion: [1, 21, 50],
    name: 'AddonExe',
    author: 'Sjn.exe',
    capabilities: []
};

function parseVersion(versionString: string) {
    if (!versionString) return [0, 0, 1];
    const parts = versionString.split('.').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        console.warn(`Invalid version format: ${versionString}. Defaulting to 0.0.1`);
        return [0, 0, 1];
    }
    return parts;
}

async function fetchLatestVersion(pkgName: string) {
    try {
        const proc = Bun.spawn(['npm', 'view', pkgName, 'version']);
        const text = await new Response(proc.stdout).text();
        return text.trim();
    } catch (error) {
        console.warn(`Failed to fetch version for ${pkgName}, defaulting to 1.0.0.`);
        return '1.0.0';
    }
}

async function resolveModuleVersion(pkgName: string, npmVersion: string) {
    if (!npmVersion) return '1.0.0';
    if (npmVersion === 'beta') return 'beta';
    if (npmVersion === 'latest') return await fetchLatestVersion(pkgName);
    return npmVersion.replace(/^[^\d]*/, '');
}

async function generateManifests() {
    const pkg = await Bun.file(path.join(__dirname, '../package.json')).json();
    const pkgVersion = pkg.version;
    const [major, minor, patch] = parseVersion(pkgVersion);

    let versionParts;
    let versionString;

    if (isRelease) {
        versionParts = [major, minor, patch];
        versionString = `${major}.${minor}.${patch}`;
        console.log('Mode: Public Release');
    } else if (isNightly) {
        versionParts = [major, minor, buildNumber];
        versionString = `${major}.${minor}.${buildNumber}`;
        console.log('Mode: Nightly Build');
    } else {
        versionParts = [major, minor, patch];
        versionString = pkgVersion;
        console.log('Mode: Local Build');
    }

    console.log(`Generating manifests with version: ${versionString}`);

    const devDeps = pkg.devDependencies || {};
    const modulesToInclude = ['@minecraft/server', '@minecraft/server-ui', '@minecraft/server-gametest', '@minecraft/debug-utilities'];

    const dependencies = [];
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
        version: versionParts
    });

    const bpManifest = {
        format_version: 2,
        header: {
            name: `§l§c${CONFIG.name}§6 §2BP§r`,
            description: `§aThe core behavior pack for ${CONFIG.name}. Version §uv${versionString}§r`,
            uuid: UUIDS.bp.header,
            version: versionParts,
            min_engine_version: CONFIG.minEngineVersion
        },
        modules: [
            {
                description: `Scripting module`,
                type: 'script',
                language: 'javascript',
                entry: 'scripts/main.js',
                uuid: UUIDS.bp.scriptModule,
                version: versionParts
            }
        ],
        dependencies: dependencies,
        metadata: {
            authors: [`${CONFIG.author}`],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    const rpManifest = {
        format_version: 2,
        header: {
            name: `§l§c${CONFIG.name}§6 §9RP§r`,
            description: `§bThe resource pack for ${CONFIG.name}. Version §uv${versionString}§r`,
            uuid: UUIDS.rp.header,
            version: versionParts,
            min_engine_version: CONFIG.minEngineVersion
        },
        modules: [
            {
                description: `Resources`,
                type: 'resources',
                uuid: UUIDS.rp.module,
                version: versionParts
            }
        ],
        dependencies: [
            {
                uuid: UUIDS.bp.header,
                version: versionParts
            }
        ],
        metadata: {
            authors: [`${CONFIG.author}`],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    const behaviorManifestPath = path.join(buildDir, 'behavior/manifest.json');
    const resourceManifestPath = path.join(buildDir, 'resource/manifest.json');

    await fsPromises.mkdir(path.dirname(behaviorManifestPath), { recursive: true });
    await fsPromises.mkdir(path.dirname(resourceManifestPath), { recursive: true });

    await fsPromises.writeFile(behaviorManifestPath, JSON.stringify(bpManifest, null, 4));
    await fsPromises.writeFile(resourceManifestPath, JSON.stringify(rpManifest, null, 4));
    console.log('Manifests generated.');
}

// --- 3. Asset Processing ---
function minifyContent(filePath: string, content: string) {
    if (filePath.endsWith('.json')) {
        try {
            const jsonWithoutComments = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
            const json = JSON.parse(jsonWithoutComments);
            return JSON.stringify(json);
        } catch (error) {
            console.warn(`Skipped minification for ${filePath}: ${(error as Error).message}`);
            return content;
        }
    } else if (filePath.endsWith('.lang')) {
        const lines = content.split('\n');
        const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
        return minifiedLines.join('\n');
    } else if (filePath.endsWith('.mcfunction')) {
        const lines = content.split('\n');
        const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#'));
        return minifiedLines.join('\n');
    }
    return content;
}

function processAsset(filePath: string) {
    const relPath = path.relative(srcDir, filePath);
    const destPath = path.join(buildDir, relPath);

    if (relPath.startsWith('behavior/scripts/') || relPath.startsWith('behavior\\scripts\\')) return;
    if (relPath === 'behavior/manifest.json' || relPath === 'behavior\\manifest.json' || relPath === 'resource/manifest.json' || relPath === 'resource\\manifest.json') return;

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    if (isMinify && (filePath.endsWith('.json') || filePath.endsWith('.lang') || filePath.endsWith('.mcfunction'))) {
        const content = fs.readFileSync(filePath, 'utf8');
        const minified = minifyContent(filePath, content);
        fs.writeFileSync(destPath, minified);
    } else {
        fs.copyFileSync(filePath, destPath);
    }
}

async function buildAssets() {
    console.log('Building all assets...');
    const glob = new Glob('**/*');
    for await (const file of glob.scan({ cwd: srcDir })) {
        const filePath = path.join(srcDir, file);
        if (fs.statSync(filePath).isFile()) {
            processAsset(filePath);
        }
    }
    console.log('Assets build complete.');
}

// --- 4. Bundling Scripts ---
const commandIndexPlugin = {
    name: 'generate-command-index',
    setup(build: import('bun').PluginBuilder) {
        build.onLoad({ filter: /src[\\/]core[\\/]commands[\\/]index\.ts$/ }, async () => {
            console.log('Generating command index...');
            const SRC_DIR = path.resolve('src');
            const FEATURES_DIR = path.join(SRC_DIR, 'features');
            const EXCLUSIONS = new Set(['index.ts']);

            const featureDirs: string[] = [];
            try {
                const registryTsPath = path.resolve('src/core/featureRegistry.ts');
                const content = await fsPromises.readFile(registryTsPath, 'utf8');
                const regex = /\{\s*id:\s*'([^']+)'/g;
                let match;
                while ((match = regex.exec(content)) !== null) {
                    featureDirs.push(match[1]);
                }
            } catch (error) {
                console.warn(`Error reading src/core/featureRegistry.ts: ${(error as Error).message}.`);
            }

            const commandList: { varName: string; importPath: string }[] = [];

            if (featureDirs.length > 0) {
                await Promise.all(
                    featureDirs.map(async (feature) => {
                        const cmdDir = path.join(FEATURES_DIR, feature, 'commands');
                        try {
                            const entries = await fsPromises.readdir(cmdDir);
                            const files = entries.filter((file) => file.endsWith('.ts') && !EXCLUSIONS.has(file));

                            for (const file of files) {
                                const baseName = path.basename(file, '.ts');
                                const safeFeature = feature.replaceAll(/[^a-zA-Z0-9]/g, '');
                                const safeFile = baseName.replaceAll(/[^a-zA-Z0-9]/g, '');
                                const varName = `cmd${safeFeature.charAt(0).toUpperCase() + safeFeature.slice(1)}${safeFile.charAt(0).toUpperCase() + safeFile.slice(1)}`;
                                const importPath = `@features/${feature}/commands/${baseName}.ts`; // Use .ts for Bun bundler

                                commandList.push({ varName, importPath });
                            }
                        } catch {
                            // ignore
                        }
                    })
                );
            }

            commandList.sort((a, b) => a.varName.localeCompare(b.varName));
            console.log(`Found ${commandList.length} command files.`);

            const imports = commandList.map((cmd) => `import ${cmd.varName} from '${cmd.importPath}';`).join('\n');
            const list = commandList.map((cmd) => cmd.varName).join(',\n        ');

            const content = `// Auto-generated
import { isDefined } from '@lib/guards.js';
import { commandManager } from './commandManager.js';

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
            return { contents: content, loader: 'ts' };
        });
    }
};

async function bundleScripts() {
    console.log('Bundling scripts...');

    // Find config files
    const configFiles: string[] = [];
    const glob = new Glob('src/**/*Config.ts');
    const ignores = ['**/__tests__/**', '**/__mocks__/**', 'src/core/configManager*.ts', 'src/core/configurations.ts', 'src/core/configLoader.ts', 'src/features/anticheat/anticheatConfigLoader.ts'];

    for await (const file of glob.scan({ cwd: process.cwd() })) {
        const fullPath = file;
        const normalizedPath = fullPath.replace(/\\/g, '/');
        const isIgnored = ignores.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
            return regex.test(normalizedPath);
        });

        if (!isIgnored) {
            configFiles.push(fullPath);
        }
    }
    configFiles.push('src/config.ts');

    // Fix Windows pathing bug
    const entrypoints = ['src/main.ts', ...configFiles];

    const external = [
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/debug-utilities',
        '@minecraft/common',
        ...configFiles.map((file) => {
            // Ensure paths use forward slash for external mapping
            const forwardSlashFile = file.replace(/\\/g, '/');
            return forwardSlashFile.replace('src/', './').replace('.ts', '.js');
        })
    ];

    const result = await Bun.build({
        entrypoints,
        outdir: path.join(buildDir, 'behavior/scripts'),
        target: 'browser', // For JS execution environment like Minecraft
        format: 'esm',
        minify: isMinify,
        sourcemap: 'external',
        external,
        naming: '[dir]/[name].[ext]', root: './src', plugins: [commandIndexPlugin]
    });

    if (!result.success) {
        console.error('Build failed');
        for (const message of result.logs) {
            console.error(message);
        }
        if (!isWatch) process.exit(1);
    }

    console.log('Scripts bundled.');
}

// --- 5. Watcher ---
let assetsWatchTimeout: Timer | null = null;
let scriptsWatchTimeout: Timer | null = null;

const IN_FLIGHT_ASSETS = new Set<string>();

function handleAssetsWatchEvent(filename: string | null) {
    if (filename) IN_FLIGHT_ASSETS.add(filename);

    if (assetsWatchTimeout) clearTimeout(assetsWatchTimeout);
    assetsWatchTimeout = setTimeout(async () => {
        try {
            if (IN_FLIGHT_ASSETS.size > 0) {
                // Batch process specific files incrementally
                for (const f of IN_FLIGHT_ASSETS) {
                    console.log(`\nAsset changed: ${f}, processing incrementally...`);
                    const fullPath = path.join(srcDir, f);
                    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                        processAsset(fullPath);
                    } else {
                        // File was deleted
                        const relPath = path.relative(srcDir, fullPath);
                        const destPath = path.join(buildDir, relPath);
                        if (fs.existsSync(destPath)) {
                            fs.rmSync(destPath, { force: true });
                            console.log(`Deleted from build: ${relPath}`);
                        }
                    }
                }
                IN_FLIGHT_ASSETS.clear();
            } else {
                console.log('\nAsset change detected, rebuilding all assets...');
                await buildAssets();
            }
        } catch (e) {
            console.error('Asset incremental build failed:', e);
            IN_FLIGHT_ASSETS.clear();
        }
    }, 100);
}

function handleScriptsWatchEvent() {
    if (scriptsWatchTimeout) clearTimeout(scriptsWatchTimeout);
    scriptsWatchTimeout = setTimeout(async () => {
        console.log('\nScript change detected, bundling...');
        try {
            await bundleScripts();
        } catch (e) {
            console.error('Script bundle failed:', e);
        }
    }, 100);
}

async function start() {
    await clean();
    await generateManifests();
    await buildAssets();
    await bundleScripts();

    if (isWatch) {
        console.log('\nWatching for changes...');

        // Spawn type checking in parallel
        console.log('Starting type checker...');
        Bun.spawn(['bun', 'run', 'check-types', '--watch'], {
            stdout: 'inherit',
            stderr: 'inherit'
        });

        const watcherOpts = { recursive: true };

        // Watch packs (assets) - trigger incremental build
        fs.watch(srcDir, watcherOpts, (event, filename) => {
            if (filename && !filename.includes('behavior/scripts') && !filename.includes('behavior\\scripts')) {
                handleAssetsWatchEvent(filename);
            }
        });

        // Watch src (scripts) - trigger bundleScripts
        fs.watch(path.join(__dirname, '../src'), watcherOpts, (event, filename) => {
            if (filename) handleScriptsWatchEvent();
        });

        // Watch package.json - trigger generateManifests
        fs.watch(path.join(__dirname, '../package.json'), (event) => {
            console.log('\npackage.json changed, regenerating manifests...');
            generateManifests().catch(console.error);
        });
    } else {
        console.log('\nBuild completed successfully!');
    }
}

start().catch(console.error);
