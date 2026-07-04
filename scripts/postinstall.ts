import { $ } from 'bun';
import { existsSync } from 'node:fs';
import os from 'node:os';

const homeDir = os.homedir();
// Dynamically pass Cargo context pathing directly into runtime process execution
process.env.PATH = `${homeDir}/.cargo/bin:${process.env.PATH}`;

async function postinstallTask() {
    if (existsSync('/data/data/com.termux')) {
        try {
            await $`command -v cargo`.quiet();

            console.log('⚡ Native toolchain found: Compiling jscpd binary utilizing LLVM optimizations...');
            await $`RUSTFLAGS="-C link-arg=-fuse-ld=lld" cargo install jscpd`;

            console.log('🧹 Purging secondary cargo registry cache directories...');
            await $`rm -rf ${homeDir}/.cargo/registry/src ${homeDir}/.cargo/registry/cache`.quiet();
        } catch {
            console.log('\n⚠️ [Toolchain Warning]: cargo could not be initialized. Verify "pkg install rust lld" output.\n');
        }
    }

    // Git Hook Generation Hook
    if (existsSync('.git')) {
        const hookPath = '.git/hooks/pre-commit';
        await Bun.write(hookPath, '#!/bin/sh\nbun scripts/pre-commit.ts\n');
        await $`chmod +x ${hookPath}`.quiet();
        console.log('⚙️ Native Git pre-commit verification hook bound.');
    }
}

postinstallTask().catch(console.error);
