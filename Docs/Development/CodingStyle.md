# Coding Style Guidelines

This document outlines coding style conventions to be followed for this project to ensure consistency, readability, and maintainability. Adherence to these guidelines is expected for all contributions.

## Naming Conventions

The general rule for all project-specific JavaScript identifiers (variables, function names, object properties, etc.) is that **any code style is allowed, but not snake_case**.

The use of `snake_case` (e.g., `my_variable`) or `UPPER_SNAKE_CASE` (e.g., `MY_CONSTANT`) is disallowed to maintain a consistent style across the codebase.

### Exception for Minecraft Identifiers

- When interacting with native Minecraft APIs, it is necessary to use the case style defined by the game itself.
- Many Minecraft identifiers (e.g., item IDs, entity type IDs, effect types) use **`snake_case`**.
- When using these identifiers as string literals, their original `snake_case` format **MUST** be preserved.
- **Example:** `player.addEffect('slow_falling', ...)` is correct; `player.addEffect('slowFalling', ...)` would fail.

## Command System Conventions

### Command Naming

- User-facing commands typed in chat **MUST** be lowercase (e.g., `!gmc`, `!help`).
- The internal registration name of a command (in its definition file) **SHOULD** be descriptive and clear (e.g., `ban`, `kick`, `mute`).

## JSDoc and Comments

- **JSDoc:** The `require-jsdoc` linting rule is disabled. However, if you choose to write JSDoc comments, you **SHOULD** follow a compact style. Multi-line comments (`/** ... */`) should only be used when necessary.
- **Clarity:** There should be no unnecessary comments or empty lines. Code should be as self-documenting as possible.

## General Formatting

- **Indentation:** Use 4 spaces for indentation.
- **Brace Style:** Follow the existing brace style (One True Brace Style).
- **Readability:** Aim for clarity and readability in all code.
- For more detailed rules, refer to `Dev/StandardizationGuidelines.md`.

## Logging

- **Purpose:** Logging is crucial for diagnosing issues and understanding behavior. Logs **SHOULD** be clear, concise, and informative.
- **Performance:** Expensive operations to gather data for logs **MUST** be conditional on a check like `if (config.enableDebugLogging || pData?.isWatched)`.
- **Tooling:**
  - Use `playerUtils.debugLog()` for development messages.
  - Use `logManager.addLog()` for persistent, structured action and error logging.
  - Use `playerUtils.notifyAdmins()` for important real-time notifications to staff.
  - Use `playerUtils.warnPlayer()` for direct warnings to players.
- For detailed implementation, see the **Debugging and Logging** section in the main `README.md` or `AGENTS.md`.
