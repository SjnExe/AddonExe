import { $ } from 'bun';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getVersionContext, parseCliArgs } from './cli-utils.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');

const cliArgs = parseCliArgs(process.argv.slice(2));
const { isWatch, isRelease, isNightly, isZip, isMinify, buildNumber, customVersion } = cliArgs;

async function getVersionParts() {
    return getVersionContext(ROOT_DIR, {
        customVersion,
        isNightly,
        buildNumber,
        isRelease
    });
}

export const iconIndexPlugin = {
    name: 'generate-icon-index',
    setup(build: import('bun').PluginBuilder) {
        build.onResolve({ filter: /^virtual:icon-index$/ }, (args) => {
            return {
                path: args.path,
                namespace: 'virtual-icon-index'
            };
        });

        build.onLoad({ filter: /.*/, namespace: 'virtual-icon-index' }, async () => {
            console.log('[Plugin] Generating virtual icon index...');
            const SRC_DIR = path.resolve(ROOT_DIR, 'src');

            const globScanner = new Bun.Glob('**/*.ts');
            const tsFiles = Array.from(globScanner.scanSync({ cwd: SRC_DIR, absolute: true }));
            const textures = new Set<string>();
            const regex = /'((?:textures\/)[^']+)'|"((?:textures\/)[^"]+)"|`((?:textures\/)[^`]+)`/g;

            for (const file of tsFiles) {
                if (file.includes('virtual:icon-index')) {
                    continue;
                }

                try {
                    const content = await Bun.file(file).text();
                    let match;
                    while ((match = regex.exec(content)) !== null) {
                        const iconPath = match[1] || match[2] || match[3];
                        if (iconPath) {
                            textures.add(iconPath);
                        }
                    }
                } catch {
                    // Ignore read errors
                }
            }

            const iconList = Array.from(textures);
            console.log(`[Plugin] Found ${iconList.length} unique icon paths.`);

            return {
                contents: `export const usedIcons = ${JSON.stringify(iconList)};`,
                loader: 'ts'
            };
        });
    }
};

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
            const SRC_DIR = path.resolve(ROOT_DIR, 'src');
            const FEATURES_DIR = path.join(SRC_DIR, 'features');

            const cmdGlob = new Bun.Glob('**/commands/*.ts');
            const scannedFiles = Array.from(cmdGlob.scanSync({ cwd: FEATURES_DIR, absolute: false }));
            const commandList: { varName: string; importPath: string }[] = [];

            for (const relPath of scannedFiles) {
                const normalized = relPath.replace(/\\/g, '/');
                if (normalized.endsWith('/index.ts') || normalized.includes('__tests__')) {
                    continue;
                }
                if (normalized.startsWith('test/') && !isNightly) {
                    continue;
                }

                const noExt = normalized.replace(/\.ts$/, '');
                const segments = noExt
                    .split('/')
                    .filter((seg) => seg !== 'commands')
                    .map((seg) => seg.replaceAll(/[^a-zA-Z0-9]/g, ''))
                    .filter(Boolean);

                const varName = 'cmd' + segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
                const importPath = `@features/${noExt}.js`;

                commandList.push({ varName, importPath });
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

async function collectPackFiles(sourceDir: string, excludeExts = ['.map']): Promise<Map<string, string | ArrayBuffer>> {
    const entries = new Map<string, string | ArrayBuffer>();
    const glob = new Bun.Glob('**/*');
    const files = Array.from(glob.scanSync({ cwd: sourceDir, absolute: false, dot: true, onlyFiles: true }));

    await Promise.all(
        files.map(async (relPath) => {
            if (excludeExts.some((ext) => relPath.endsWith(ext))) {
                return;
            }
            const fullPath = path.join(sourceDir, relPath);
            const normalizedPath = relPath.replace(/\\/g, '/');

            if (relPath.endsWith('.json')) {
                try {
                    const rawJsonText = await Bun.file(fullPath).text();
                    entries.set(normalizedPath, JSON.stringify(JSON.parse(rawJsonText)));
                    return;
                } catch {
                    // Fall back to raw content if JSON parsing fails
                }
            }

            entries.set(normalizedPath, await Bun.file(fullPath).arrayBuffer());
        })
    );

    return entries;
}

function populateZipFromEntries(entries: Map<string, string | ArrayBuffer>, zip: JSZip, zipPrefix = '') {
    for (const [relPath, content] of entries) {
        const zipPath = zipPrefix ? `${zipPrefix}/${relPath}` : relPath;
        zip.file(zipPath, content);
    }
}

async function createArchives(prefix: string, versionStr: string) {
    console.log(`[Build] Creating release archives (${prefix}.${versionStr})...`);

    const packsDir = path.resolve(ROOT_DIR, 'packs');
    const behaviorDir = path.join(packsDir, 'behavior');
    const resourceDir = path.join(packsDir, 'resource');

    const [bpEntries, rpEntries] = await Promise.all([collectPackFiles(behaviorDir), collectPackFiles(resourceDir)]);

    const mcaddonZip = new JSZip();
    populateZipFromEntries(bpEntries, mcaddonZip, 'behavior');
    populateZipFromEntries(rpEntries, mcaddonZip, 'resource');

    const bpZip = new JSZip();
    populateZipFromEntries(bpEntries, bpZip);

    const rpZip = new JSZip();
    populateZipFromEntries(rpEntries, rpZip);

    const zipOptions: JSZip.JSZipGeneratorOptions<'uint8array'> = {
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    };

    const mcaddonPath = path.resolve(ROOT_DIR, `AddonExe.${prefix}.${versionStr}.mcaddon`);
    const bpPath = path.resolve(ROOT_DIR, `AddonExe_BP.${prefix}.${versionStr}.mcpack`);
    const rpPath = path.resolve(ROOT_DIR, `AddonExe_RP.${prefix}.${versionStr}.mcpack`);

    const [mcaddonData, bpData, rpData] = await Promise.all([mcaddonZip.generateAsync(zipOptions), bpZip.generateAsync(zipOptions), rpZip.generateAsync(zipOptions)]);

    await Promise.all([Bun.write(mcaddonPath, mcaddonData), Bun.write(bpPath, bpData), Bun.write(rpPath, rpData)]);

    console.log(`[Build] Archives generated successfully:`);
    console.log(`  - ${path.basename(mcaddonPath)}`);
    console.log(`  - ${path.basename(bpPath)}`);
    console.log(`  - ${path.basename(rpPath)}`);
}

async function compileScripts(_versionArray: number[], versionStr: string, outDirSuffix: string = '') {
    console.log(`[Build] Compiling Scripts...`);

    const coreEntrypoints = ['src/main.ts'];
    const outDir = path.resolve(ROOT_DIR, `packs/behavior/scripts${outDirSuffix}`);

    const externalModules = ['@minecraft/server', '@minecraft/server-ui'];

    // Bundle Core Engine Module into main.js
    const coreResult = await Bun.build({
        entrypoints: coreEntrypoints,
        outdir: outDir,
        root: './src',
        target: 'browser',
        format: 'esm',
        minify: isMinify,
        sourcemap: process.argv.includes('--sourcemap') || cliArgs.sourcemap ? 'external' : 'none',
        drop: isRelease ? ['debugger'] : [],
        splitting: false,
        naming: '[dir]/[name].[ext]',
        define: {
            __IS_NIGHTLY__: String(isNightly),
            __VERSION__: JSON.stringify(versionStr)
        },
        plugins: [commandIndexPlugin, iconIndexPlugin],
        external: externalModules
    });

    if (!coreResult.success) {
        console.error(`[Build] Core script compilation failed:`);
        for (const msg of coreResult.logs) {
            console.error(msg);
        }
        process.exit(1);
    }

    console.log(`[Build] Scripts compiled successfully.`);
}

async function main() {
    console.log('--- Starting Build Pipeline ---');

    const updateArgs: string[] = [];
    if (isNightly) {
        updateArgs.push('-n');
    }
    if (isRelease) {
        updateArgs.push('-r');
    }
    if (buildNumber > 0) {
        updateArgs.push('-b', String(buildNumber));
    }
    if (customVersion) {
        updateArgs.push('-v', customVersion);
    }

    await $`bun scripts/build/update-manifests.ts ${updateArgs}`;

    const { versionStr, versionArray } = await getVersionParts();

    if (isNightly) {
        console.log('[Build] Mode: Nightly Build');
    } else if (isRelease) {
        console.log('[Build] Mode: Public Release');
    } else {
        console.log('[Build] Mode: Local Build');
    }
    console.log(`[Build] Version Resolved: ${versionStr} -> [${versionArray.join(', ')}]`);

    await compileScripts(versionArray, versionStr, '');

    if (isZip) {
        const prefix = isRelease ? 'Release' : isNightly ? 'Nightly' : 'Local';
        await createArchives(prefix, versionStr);
    }

    const buildMetaContent = [
        `BUILD_TYPE=${isRelease ? 'stable' : isNightly ? 'nightly' : 'local'}`,
        `ARCHIVE_VERSION=${versionStr}`,
        `VERSION_STRING=${versionStr}`,
        `BUILD_DATE=${new Date().toUTCString()}`,
        `PREFIX=${isRelease ? 'Release' : isNightly ? 'Nightly' : 'Local'}`
    ].join('\n');
    await Bun.write(path.resolve(ROOT_DIR, 'build_meta.env'), buildMetaContent);

    console.log('--- Build Complete ---');

    if (isWatch) {
        console.log('[Watch] Watching for file changes...');
        let buildTimeout: any = null;
        const debounceBuild = () => {
            if (buildTimeout) {
                clearTimeout(buildTimeout);
            }
            buildTimeout = setTimeout(async () => {
                console.log('[Watch] Change detected, rebuilding...');
                try {
                    await compileScripts(versionArray, versionStr, '');
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

        watchDir(path.resolve(ROOT_DIR, 'src'));
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
