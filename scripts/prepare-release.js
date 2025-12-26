import fs from 'node:fs';
import path from 'node:path';

const VERSION_STRING = process.env.VERSION_STRING;
const VERSION_ARRAY_STRING = process.env.VERSION_ARRAY_STRING;
const IS_BETA_RELEASE = process.env.IS_BETA_RELEASE === 'true';

if (!VERSION_STRING || !VERSION_ARRAY_STRING) {
    console.error('Error: VERSION_STRING and VERSION_ARRAY_STRING environment variables must be set.');
    process.exit(1);
}

// We now modify the source files directly in the checked-out repo before building.
const baseDir = '.';

// Function to copy the master icon to packs
function copyIcon() {
    const iconPath = path.join(baseDir, 'assets/pack_icon.png');
    if (!fs.existsSync(iconPath)) {
        console.warn('Warning: assets/pack_icon.png not found. Skipping icon copy.');
        return;
    }
    const bpPath = path.join(baseDir, 'packs/behavior/pack_icon.png');
    const rpPath = path.join(baseDir, 'packs/resource/pack_icon.png');

    // Ensure directories exist (though they should)
    if (fs.existsSync(path.dirname(bpPath))) {
        fs.copyFileSync(iconPath, bpPath);
        console.log(`Copied icon to ${bpPath}`);
    }
    if (fs.existsSync(path.dirname(rpPath))) {
        fs.copyFileSync(iconPath, rpPath);
        console.log(`Copied icon to ${rpPath}`);
    }
}

// Function to update config.ts (Source)
function updateConfig(filePath) {
    const fullPath = path.join(baseDir, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Error: File not found: ${fullPath}`);
        process.exit(1);
    }

    let content = fs.readFileSync(fullPath, 'utf8');

    // Update version
    // Regex matches: version: [1, 0, 0] (with flexible whitespace)
    content = content.replaceAll(/version:\s*\[\s*1\s*,\s*0\s*,\s*0\s*\]/g, `version: ${VERSION_ARRAY_STRING}`);

    if (IS_BETA_RELEASE) {
        console.log('Applying Beta Release Modifications...');
        // Update ownerPlayerNames
        // Regex matches: ownerPlayerNames: ['Your•Name•Here']
        content = content.replaceAll(
            /ownerPlayerNames:\s*\[\s*'Your•Name•Here'\s*\]/g,
            "ownerPlayerNames: ['SjnTechMlmYT']"
        );

        // Update logLevel
        // Regex matches: logLevel: 2
        content = content.replaceAll(/logLevel:\s*2/g, 'logLevel: 3');

        // Update isNightly
        content = content.replaceAll(/isNightly:\s*false/g, 'isNightly: true');
    }

    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
}

console.log('--- Starting Release Preparation ---');
console.log(`Version: ${VERSION_STRING}`);
console.log(`Version Array: ${VERSION_ARRAY_STRING}`);
console.log(`Is Beta: ${IS_BETA_RELEASE}`);

copyIcon();

// Manifest updates are handled by scripts/set-version.js during the build process.
// We removed updateManifest() from here to avoid race conditions/ordering issues in CI.

// Update the TypeScript source config
// Priority: src/config.ts (User Custom) -> src/config.default.ts (Repo Default)
if (fs.existsSync(path.join(baseDir, 'src/config.ts'))) {
    updateConfig('src/config.ts');
} else if (fs.existsSync(path.join(baseDir, 'src/config.default.ts'))) {
    updateConfig('src/config.default.ts');
} else {
    console.warn('Warning: Neither src/config.ts nor src/config.default.ts found. Config version update skipped.');
}

console.log('--- Release Preparation Complete ---');
