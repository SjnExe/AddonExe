#!/bin/sh
# Bootstrapper for AddonExe Environment Engine
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

if [ -d "/data/data/com.termux" ]; then
    echo "📱 Termux environment confirmed: Provisioning system dependencies..."

    # Inject Bun Android target profile into configuration safely if not present
    if ! grep -q "BUN_OPTIONS=" "$HOME/.bashrc" 2>/dev/null; then
        echo "🔧 Injecting Bun Android target mapping into ~/.bashrc..."
        printf "\n# Added by AddonExe Setup Engine\nexport BUN_OPTIONS='--os=android'\n" >> "$HOME/.bashrc"
    fi
    # Apply to current execution context for the following pipeline tasks
    export BUN_OPTIONS='--os=android'

    # We always ensure glibc-repo and update to avoid lock issues later
    pkg install -y glibc-repo
    pkg update -y

    # Install all required packages sequentially to avoid dpkg lock contention
    pkg install -y glibc-runner rust lld golang attr-glibc bzip2-glibc coreutils-glibc curl-glibc findutils-glibc grep-glibc less-glibc libacl-glibc libcap-glibc libcap-ng-glibc libgmp-glibc libpam-glibc libsmartcols-glibc pcre2-glibc sed-glibc tar-glibc util-linux-glibc xz-utils-glibc oxlint
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
