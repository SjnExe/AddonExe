import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isTermux = existsSync('/data/data/com.termux');
const homeDir = os.homedir();
const args = process.argv.slice(2);
const forceRebuild = args.includes('--rebuild') || args.includes('--force');

async function configureSystemEnvironment() {
    console.log('🔍 Analyzing system environment profile...');

    // bun-node-shim: Route Node-dependent hooks/wrappers directly to Bun on Termux
    const binDir = path.join(homeDir, '.bun/bin');
    const nodeShimPath = path.join(binDir, 'node');
    if (isTermux && !existsSync(nodeShimPath)) {
        await fs.mkdir(binDir, { recursive: true });
        await fs.symlink(process.execPath, nodeShimPath).catch(() => {});
        console.log('🔗 Created Termux Node -> Bun compatibility symlink.');
    }

    if (isTermux) {
        console.log('📱 Termux environment detected.');
    } else {
        console.log('💻 Standard Linux environment verified. No system-level dependencies required.');
    }
}

async function compilePatchedTsc(): Promise<string | null> {
    if (!isTermux) {
        return null;
    }

    const persistentBinPath = path.join(homeDir, '.cache/tsc-patched-bin');

    // Fast-path: Skip rebuild if binary already exists and executes cleanly
    if (!forceRebuild && existsSync(persistentBinPath)) {
        const check = await $`${persistentBinPath} --version`.nothrow().quiet();
        if (check.exitCode === 0) {
            console.log('✅ Patched native tsc binary already exists and functional. Skipping compilation.');
            return persistentBinPath;
        }
        console.warn('⚠️ Existing tsc binary is unexecutable. Triggering rebuild...');
    }

    const hasGo = (await $`which go`.nothrow().quiet()).exitCode === 0;
    if (!hasGo) {
        console.log('📦 Go compiler engine missing. Auto-provisioning golang...');
        await $`pkg install -y golang`;
    }

    console.log('🏗️  Preparing native TypeScript compiler engine workspace...');
    const buildDir = path.join(homeDir, '.cache/typescript-go');
    await fs.mkdir(buildDir, { recursive: true });

    if (!existsSync(path.join(buildDir, '.git'))) {
        console.log('📥 Cloning microsoft/typescript-go upstream engine...');
        await $`git clone https://github.com/microsoft/typescript-go.git ${buildDir}`.quiet();
    } else {
        console.log('🔄 Hydrating and syncing latest typescript-go source changes...');
        await $`git -C ${buildDir} reset --hard`.quiet();
        await $`git -C ${buildDir} pull`.quiet();
    }

    const targetFile = path.join(buildDir, 'internal/fswatch/fanotify_linux.go');
    if (existsSync(targetFile)) {
        let code = await Bun.file(targetFile).text();

        if (code.includes('unix.FanotifyInit') && !code.includes('fakeFanotifyInit')) {
            console.log('🧬 Injecting universal Seccomp sandbox mitigation into source logic...');
            code = code.replaceAll('unix.FanotifyInit', 'fakeFanotifyInit');

            const mockImplementation = `
// Patched dynamically for Termux Android Seccomp sandboxing safety
func fakeFanotifyInit(flags uint, event_f_flags uint) (int, error) {
\treturn -1, unix.ENOSYS
}
`;
            await Bun.write(targetFile, code + mockImplementation);
        }
    }

    console.log('🐹 Building optimized native toolchain binary via Go...');
    const buildRes = await $`cd ${buildDir} && go build -o tsc ./cmd/tsgo`.nothrow().quiet();

    if (buildRes.exitCode !== 0) {
        console.error('❌ Failed to compile typescript-go native binary.');
        if (existsSync(persistentBinPath)) {
            console.warn('⚠️ Falling back to existing cached tsc binary.');
            return persistentBinPath;
        }
        throw new Error('Native tsc build failed and no cached binary available.');
    }

    await fs.mkdir(path.dirname(persistentBinPath), { recursive: true });
    await fs.copyFile(path.join(buildDir, 'tsc'), persistentBinPath);

    console.log('🧹 Purging redundant codebase files to minimize mobile storage footprint...');
    const workspaceFiles = await fs.readdir(buildDir);
    for (const file of workspaceFiles) {
        if (file !== '.git') {
            await fs.rm(path.join(buildDir, file), { recursive: true, force: true }).catch(() => {});
        }
    }

    console.log('✅ Native tsc binary successfully compiled and cached.');
    return persistentBinPath;
}

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');

    await configureSystemEnvironment();
    const tscBuildTask = compilePatchedTsc();

    console.log('🚀 Invoking project package ecosystem installation...');
    const bunInstallTask = $`bun install`;

    await Promise.all([tscBuildTask, bunInstallTask]);

    console.log('✨ System environment alignment fully operational.');
}

runPipeline().catch((err) => {
    console.error('❌ Critical failure within environment setup runtime:', err);
    process.exit(1);
});
