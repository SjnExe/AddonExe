import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

const isTestFile = (f) => f.endsWith('.test.ts') || f.endsWith('.spec.ts') || f.includes('__mocks__');

walk('src', (f) => {
    if (isTestFile(f)) {
        let content = fs.readFileSync(f, 'utf-8');
        let originalContent = content;

        // Remove "vi " from import { ..., vi } from 'bun:test'
        content = content.replace(/,\s*vi\s*/g, '');
        content = content.replace(/vi\s*,\s*/g, '');
        content = content.replace(/\{\s*vi\s*\}/g, '{}');

        // Replace mock.mock with mock.module
        content = content.replace(/mock\.mock/g, 'mock.module');
        content = content.replace(/vi\.mock/g, 'mock.module');
        content = content.replace(/vi\.fn\(/g, 'mock(');
        content = content.replace(/vi\.spyOn\(/g, 'spyOn(');

        const testKeywords = ['describe', 'test', 'expect', 'mock', 'spyOn', 'it', 'beforeEach', 'afterEach', 'afterAll', 'beforeAll'];
        let usedKeywords = [];
        for (let kw of testKeywords) {
            if (new RegExp(`\\b${kw}\\b`).test(content) || content.includes(kw + '(')) {
                usedKeywords.push(kw);
            }
        }

        // Remove existing bun:test imports
        content = content.replace(/import\s*\{[^}]*\}\s*from\s*['"](bun:test|vitest)['"];?\n?/g, '');

        // Prepend new bun:test import
        if (usedKeywords.length > 0) {
            content = `import { ${usedKeywords.join(', ')} } from "bun:test";\n` + content;
        }

        if (content !== originalContent) {
            fs.writeFileSync(f, content);
            console.log('Migrated 2', f);
        }
    }
});
