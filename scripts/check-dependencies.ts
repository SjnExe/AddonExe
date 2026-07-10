import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../packs/behavior/manifest.json');

async function main() {
    const pkgFile = Bun.file(packageJsonPath);
    const manifestFile = Bun.file(manifestJsonPath);

    if (!(await pkgFile.exists()) || !(await manifestFile.exists())) {
        // If manifest doesn't exist yet (e.g. pre-build), skip check or warn
        console.warn('Could not find package.json or packs/behavior/manifest.json. Skipping dependency check.');
        process.exit(0);
    }

    const [packageJson, manifestJson] = await Promise.all([pkgFile.json(), manifestFile.json()]);

    const packageDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
    };

    // Extract module dependencies from manifest
    // Manifest dependencies is an array of objects: { "module_name": "@minecraft/server", "version": "..." }
    // Or for UUID dependencies: { "uuid": "...", "version": "..." }
    const manifestDeps = manifestJson.dependencies || [];

    // Filter package.json for @minecraft/* packages
    const minecraftPackageKeys = Object.keys(packageDeps).filter((d) => d.startsWith('@minecraft/'));

    // Filter manifest.json for script modules (ignore UUID dependencies)
    const minecraftManifestModules = manifestDeps.filter((d) => d.module_name && d.module_name.startsWith('@minecraft/')).map((d) => d.module_name);

    const errors: string[] = [];

    // Define known Script API modules
    const runtimeModules = new Set<string>([
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/server-editor',
        '@minecraft/debug-utilities',
        '@minecraft/common', // Often dev-only, but check logic below
        '@minecraft/gameplay-utilities' // Deprecated/merged but listed just in case
    ]);

    // Modules that are typically used only for development/types and might NOT be in manifest at runtime
    // However, if code imports them, they MUST be in manifest.
    // Usually @minecraft/common contains shared types/utils that might be bundled or used in tests only.
    // If they are imported in runtime code, they need to be in manifest.
    // For safety, let's assume if it's in dependencies (not devDependencies), it should be in manifest.
    // But here we merged deps and devDeps.
    // Let's check imports in built files? Too complex.
    // Sticking to basic parity check for core modules.

    // Optimization: Use Sets for O(1) checks
    const manifestModuleSet = new Set<string>(minecraftManifestModules);
    const packageKeySet = new Set<string>(minecraftPackageKeys);

    for (const pkg of minecraftPackageKeys) {
        if (
            runtimeModules.has(pkg) && // If it's a runtime module in package.json, it should generally be in manifest
            // UNLESS it is strictly a dev dependency (types) and not used in runtime code.
            // But detecting usage is hard.
            // We'll relax the check: if it is in package.json but not manifest, warn but don't fail?
            // Or fail if it's critical like @minecraft/server.

            !manifestModuleSet.has(pkg)
        ) {
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
