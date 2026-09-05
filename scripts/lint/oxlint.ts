import { $ } from 'bun';

// 1. Run Bun-native custom rule validator first (guaranteed 100% platform parity)
const customCheck = await $`bun scripts/lint/minecraft-rules.ts`.nothrow();
if (customCheck.exitCode !== 0) {
    process.exit(customCheck.exitCode);
}

// 2. Run oxlint binary
const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const bin = (await Bun.file(termuxBin).exists()) ? termuxBin : 'oxlint';

const args = process.argv.slice(2);
const result = await $`${bin} ${args}`.nothrow();

process.exit(result.exitCode);
