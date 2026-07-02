import fs from 'node:fs/promises';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuration parsing
const args = process.argv.slice(2);
const isRelease = args.includes('--release');
const isNightly = args.includes('--nightly');
const isMinify = args.includes('--minify') || process.env.CI || process.env.GITHUB_ACTIONS;
const isWatch = args.includes('--watch');

let buildNumber = 0;
const buildNumIndex = args.indexOf('--build-number');
if (buildNumIndex !== -1 && buildNumIndex + 1 < args.length) {
    buildNumber = Number.parseInt(args[buildNumIndex + 1], 10);
}

// 2. Clean out build directory
const buildDir = path.resolve(__dirname, '../build');
if (existsSync(buildDir)) {
    rmSync(buildDir, { recursive: true, force: true });
}
mkdirSync(buildDir, { recursive: true });

// 3. Versioning
const packageJsonPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
const pkgVersion = pkg.version || '0.0.1';

function parseVersion(versionString: string): [number, number, number] {
    const parts = versionString.split('.').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
        console.warn(`Invalid version format: ${versionString}. Defaulting to 0.0.1`);
        return [0, 0, 1];
    }
    return parts as [number, number, number];
}

const [major, minor, patch] = parseVersion(pkgVersion);

let versionParts: [number, number, number];
let versionString: string;

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

console.log(`Version: ${versionString} (Array: [${versionParts.join(', ')}])`);

// 4. Manifest Generation
const behaviorManifestPath = path.join(buildDir, 'behavior/manifest.json');
const resourceManifestPath = path.join(buildDir, 'resource/manifest.json');

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

async function resolveModuleVersion(pkgName: string, npmVersion: string) {
    if (!npmVersion) return '1.0.0';
    if (npmVersion === 'beta') return 'beta';
    if (npmVersion === 'latest') {
        try {
            const proc = Bun.spawn(['npm', 'view', pkgName, 'version']);
            const stdout = await new Response(proc.stdout).text();
            return stdout.trim() || '1.0.0';
        } catch {
            return '1.0.0';
        }
    }
    return npmVersion.replace(/^[^\d]*/, '');
}

async function generateManifests() {
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

    mkdirSync(path.dirname(behaviorManifestPath), { recursive: true });
    mkdirSync(path.dirname(resourceManifestPath), { recursive: true });

    await fs.writeFile(behaviorManifestPath, JSON.stringify(bpManifest, null, 4));
    console.log(`Generated: ${behaviorManifestPath}`);

    await fs.writeFile(resourceManifestPath, JSON.stringify(rpManifest, null, 4));
    console.log(`Generated: ${resourceManifestPath}`);
}

await generateManifests();


// 5. Asset Processing
const srcDir = path.resolve(__dirname, '../packs');

function minifyContent(filePath: string, content: string): string {
    if (filePath.endsWith('.json')) {
        try {
            const jsonWithoutComments = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
            const json = JSON.parse(jsonWithoutComments);
            return JSON.stringify(json);
        } catch (error: any) {
            console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            return content;
        }
    } else if (filePath.endsWith('.lang') || filePath.endsWith('.mcfunction')) {
        const lines = content.split('\n');
        const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#') && (!filePath.endsWith('.lang') || !line.startsWith('//')));
        return minifiedLines.join('\n');
    }
    return content;
}

async function processFile(filePath: string) {
    const relPath = path.relative(srcDir, filePath);
    const destPath = path.join(buildDir, relPath);

    // Skip scripts, we will bundle them
    if (relPath.startsWith('behavior/scripts/') || relPath.startsWith('behavior/scripts\\') || relPath.startsWith('behavior/src/')) {
        return;
    }

    // Skip static manifest files since we generate them
    if (relPath === 'behavior/manifest.json' || relPath === 'behavior\\manifest.json' || relPath === 'resource/manifest.json' || relPath === 'resource\\manifest.json') {
        return;
    }

    const destDir = path.dirname(destPath);
    mkdirSync(destDir, { recursive: true });

    if (isMinify && (filePath.endsWith('.json') || filePath.endsWith('.lang') || filePath.endsWith('.mcfunction'))) {
        const content = await fs.readFile(filePath, 'utf8');
        const minified = minifyContent(filePath, content);
        await fs.writeFile(destPath, minified);
    } else {
        await fs.copyFile(filePath, destPath);
    }
}

async function scanAndProcess(dir: string) {
    if (!existsSync(dir)) return;
    const files = await fs.readdir(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            await scanAndProcess(filePath);
        } else {
            await processFile(filePath);
        }
    }
}

console.log('Building assets...');
await scanAndProcess(srcDir);
console.log('Assets build complete!');



