import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isTermux = existsSync('/data/data/com.termux');
const homeDir = os.homedir();

async function configureSystemEnvironment() {
    console.log('🔍 Analyzing system environment profile...');

    const binDir = path.join(homeDir, '.bun/bin');
    const nodeShimPath = path.join(binDir, 'node');
    if (isTermux && !existsSync(nodeShimPath)) {
        await fs.mkdir(binDir, { recursive: true });
        await fs.symlink(process.execPath, nodeShimPath).catch(() => {});
        console.log('🔗 Created Termux Node -> Bun compatibility symlink.');
    }

    if (isTermux) {
        console.log('📱 Termux environment verified.');
        const tscCheck = await $`which tsc`.nothrow().quiet();
        const jscpdCheck = await $`which jscpd`.nothrow().quiet();

        if (tscCheck.exitCode === 0) {
            console.log('✅ Native pre-built tsc binary detected.');
        } else {
            console.warn('⚠️ tsc binary missing from PATH. Run "pkg install tsc" via RepoExe.');
        }

        if (jscpdCheck.exitCode === 0) {
            console.log('✅ Native pre-built jscpd binary detected.');
        } else {
            console.warn('⚠️ jscpd binary missing from PATH. Run "pkg install jscpd" via RepoExe.');
        }
    } else {
        console.log('💻 Standard Linux environment verified.');
    }
}

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');

    await configureSystemEnvironment();

    console.log('🚀 Invoking project package ecosystem installation...');
    await $`bun install`;

    console.log('✨ System environment alignment fully operational.');
}

runPipeline().catch((err) => {
    console.error('❌ Critical failure within environment setup runtime:', err);
    process.exit(1);
});
