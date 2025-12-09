import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
    // (Removed as we now use "beta" tag directly in package.json)

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
