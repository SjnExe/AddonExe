import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';

const isTermux = existsSync('/data/data/com.termux');
const homeDir = os.homedir();
const bashrcPath = `${homeDir}/.bashrc`;

async function configureSystemEnvironment() {
    console.log('🔍 Analyzing system environment profile...');

    if (isTermux) {
        console.log('📱 Termux environment detected. Validating repositories and toolchains...');

        // Parallel repository initialization and system dependency verification
        await $`pkg update -y`.quiet();

        console.log('📦 Deploying system components concurrently...');
        await Promise.all([
            $`pkg install -y rust lld`.quiet(),
            $`pkg install -y glibc-repo`.quiet().catch(() => {}) // Gracefully handle if glibc-repo package name varies
        ]);
    } else {
        console.log('💻 Standard Linux environment verified.');
    }
}

async function syncProfileConfiguration() {
    if (!existsSync(bashrcPath)) return;

    console.log('⚙️ Synchronizing shell environmental paths safely...');
    let content = await fs.readFile(bashrcPath, 'utf8');

    // Define unique markers to isolate AddonExe changes cleanly
    const startMarker = '# >>> ADDONEXE PROFILE START >>>';
    const endMarker = '# <<< ADDONEXE PROFILE END <<<';

    // Regex to cleanly match and remove any pre-existing config blocks to prevent duplication
    const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`, 'g');
    content = content.replace(blockRegex, '');

    const optimizedBlock = `${startMarker}
# Automated Environment Paths for Cargo and Bun runtimes
export PATH="${homeDir}/.cargo/bin:${homeDir}/.bun/bin:$PATH"
${endMarker}\n`;

    // Append clean, unique block to the end of your configuration file
    await fs.writeFile(bashrcPath, content + optimizedBlock, 'utf8');
    console.log('✨ System shell profile updated idempotently (zero duplicates generated).');
}

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');

    // Core pipeline runs concurrently where safe
    await configureSystemEnvironment();
    await syncProfileConfiguration();

    console.log('🚀 Invoking project package ecosystem installation...');
    await $`bun install`;

    console.log('✨ System environment alignment fully operational.');
}

runPipeline().catch((err) => {
    console.error('❌ Critical failure within environment setup runtime:', err);
    process.exit(1);
});
