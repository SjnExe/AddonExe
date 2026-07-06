# Addon Development Resources

This folder contains useful resources, documentation links, and potentially helper scripts for the development and debugging of this Minecraft Bedrock Edition addon.

## Official Minecraft Bedrock Creator Documentation

The primary hub for all official Bedrock addon development documentation is:

- **[Minecraft Creator Documentation (Bedrock)](https://learn.microsoft.com/en-us/minecraft/creator/?view=minecraft-bedrock-stable)**

### Scripting APIs (`@minecraft/server`)

- **Overview & Getting Started:**
    - [Introduction to Scripting](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/introduction?view=minecraft-bedrock-stable)
    - [Scripting API Reference (Main Page)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/?view=minecraft-bedrock-stable)
- **Core World & Event Handling:**
    - [World Class (world, events)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/world?view=minecraft-bedrock-stable)
    - [WorldBeforeEvents Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldbeforeevents?view=minecraft-bedrock-stable)
    - [WorldAfterEvents Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable)
- **User Interface (Server-Side):**
    - [@minecraft/server-ui Module](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/minecraft-server-ui?view=minecraft-bedrock-stable)

## Target Minecraft Version

The addon currently targets Minecraft Bedrock version 1.21.110 and newer. Please ensure development and testing align with this version.

## Codebase Architecture Overview

The AddonExe is structured to be modular and configurable.

- **`src/`**: The root for all source code (TypeScript). This is compiled to `packs/behavior/scripts/`.
    - **`config.default.ts`**: The template configuration. Developers should copy this to `src/config.ts` for local customization.
    - **`core/`**: Houses the central manager modules that form the backbone of the addon (e.g., `playerDataManager.ts`, `rankManager.ts`).
    - **`modules/`**: Contains feature-specific logic, separated from the core managers (e.g., commands).

## Versioning & Release Workflow

The project uses a structured versioning system where `package.json` is the single source of truth.

- **Source of Truth:** The version in `package.json` controls the version of the generated addon.
- **Manifest Templates:** The `manifest.json` files in `packs/` are generated from `manifest.template.json` during the build. Do not edit `manifest.json` directly as it is git-ignored and will be overwritten.
- **Build Modes:**
    - **Local Build:** `npm run build` uses the exact version from `package.json`.
    - **Public Release:** Triggered by tagging a commit with `vX.Y.Z`. Enforces `Patch = 0` (e.g., `1.2.0`).
    - **Nightly Build:** Triggered by pushes to the `Dev` branch. Uses `Major.Minor` from `package.json` + GitHub Run Number as the patch (e.g., `0.7.124`).

## TypeScript Development

The codebase uses **TypeScript** for robustness and maintainability.

- **Source Directory:** All behavior pack scripts are located in `src/`.
- **Compilation:** Run `npm run build` to compile the TypeScript source into JavaScript in `packs/behavior/scripts/`. This command also auto-generates the `manifest.json` files.
- **Local Configuration:**
    - The repository contains `src/config.default.ts` as the template.
    - **Action:** Create a copy named `src/config.ts`. This file is git-ignored.
    - Use `src/config.ts` to customize your local development environment. The build process will prioritize it.

## Performance Profiling

To help identify potential bottlenecks, the addon includes a basic performance profiling feature.

- **Enable:** Set `enablePerformanceProfiling: true` in your config.
- **Logging:** When enabled, aggregated performance data will be logged to the content log.

## Important Workflow Notes for AI Assistants

For detailed guidelines, project-specific conventions, and workflow instructions tailored for AI assistants (like Jules) working on this codebase, please refer to the main **[agents.md](../../agents.md)** file located in the root of the repository.
