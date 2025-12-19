import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../packs/behavior/manifest.json');

if (!fs.existsSync(packageJsonPath) || !fs.existsSync(manifestJsonPath)) {
    console.error('Could not find package.json or manifest.json');
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));

const packageDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
};

const manifestDeps = manifestJson.dependencies || [];

const minecraftPackageDeps = Object.keys(packageDeps).filter((d) => d.startsWith('@minecraft/'));
const minecraftManifestDeps = manifestDeps
    .filter((d) => d.module_name && d.module_name.startsWith('@minecraft/'))
    .map((d) => d.module_name);

const errors = [];

// List of modules that are actual Script API modules and should be in manifest.json if used
const runtimeModules = new Set([
    '@minecraft/server',
    '@minecraft/server-ui',
    '@minecraft/server-gametest',
    '@minecraft/server-net',
    '@minecraft/server-admin',
    '@minecraft/debug-utilities',
    '@minecraft/diagnostics',
    '@minecraft/common',
    '@minecraft/gameplay-utilities'
]);

// Modules allowed to be in package.json (for types/dev) but NOT in manifest.json (runtime)
const devOnlyModules = new Set(['@minecraft/server-gametest', '@minecraft/debug-utilities', '@minecraft/common']);

for (const pkg of minecraftPackageDeps) {
    if (runtimeModules.has(pkg) && !devOnlyModules.has(pkg) && !minecraftManifestDeps.includes(pkg)) {
            errors.push(`Package '${pkg}' is in package.json but missing from manifest.json dependencies.`);
        }
}

for (const pkg of minecraftManifestDeps) {
    if (!minecraftPackageDeps.includes(pkg)) {
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
