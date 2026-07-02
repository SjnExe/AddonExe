import { $ } from 'bun';

try {
    await $`bun --bun lint-staged`;

    console.log('Running validation checks in parallel...');
    const [checkTypes, test, validate] = await Promise.all([$`bun check-types`.nothrow().quiet(), $`bun test`.nothrow().quiet(), $`bun validate`.nothrow().quiet()]);

    const logContent = [
        `=== Type Check (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`,
        `=== Tests (Exit: ${test.exitCode}) ===\n${test.stdout}${test.stderr}`,
        `=== Validation (Exit: ${validate.exitCode}) ===\n${validate.stdout}${validate.stderr}`
    ].join('\n\n');

    await Bun.write('.git/pre-commit.log', logContent);

    if (checkTypes.exitCode !== 0 || test.exitCode !== 0 || validate.exitCode !== 0) {
        if (checkTypes.exitCode !== 0) console.log(`\n=== Type Check (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`);
        if (test.exitCode !== 0) console.log(`\n=== Tests (Exit: ${test.exitCode}) ===\n${test.stdout}${test.stderr}`);
        if (validate.exitCode !== 0) console.log(`\n=== Validation (Exit: ${validate.exitCode}) ===\n${validate.stdout}${validate.stderr}`);
        console.error('\n❌ Pre-commit checks failed. See details above.');
        process.exit(1);
    }

    console.log('✨ All pre-commit checks passed!');
} catch (error) {
    console.error('Pre-commit hook exception:', error);
    process.exit(1);
}
