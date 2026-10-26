import os from 'node:os';
import path from 'node:path';

import { $ } from 'bun';

import { validateMinecraftRules } from '../lint/minecraftRules.ts';

const homeDir = os.homedir();
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

const paths = [cargoBinDir, termuxBinDir, process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

try {
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
      const ruleErrors = await validateMinecraftRules();
      if (ruleErrors > 0) {
        process.exit(1);
      }
      const termuxOxlint = '/data/data/com.termux/files/usr/bin/oxlint';
      if (await Bun.file(termuxOxlint).exists()) {
        await $`${termuxOxlint} --fix ${codeFiles}`.quiet();
      } else {
        await $`./node_modules/.bin/oxlint --fix ${codeFiles}`.quiet();
      }
      await $`git add ${codeFiles}`.quiet();
    }
    await $`bun fmt --staged`.quiet();
  }

  console.log('⚡ Running incremental type check...');
  const checkTypes = await $`bun check`.nothrow().quiet();

  if (checkTypes.exitCode !== 0) {
    console.error(`=== Type Check Failed (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`);
    console.error('\n❌ Pre-commit checks failed.');
    process.exit(1);
  }

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
