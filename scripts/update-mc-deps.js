import { exec } from 'node:child_process';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../package.json');

// Color codes for console output
const colors = {
    reset: '\u001B[0m',
    green: '\u001B[32m',
    yellow: '\u001B[33m',
    blue: '\u001B[34m',
    red: '\u001B[31m'
};

async function fetchPackageVersion(pkg) {
    try {
        const { stdout } = await execAsync(`npm view ${pkg} versions --json`);
        const versions = JSON.parse(stdout);

        // Filter: Must include 'beta', end with '-stable', and NOT include 'preview'
        const candidates = versions
            .filter((v) => v.includes('beta') && v.endsWith('-stable') && !v.includes('preview'))
            .toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (candidates.length === 0) {
            return null;
        }
        // Pick the last one (which is the latest due to numeric sort)
        return candidates.at(-1);
    } catch (error) {
        console.error(`${colors.yellow}Warning: Failed to fetch versions for ${pkg}: ${error.message}${colors.reset}`);
        return null;
    }
}

async function updatePackageJson(updates) {
    try {
        await fs.access(packageJsonPath, constants.F_OK);
    } catch {
        console.error(`${colors.red}Error: package.json not found at ${packageJsonPath}${colors.reset}`);
        return false;
    }

    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    const devDeps = packageJson.devDependencies || {};
    const overrides = packageJson.overrides || {};

    // Identify targets: @minecraft/* packages in devDependencies that are NOT 'latest'
    const targets = Object.keys(devDeps).filter((pkg) => pkg.startsWith('@minecraft/') && devDeps[pkg] !== 'latest');

    if (targets.length === 0) {
        return false;
    }

    console.log(`${colors.blue}Checking for updates for ${targets.length} packages...${colors.reset}`);

    const promiseResults = await Promise.allSettled(
        targets.map(async (pkg) => {
            const newVersion = await fetchPackageVersion(pkg);
            return { pkg, newVersion };
        })
    );

    let packageJsonUpdated = false;
    for (const result of promiseResults) {
        if (result.status === 'fulfilled' && result.value.newVersion) {
            const { pkg, newVersion } = result.value;
            const currentVersion = devDeps[pkg];

            if (currentVersion !== newVersion) {
                devDeps[pkg] = newVersion;

                // Update overrides if the package exists there
                if (overrides[pkg]) {
                    overrides[pkg] = newVersion;
                }

                updates.push(`[package.json] ${pkg}: ${currentVersion} -> ${newVersion}`);
                packageJsonUpdated = true;
            }
        }
    }

    if (packageJsonUpdated) {
        const indentation = 4;
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, undefined, indentation) + '\n');
        return true;
    }

    return false;
}

async function main() {
    console.log(`${colors.blue}Checking Minecraft dependencies...${colors.reset}`);

    const updates = [];
    const pkgUpdated = await updatePackageJson(updates);

    if (pkgUpdated) {
        console.log(`${colors.green}Updated Minecraft dependencies:${colors.reset}`);
        for (const u of updates) console.log(`  ${u}`);
        console.log(
            `${colors.yellow}Dependencies updated. Please run 'npm install' again to install the new versions.${colors.reset}`
        );
        // Exit with 1 to indicate changes were made (useful for CI/hooks)
        process.exit(1);
    } else {
        console.log(`${colors.green}All Minecraft dependencies are up to date.${colors.reset}`);
        process.exit(0);
    }
}

main().catch((error) => {
    console.error(`${colors.red}Fatal error updating dependencies: ${error}${colors.reset}`);
    process.exit(1);
});
