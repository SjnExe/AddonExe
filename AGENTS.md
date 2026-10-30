# Agent & Developer Instructions for AddonExe

This document is the single source of truth for the architecture, coding standards, configuration lifecycle, and workflow conventions of **AddonExe**.

## 1. Project Overview & Tech Stack

- **Runtime & Package Manager:** Bun (`bun`, `bun test`, `bun scripts/build/build.ts`).
- **Language:** TypeScript (strictly typed, bundled into `packs/behavior/scripts/main.js`).
- **Minecraft Target:** Latest Minecraft Bedrock Edition (`@minecraft/server`, `@minecraft/server-ui`, `@minecraft/vanilla-data`, `@minecraft/math`).
- **Linter & Validator:** Oxlint (`.oxlintrc.json`), custom Minecraft & casing rules (`scripts/lint/minecraftRules.ts`), `@minecraft/bedrock-schemas` + Ajv JSON validator (`scripts/lint/schemas.ts`), strict vanilla/custom icon verifier (`scripts/lint/icons.ts`), and Bun built-in typecheck (`bun check` via `scripts/lint/run.ts`).

## 2. Build, Test & Verification Commands

- **Build (Local):** `bun run build`
- **Build (Canary Archive for Testing):** `bun run build:canary` (creates `.mcaddon` with test framework enabled)
- **Package `.mcaddon` Archive:** `bun scripts/build/build.ts --zip`
- **Lint & Source Check (Read-Only):** `bun lint:check` (includes typechecking — do not run `bun check` separately)
- **Lint & Auto-Fix:** `bun lint`
- **Typecheck (Bun Built-In Only):** `bun check` (never use `tsc` or external typecheckers)
- **Format Modified Files Only:** `bun fmt --changed` (auto-detects modified files — prefer over `bun fmt <file1> <file2>`)
- **Run Unit Tests:** `bun test --parallel` (always use `--parallel`)
- **Check Code Duplication (Explicit Only):** `bun run test:dupe`
- **Full Pack Validation (MCT):** `bun run validate` (validates built pack manifests and assets via Minecraft Creator Tools; run after building)

## 3. Coding & Architectural Standards

- **Never Edit Build Artifacts:** Never manually edit `packs/behavior/scripts/` or generated `manifest.json` files. Edit `src/` and run `bun run build`.
- **Naming Conventions:**
  - **No `snake_case` or `UPPER_SNAKE_CASE` in TypeScript:** Project variables, functions, parameters, properties, and filenames must use `camelCase`, and classes/interfaces/types/enums must use `PascalCase` (enforced by `scripts/lint/minecraftRules.ts`). Native Minecraft API identifiers and JSON UI keys are exempt.
  - Avoid redundant feature prefixes on files inside feature folders (e.g., use `ranks/config.ts` and `ranks/ui/panel.ts` instead of `ranks/ranksConfig.ts`).
- **Formatting (`bun fmt`):** 2-space indentation, single quotes for TS, sorted imports, semicolons required, curly braces `{}` required on all control flow blocks (`bun fmt <files>` / `bun fmt --check`).
- **Path Aliases:** Use aliases defined in `tsconfig.json` (`@core/*`, `@features/*`, `@commands/*`, `@ui/*`, `@lib/*`).
- **Strict Type Guards:** Use `isDefined`, `isNonEmptyString`, and `isNumber` from `@lib/guards.js` instead of loose truthiness checks.
- **Minecraft Constants:** Always import `MinecraftItemTypes`, `MinecraftBlockTypes`, `MinecraftEntityTypes`, and `MinecraftDimensionTypes` from `@minecraft/vanilla-data` instead of raw `'minecraft:...'` strings.
- **Entity Safety & Command Sanitization:**
  - Always check `player.isValid` across tick boundaries and resolve live player references via `playerCache`.
  - Sanitize any dynamic string passed into `runCommand()` using `escapeCommandArg()`.

## 4. Configuration, Presets & SemVer Migration System

- **Single Bundled Build & In-Game Editor:** All configurations are compiled into `main.js` with clean defaults and edited live in-game via `/panel`.
- **Version-Safe Deep Merge:** On world load, saved dynamic properties are merged on top of default configs (`deepMerge(defaultConfig, savedConfig)`), preserving all existing server customizations while automatically populating newly added config keys on addon updates.
- **SemVer Migration Runner:** `migrationManager.ts` compares the stored world addon version (`exe:version`) against the current `package.json` version and runs any pending versioned migration steps sequentially.

## 5. Custom Dark-Mode UI & Text Formatting

- **UI Builders:** Always use `ActionFormBuilder`, `CustomFormBuilder`, and `MessageFormBuilder`.
  - `.grid(1)` (`\uE100§r`): 1-column full-width reader/list stack.
  - `.grid(2)` (`§2§<tens>§<ones>§f§r`): 2-column wide card grid (default for hubs/menus).
  - `.grid(3)` (`§3§<tens>§<ones>§f§r`): 3-column compact tile grid (Server Shop & RPS).
  - `.grid(4)` (`§4§<tens>§<ones>§f§r`): 4-column icon tile grid.
  - `.grid('board')` (`§9§0§0§f§r`): 3x3 fixed board grid (Tic-Tac-Toe).
  - `.grid('ms9' | 'ms12' | 'ms16')` (`§8§0§9§f§r`, `§8§1§2§f§r`, `§8§1§6§f§r`): Minesweeper 9x9, 12x12, and 16x12 grids.
- **Bedrock Section (`§`) Color & Style Codes:**
  - Colors: `§0` Black, `§1` Dark Blue, `§2` Dark Green, `§3` Dark Aqua, `§4` Dark Red, `§5` Dark Purple, `§6` Gold, `§7` Gray, `§8` Dark Gray, `§9` Blue, `§a` Green, `§b` Aqua, `§c` Red, `§d` Light Purple, `§e` Yellow, `§f` White, `§g` Minecoin Gold.
  - Styles (must follow color code): `§l` Bold, `§o` Italic, `§k` Obfuscated, `§r` Reset.
