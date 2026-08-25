#!/bin/sh
# Bootstrapper for AddonExe Environment Engine
#
# Summary of setup.sh operations:
# 1. Environment Detection:
#    - Checks if running inside Android Termux (`/data/data/com.termux`).
# 2. Termux Flow:
#    - Verifies presence of `repoexe` (installs via bootstrapper script if missing).
#    - Executes `repoexe enable all` to configure APT & NPM/Bun registry proxies for bionic compatibility.
#    - Installs native Termux Bun via `pkg install bun` if `bun` command is missing or `--force` flag is passed.
# 3. Standard Linux Flow:
#    - Installs official Bun runtime via official install script (`bun.sh`) if missing.
# 4. Shell Configuration & Defaults:
#    - Appends PATH and `BUN_OPTIONS="--os=android"` environment variables to `$HOME/.bashrc` if not present.
#    - Exports PATH and `BUN_OPTIONS` for the current execution context.
# 5. Handover Execution:
#    - Invokes project setup pipeline via `bun scripts/setup.ts "$@"`.

if [ -d "/data/data/com.termux" ]; then
    echo "📱 Termux environment confirmed: Ensuring RepoExe configuration..."
    if ! command -v repoexe >/dev/null 2>&1; then
        echo "🔑 Registering RepoExe..."
        curl -sL https://sjnexe.github.io/RepoExe/install | sh -s -- --bootstrap
    fi
    
    # Enable APT and NPM/Bun registry proxies (proxies patched bionic binaries for jscpd/tsc)
    repoexe enable all

    # Install native Bun via APT package manager if missing
    if ! command -v bun >/dev/null 2>&1 || [ "$1" = "--force" ]; then
        echo "📦 Installing native Termux Bun..."
        pkg update -y
        pkg install -y bun
    fi
else
    echo "💻 Standard Linux environment confirmed: Installing official Bun runtime..."
    if ! command -v bun >/dev/null 2>&1; then
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
    fi
fi

# Ensure shell environment defaults in ~/.bashrc
BASHRC="$HOME/.bashrc"
if ! awk '/BUN_OPTIONS/ {found=1} END {if (found) exit 0; else exit 1}' "$BASHRC" 2>/dev/null; then
    echo "" >> "$BASHRC"
    echo "# Bun & Termux Environment" >> "$BASHRC"
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$BASHRC"
    echo 'export BUN_OPTIONS="--os=android"' >> "$BASHRC"
fi

export PATH="$HOME/.bun/bin:$PATH"
export BUN_OPTIONS="--os=android"

chmod +x setup.sh
bun scripts/setup.ts "$@"
