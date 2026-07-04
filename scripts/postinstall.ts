import { $ } from 'bun';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const homeDir = os.homedir();
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

// Immunize paths against shell context degradation
const paths = [cargoBinDir, termuxBinDir, process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

async function postinstallTask() {
    if (existsSync('/data/data/com.termux')) {
        const cargoExists = existsSync(path.join(termuxBinDir, 'cargo')) || existsSync(path.join(cargoBinDir, 'cargo'));
        const jscpdExists = existsSync(path.join(cargoBinDir, 'jscpd')) || existsSync(path.join(termuxBinDir, 'jscpd'));

        if (cargoExists) {
            if (!jscpdExists) {
                try {
                    console.log('⚡ Termux toolchain verified: Compiling native jscpd with LLVM optimization...');
                    await $`RUSTFLAGS="-C link-arg=-fuse-ld=lld" cargo install jscpd`;
                } catch (err) {
                    console.error('❌ Native compilation failed during execution:', err);
                }
            } else {
                console.log('✅ Native jscpd binary detected in toolchain path. Skipping network registry checks.');
            }

            // Clean up registry index residuals if present
            if (existsSync(path.join(homeDir, '.cargo/registry'))) {
                console.log('🧹 Purging secondary cargo registry cache directories...');
                await $`rm -rf ${homeDir}/.cargo/registry/src ${homeDir}/.cargo/registry/cache`.quiet();
            }
        } else {
            console.log('\n⚠️ [Toolchain Warning]: cargo binary not found. Run "pkg install rust lld" to enable optimized jscpd support.\n');
        }
    }

    if (existsSync('.git')) {
        const hookPath = '.git/hooks/pre-commit';
        await Bun.write(hookPath, '#!/bin/sh\nbun scripts/pre-commit.ts\n');
        await $`chmod +x ${hookPath}`.quiet();
        console.log('⚙️ Native Git pre-commit verification hook bound.');
    }
}

postinstallTask().catch(console.error);
