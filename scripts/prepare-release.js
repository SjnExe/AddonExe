import fs from 'node:fs/promises';
import path from 'node:path';

const VERSION_STRING = process.env.VERSION_STRING;
const VERSION_ARRAY_STRING = process.env.VERSION_ARRAY_STRING;
const IS_BETA_RELEASE = process.env.IS_BETA_RELEASE === 'true';

if (!VERSION_STRING || !VERSION_ARRAY_STRING) {
    console.error('Error: VERSION_STRING and VERSION_ARRAY_STRING environment variables must be set.');
    process.exit(1);
}

// We now modify the source files directly in the checked-out repo before building.
const baseDir = process.cwd();

// Function to update config.ts (Source)
async function updateConfig(filePath) {
    const fullPath = path.join(baseDir, filePath);
    try {
        await fs.access(fullPath);
    } catch {
        console.error(`Error: File not found: ${fullPath}`);
        process.exit(1);
    }

    let content = await fs.readFile(fullPath, 'utf8');

    // Update version
    // Regex matches: version: [1, 0, 0] (with flexible whitespace)
    content = content.replaceAll(/version:\s*\[\s*1\s*,\s*0\s*,\s*0\s*\]/g, `version: ${VERSION_ARRAY_STRING}`);

    if (IS_BETA_RELEASE) {
        console.log('Applying Beta Release Modifications...');
        // Update ownerPlayerNames
        // Regex matches: ownerPlayerNames: ['Your•Name•Here']
        content = content.replaceAll(/ownerPlayerNames:\s*\[\s*'Your•Name•Here'\s*\]/g, "ownerPlayerNames: ['SjnTechMlmYT']");

        // Update logLevel
        // Regex matches: logLevel: 2
        content = content.replaceAll(/logLevel:\s*2/g, 'logLevel: 3');
    }

    await fs.writeFile(fullPath, content);
    console.log(`Updated ${filePath}`);
}

async function main() {
    console.log('--- Starting Release Preparation ---');
    console.log(`Version: ${VERSION_STRING}`);
    console.log(`Version Array: ${VERSION_ARRAY_STRING}`);
    console.log(`Is Beta: ${IS_BETA_RELEASE}`);

    // Manifest updates are handled by scripts/generate-manifests.js during the build process.

    // Update the TypeScript source config
    // Priority: src/config.ts (User Custom) -> src/config.default.ts (Repo Default)
    const customConfigPath = path.join(baseDir, 'src/config.ts');
    const defaultConfigPath = path.join(baseDir, 'src/config.default.ts');

    let configExists = false;
    try {
        await fs.access(customConfigPath);
        configExists = true;
        await updateConfig('src/config.ts');
    } catch {
        // Custom config not found, check default
    }

    if (!configExists) {
        try {
            await fs.access(defaultConfigPath);
            await updateConfig('src/config.default.ts');
        } catch {
            console.warn('Warning: Neither src/config.ts nor src/config.default.ts found. Config version update skipped.');
        }
    }

    console.log('--- Release Preparation Complete ---');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
