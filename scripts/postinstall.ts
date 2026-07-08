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
        console.log('⚙️ Native Git pre-commit verification hook bound.');
    }

    // Safely parse and upgrade terminal workspace profiles
    const bashrcPath = path.join(homeDir, '.bashrc');
    if (existsSync(bashrcPath)) {
        let bashrcContent = await Bun.file(bashrcPath).text();

        if (!bashrcContent.includes('"$1" = "test"')) {
            console.log('⚡ Configuring your ~/.bashrc bun interceptor for optimized testing...');

            const startMarker = '# >>> ADDONEXE PROFILE START >>>';
            const endMarker = '# <<< ADDONEXE PROFILE END <<<';

            const upgradedBlock = `${startMarker}
# Automated Environment Paths for Cargo and Bun runtimes
export PATH="/data/data/com.termux/files/home/.cargo/bin:/data/data/com.termux/files/home/.bun/bin:$PATH"
# Intercept 'bun' commands in Termux for optimization and upgrades
function bun() {
    if [ "$1" = "upgrade" ]; then
        btm update bun
    elif [ "$1" = "test" ]; then
        shift
        command bun test --isolate --parallel "$@"
    else
        command bun "$@"
    fi
}
${endMarker}`;

            if (bashrcContent.includes(startMarker) && bashrcContent.includes(endMarker)) {
                const startIndex = bashrcContent.indexOf(startMarker);
                const endIndex = bashrcContent.indexOf(endMarker) + endMarker.length;

                bashrcContent = bashrcContent.substring(0, startIndex) + upgradedBlock + bashrcContent.substring(endIndex);
                await Bun.write(bashrcPath, bashrcContent);
                console.log('✅ Existing ~/.bashrc ADDONEXE profile block upgraded cleanly!');
            } else {
                const pureTestFunction = `bun() {
    if [ "$1" = "test" ]; then
        shift
        command bun test --isolate --parallel "$@"
    else
        command bun "$@"
    fi
}`;
                const wrapper = `\n${startMarker}\n${pureTestFunction}\n${endMarker}\n`;
                await Bun.write(bashrcPath, bashrcContent + wrapper);
                console.log('✅ New isolated bun test runner appended to your ~/.bashrc successfully!');
            }
            console.log('💡 Run "source ~/.bashrc" to apply changes instantly.');
        } else {
            console.log('✅ Optimized bun test wrapper is already configured inside ~/.bashrc.');
        }
    }
}

postinstallTask().catch(console.error);
