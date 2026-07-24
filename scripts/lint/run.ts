import { $ } from 'bun';

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
        errorDetail = err?.stderr?.toString() || err?.stdout?.toString() || String(err);
    }
    const duration = (performance.now() - start).toFixed(2);
    if (errorDetail) {
        console.error(`\n❌ Error details for [${name}]:\n${errorDetail}`);
    }
    return { Task: name, 'Duration (ms)': `${duration} ms`, Status: status };
}

async function runLintingPipeline() {
    const overallStart = performance.now();
    console.log(`⚡ Launching profiled multi-threaded linting pipeline (${isFix ? 'Fix Mode' : 'Check Mode'})...\n`);

    // Oxlint Engine (Rust - native multi-threading)
    const oxlintTask = runTask('1. Oxlint Engine (Rust)', () => (isFix ? $`bun scripts/lint/oxlint.ts --fix`.quiet() : $`bun scripts/lint/oxlint.ts`.quiet()));

    // Concurrent ESLint Chunk 1: src/core
    const eslintCoreTask = runTask('2a. ESLint (src/core)', () => (isFix ? $`bun eslint src/core --fix --cache`.quiet() : $`bun eslint src/core --cache`.quiet()));

    // Concurrent ESLint Chunk 2: src/features
    const eslintFeaturesTask = runTask('2b. ESLint (src/features)', () => (isFix ? $`bun eslint src/features --fix --cache`.quiet() : $`bun eslint src/features --cache`.quiet()));

    // Concurrent ESLint Chunk 3: Remaining files & scripts
    const eslintRestTask = runTask('2c. ESLint (lib, types & scripts)', () =>
        isFix ? $`bun eslint src/lib src/types scripts eslint.config.js --fix --cache`.quiet() : $`bun eslint src/lib src/types scripts eslint.config.js --cache`.quiet()
    );

    // JSON Schema Validation
    const schemaTask = runTask('3. JSON Schema Validation', () => $`bun run scripts/lint/schemas.ts`.quiet());

    // Icon & Texture Integrity
    const iconTask = runTask('4. Icon & Texture Integrity', () => $`bun run scripts/lint/icons.ts`.quiet());

    // TypeScript Incremental Type Check
    const typeCheckTask = runTask('5. TypeScript Type Check', () => $`bun tsc --noEmit --incremental`.quiet());

    const results = await Promise.all([oxlintTask, eslintCoreTask, eslintFeaturesTask, eslintRestTask, schemaTask, iconTask, typeCheckTask]);

    const totalDuration = (performance.now() - overallStart).toFixed(2);

    console.table(results);
    console.log(`\n⏱️ Total Pipeline Execution Wall-Clock Time: ${totalDuration} ms`);

    const hasFailure = results.some((r) => r.Status.includes('Failed'));
    if (hasFailure) {
        process.exit(1);
    }
}

runLintingPipeline();
