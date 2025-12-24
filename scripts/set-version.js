import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const packageJsonPath = path.join(__dirname, '../package.json');
const behaviorTemplatePath = path.join(__dirname, '../packs/behavior/manifest.template.json');
const resourceTemplatePath = path.join(__dirname, '../packs/resource/manifest.template.json');
const behaviorManifestPath = path.join(__dirname, '../packs/behavior/manifest.json');
const resourceManifestPath = path.join(__dirname, '../packs/resource/manifest.json');

function getPackageVersion() {
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

function updateManifest(templatePath, outputPath, versionParts, versionString) {
    if (!fs.existsSync(templatePath)) {
        console.warn(`Template not found: ${templatePath}`);
        return;
    }

    try {
        const content = fs.readFileSync(templatePath, 'utf8');
        const json = JSON.parse(content);

        // Update version in header
        json.header.version = versionParts;

        // Update description version string
        if (json.header.description) {
            json.header.description = json.header.description.replace(/v\d+\.\d+\.\d+/, `v${versionString}`);
        }

        // Update modules version
        if (json.modules) {
            for (const m of json.modules) {
                m.version = versionParts;
            }
        }

        // Update dependencies
        if (json.dependencies) {
            for (const d of json.dependencies) {
                // Assuming the dependency UUID matches the other pack's UUID
                // We update all local dependencies to the new version
                // The UUIDs are:
                // BP Header: 1564bfa3-6796-4b67-826a-03ca1ac2f3c1, Module: 623bbed8-14c8-45c3-893b-c0492855b668
                // RP Header: 9dca0c93-f6ec-4701-a74c-a774600640a4, Module: da4ec34d-3a7a-4b10-bd5d-909810558a51
                // We check against all of them to ensure dependencies are updated correctly.
                const knownUUIDs = [
                    '1564bfa3-6796-4b67-826a-03ca1ac2f3c1', // BP Header
                    '623bbed8-14c8-45c3-893b-c0492855b668', // BP Module
                    '9dca0c93-f6ec-4701-a74c-a774600640a4', // RP Header
                    'da4ec34d-3a7a-4b10-bd5d-909810558a51' // RP Module
                ];

                if (d.uuid && knownUUIDs.includes(d.uuid)) {
                    d.version = versionParts;
                }
            }
        }

        fs.writeFileSync(outputPath, JSON.stringify(json, null, 4));
        console.log(`Generated manifest at ${outputPath} with version ${versionString}`);
    } catch (error) {
        console.error(`Failed to update manifest at ${outputPath}:`, error);
        process.exit(1);
    }
}

function main() {
    const args = process.argv.slice(2);
    const isRelease = args.includes('--release');
    const isNightly = args.includes('--nightly');

    // Parse --build-number <n>
    let buildNumber = 0;
    const buildNumIndex = args.indexOf('--build-number');
    if (buildNumIndex !== -1 && buildNumIndex + 1 < args.length) {
        buildNumber = Number.parseInt(args[buildNumIndex + 1], 10);
        if (Number.isNaN(buildNumber)) {
            console.error('Invalid build number provided.');
            process.exit(1);
        }
    }

    const pkgVersion = getPackageVersion();
    const [major, minor, patch] = parseVersion(pkgVersion);

    let finalVersionParts;
    let finalVersionString;

    if (isRelease) {
        // Public Release: Use package.json version exactly (patch should be 0 per convention, but we respect package.json)
        // User specified: "tag will be "va.b.0" where a and b will same as in package.json(0 is used as the third version number always for public release)."
        // We enforce patch = 0 for public releases to match the tag convention.
        finalVersionParts = [major, minor, 0];
        finalVersionString = `${major}.${minor}.0`;
        console.log(`Mode: Public Release`);
    } else if (isNightly) {
        // Nightly: Major.Minor from package.json, Patch = Build Number
        // "Nightly uses the tag "nightly"... but when package.json updates the version, nightly will reset the increment"
        // Since we use the GitHub Run Number, it auto-increments.
        // Wait, if package.json updates, run number doesn't reset.
        // But the user said: "remembers the last nightly version... but when package.json updates... reset the increment".
        // Using GitHub Run Number is simplest but it doesn't reset on version bump.
        // However, user accepted "PackageVersion.Patch = Tag" (where Tag/BuildNum is the run number).
        // Let's stick to Run Number as the Patch version. It's unique and increasing.
        // If the user wants a reset, we'd need to store state, which is complex.
        // Run Number is safe.
        finalVersionParts = [major, minor, buildNumber];
        finalVersionString = `${major}.${minor}.${buildNumber}`;
        console.log(`Mode: Nightly Build`);
    } else {
        // Local/Default: Use package.json version as is
        finalVersionParts = [major, minor, patch];
        finalVersionString = pkgVersion;
        console.log(`Mode: Local Build`);
    }

    console.log(`Setting version to: ${finalVersionString}`);

    updateManifest(behaviorTemplatePath, behaviorManifestPath, finalVersionParts, finalVersionString);
    updateManifest(resourceTemplatePath, resourceManifestPath, finalVersionParts, finalVersionString);
}

main();
