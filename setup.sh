#!/bin/sh
# Bootstrapper for AddonExe Environment Engine
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

if [ -d "/data/data/com.termux" ]; then
    if ! command -v glibc-runner >/dev/null 2>&1; then
        echo "📱 Termux environment confirmed: Provisioning core glibc translation layer..."
        pkg install -y glibc-repo
        pkg update -y
        pkg install -y glibc-runner
    fi
fi

# Verify actual runtime execution instead of trusting path lookups
if ! bun --version >/dev/null 2>&1; then
    echo "📦 Bun runtime not found or unexecutable. Bootstrapping isolated runtime environment..."
    if [ -d "/data/data/com.termux" ]; then
        rm -rf "$HOME/.bun"
        # Clear any stale or broken symlinks left over in the system binary directory
        rm -f /data/data/com.termux/files/usr/bin/bun 2>/dev/null
        curl -fsSL "https://raw.githubusercontent.com/Happ1ness-dev/bun-termux/main/helper_scripts/bun-termux-manager" | bash -s install
    else
        echo "💻 Standard Linux environment confirmed: Installing official Bun runtime..."
        curl -fsSL https://bun.sh/install | bash
        export PATH="$HOME/.bun/bin:$PATH"
    fi
else
    echo "✅ Bun runtime is already installed and functional."
fi

# Hand off to the TypeScript Setup Orchestrator
bun scripts/setup.ts
