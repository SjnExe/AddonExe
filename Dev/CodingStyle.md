# Coding Style Guidelines

This document outlines the coding style conventions enforced across **AddonExe** by Oxlint, custom AST rules (`scripts/lint/minecraft-rules.ts`), and Prettier.

## 1. Naming Conventions

- **No `snake_case` in TypeScript:** Project-specific identifiers (variables, functions, parameters, class properties) **must not** use `snake_case` or `UPPER_SNAKE_CASE`.
    - Use `camelCase` for variables, functions, methods, and constants (e.g., `maxListingsPerPlayer`, `floatingTextId`).
    - Use `PascalCase` for classes, interfaces, type aliases, and enums (e.g., `ActionFormBuilder`, `CustomCommand`).
- **Exceptions for Minecraft & External Schemas:**
    - Native Minecraft identifiers (e.g., `'slow_falling'`, `'exe:floating_text'`, `'random.orb'`) and JSON UI properties must preserve their required format.
    - Prefer `@minecraft/vanilla-data` enums (`MinecraftItemTypes`, `MinecraftBlockTypes`, `MinecraftDimensionTypes`) over raw `'minecraft:*'` strings.

## 2. Formatting (Prettier)

- **Indentation:** 4 spaces (no tabs).
- **Quotes:** Single quotes (`'`) for TypeScript strings; double quotes (`"`) for JSON.
- **Semicolons:** Required at the end of all statements.
- **Braces:** Always use curly braces `{}` for control flow blocks (`if`, `for`, `while`), even for single-line statements.
- **Formatting Command:** Format only modified files using `bunx prettier --write --cache <files>`.

## 3. Type Safety & Guards

- Avoid `any` and unsafe type assertions.
- Use helper guards from `@lib/guards.js` (`isDefined`, `isNonEmptyString`, `isNumber`) to satisfy strict null/boolean checks.
- Always use strict equality (`===`, `!==`).

## 4. Command Conventions

- Slash command names and aliases must be lowercase.
- Commands that conflict with vanilla Bedrock commands use an `x` prefix via `slashName` (e.g., `xhelp`, `xclear`, `xgamemode`, `xkick`, `xreload`, `xsave`).
- Every command must define a `permissionNode` following `cmd.<name>.<tier>` (e.g., `cmd.ban.admin`, `cmd.kick.mod`, `cmd.spawn.member`).

## 5. Logging

- Use `debugLog`, `infoLog`, `warnLog`, and `errorLog` from `@core/logger.js`.
- Verbosity is controlled via `config.logLevel` (`0` = ERROR, `1` = WARN, `2` = INFO, `3` = DEBUG).
- For persistent moderation/flag records, use `src/features/anticheat/logManager.ts` and `src/features/moderation/chatLogManager.ts`.
