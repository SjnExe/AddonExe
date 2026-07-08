import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const homeDir = os.homedir();
const isTermux = existsSync('/data/data/com.termux');
const termuxBinDir = '/data/data/com.termux/files/usr/bin';
const cargoBinDir = `${homeDir}/.cargo/bin`;

const paths = [cargoBinDir, isTermux ? termuxBinDir : '', process.env.PATH].filter(Boolean);
process.env.PATH = paths.join(path.delimiter);

async function postinstallTask() {
    if (isTermux) {
        const cargoExists = existsSync(path.join(termuxBinDir, 'cargo')) || existsSync(path.join(cargoBinDir, 'cargo'));
        const jscpdExists = existsSync(path.join(cargoBinDir, 'jscpd')) || existsSync(path.join(termuxBinDir, 'jscpd'));

        if (cargoExists) {
            if (!jscpdExists) {
                try {
                    console.log('⚡ Termux toolchain verified: Compiling native jscpd with microarchitecture optimizations...');
                    await $`RUSTFLAGS="-C target-cpu=native -C link-arg=-fuse-ld=lld -C strip=symbols" cargo install jscpd`;
                } catch (err) {
                    console.error('❌ Native compilation failed during execution:', err);
                }
            } else {
                console.log('✅ Native jscpd binary detected in toolchain path. Skipping network registry checks.');
            }

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
        console.log('⚙️  Native Git pre-commit verification hook bound.');
    }

    if (isTermux) {
        const patchedTscPath = path.join(homeDir, '.cache/tsc-patched-bin');
        const binLink = path.join(process.cwd(), 'node_modules/.bin/tsc');

        if (existsSync(patchedTscPath) && existsSync(binLink)) {
            const realPath = await fs.realpath(binLink);
            console.log(`🎯 Resolving ecosystem symlink target path: ${realPath}`);
            await fs.copyFile(patchedTscPath, realPath);
            await fs.chmod(realPath, 0o755);
            console.log('✅ Injected Termux-compliant native tsc binary wrapper successfully.');
        }
    }

    // Force hot-swap the native jscpd binary into the local node_modules layout on every installation pass
    if (isTermux) {
        const nativeJscpdPath = path.join(homeDir, '.cargo/bin/jscpd');
        const npmJscpdBinDir = path.join(process.cwd(), 'node_modules/jscpd-linux-arm64-gnu/bin');
        const npmJscpdPath = path.join(npmJscpdBinDir, 'jscpd');

        if (existsSync(nativeJscpdPath)) {
            await fs.mkdir(npmJscpdBinDir, { recursive: true });
            await fs.copyFile(nativeJscpdPath, npmJscpdPath);
            await fs.chmod(npmJscpdPath, 0o755);
            console.log('✅ Injected Termux-compliant native jscpd binary wrapper successfully.');
        }
    }

    const bashrcPath = path.join(homeDir, '.bashrc');
    if (existsSync(bashrcPath)) {
        console.log('⚙️  Synchronizing shell profile configuration wrappers...');
        let bashrcContent = await Bun.file(bashrcPath).text();

        const startMarker = '# >>> ADDONEXE PROFILE START >>>';
        const endMarker = '# <<< ADDONEXE PROFILE END <<<';

        const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`, 'g');
        bashrcContent = bashrcContent.replace(blockRegex, '');

        const runtimeInterceptorBlock = `${startMarker}
# Automated Environment Paths for Cargo and Bun runtimes
export PATH="${homeDir}/.cargo/bin:${homeDir}/.bun/bin:$PATH"

function bun() {
    if [ "$1" = "test" ]; then
        shift
        command bun test --isolate --parallel "$@"
    elif [ -d "/data/data/com.termux" ]; then
        if [ "$1" = "upgrade" ]; then
            btm update bun
        elif [ "$1" = "install" ] || [ "$1" = "i" ] || [ "$1" = "add" ]; then
            if [ -f "scripts/update-mc.ts" ]; then
                command bun scripts/update-mc.ts
            fi
            command bun "$@"
        else
            command bun "$@"
        fi
    else
        command bun "$@"
    fi
}
${endMarker}\n`;

        await Bun.write(bashrcPath, bashrcContent + runtimeInterceptorBlock);
        console.log('✨ System shell profile synchronization completed successfully.');
    }
}

postinstallTask().catch(console.error);
