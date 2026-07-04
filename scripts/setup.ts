import { $ } from 'bun';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isTermux = existsSync('/data/data/com.termux');
const homeDir = os.homedir();
const bashrcPath = path.join(homeDir, '.bashrc');

async function configureSystemEnvironment() {
    if (!isTermux) {
        console.log('💻 Standard Linux environment verified.');
        return;
    }

    console.log('📱 Termux environment detected. Checking toolchain status...');

    const hasCargo = existsSync('/data/data/com.termux/files/usr/bin/cargo') || existsSync(path.join(homeDir, '.cargo/bin/cargo'));
    const hasLld = existsSync('/data/data/com.termux/files/usr/bin/lld');

    if (hasCargo && hasLld) {
        console.log('✅ Core toolchains already provisioned. Skipping package manager overhead.');
        return;
    }

    console.log('📦 Missing components detected. Synchronizing repository indexes...');
    await $`apt update -y`.quiet();

    console.log('📥 Deploying system dependencies inside a single transaction...');
    await $`pkg install -y rust lld glibc-repo`.quiet();

    console.log('🧹 Purging redundant APT package download archives...');
    // Completely drops cached .deb files to keep system storage pristine
    await $`apt clean`.quiet();
}

async function syncProfileConfiguration() {
    if (!existsSync(bashrcPath)) return;

    console.log('⚙️ Synchronizing shell environmental paths safely...');
    let content = await fs.readFile(bashrcPath, 'utf8');

    const externalInjectionsRegex = /# bun\nexport BUN_INSTALL="\$HOME\/\.bun"\nexport PATH="\$BUN_INSTALL\/bin:\$PATH"\n?/g;
    content = content.replace(externalInjectionsRegex, '');

    const startMarker = '# >>> ADDONEXE PROFILE START >>>';
    const endMarker = '# <<< ADDONEXE PROFILE END <<<';

    const blockRegex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}\\n?`, 'g');
    content = content.replace(blockRegex, '');

    const optimizedBlock = `${startMarker}
# Automated Environment Paths for Cargo and Bun runtimes
export BUN_INSTALL="${homeDir}/.bun"
export PATH="${homeDir}/.cargo/bin:$BUN_INSTALL/bin:$PATH"

# Global Interceptor Engine to optimize native Bun workflows
bun() {
  if [ "$1" = "upgrade" ]; then
    echo "🔄 Intercepting 'bun upgrade' to use the safe Termux installer..."
    if command -v btm >/dev/null 2>&1; then
      btm update bun
    else
      curl -fsSL "https://raw.githubusercontent.com/Happ1ness-dev/bun-termux/main/helper_scripts/bun-termux-manager" | bash -s install
    fi
  elif [ "$1" = "test" ]; then
    shift
    command bun test --isolate --parallel "$@"
  else
    command bun "$@"
  fi
}
${endMarker}\n`;

    await fs.writeFile(bashrcPath, content + optimizedBlock, 'utf8');
    console.log('✨ System shell profile updated idempotently.');
}

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');

    await Promise.all([configureSystemEnvironment(), syncProfileConfiguration()]);

    console.log('🚀 Invoking package ecosystem installation (Online-First Sync)...');
    // Standard invocation to ensure active remote registry checking
    await $`bun install`;

    console.log('✨ System environment alignment fully operational.');
}

runPipeline().catch((err) => {
    console.error('❌ Critical failure within environment setup runtime:', err);
    process.exit(1);
});
