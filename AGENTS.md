# Agent Instructions for AddonExe Development

This document defines the architecture, technical constraints, and workflow conventions for working on **AddonExe**.

## 1. Project Overview & Tech Stack

- **Runtime & Package Manager:** Bun (`bun`, `bun test`, `bun scripts/build.ts`).
- **Language:** TypeScript (strictly typed, compiled via esbuild into `packs/behavior/scripts/`).
- **Minecraft Target:** Latest Minecraft Bedrock Edition (`@minecraft/server`, `@minecraft/server-ui`, `@minecraft/vanilla-data`, `@minecraft/math`).
- **Linter & Validator:** Oxlint (`.oxlintrc.json`), Ajv JSON schema validator (`scripts/lint/schemas.ts`), icon texture verifier (`scripts/lint/icons.ts`), and TypeScript typecheck (`scripts/lint/run.ts`).

## 2. Repository Structure

- `src/main.ts`: Addon entry point.
- `src/config.ts`: Main configuration defaults and feature toggles.
- `src/core/`: Core infrastructure:
    - `commands/commandManager.ts`: Native slash command registry and execution engine.
    - `configManager.ts`, `configManagerFactory.ts`, `configurations.ts`: Two-state priority-merge configuration persistence using world dynamic properties.
    - `dataManager.ts`, `playerDataManager.ts`, `storage/StorageManager.ts`: Player and world data persistence.
    - `permissionEngine.ts`, `rankManager.ts`, `rankDb.ts`: Tag/condition-based rank resolution and wildcard permission evaluation.
    - `featureManager.ts`, `featureRegistry.ts`: Topological feature loader (`ac`, `eco`, `eco.shop`, `eco.ah`, `util.daily`, `util.kit`, `util.vote`, `util.sidebar`, `essentials`, `mod`, `ranks`, `soc`, `soc.team`, `tp`, `game`).
    - `ui/`: UI builders (`ActionFormBuilder.ts`, `CustomFormBuilder.ts`, `MessageFormBuilder.ts`), registries (`menuRegistry.ts`, `configPanelRegistry.ts`, `systemRegistry.ts`), and core panels (`mainPanel.ts`, `adminPanel.ts`, `configPanel.ts`, `playerPanel.ts`, `inventoryPanel.ts`, `serverInfoPanel.ts`, `statsPanel.ts`).
- `src/features/`: Self-contained feature modules (`anticheat`, `auction`, `daily`, `economy`, `essentials`, `games`, `kit`, `moderation`, `ranks`, `shop`, `sidebar`, `social`, `team`, `teleport`, `test`, `vote`).
- `packs/behavior/` & `packs/resource/`: Behavior and Resource pack JSON definitions, functions (`owner.mcfunction`), entities (`exe:floating_text`), items (`exe:panel`), and custom dark-mode JSON UI (`packs/resource/ui/server_form.json`).
- `scripts/`: Build pipeline (`build.ts`), manifest generator (`update-manifests.ts`), lint runner (`lint/run.ts`), and dependency tools.

## 3. Build, Test & Verification Commands

- **Build (Local):** `bun run build`
- **Package `.mcaddon` Archive:** `bun scripts/build.ts --zip`
- **Lint & Validate (Read-Only Check):** `bun run lint:check`
- **Lint & Auto-Fix:** `bun run lint`
- **Format Specific Files (Preferred over full-repo format):** `bunx prettier --write --cache <file1> <file2>`
- **Run Unit Tests:** `bun test`
- **Check Code Duplication:** `bun run test:dupe`
- **Full Validation Suite:** `bun run validate`

## 4. Coding & Architectural Conventions

- **Never Edit Build Artifacts:** Never manually edit `packs/behavior/scripts/` or generated `manifest.json` files. Edit `src/` and run `bun run build`.
- **Naming Convention:** `snake_case` and `UPPER_SNAKE_CASE` are disallowed for project TypeScript variables, functions, and properties (enforced by custom AST lint rules in `scripts/lint/minecraft-rules.ts`). Exception: native Minecraft API identifiers and JSON UI schema keys.
- **Path Aliases:** Use TypeScript path aliases defined in `tsconfig.json` (`@core/*`, `@features/*`, `@commands/*`, `@ui/*`, `@lib/*`).
- **Strict Guards:** Use type guards from `@lib/guards.js` (`isDefined`, `isNonEmptyString`, `isNumber`) instead of loose truthiness checks.
- **Minecraft Constants:** Use `@minecraft/vanilla-data` (`MinecraftItemTypes`, `MinecraftBlockTypes`, `MinecraftDimensionTypes`) instead of raw `"minecraft:..."` string literals.
- **Logging:** Use `debugLog`, `infoLog`, `warnLog`, and `errorLog` from `@core/logger.js` (controlled by `config.logLevel`).
- **UI System:**
    - Use `ActionFormBuilder`, `CustomFormBuilder`, and `MessageFormBuilder` from `@ui/builders/`.
    - `ActionFormBuilder.grid(1 | 2 | 3)` prefixes the form title with `§1` (1-column reader/list stack), `§2` (2-column wide card grid, default for hubs/menus), or `§3` (3-column compact tile grid, used for Shop).
    - Register hub navigation entries in `src/core/ui/menuRegistry.ts` and config schemas in `src/core/ui/configPanelRegistry.ts`.
- **Documentation Sync:** Keep `README.md`, `Docs/*.md`, and `Dev/*.md` synchronized when adding or modifying commands, features, or configuration keys.
