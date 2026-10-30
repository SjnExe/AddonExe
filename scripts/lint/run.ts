import { $ } from 'bun';

import { validateIcons } from './icons.ts';
import { validateMinecraftRules } from './minecraftRules.ts';
import { validateSchemas } from './schemas.ts';

interface TaskResult {
  Task: string;
  'Duration (ms)': string;
  Status: string;
}

const isFix = process.argv.includes('--fix');

async function runTask(name: string, command: () => Promise<unknown>): Promise<TaskResult> {
  const start = performance.now();
  let status = '✅ Passed';
  let errorDetail = '';
  try {
    await command();
  } catch (err: any) {
    status = '❌ Failed';
    const stdout = err?.stdout ? err.stdout.toString() : '';
    const stderr = err?.stderr ? err.stderr.toString() : '';
    errorDetail = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') || String(err);
  }
  const duration = (performance.now() - start).toFixed(2);
  if (errorDetail) {
    console.error(`\n❌ Error details for [${name}]:\n${errorDetail}`);
  }
  return { Task: name, 'Duration (ms)': `${duration} ms`, Status: status };
}

async function runLintingPipeline() {
  const overallStart = performance.now();
  console.log(`⚡ Launching profiled Bun-native linting pipeline (${isFix ? 'Fix Mode' : 'Check Mode'})...\n`);

  const oxlintBin = Bun.which('oxlint') ?? './node_modules/.bin/oxlint';

  let results: TaskResult[];

  if (isFix) {
    // In fix mode, run mutating tasks sequentially first to prevent filesystem write races
    const oxlintFixTask = await runTask('Oxlint Engine (Auto-Fix)', () => $`${oxlintBin} --fix`.quiet());
    const fmtFixTask = await runTask('Code Formatting (bun fmt)', () => $`bun fmt`.quiet());

    const readOnlyResults = await Promise.all([
      runTask('Minecraft Custom Rules', async () => {
        const errors = await validateMinecraftRules();
        if (errors > 0) {
          throw new Error(`Found ${errors} Minecraft rule violation(s).`);
        }
      }),
      runTask('JSON Schema Validation', () => validateSchemas()),
      runTask('Icon & Texture Integrity', () => validateIcons()),
      runTask('TypeScript Type Check', () => $`bun check`.quiet()),
    ]);

    results = [oxlintFixTask, fmtFixTask, ...readOnlyResults];
  } else {
    // In check mode, all tasks are read-only and safe to run concurrently
    const mcRulesTask = runTask('Minecraft Custom Rules', async () => {
      const errors = await validateMinecraftRules();
      if (errors > 0) {
        throw new Error(`Found ${errors} Minecraft rule violation(s).`);
      }
    });

    const oxlintTask = runTask('Oxlint Engine (Pure Rust)', () => $`${oxlintBin}`.quiet());
    const fmtTask = runTask('Code Formatting (bun fmt)', () => $`bun fmt --check`.quiet());
    const schemaTask = runTask('JSON Schema Validation', () => validateSchemas());
    const iconTask = runTask('Icon & Texture Integrity', () => validateIcons());
    const typeCheckTask = runTask('TypeScript Type Check', () => $`bun check`.quiet());

    results = await Promise.all([mcRulesTask, oxlintTask, fmtTask, schemaTask, iconTask, typeCheckTask]);
  }

  const totalDuration = (performance.now() - overallStart).toFixed(2);

  console.table(results);
  console.log(`\n⏱️ Total Pipeline Execution Wall-Clock Time: ${totalDuration} ms`);

  const hasFailure = results.some((r) => r.Status.includes('Failed'));
  if (hasFailure) {
    process.exit(1);
  }
}

runLintingPipeline();
