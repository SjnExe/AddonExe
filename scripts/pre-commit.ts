import { $ } from 'bun';
import os from 'node:os';
import path from 'node:path';

const homeDir = os.homedir();
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

const paths = [cargoBinDir, termuxBinDir, process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

try {
    // 1. Run single-pass staged linter/formatter
    await $`bun lint-staged`;

    // 2. Fast Incremental Type Check (~300ms)
    console.log('⚡ Running incremental type check...');
    const checkTypes = await $`bun check-types`.nothrow().quiet();

    if (checkTypes.exitCode !== 0) {
        console.error(`=== Type Check Failed (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`);
        console.error('\n❌ Pre-commit checks failed.');
        process.exit(1);
    }

    console.log('✨ All pre-commit checks passed!');
} catch (error) {
    console.error('Pre-commit hook exception:', error);
    process.exit(1);
}
