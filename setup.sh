#!/bin/sh
# Bootstrapper for AddonExe Environment Engine
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

if [ -d "/data/data/com.termux" ]; then
    echo "📱 Termux environment confirmed: Checking system dependencies..."

    # Inject Bun Android target profile into configuration safely if not present
    if ! grep -q "BUN_OPTIONS=" "$HOME/.bashrc" 2>/dev/null; then
        echo "🔧 Injecting Bun Android target mapping into ~/.bashrc..."
        printf "\n# Added by AddonExe Setup Engine\nexport BUN_OPTIONS='--os=android'\n" >> "$HOME/.bashrc"
    fi
    export BUN_OPTIONS='--os=android'

    # Only run pkg update/install if critical tools like oxlint or golang are missing or --force is requested
    if ! command -v oxlint >/dev/null 2>&1 || ! command -v go >/dev/null 2>&1 || [ "$1" = "--force" ] || [ "$1" = "--rebuild" ]; then
        echo "📦 Provisioning missing system packages via pkg..."
        pkg install -y glibc-repo 2>/dev/null
        pkg update -y
        pkg install -y glibc-runner rust lld golang attr-glibc bzip2-glibc coreutils-glibc curl-glibc findutils-glibc grep-glibc less-glibc libacl-glibc libcap-glibc libcap-ng-glibc libgmp-glibc libpam-glibc libsmartcols-glibc pcre2-glibc sed-glibc tar-glibc util-linux-glibc xz-utils-glibc oxlint
    else
        echo "✅ Required Termux system packages are already installed."
    fi
fi

# Verify actual runtime execution
if ! bun --version >/dev/null 2>&1; then
    echo "📦 Bun runtime not found or unexecutable. Bootstrapping isolated runtime environment..."
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
    echo "✅ Bun runtime is already installed and functional."
fi

# Automatically configure shell environment if missing
BASHRC="$HOME/.bashrc"
if ! grep -q "BUN_INSTALL" "$BASHRC" 2>/dev/null && ! grep -q "BUN_OPTIONS" "$BASHRC" 2>/dev/null; then
    echo "" >> "$BASHRC"
    echo "# Bun & Cargo Toolchains" >> "$BASHRC"
    echo 'export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"' >> "$BASHRC"
    echo 'export BUN_OPTIONS="--os=android"' >> "$BASHRC"
fi

export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"
export BUN_OPTIONS="--os=android"

chmod +x setup.sh
bun scripts/setup.ts "$@"
