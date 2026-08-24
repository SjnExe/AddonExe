#!/bin/sh
# Bootstrapper for AddonExe Environment Engine

if [ -d "/data/data/com.termux" ]; then
    echo "📱 Termux environment confirmed: Ensuring RepoExe configuration..."
    if ! command -v repoexe >/dev/null 2>&1; then
        echo "🔑 Registering RepoExe..."
        curl -sL https://sjnexe.github.io/RepoExe/install | sh -s -- --bootstrap
    fi
    
    # Enable APT and NPM/Bun registry proxies
    repoexe enable all

    # Install native Bun via APT
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

# Ensure shell environment defaults
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
