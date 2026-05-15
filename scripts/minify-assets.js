import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to minify files recursively
function minifyFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'scripts') {
                minifyFiles(filePath);
            }
        } else if (file.endsWith('.json')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                // Simple regex for stripping comments (not perfect but often sufficient for MC):
                const jsonWithoutComments = content.replaceAll(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
                const json = JSON.parse(jsonWithoutComments);
                const minified = JSON.stringify(json);
                fs.writeFileSync(filePath, minified);
                console.log(`Minified JSON: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        } else if (file.endsWith('.lang')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));
                fs.writeFileSync(filePath, minifiedLines.join('\n'));
                console.log(`Minified Lang: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        } else if (file.endsWith('.mcfunction')) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n');
                const minifiedLines = lines.map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#'));
                fs.writeFileSync(filePath, minifiedLines.join('\n'));
                console.log(`Minified MCFunction: ${filePath}`);
            } catch (error) {
                console.warn(`Skipped minification for ${filePath}: ${error.message}`);
            }
        }
    }
}

const buildPacksDir = path.join(__dirname, '../build');
minifyFiles(buildPacksDir);
