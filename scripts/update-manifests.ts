import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkgPath = path.resolve(__dirname, '../package.json');

const args = process.argv.slice(2);
const isNightly = args.includes('--nightly');

let buildNumber = 0;
const buildNumIndex = args.indexOf('--build-number');
if (buildNumIndex !== -1 && buildNumIndex + 1 < args.length) {
    buildNumber = Number.parseInt(args[buildNumIndex + 1], 10);
    if (isNaN(buildNumber)) buildNumber = 0;
}

/**
 * Fetches the latest stable version of a package from the npm registry.
 */
async function fetchLatestVersion(pkgName: string): Promise<string> {
    try {
        const response = await fetch(`https://registry.npmjs.org/${pkgName}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data['dist-tags'].latest || '1.0.0';
    } catch (err: any) {
        console.warn(`[Prebuild] Failed to fetch version for ${pkgName} from registry: ${err.message}. Defaulting to 1.0.0.`);
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

    const cleanVersion = npmVersion.replace(/^[^\d]*/, '');
    if (cleanVersion.includes('-beta.') && cleanVersion.includes('-stable')) {
        return 'beta';
    }
    return cleanVersion;
}

async function main() {
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
    }

    console.log(`[Prebuild] Updating manifests to version ${finalStr} -> [${finalParts.join(', ')}]`);

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

    const allDeps = { ...(pkg.devDependencies || {}), ...(pkg.dependencies || {}) };
    const modulesToInclude = [
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/debug-utilities',
        '@minecraft/server-net',
        '@minecraft/server-admin',
        '@minecraft/common'
    ];

    const dependencies: any[] = [];
    const modulePromises = modulesToInclude
        .filter((mod) => allDeps[mod])
        .map(async (mod) => {
            const version = await resolveModuleVersion(mod, allDeps[mod]);
            return {
                module_name: mod,
                version: version
            };
        });

    const resolvedModules = await Promise.all(modulePromises);
    dependencies.push(...resolvedModules, {
        uuid: UUIDS.rp.header,
        version: finalParts
    });

    const minEngineVersion = [1, 21, 50];

    const bpManifest = {
        format_version: 2,
        header: {
            name: `§l§cAddonExe§6 §2BP§r`,
            description: `§aThe core behavior pack for AddonExe. Version §uv${finalStr}§r`,
            uuid: UUIDS.bp.header,
            version: finalParts,
            min_engine_version: minEngineVersion
        },
        modules: [
            {
                description: `Scripting module`,
                type: 'script',
                language: 'javascript',
                uuid: UUIDS.bp.scriptModule,
                version: finalParts,
                entry: 'scripts/main.js'
            },
            {
                description: `Data module`,
                type: 'data',
                uuid: UUIDS.bp.dataModule,
                version: finalParts
            }
        ],
        dependencies: dependencies,
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
            description: `§bThe core resource pack for AddonExe. Version §uv${finalStr}§r`,
            uuid: UUIDS.rp.header,
            version: finalParts,
            min_engine_version: minEngineVersion
        },
        modules: [
            {
                description: `Resources`,
                type: 'resources',
                uuid: UUIDS.rp.module,
                version: finalParts
            }
        ],
        dependencies: [
            {
                uuid: UUIDS.bp.header,
                version: finalParts
            }
        ],
        metadata: {
            authors: ['SjnExe'],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    await fs.writeFile(path.join(__dirname, '../packs/behavior/manifest.json'), JSON.stringify(bpManifest, null, 4));
    await fs.writeFile(path.join(__dirname, '../packs/resource/manifest.json'), JSON.stringify(rpManifest, null, 4));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
