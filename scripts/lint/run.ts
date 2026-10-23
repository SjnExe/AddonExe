import { $ } from 'bun';

import { validateIcons } from './icons.ts';
import { validateMinecraftRules } from './minecraft-rules.ts';
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

    const mcRulesTask = runTask('Minecraft Custom Rules', async () => {
        const errors = await validateMinecraftRules();
        if (errors > 0) {
            throw new Error(`Found ${errors} Minecraft rule violation(s).`);
        }
    });

    const termuxOxlint = '/data/data/com.termux/files/usr/bin/oxlint';
    const hasNativeOxlint = await Bun.file(termuxOxlint).exists();
    const oxlintTask = runTask('Oxlint Engine (Pure Rust)', () => {
        if (hasNativeOxlint) {
            return isFix ? $`${termuxOxlint} --fix`.quiet() : $`${termuxOxlint}`.quiet();
        }
        return isFix ? $`./node_modules/.bin/oxlint --fix`.quiet() : $`./node_modules/.bin/oxlint`.quiet();
    });

    const schemaTask = runTask('JSON Schema Validation', () => validateSchemas());

    const iconTask = runTask('Icon & Texture Integrity', () => validateIcons());

    const typeCheckTask = runTask('TypeScript Type Check', () => $`bun check`.quiet());

    const results = await Promise.all([mcRulesTask, oxlintTask, schemaTask, iconTask, typeCheckTask]);

    const totalDuration = (performance.now() - overallStart).toFixed(2);

    console.table(results);
    console.log(`\n⏱️ Total Pipeline Execution Wall-Clock Time: ${totalDuration} ms`);

    const hasFailure = results.some((r) => r.Status.includes('Failed'));
    if (hasFailure) {
        process.exit(1);
    }
}

runLintingPipeline();
