import { $ } from 'bun';
import fs from 'fs';

try {
    // Run lint-staged first (inherits console output natively)
    await $`bun --bun lint-staged`;

    // Run validation checks in parallel and capture stdout/stderr quietly
    const result = await $`bun --bun concurrently --group "bun check-types" "bun test" "bun validate"`.nothrow().quiet();

    const logContent = result.stdout.toString() + result.stderr.toString();
    fs.writeFileSync('.git/pre-commit.log', logContent);

    if (result.exitCode !== 0) {
        // Print the failure log out to the terminal so you know what failed
        console.log(logContent);
        process.exit(1);
    }
} catch (error) {
    console.error('Pre-commit hook exception:', error);
    process.exit(1);
}
