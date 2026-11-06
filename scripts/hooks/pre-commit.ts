import { delimiter, join } from 'node:path';

import { $ } from 'bun';

import { validateJsDocRules } from '../lint/jsdocRules.ts';
import { validateMinecraftRules } from '../lint/minecraftRules.ts';

/** Ensures that Termux or custom environment PATH entries include PREFIX/bin. */
export function ensurePrefixPath(): void {
  if (process.env.PREFIX) {
    const prefixBinDir = join(process.env.PREFIX, 'bin');
    const pathEntries = (process.env.PATH ?? '').split(delimiter);
    if (!pathEntries.includes(prefixBinDir)) {
      process.env.PATH = `${prefixBinDir}${delimiter}${process.env.PATH ?? ''}`;
    }
  }
}

/** Options for customizing pre-commit hook execution during tests or CI. */
export interface PreCommitOptions {
  stagedFiles?: string[];
  skipFormat?: boolean;
  skipTypeCheck?: boolean;
  skipTests?: boolean;
}

/**
 * Runs the pre-commit hook validation pipeline.
 *
 * @param options - Optional configuration overriding staged files or skipping verification stages.
 * @returns Resolves with true if all pre-commit checks pass, false otherwise.
 */
export async function runPreCommitHook(options?: PreCommitOptions): Promise<boolean> {
  ensurePrefixPath();

  try {
    let stagedFiles = options?.stagedFiles;
    if (!stagedFiles) {
      const stagedOutput = await $`git diff --cached --name-only --diff-filter=ACMR`.text();
      stagedFiles = stagedOutput
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);
    }

    if (stagedFiles.length > 0) {
      const existingFiles: string[] = [];
      for (const f of stagedFiles) {
        if (await Bun.file(f).exists()) {
          existingFiles.push(f);
        }
      }

      const codeFiles = existingFiles.filter((f) => /\.(js|ts|tsx)$/.test(f));

      if (codeFiles.length > 0) {
        const ruleErrors = await validateMinecraftRules(codeFiles);
        if (ruleErrors > 0) {
          return false;
        }
        const jsdocErrors = await validateJsDocRules(codeFiles, { staged: true });
        if (jsdocErrors > 0) {
          return false;
        }

        const unstagedFiles = new Set<string>();
        try {
          const unstagedOutput = await $`git diff --name-only -- ${codeFiles}`.quiet().text();
          for (const f of unstagedOutput
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)) {
            unstagedFiles.add(f);
          }
        } catch {
          // If git diff fails, proceed without unstaged isolation
        }

        const fullyStagedFiles = codeFiles.filter((f) => !unstagedFiles.has(f));
        const partiallyStagedFiles = codeFiles.filter((f) => unstagedFiles.has(f));

        const oxlintBin = Bun.which('oxlint') ?? './node_modules/.bin/oxlint';
        if (fullyStagedFiles.length > 0) {
          await $`${oxlintBin} --fix ${fullyStagedFiles}`.quiet();
          await $`git add ${fullyStagedFiles}`.quiet();
        }
        if (partiallyStagedFiles.length > 0) {
          const result = await $`${oxlintBin} ${partiallyStagedFiles}`.nothrow().quiet();
          if (result.exitCode !== 0) {
            console.error(result.stdout.toString() + result.stderr.toString());
            return false;
          }
        }
      }

      if (!options?.skipFormat) {
        await $`bun fmt --staged`.quiet();
      }
    }

    if (!options?.skipTypeCheck) {
      console.log('⚡ Running incremental type check...');
      const checkTypes = await $`bun check`.nothrow().quiet();

      if (checkTypes.exitCode !== 0) {
        console.error(
          `=== Type Check Failed (Exit: ${checkTypes.exitCode}) ===\n${checkTypes.stdout}${checkTypes.stderr}`,
        );
        console.error('\n❌ Pre-commit checks failed.');
        return false;
      }
    }

    if (!options?.skipTests) {
      console.log('🧪 Running unit tests...');
      const runTests = await $`bun test --parallel`.nothrow().quiet();

      if (runTests.exitCode !== 0) {
        console.error(`=== Unit Tests Failed (Exit: ${runTests.exitCode}) ===\n${runTests.stdout}${runTests.stderr}`);
        console.error('\n❌ Unit test suite failed.');
        return false;
      }
    }

    console.log('✨ All pre-commit checks passed!');
    return true;
  } catch (error) {
    console.error('Pre-commit hook exception:', error);
    return false;
  }
}

if (import.meta.main) {
  const success = await runPreCommitHook();
  if (!success) {
    process.exit(1);
  }
}
