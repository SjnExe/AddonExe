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
    console.log(`⚡ Launching profiled parallel linting pipeline (${isFix ? 'Fix Mode' : 'Check Mode'})...\n`);

    const oxlintTask = runTask('1. Oxlint Engine (Rust)', () => (isFix ? $`bun scripts/lint/oxlint.ts --fix`.quiet() : $`bun scripts/lint/oxlint.ts`.quiet()));

    const eslintTask = runTask('2. ESLint Engine (Cache)', () =>
        isFix ? $`bun eslint src scripts eslint.config.js --fix --cache`.quiet() : $`bun eslint src scripts eslint.config.js --cache`.quiet()
    );

    const schemaTask = runTask('3. JSON Schema Validation', () => $`bun run scripts/lint/schemas.ts`.quiet());

    const iconTask = runTask('4. Icon & Texture Integrity', () => $`bun run scripts/lint/icons.ts`.quiet());

    const results = await Promise.all([oxlintTask, eslintTask, schemaTask, iconTask]);
    const totalDuration = (performance.now() - overallStart).toFixed(2);

    console.table(results);
    console.log(`\n⏱️ Total Pipeline Execution Wall-Clock Time: ${totalDuration} ms`);

    const hasFailure = results.some((r) => r.Status.includes('Failed'));
    if (hasFailure) {
        process.exit(1);
    }
}

runLintingPipeline();
