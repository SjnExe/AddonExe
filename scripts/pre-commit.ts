import { $ } from 'bun';
import os from 'node:os';
import path from 'node:path';

const homeDir = os.homedir();
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

const paths = [cargoBinDir, termuxBinDir, process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

try {
    // 1. Run single-pass lint-staged
    await $`bun lint-staged`;

    // 2. Phase 1: Source Verification (Type Check + Unit Tests)
    console.log('Running source verification (Type Check & Unit Tests)...');
    const [checkTypes, test] = await Promise.all([$`bun check-types`.nothrow().quiet(), $`bun test --isolate --parallel`.nothrow().quiet()]);

    // 3. Phase 2: Build & Pack Validation
    console.log('Running build & pack validation...');
    const validate = await $`bun validate`.nothrow().quiet();

    // 4. Group all logs with zero truncation
    const logContent = [
        `=== Type Check (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`,
        `=== Tests (Exit: ${test.exitCode}) ===\n${test.stdout}${test.stderr}`,
        `=== Validation (Exit: ${validate.exitCode}) ===\n${validate.stdout}${validate.stderr}`
    ].join('\n\n');

    await Bun.write('.git/pre-commit.log', logContent);

    // 5. Block commit and dump full logs if any check failed
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
