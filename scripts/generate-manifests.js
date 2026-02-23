import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const packageJsonPath = path.join(__dirname, '../package.json');
const behaviorManifestPath = path.join(__dirname, '../packs/behavior/manifest.json');
const resourceManifestPath = path.join(__dirname, '../packs/resource/manifest.json');

// UUIDs (Static)
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

// Configuration
const CONFIG = {
    minEngineVersion: [1, 21, 50],
    name: 'AddonExe',
    author: 'Sjn.exe',
    capabilities: []
};

async function getPackageJson() {
    try {
        const data = await fs.readFile(packageJsonPath, 'utf8');
        return JSON.parse(data);
    } catch {
        throw new Error('package.json not found');
    }
}

function parseVersion(versionString) {
    if (!versionString) return [0, 0, 1];
    const parts = versionString.split('.').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        console.warn(`Invalid version format: ${versionString}. Defaulting to 0.0.1`);
        return [0, 0, 1];
    }
    return parts;
}

/**
 * Extracts the module version from the NPM version string.
 * e.g., "2.5.0-beta.1.21.132-stable" -> "2.5.0-beta"
 *       "1.0.0" -> "1.0.0"
 */
function extractModuleVersion(npmVersion) {
    if (!npmVersion) return '1.0.0';
    if (npmVersion === 'latest') return 'beta';
    if (npmVersion === 'beta') return 'beta';

    // Strip range characters like ^, ~, >=
    const cleanVersion = npmVersion.replace(/^[^\d]*/, '');

    // Regex to capture x.y.z(-tag)?
    const match = cleanVersion.match(/^(\d+\.\d+\.\d+(?:-(?:beta|rc|preview))?)/);
    if (match) {
        return match[1];
    }
    return cleanVersion;
}

async function generateManifests() {
    const args = process.argv.slice(2);
    const isRelease = args.includes('--release');
    const isNightly = args.includes('--nightly');

    let buildNumber = 0;
    const buildNumIndex = args.indexOf('--build-number');
    if (buildNumIndex !== -1 && buildNumIndex + 1 < args.length) {
        buildNumber = Number.parseInt(args[buildNumIndex + 1], 10);
    }

    const pkg = await getPackageJson();
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

    // Dynamic Dependency Resolution
    const devDeps = pkg.devDependencies || {};
    // Only include specific runtime modules
    const modulesToInclude = [
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/debug-utilities'
    ];

    const dependencies = [];

    for (const mod of modulesToInclude) {
        if (devDeps[mod]) {
            dependencies.push({
                module_name: mod,
                version: extractModuleVersion(devDeps[mod])
            });
        }
    }

    // Always add RP dependency
    dependencies.push({
        uuid: UUIDS.rp.header,
        version: versionParts
    });

    // --- Behavior Pack Manifest ---
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

    // --- Resource Pack Manifest ---
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

    // Write Files
    await fs.writeFile(behaviorManifestPath, JSON.stringify(bpManifest, null, 4));
    console.log(`Generated: ${behaviorManifestPath}`);

    await fs.writeFile(resourceManifestPath, JSON.stringify(rpManifest, null, 4));
    console.log(`Generated: ${resourceManifestPath}`);
}

generateManifests().catch(console.error);
