#!/bin/sh
# Bootstrapper for AddonExe Environment Engine
export PATH="$HOME/.bun/bin:$PATH"

if [ -d "/data/data/com.termux" ]; then
    echo "📱 Termux environment confirmed: Ensuring RepoExe APT repository..."

    # Register RepoExe custom repository if missing
    if [ ! -f "/data/data/com.termux/files/usr/etc/apt/sources.list.d/repoexe.list" ]; then
        echo "🔑 Registering RepoExe repository endpoint..."
        curl -sL https://sjnexe.github.io/RepoExe/install | sh
    fi

    # Install pre-built tsc, jscpd, and oxlint binaries from RepoExe/Termux without compiling
    if ! command -v tsc >/dev/null 2>&1 || ! command -v jscpd >/dev/null 2>&1 || ! command -v oxlint >/dev/null 2>&1 || [ "$1" = "--force" ]; then
        echo "📦 Installing pre-built binary packages (tsc, jscpd, oxlint)..."
        pkg update -y
        pkg install -y tsc jscpd oxlint
    else
        echo "✅ Required pre-built binaries (tsc, jscpd, oxlint) are functional."
    fi
fi

# Verify Bun runtime execution
if ! bun --version >/dev/null 2>&1; then
    echo "📦 Bootstrapping isolated Bun runtime environment..."
    if [ -d "/data/data/com.termux" ]; then
        rm -rf "$HOME/.bun"
        rm -f /data/data/com.termux/files/usr/bin/bun 2>/dev/null
        curl -fsSL "https://raw.githubusercontent.com/Happ1ness-dev/bun-termux/main/helper_scripts/bun-termux-manager" | bash -s install
    else
        echo "💻 Standard Linux environment confirmed: Installing official Bun runtime..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
    fi
else
    echo "✅ Bun runtime is already installed."
fi

# Configure shell environment in ~/.bashrc if missing
BASHRC="$HOME/.bashrc"
if ! grep -q "BUN_OPTIONS" "$BASHRC" 2>/dev/null; then
    echo "" >> "$BASHRC"
    echo "# Bun & Termux Environment" >> "$BASHRC"
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$BASHRC"
    echo 'export BUN_OPTIONS="--os=android"' >> "$BASHRC"
fi

export PATH="$HOME/.bun/bin:$PATH"
export BUN_OPTIONS="--os=android"

chmod +x setup.sh
bun scripts/setup.ts "$@"
