#!/bin/sh
# Micro-bootstrapper for AddonExe Environment Engine
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

if ! command -v bun >/dev/null 2>&1; then
    echo "📦 Bun runtime not found. Bootstrapping isolated runtime environment..."
    [ -d "/data/data/com.termux" ] && \
        curl -fsSL "https://raw.githubusercontent.com/Happ1ness-dev/bun-termux/main/helper_scripts/bun-termux-manager" | bash -s install || \
        curl -fsSL https://bun.sh/install | bash
fi

# Instantly hand off to the advanced TypeScript Orchestrator
bun scripts/setup.ts
