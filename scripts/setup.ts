import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isTermux = existsSync('/data/data/com.termux');
const homeDir = os.homedir();
const bashrcPath = path.join(homeDir, '.bashrc');

async function configureSystemEnvironment() {
    console.log('🔍 Analyzing system environment profile...');

    if (isTermux) {
        console.log('📱 Termux environment detected. Toolchains were handled by setup.sh.');

        const cargoBin = path.join(homeDir, '.cargo/bin/cargo');
        const hasCargo = existsSync('/data/data/com.termux/files/usr/bin/cargo') || existsSync(cargoBin);
        const jscpdBin = path.join(homeDir, '.cargo/bin/jscpd');

        if (hasCargo && !existsSync(jscpdBin)) {
            console.log('🦀 Started installing native jscpd via Cargo for Termux support in background...');
            // Start compilation in background but return the promise to await it later
            return $`${existsSync(cargoBin) ? cargoBin : 'cargo'} install jscpd`;
        }
    } else {
        console.log('💻 Standard Linux environment verified. No system-level dependencies required.');
    }

    return Promise.resolve();
}

async function syncProfileConfiguration() {
    // Clean up failed old global bunfig if it exists
    const globalBunfigPath = path.join(homeDir, '.bunfig.toml');
    if (existsSync(globalBunfigPath)) {
        await fs.unlink(globalBunfigPath).catch(() => {});
    }

    if (!existsSync(bashrcPath)) return;

    console.log('⚙️ Synchronizing shell environmental paths safely...');
    let content = await fs.readFile(bashrcPath, 'utf8');

    // Define unique markers to isolate AddonExe changes cleanly
    const startMarker = '# >>> ADDONEXE PROFILE START >>>';
    const endMarker = '# <<< ADDONEXE PROFILE END <<<';

    // Regex to cleanly match and remove any pre-existing config blocks to prevent duplication
    const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`, 'g');
    content = content.replace(blockRegex, '');

    // Note: We deliberately exclude the 'bun test' alias interceptor here because
    // test flags (--isolate --parallel) are now natively applied via bunfig.toml and package.json
    const bunUpgradeInterceptor = isTermux ? `
# Intercept 'bun upgrade' in Termux to use the community manager
function bun() {
    if [ "$1" = "upgrade" ]; then
        btm update bun
    else
        command bun "$@"
    fi
}
` : '';

    const optimizedBlock = `${startMarker}
# Automated Environment Paths for Cargo and Bun runtimes
export PATH="${homeDir}/.cargo/bin:${homeDir}/.bun/bin:$PATH"${bunUpgradeInterceptor}
${endMarker}\n`;

    // Append clean, unique block to the end of your configuration file
    await fs.writeFile(bashrcPath, content + optimizedBlock, 'utf8');
    console.log('✨ System shell profile updated idempotently (zero duplicates generated).');
}

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');

    // Start background tasks
    const jscpdTask = configureSystemEnvironment();

    // Core pipeline continues sequentially
    await syncProfileConfiguration();

    console.log('🚀 Invoking project package ecosystem installation...');
    const bunInstallTask = $`bun install`;

    // Wait for all concurrent installations to finish
    await Promise.all([jscpdTask, bunInstallTask]);

    console.log('✨ System environment alignment fully operational.');
}

runPipeline().catch((err) => {
    console.error('❌ Critical failure within environment setup runtime:', err);
    process.exit(1);
});
