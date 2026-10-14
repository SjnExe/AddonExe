# Standardization Guidelines for AddonExe

This document consolidates the code organization, API usage, UI builder, and error-handling standards for **AddonExe**.

## 1. Code Style & Naming

- **No `snake_case`:** Disallowed for all TypeScript variables, functions, methods, and properties (enforced by `scripts/lint/minecraft-rules.ts`), except where required by Minecraft APIs or JSON schemas.
- **Formatting:** Enforced via Prettier (`.prettierrc`). Format modified files using `bunx prettier --write --cache <files>`.
- **Strict Equality & Guards:** Always use `===` / `!==` and type guards from `@lib/guards.js` (`isDefined`, `isNonEmptyString`, `isNumber`).

## 2. Module & Import Organization

- **ES Modules:** Use named exports for managers and utilities; default exports are reserved for command definitions and configuration objects.
- **Path Aliases:** Prefer `@core/*`, `@features/*`, `@commands/*`, `@ui/*`, and `@lib/*` over deep relative `../../..` chains.
- **Vanilla Data:** Always import item, block, and dimension identifiers from `@minecraft/vanilla-data` rather than hardcoding `'minecraft:...'` strings.

## 3. Minecraft Scripting API Practices

- **Entity Validity:** Check `player.isValid` before operating on player or entity references across ticks.
- **No Entity Caching Across Ticks:** Store player/entity IDs and resolve live objects via `@core/playerCache.js`.
- **Command Execution:** Use `dimension.runCommand()` with sanitized arguments via `escapeCommandArg()` from `@core/utils/sanitization.js`.
- **Task Scheduling:** Use `@core/timerManager.js` or `mc.system.runJob` for deferred or multi-tick operations.

## 4. UI Standardization

- Build all forms using `ActionFormBuilder`, `CustomFormBuilder`, or `MessageFormBuilder` in `src/core/ui/builders/`.
- Select the appropriate layout mode on `ActionFormBuilder`:
    - `.grid(2)` (Default — 2-Column Wide Cards): Main Menu, category hubs, and standard action menus.
    - `.grid(3)` (3-Column Compact Tiles): High-count visual item browsers such as the Server Shop.
    - `.grid(1)` (1-Column Full-Width Rows): Long-text reader screens (`Server Rules`, `Helpful Links`, `Placeholders`, `Listing Details`).

## 5. Logging & Error Handling

- Wrap dynamic property JSON parsing and command execution in `try...catch` blocks.
- Use `debugLog`, `infoLog`, `warnLog`, and `errorLog` from `@core/logger.js`.
- Record moderation punishments and anti-cheat flags through `src/features/anticheat/logManager.ts`.
