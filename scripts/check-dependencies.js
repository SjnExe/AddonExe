import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../build/behavior/manifest.json');

async function main() {
    try {
        await Promise.all([fs.access(packageJsonPath), fs.access(manifestJsonPath)]);
    } catch {
        // If manifest doesn't exist yet (e.g. pre-build), skip check or warn
        console.warn('Could not find package.json or build/behavior/manifest.json. Skipping dependency check.');
        process.exit(0);
    }

    const [packageJsonContent, manifestJsonContent] = await Promise.all([fs.readFile(packageJsonPath, 'utf8'), fs.readFile(manifestJsonPath, 'utf8')]);

    const packageJson = JSON.parse(packageJsonContent);
    const manifestJson = JSON.parse(manifestJsonContent);

    const packageDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
    };

    // Extract module dependencies from manifest
    const manifestDeps = manifestJson.dependencies || [];

    // Filter package.json for @minecraft/* packages
    const minecraftPackageKeys = Object.keys(packageDeps).filter((d) => d.startsWith('@minecraft/'));

    // Filter manifest.json for script modules (ignore UUID dependencies)
    const minecraftManifestModules = manifestDeps.filter((d) => d.module_name && d.module_name.startsWith('@minecraft/')).map((d) => d.module_name);

    const errors = [];

    // Define known Script API modules
    const runtimeModules = new Set([
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/server-net',
        '@minecraft/server-admin',
        '@minecraft/server-editor',
        '@minecraft/debug-utilities',
        '@minecraft/common', // Often dev-only, but check logic below
        '@minecraft/gameplay-utilities' // Deprecated/merged but listed just in case
    ]);

    // Optimization: Use Sets for O(1) checks
    const manifestModuleSet = new Set(minecraftManifestModules);
    const packageKeySet = new Set(minecraftPackageKeys);

    for (const pkg of minecraftPackageKeys) {
        if (runtimeModules.has(pkg) && !manifestModuleSet.has(pkg)) {
            // Special exemptions
            if (pkg === '@minecraft/common' || pkg === '@minecraft/debug-utilities') {
                // Often used for types or debug only
                continue;
            }
            errors.push(`Package '${pkg}' is in package.json but missing from manifest.json dependencies.`);
        }
    }

    for (const pkg of minecraftManifestModules) {
        if (!packageKeySet.has(pkg)) {
            errors.push(`Module '${pkg}' is in manifest.json but missing from package.json dependencies.`);
        }
    }

    if (errors.length > 0) {
        console.error('Dependency mismatch detected:');
        for (const e of errors) console.error(`- ${e}`);
        process.exit(1);
    } else {
        console.log('Dependency check passed.');
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
