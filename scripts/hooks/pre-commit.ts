import os from 'node:os';
import path from 'node:path';

import { $ } from 'bun';

const homeDir = os.homedir();
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

const paths = [cargoBinDir, termuxBinDir, process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

try {
  // 1. Native single-pass staged linter/formatter (bypasses external lint-staged)
  const stagedOutput = await $`git diff --cached --name-only --diff-filter=ACMR`.text();
  const stagedFiles = stagedOutput
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  if (stagedFiles.length > 0) {
    const existingFiles: string[] = [];
    for (const f of stagedFiles) {
      if (await Bun.file(f).exists()) {
        existingFiles.push(f);
      }
    }

    const codeFiles = existingFiles.filter((f) => /\.(js|ts)$/.test(f));

    if (codeFiles.length > 0) {
      await $`bun scripts/lint/oxlint.ts --fix ${codeFiles}`.quiet();
      await $`git add ${codeFiles}`.quiet();
    }
    await $`bun fmt --staged`.quiet();
  }

  // 2. Fast Incremental Type Check
  console.log('⚡ Running incremental type check...');
  const checkTypes = await $`bun check`.nothrow().quiet();

  if (checkTypes.exitCode !== 0) {
    console.error(`=== Type Check Failed (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`);
    console.error('\n❌ Pre-commit checks failed.');
    process.exit(1);
  }

  // 3. Fast Unit Test Suite
  console.log('🧪 Running unit tests...');
  const runTests = await $`bun test --parallel`.nothrow().quiet();

  if (runTests.exitCode !== 0) {
    console.error(`=== Unit Tests Failed (Exit: ${runTests.exitCode}) ===\n${runTests.stdout}${runTests.stderr}`);
    console.error('\n❌ Unit test suite failed.');
    process.exit(1);
  }

  console.log('✨ All pre-commit checks passed!');
} catch (error) {
  console.error('Pre-commit hook exception:', error);
  process.exit(1);
}
