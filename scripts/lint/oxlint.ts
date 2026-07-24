import { $ } from 'bun';
import { existsSync } from 'node:fs';

const termuxBin = '/data/data/com.termux/files/usr/bin/oxlint';
const bin = existsSync(termuxBin) ? termuxBin : 'oxlint';

const isCI = process.env.GITHUB_ACTIONS === 'true';
const defaultFlags = ['--deny-warnings'];
if (isCI) {
    defaultFlags.push('-f', 'github');
}

const userArgs = process.argv.slice(2);
const args = [...defaultFlags, ...userArgs];

const result = await $`${bin} ${args}`.nothrow();

process.exit(result.exitCode);
