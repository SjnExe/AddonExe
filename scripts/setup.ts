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
        await $`pkg update -y`.quiet();

        console.log('📦 Deploying system components concurrently...');
        await Promise.all([$`pkg install -y rust lld`.quiet(), $`pkg install -y glibc-repo`.quiet().catch(() => {})]);
    } else {
        console.log('💻 Standard Linux environment verified.');
    }
}

async function syncProfileConfiguration() {
    if (!existsSync(bashrcPath)) return;

    console.log('⚙️ Synchronizing shell environmental paths safely...');
    let content = await fs.readFile(bashrcPath, 'utf8');

    // Strip unmanaged lines injected by the community installer outside our block
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
    console.log('✨ System shell profile updated idempotently (zero duplicates generated).');
}

async function runPipeline() {
    console.log('--- Starting Architecture Setup ---');
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
