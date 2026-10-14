# AddonExe Developer Guide

This directory contains technical documentation and architectural references for developing **AddonExe**.

## Official Minecraft Bedrock Creator References

- [Minecraft Creator Documentation (Bedrock)](https://learn.microsoft.com/en-us/minecraft/creator/?view=minecraft-bedrock-stable)
- [@minecraft/server API Reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/minecraft-server?view=minecraft-bedrock-stable)
- [@minecraft/server-ui API Reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/minecraft-server-ui?view=minecraft-bedrock-stable)

## Codebase Architecture

- **`src/`**: All TypeScript source code (compiled to `packs/behavior/scripts/`).
    - **`src/config.ts`**: Primary configuration defaults and feature switches.
    - **`src/core/`**: Core managers, command registration, storage, permission engine, and UI builders/panels.
    - **`src/features/`**: Modular feature packages (`anticheat`, `auction`, `daily`, `economy`, `essentials`, `games`, `kit`, `moderation`, `ranks`, `shop`, `sidebar`, `social`, `team`, `teleport`, `test`, `vote`).
- **`packs/behavior/`**: Behavior Pack entities, items, recipes, loot tables, and `functions/owner.mcfunction`.
- **`packs/resource/`**: Resource Pack custom dark-mode UI (`ui/server_form.json`), HUD, scoreboard, and pause screen overrides.
- **`scripts/`**: Bun build, manifest generation, schema validation, and Oxlint scripts.

## Build & Versioning Workflow

`package.json` is the single source of truth for the addon version.

- **Local Build:** `bun run build` compiles TypeScript and updates `packs/*/manifest.json`.
- **Packaged Archive:** `bun scripts/build.ts --zip` generates `.mcaddon` and `.mcpack` archives.
- **Nightly Build:** `bun run build:nightly` injects the nightly test suite and appends the CI run number.
- **Release Build:** `bun run build:release` minifies output for production releases.
- **Update Minecraft Beta Dependencies:** `bun run mc-update`.

## Developer Documentation Index

- [Agent & Contributor Technical Guide](../AGENTS.md)
- [Coding Style Guidelines](CodingStyle.md)
- [Standardization Guidelines](StandardizationGuidelines.md)
- [Configuration Loading & Merging Explained](ConfigurationExplanation.md)
- [Minecraft Bedrock Text Formatting Codes](MinecraftTextFormatting.md)
