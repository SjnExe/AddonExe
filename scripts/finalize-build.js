import fs from 'node:fs';
import path from 'node:path';

const SCRIPTS_DIR = 'packs/behavior/scripts';

console.log('Processing build artifacts...');

if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error(`Directory not found: ${SCRIPTS_DIR}`);
    process.exit(1);
}

// Helper to find files recursively
function findFiles(dir, filter) {
    const results = [];
    const list = fs.readdirSync(dir);
    for (const fileName of list) {
        const file = path.join(dir, fileName);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results.push(...findFiles(file, filter));
        } else {
            if (filter(file)) results.push(file);
        }
    }
    return results;
}

try {
    // 1. Rewrite imports in all JS files
    // Changes: import ... from './config.default.js' -> './config.js'
    console.log('Rewriting imports...');
    const jsFiles = findFiles(SCRIPTS_DIR, (f) => f.endsWith('.js'));
    let rewriteCount = 0;

    for (const file of jsFiles) {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes('.default.js')) {
            content = content.replaceAll('.default.js', '.js');
            fs.writeFileSync(file, content);
            rewriteCount++;
        }
    }
    console.log(`Rewrote imports in ${rewriteCount} files.`);

    // 2. Process Configuration Files
    // Strategy: If config.js doesn't exist, copy config.default.js to config.js.
    // Then delete config.default.js to avoid having both in the pack.
    console.log('Handling config files...');
    const defaultConfigs = findFiles(SCRIPTS_DIR, (f) => f.endsWith('.default.js'));

    for (const defFile of defaultConfigs) {
        const targetFile = defFile.replace('.default.js', '.js');

        // Only create the active config if it doesn't already exist (e.g. from a previous build step or user override)
        // Note: In a clean build context, it usually won't exist.
        if (!fs.existsSync(targetFile)) {
            fs.copyFileSync(defFile, targetFile);
            console.log(`Created default config: ${targetFile}`);
        }

        // Always remove the .default.js file from the final build artifact
        fs.unlinkSync(defFile);
        console.log(`Removed template: ${defFile}`);
    }

    console.log('Build finalization complete.');
} catch (error) {
    console.error('Error during build finalization:', error);
    process.exit(1);
}
