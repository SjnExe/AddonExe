import { $ } from 'bun';

// 1. Run Bun-native custom rule validator first (guaranteed 100% platform parity)
const customCheck = await $`bun scripts/lint/minecraft-rules.ts`.nothrow();
if (customCheck.exitCode !== 0) {
    process.exit(customCheck.exitCode);
}

// 2. Run oxlint binary
const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const args = process.argv.slice(2);

let result;
if (await Bun.file(termuxBin).exists()) {
    result = await $`${termuxBin} ${args}`.nothrow();
} else {
    result = await $`bunx oxlint ${args}`.nothrow();
}

process.exit(result.exitCode);
