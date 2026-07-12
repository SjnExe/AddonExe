import { $ } from 'bun';
import os from 'node:os';
import path from 'node:path';

const homeDir = os.homedir();
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

// Immunize the subshell path environment completely against degradation
const paths = [cargoBinDir, termuxBinDir, process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

try {
    // 1. Run lint-staged first
    await $`bun lint-staged`;

    // 2. Run validation checks concurrently using native JS Promises
    console.log('Running validation checks in parallel...');
    const [checkTypes, test, validate] = await Promise.all([$`bun check-types`.nothrow().quiet(), $`bun test --isolate --parallel`.nothrow().quiet(), $`bun validate`.nothrow().quiet()]);

    // 3. Group the logs cleanly
    const logContent = [
        `=== Type Check (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`,
        `=== Tests (Exit: ${test.exitCode}) ===\n${test.stdout}${test.stderr}`,
        `=== Validation (Exit: ${validate.exitCode}) ===\n${validate.stdout}${validate.stderr}`
    ].join('\n\n');

    await Bun.write('.git/pre-commit.log', logContent);

    // 4. If any of them failed, dump logs to console and block the commit
    if (checkTypes.exitCode !== 0 || test.exitCode !== 0 || validate.exitCode !== 0) {
        console.log(logContent);
        console.error('\n❌ Pre-commit checks failed. See details above.');
        process.exit(1);
    }

    console.log('✨ All pre-commit checks passed!');
} catch (error) {
    console.error('Pre-commit hook exception:', error);
    process.exit(1);
}
