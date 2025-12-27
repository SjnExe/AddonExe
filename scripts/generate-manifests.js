import fs from 'node:fs';
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
    minEngineVersion: [1, 21, 130],
    name: 'AddonExe',
    author: 'Sjn.exe',
    capabilities: ['pbr', 'raytraced'] // For Deferred Graphics
};

function getPackageVersion() {
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return pkg.version;
}

function parseVersion(versionString) {
    const parts = versionString.split('.').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
        throw new Error(`Invalid version format in package.json: ${versionString}`);
    }
    return parts;
}

function generateManifests() {
    const args = process.argv.slice(2);
    const isRelease = args.includes('--release');
    const isNightly = args.includes('--nightly');

    // Parse --build-number <n>
    let buildNumber = 0;
    const buildNumIndex = args.indexOf('--build-number');
    if (buildNumIndex !== -1 && buildNumIndex + 1 < args.length) {
        buildNumber = Number.parseInt(args[buildNumIndex + 1], 10);
    }

    const pkgVersion = getPackageVersion();
    const [major, minor, patch] = parseVersion(pkgVersion);

    let versionParts;
    let versionString;

    if (isRelease) {
        versionParts = [major, minor, 0];
        versionString = `${major}.${minor}.0`;
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

    // --- Behavior Pack Manifest ---
    const bpManifest = {
        format_version: 2,
        header: {
            name: `§l§c${CONFIG.name}§6 §2BP§r`,
            description: `§aThe core behavior pack for ${CONFIG.name}, a powerful server management and moderation tool. By ${CONFIG.author}. Version §uv${versionString}§r`,
            uuid: UUIDS.bp.header,
            version: versionParts,
            min_engine_version: CONFIG.minEngineVersion,
            capabilities: CONFIG.capabilities
        },
        modules: [
            {
                description: `Core data and functions for ${CONFIG.name}.`,
                type: 'data',
                uuid: UUIDS.bp.dataModule,
                version: versionParts
            },
            {
                description: `Main scripting engine for ${CONFIG.name}'s features.`,
                type: 'script',
                language: 'javascript',
                entry: 'scripts/main.js',
                uuid: UUIDS.bp.scriptModule,
                version: versionParts
            }
        ],
        dependencies: [
            {
                module_name: '@minecraft/server',
                version: 'beta'
            },
            {
                module_name: '@minecraft/server-ui',
                version: 'beta'
            },
            {
                module_name: '@minecraft/diagnostics',
                version: 'beta'
            },
            {
                uuid: UUIDS.rp.header,
                version: versionParts
            }
        ],
        metadata: {
            authors: [`§6${CONFIG.author}§r`],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    // --- Resource Pack Manifest ---
    const rpManifest = {
        format_version: 2,
        header: {
            name: `§l§c${CONFIG.name}§6 §9RP§r`,
            description: `§bThe resource pack for ${CONFIG.name}. Provides textures and UI elements. By ${CONFIG.author}. Version §uv${versionString}§r`,
            uuid: UUIDS.rp.header,
            version: versionParts,
            min_engine_version: CONFIG.minEngineVersion,
            capabilities: CONFIG.capabilities
        },
        modules: [
            {
                description: `Resources for ${CONFIG.name}.`,
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
            authors: [`§6${CONFIG.author}§r`],
            license: 'MIT',
            url: 'https://github.com/SjnExe/AddonExe'
        }
    };

    // Write Files
    fs.writeFileSync(behaviorManifestPath, JSON.stringify(bpManifest, null, 4));
    console.log(`Generated: ${behaviorManifestPath}`);

    fs.writeFileSync(resourceManifestPath, JSON.stringify(rpManifest, null, 4));
    console.log(`Generated: ${resourceManifestPath}`);
}

generateManifests();
