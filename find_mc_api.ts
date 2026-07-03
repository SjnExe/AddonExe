import * as fs from 'fs';
const mcPath = 'node_modules/@minecraft/server/index.d.ts';
if (fs.existsSync(mcPath)) {
    const content = fs.readFileSync(mcPath, 'utf8');
    const lines = content.split('\n');
    console.log(lines.filter(l => l.toLowerCase().includes('random') || l.toLowerCase().includes('uuid') || l.toLowerCase().includes('crypto')).join('\n'));
} else {
    console.log('not found');
}
