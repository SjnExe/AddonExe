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

// Function to update JSON manifest
function updateManifest(filePath) {
    const fullPath = path.join(baseDir, filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`Error: File not found: ${fullPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    let json;
    try {
        json = JSON.parse(content);
    } catch (e) {
        console.error(`Error parsing JSON file ${fullPath}:`, e);
        process.exit(1);
    }

    // Parse version array string "[1, 0, 0]" -> [1, 0, 0]
    let versionArray;
    try {
        versionArray = JSON.parse(VERSION_ARRAY_STRING);
    } catch (e) {
        console.error('Error parsing VERSION_ARRAY_STRING:', e);
        process.exit(1);
    }

    // Update header version
    if (json.header) {
        json.header.version = versionArray;
        // Update description version string
        if (json.header.description) {
            // Replace v1.0.0 placeholder
            json.header.description = json.header.description.replace('v1.0.0', `v${VERSION_STRING}`);
            // Replace any existing vX.X.X pattern if re-running or if base file changed
            json.header.description = json.header.description.replaceAll(/v\d+\.\d+\.\d+(-beta)?/g, `v${VERSION_STRING}`);
        }
    }

    // Update modules version
    if (json.modules) {
        for (const module of json.modules) {
            if (module.version && // Keep beta dependencies as is, unless they match the [1, 0, 0] placeholder we are replacing.
                (JSON.stringify(module.version) === '[1,0,0]' || JSON.stringify(module.version) === '[1, 0, 0]')) {
                    module.version = versionArray;
                }
        }
    }

    // Update dependencies version
    if (json.dependencies) {
        for (const dep of json.dependencies) {
            if (dep.version && // Only update if version is [1, 0, 0]
                // This avoids touching "beta" or other specific versions
                (JSON.stringify(dep.version) === '[1,0,0]' || JSON.stringify(dep.version) === '[1, 0, 0]')) {
                    dep.version = versionArray;
                }
        }
    }

    fs.writeFileSync(fullPath, JSON.stringify(json, null, 4));
    console.log(`Updated ${filePath}`);
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
updateManifest('packs/behavior/manifest.json');
updateManifest('packs/resource/manifest.json');

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
