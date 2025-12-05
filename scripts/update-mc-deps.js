import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../package.json');
const manifestJsonPath = path.resolve(__dirname, '../packs/behavior/manifest.json');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

async function main() {
    console.log(`${colors.blue}Checking Minecraft dependencies...${colors.reset}`);

    let updated = false;
    const updates = [];

    // --- Package.json Logic ---
    if (fs.existsSync(packageJsonPath)) {
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);

        const devDeps = packageJson.devDependencies || {};
        const overrides = packageJson.overrides || {};

        // Identify targets: @minecraft/* packages in devDependencies that are NOT 'latest'
        const targets = Object.keys(devDeps).filter(
            (pkg) => pkg.startsWith('@minecraft/') && devDeps[pkg] !== 'latest'
        );

        if (targets.length > 0) {
            const promiseResults = await Promise.allSettled(
                targets.map(async (pkg) => {
                    try {
                        const { stdout } = await execAsync(`npm view ${pkg} versions --json`);
                        const versions = JSON.parse(stdout);

                        // Filter: Must include 'beta', end with '-stable', and NOT include 'preview'
                        const candidates = versions
                            .filter((v) => v.includes('beta') && v.endsWith('-stable') && !v.includes('preview'))
                            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

                        let newVersion;
                        if (candidates.length > 0) {
                            // Pick the last one (which is the latest due to numeric sort)
                            newVersion = candidates[candidates.length - 1];
                        } else {
                            // No matching stable beta found, preserve existing version
                            return null;
                        }

                        return { pkg, newVersion };
                    } catch (error) {
                        console.error(
                            `${colors.yellow}Warning: Failed to fetch versions for ${pkg}: ${error.message}${colors.reset}`
                        );
                        return null;
                    }
                })
            );

            let packageJsonUpdated = false;
            for (const result of promiseResults) {
                if (result.status === 'fulfilled' && result.value) {
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
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, indentation) + '\n');
                updated = true;
            }
        }
    } else {
        console.error(`${colors.red}Error: package.json not found at ${packageJsonPath}${colors.reset}`);
    }

    // --- Manifest.json Logic ---
    if (fs.existsSync(manifestJsonPath)) {
        const manifestContent = fs.readFileSync(manifestJsonPath, 'utf8');
        const manifestJson = JSON.parse(manifestContent);
        const manifestDeps = manifestJson.dependencies || [];
        let manifestUpdated = false;

        // Filter dependencies that are @minecraft/* and NOT 'beta'
        // We need to map them to an array of promises
        const manifestPromises = manifestDeps.map(async (dep) => {
            if (dep.module_name && dep.module_name.startsWith('@minecraft/') && dep.version !== 'beta') {
                try {
                    // Fetch 'latest' version
                    const { stdout } = await execAsync(`npm view ${dep.module_name} version`);
                    const latestVersion = stdout.trim();
                    return { dep, latestVersion };
                } catch (error) {
                    console.error(
                        `${colors.yellow}Warning: Failed to fetch latest version for manifest dependency ${dep.module_name}: ${error.message}${colors.reset}`
                    );
                    return null;
                }
            }
            return null;
        });

        const manifestResults = await Promise.allSettled(manifestPromises);

        for (const result of manifestResults) {
            if (result.status === 'fulfilled' && result.value) {
                const { dep, latestVersion } = result.value;
                if (dep.version !== latestVersion) {
                    updates.push(`[manifest.json] ${dep.module_name}: ${dep.version} -> ${latestVersion}`);
                    dep.version = latestVersion;
                    manifestUpdated = true;
                }
            }
        }

        if (manifestUpdated) {
            const indentation = 4;
            fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, indentation) + '\n');
            updated = true;
        }
    } else {
        console.log(`${colors.yellow}Warning: manifest.json not found at ${manifestJsonPath}${colors.reset}`);
    }

    // --- Final Output ---
    if (updated) {
        console.log(`${colors.green}Updated Minecraft dependencies:${colors.reset}`);
        updates.forEach((u) => console.log(`  ${u}`));
        console.log(
            `${colors.yellow}Dependencies updated. Please run 'npm install' again to install the new versions.${colors.reset}`
        );
        process.exit(1);
    } else {
        console.log(`${colors.green}All Minecraft dependencies are up to date.${colors.reset}`);
    }
}

main().catch((err) => {
    console.error(`${colors.red}Fatal error updating dependencies: ${err}${colors.reset}`);
    process.exit(0);
});
