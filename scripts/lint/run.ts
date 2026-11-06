import { $ } from 'bun';

import { validateIcons } from './icons.ts';
import { getChangedFiles, validateJsDocRules } from './jsdocRules.ts';
import { validateMinecraftRules } from './minecraftRules.ts';
import { validateSchemas } from './schemas.ts';

interface TaskResult {
  Task: string;
  'Duration (ms)': string;
  Status: string;
}

/** Configuration options for the project linting pipeline. */
export interface LintPipelineOptions {
  fix?: boolean;
}

/**
 * Executes a named lint task asynchronously, capturing runtime duration and error output.
 *
 * @param name Display label for the lint task.
 * @param command Asynchronous task function to execute.
 * @returns Task execution result with duration and status indicators.
 */
async function runTask(name: string, command: () => Promise<unknown>): Promise<TaskResult> {
  const start = performance.now();
  let status = '✅ Passed';
  let errorDetail = '';
  try {
    await command();
  } catch (err: unknown) {
    status = '❌ Failed';
    const errObj = err as { stdout?: Buffer | string; stderr?: Buffer | string } | undefined;
    const stdout = errObj?.stdout ? errObj.stdout.toString() : '';
    const stderr = errObj?.stderr ? errObj.stderr.toString() : '';
    errorDetail = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') || String(err);
  }
  const duration = (performance.now() - start).toFixed(2);
  if (errorDetail) {
    console.error(`\n❌ Error details for [${name}]:\n${errorDetail}`);
  }
  return { Task: name, 'Duration (ms)': `${duration} ms`, Status: status };
}

/**
 * Main coordinator executing all project validation and linting tasks in parallel.
 *
 * @param options - Pipeline options controlling fix mode.
 * @returns Resolves with true if all lint tasks passed, false if any failed.
 */
export async function runLintingPipeline(options?: LintPipelineOptions): Promise<boolean> {
  const isFix = options?.fix ?? false;
  const overallStart = performance.now();
  console.log(`⚡ Launching profiled Bun-native linting pipeline (${isFix ? 'Fix Mode' : 'Check Mode'})...\n`);

  const oxlintBin = Bun.which('oxlint') ?? './node_modules/.bin/oxlint';

  const mcRulesTask = runTask('Minecraft Custom Rules', async () => {
    const errors = await validateMinecraftRules();
    if (errors > 0) {
      throw new Error(`Found ${errors} Minecraft rule violation(s).`);
    }
  });

  const oxlintTask = runTask('Oxlint Engine (Pure Rust)', () => {
    return isFix ? $`${oxlintBin} --fix`.quiet() : $`${oxlintBin}`.quiet();
  });

  const schemaTask = runTask('JSON Schema Validation', () => validateSchemas());
  const iconTask = runTask('Icon & Texture Integrity', () => validateIcons());
  const typeCheckTask = runTask('TypeScript Type Check', () => $`bun check`.quiet());
  /**
   * Performs an automated JSDoc documentation audit on all files modified on the current branch. File selection
   * invariant: Computes merge base against origin/main to capture all committed, staged, and working-tree changes, plus
   * untracked files via `git status --porcelain -uall`.
   */
  const jsdocTask = runTask('JSDoc Documentation Audit', async () => {
    const changedFiles = await getChangedFiles();
    if (changedFiles.length > 0) {
      const errors = await validateJsDocRules(changedFiles);
      if (errors > 0) {
        throw new Error(`Found ${errors} missing JSDoc documentation violation(s).`);
      }
    }
  });

  const results = await Promise.all([mcRulesTask, oxlintTask, schemaTask, iconTask, typeCheckTask, jsdocTask]);

  const totalDuration = (performance.now() - overallStart).toFixed(2);

  console.table(results);
  console.log(`\n⏱️ Total Pipeline Execution Wall-Clock Time: ${totalDuration} ms`);

  const hasFailure = results.some((r) => r.Status.includes('Failed'));
  return !hasFailure;
}

if (import.meta.main) {
  const isFix = process.argv.includes('--fix');
  const success = await runLintingPipeline({ fix: isFix });
  if (!success) {
    process.exit(1);
  }
}
