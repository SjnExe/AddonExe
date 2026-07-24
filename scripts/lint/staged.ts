import { $ } from 'bun';

const files = process.argv.slice(2);
if (files.length === 0) {
    process.exit(0);
}

await $`bun scripts/lint/oxlint.ts --fix ${files}`.quiet();
await $`bun eslint --fix --cache ${files}`.quiet();
await $`bun prettier --write --cache ${files}`.quiet();
