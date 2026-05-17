import chokidar from 'chokidar';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWatch = process.argv.includes('--watch');
const isMinify = process.argv.includes('--minify') || process.env.CI || process.env.GITHUB_ACTIONS;

const srcDir = path.join(__dirname, '../packs');
const buildDir = path.join(__dirname, '../build');

function minifyContent(filePath, content) {
    if (filePath.endsWith('.json')) {
        try {
            const jsonWithoutComments = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
            const json = JSON.parse(jsonWithoutComments);
            return JSON.stringify(json);
        } catch (error) {
            console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            return content;
        }
    } else if (filePath.endsWith('.lang')) {
        const lines = content.split('\n');
        const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
        return minifiedLines.join('\n');
    } else if (filePath.endsWith('.mcfunction')) {
        const lines = content.split('\n');
        const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#'));
        return minifiedLines.join('\n');
    }
    return content;
}

function processFile(filePath) {
    const relPath = path.relative(srcDir, filePath);
    const destPath = path.join(buildDir, relPath);

    // Skip scripts, we use tsup for them
    if (relPath.startsWith('behavior/scripts/') || relPath.startsWith('behavior/scripts\\')) {
        return;
    }

    // Skip static manifest files, they are generated dynamically
    if (relPath === 'behavior/manifest.json' || relPath === 'behavior\\manifest.json' || relPath === 'resource/manifest.json' || relPath === 'resource\\manifest.json') {
        return;
    }

    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    if (isMinify && (filePath.endsWith('.json') || filePath.endsWith('.lang') || filePath.endsWith('.mcfunction'))) {
        const content = fs.readFileSync(filePath, 'utf8');
        const minified = minifyContent(filePath, content);
        fs.writeFileSync(destPath, minified);
        console.log(`Minified and copied: ${relPath}`);
    } else {
        fs.copyFileSync(filePath, destPath);
        console.log(`Copied: ${relPath}`);
    }
}

function scanAndProcess(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            scanAndProcess(filePath);
        } else {
            processFile(filePath);
        }
    }
}

console.log('Building assets...');
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

scanAndProcess(srcDir);

if (isWatch) {
    console.log('Watching for asset changes...');
    const watcher = chokidar.watch(srcDir, {
        ignoreInitial: true,
        ignored: [/(^|[/\\])\../, '**/behavior/scripts/**']
    });

    watcher.on('add', (filePath) => processFile(filePath));
    watcher.on('change', (filePath) => processFile(filePath));
} else {
    console.log('Assets build complete!');
}
