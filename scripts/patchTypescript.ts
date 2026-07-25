import { existsSync } from 'node:fs';

// Check if running on Termux (Android ARM64 path signature)
const isTermux = process.platform === 'linux' && process.arch === 'arm64' && process.env.PREFIX?.includes('com.termux');

if (isTermux) {
    const exePathFile = 'node_modules/typescript/lib/getExePath.js';
    if (existsSync(exePathFile)) {
        const content = await Bun.file(exePathFile).text();
        if (!content.includes('process.execPath')) {
            const patched = `
export default function getExePath() {
    return process.execPath;
}
`;
            await Bun.write(exePathFile, patched);
            console.log('✅ Conditionally patched TypeScript getExePath.js for Termux ARM64 environment.');
        }
    }
} else {
    console.log('ℹ️ Non-Termux environment detected; skipping TypeScript ARM64 binary shim.');
}
