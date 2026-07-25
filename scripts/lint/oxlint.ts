import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// 1. Run Bun-native custom rule validator first (guaranteed 100% platform parity)
const customCheck = spawnSync('bun', ['scripts/lint/minecraft-rules.ts'], { stdio: 'inherit', env: process.env });
if (customCheck.status !== 0) {
    process.exit(customCheck.status ?? 1);
}

// 2. Run oxlint binary
const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const bin = existsSync(termuxBin) ? termuxBin : 'oxlint';

const args = process.argv.slice(2);
const result = spawnSync(bin, args, { stdio: 'inherit', env: process.env });

process.exit(result.status ?? 0);
