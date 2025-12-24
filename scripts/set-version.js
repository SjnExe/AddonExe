import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const packageJsonPath = path.join(__dirname, '../package.json');

function getGitCommitCount() {
    try {
        const count = execSync('git rev-list --count HEAD').toString().trim();
        return Number.parseInt(count, 10);
    } catch {
        console.warn('Failed to get git commit count, defaulting to 0');
        return 0;
    }
}

function updateManifest(versionString) {
    const behaviorManifestPath = path.join(__dirname, '../packs/behavior/manifest.json');
    const resourceManifestPath = path.join(__dirname, '../packs/resource/manifest.json');

    for (const p of [behaviorManifestPath, resourceManifestPath]) {
        if (fs.existsSync(p)) {
            try {
                const content = fs.readFileSync(p, 'utf8');
                const json = JSON.parse(content);

                // versionString is "A.B.C". MC manifest needs [A, B, C]
                const parts = versionString.split('.').map(Number);

                json.header.version = parts;
                if (json.modules) {
                    for (const m of json.modules) m.version = parts;
                }

                fs.writeFileSync(p, JSON.stringify(json, null, 4));
                console.log(`Updated manifest at ${p} to ${parts.join('.')}`);
            } catch (error) {
                console.error(`Failed to update manifest at ${p}:`, error);
            }
        }
    }
}

function main() {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const baseVersion = pkg.version; // "0.7.0"
    const [major, minor] = baseVersion.split('.').map(Number);

    const isRelease = process.argv.includes('--release');

    let finalVersion;

    if (isRelease) {
        finalVersion = `${major}.${minor}.0`;
    } else {
        const commitCount = getGitCommitCount();
        finalVersion = `${major}.${minor}.${commitCount}`;
    }

    console.log(`Setting version to: ${finalVersion}`);

    updateManifest(finalVersion);

    // Write version to a temp file for build.js to use if needed,
    // or we can rely on build.js to use a define/replace plugin if we wanted to replace the placeholder in config.js.
    // The previous plan was to replace 0.0.0-PLACEHOLDER in src/config.default.ts via esbuild define,
    // but the simplest way is to update the file content during build or use esbuild 'define'.
    // Let's create a .version file so build.js can read it.
    fs.writeFileSync(path.join(__dirname, '../.version'), finalVersion);
}

main();
