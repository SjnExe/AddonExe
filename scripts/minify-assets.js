import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packsDir = path.join(__dirname, '../packs');

function minifyFiles(dir) {
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
                // Regex for stripping comments but preserving section symbols like § and newlines in string literals
                const jsonWithoutComments = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');

                // For manifest.json with Minecraft formatting codes, simple parse might fail if it's invalid JSON,
                // so we use a safer approach or just strip whitespace if parse fails.
                try {
                    const json = JSON.parse(jsonWithoutComments);
                    const minified = JSON.stringify(json);
                    fs.writeFileSync(filePath, minified);
                    console.log(`Minified JSON: ${filePath}`);
                } catch (e) {
                     // Fallback: just strip raw whitespace and newlines if it fails to parse (due to formatting codes)
                     const fallbackMinified = jsonWithoutComments.replace(/\n/g, '').replace(/\r/g, '').replace(/\s{2,}/g, ' ');
                     fs.writeFileSync(filePath, fallbackMinified);
                     console.log(`Minified JSON (Fallback): ${filePath}`);
                }
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

if (process.argv.includes('--minify')) {
    minifyFiles(packsDir);
}