// 6. Bun Plugin for Virtual Command Index
const commandIndexPlugin = {
    name: 'generate-command-index',
    setup(builder) {
        builder.onResolve({ filter: /^virtual:command-index$/ }, (args) => {
            return {
                path: 'virtual:command-index',
                namespace: 'virtual-commands'
            };
        });

        builder.onLoad({ filter: /.*/, namespace: 'virtual-commands' }, async (args) => {
            console.log('Generating command index...');

            const SRC_DIR = path.resolve(__dirname, '../src');
            const FEATURES_DIR = path.join(SRC_DIR, 'features');
            const EXCLUSIONS = new Set(['index.ts']);

            const featureDirs = [];
            try {
                const registryTsPath = path.resolve(SRC_DIR, 'core/featureRegistry.ts');
                const content = await fs.readFile(registryTsPath, 'utf8');

                // Match feature IDs from featureRegistry.ts
                const regex = /\{\s*id:\s*'([^']+)'/g;
                let match;
                while ((match = regex.exec(content)) !== null) {
                    featureDirs.push(match[1]);
                }
            } catch (error) {
                console.warn(`Error reading src/core/featureRegistry.ts: ${error.message}`);
            }

            const commandList = [];

            if (featureDirs.length > 0) {
                await Promise.all(
                    featureDirs.map(async (feature) => {
                        const cmdDir = path.join(FEATURES_DIR, feature, 'commands');
                        try {
                            const entries = await fs.readdir(cmdDir);
                            const files = entries.filter((file) => file.endsWith('.ts') && !EXCLUSIONS.has(file));

                            for (const file of files) {
                                const baseName = path.basename(file, '.ts');
                                const safeFeature = feature.replace(/[^a-zA-Z0-9]/g, '');
                                const safeFile = baseName.replace(/[^a-zA-Z0-9]/g, '');
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

            console.log(`Found ${commandList.length} command files.`);

            const imports = commandList.map((cmd) => `import ${cmd.varName} from '${cmd.importPath}';`).join('\n');
            const list = commandList.map((cmd) => cmd.varName).join(',\n        ');

            const contents = `// Auto-generated by Bun plugin
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
                contents,
                loader: 'ts'
            };
        });
    }
};

// 7. Bundle with Bun.build

console.log('Bundling scripts...');

const { globSync } = await import('glob');

const configFiles = globSync('src/**/*Config{.ts,.default.ts}', {
    ignore: ['**/__tests__/**', '**/__mocks__/**', 'src/core/configManager*.ts', 'src/core/configurations.ts', 'src/core/configLoader.ts', 'src/features/anticheat/anticheatConfigLoader.ts']
});
configFiles.push('src/config.default.ts');
if (existsSync('src/config.ts')) configFiles.push('src/config.ts');

const externalModules = [
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/debug-utilities',
    '@minecraft/common',
    ...configFiles.map((file) => {
        let relativePath = file.replace('src/', './').replace('.ts', '.js');
        // The original tsup build probably did this to make them external.
        // Bun needs exactly the requested import string to mark it external.
        if (relativePath.endsWith('.default.js')) {
            relativePath = relativePath.replace('.default.js', '.js');
        }
        return relativePath;
    })
];

const buildOutput = await Bun.build({
    entrypoints: ['src/main.ts', ...configFiles],
    outdir: 'build/behavior/scripts',
    root: 'src',
    target: 'node',
    format: 'esm',
    minify: isMinify,
    sourcemap: isRelease ? 'none' : 'external',
    naming: '[dir]/[name].[ext]',
    external: externalModules,
    plugins: [commandIndexPlugin],
    define: {
        '__INJECTED_VERSION__': JSON.stringify(versionParts),
        '__ADDON_VERSION__': JSON.stringify(versionString)
    }
});

if (!buildOutput.success) {
    console.error('Build failed:');
    for (const message of buildOutput.logs) {
        console.error(message);
    }
    process.exit(1);
}

// Rename compiled config files
async function renameDefaultJs(dir) {
    if (!existsSync(dir)) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await renameDefaultJs(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.default.js')) {
            const newPath = fullPath.replace('.default.js', '.js');
            if (existsSync(newPath)) {
                await fs.rm(fullPath);
                if (existsSync(fullPath + '.map')) await fs.rm(fullPath + '.map');
            } else {
                await fs.rename(fullPath, newPath);
                if (existsSync(fullPath + '.map')) await fs.rename(fullPath + '.map', newPath + '.map');
            }
        }
    }
}

await renameDefaultJs(path.resolve('build/behavior/scripts'));
console.log('Script bundling complete!');

if (isWatch) {
    // Watch source directory for script changes
    const srcDir = path.resolve(__dirname, '../src');
    if (existsSync(srcDir)) {
        (async () => {
            const watcher = fs.watch(srcDir, { recursive: true });
            for await (const event of watcher) {
                if (event.filename && (event.filename.endsWith('.ts') || event.filename.endsWith('.js'))) {
                    console.log(`[Watch] Script changed: ${event.filename}`);

                    // Simple rebuild loop. (A robust one might use child processes or clear require cache)
                    console.log('Rebuilding scripts...');
                    const output = await Bun.build({
                        entrypoints: ['src/main.ts', ...configFiles],
                        outdir: 'build/behavior/scripts',
    root: 'src',
                        target: 'node',
                        format: 'esm',
                        minify: isMinify,
                        sourcemap: isRelease ? 'none' : 'external',
                        naming: '[dir]/[name].[ext]',
                        external: externalModules,
                        plugins: [commandIndexPlugin],
                        define: {
                            '__INJECTED_VERSION__': JSON.stringify(versionParts),
                            '__ADDON_VERSION__': JSON.stringify(versionString)
                        }
                    });

                    if (output.success) {
                        await renameDefaultJs(path.resolve("build/behavior/scripts"));
                        console.log('Script rebuilding complete!');
                    } else {
                        console.error('Script rebuild failed!');
                        for (const message of output.logs) {
                            console.error(message);
                        }
                    }
                }
            }
        })();
    }
}
