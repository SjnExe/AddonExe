import { $ } from 'bun';
import { existsSync } from 'node:fs';

// Prefer native Termux binary when running on Android
const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const bin = existsSync(termuxBin) ? termuxBin : 'oxlint';

const args = process.argv.slice(2);
const result = await $`${bin} ${args}`.nothrow();

process.exit(result.exitCode);
