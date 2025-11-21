# Agent Instructions for AddonExe Development

Welcome, AI Assistant (Jules)! This document provides specific guidelines and tips for working effectively on the AddonExe codebase. Please adhere to these instructions in addition to your general knowledge and the user's direct requests.

## 1. Core Objective

Your primary goal is to assist users by completing coding tasks, such as solving bugs, implementing features, writing tests, and updating documentation, all while maintaining code quality, consistency, and adhering to project conventions.

## 2. Understanding the Codebase

Before implementing changes, strive to understand the relevant parts of the codebase. Key architectural information can be found in `Dev/README.md`. Pay attention to:

- **Core Managers (`AddonExeBP/scripts/core/`):** Understand how modules like `playerDataManager.js`, `rankManager.js`, `punishmentManager.js`, and `cooldownManager.js` interact. The `commandManager.js` in `AddonExeBP/scripts/modules/commands/` is also critical.
- **Configuration Files:**
  - `AddonExeBP/scripts/config.js`: Main settings, feature toggles, owner/admin setup.
  - `AddonExeBP/scripts/core/ranksConfig.js`: Defines all ranks and their visual styles.
  - `AddonExeBP/scripts/core/panelLayoutConfig.js`: Defines the layout and content of the UI panels.
- **Coding Conventions:** Strictly follow guidelines in `Dev/CodingStyle.md` and `Dev/StandardizationGuidelines.md`.
- **Naming Conventions:**
  - The general rule for all project-specific JavaScript identifiers is that **any code style is allowed, but not snake_case**.
  - The use of `snake_case` (e.g., `my_variable`) or `UPPER_SNAKE_CASE` (e.g., `MY_CONSTANT`) is disallowed.
  - An exception is when interacting with native Minecraft APIs that require `snake_case` identifiers. In those cases, the required style must be used.
  - For full details, always refer to the latest `Dev/CodingStyle.md` and `Dev/StandardizationGuidelines.md`.

## 3. Workflow and Task Management

This project uses a simple task management system in the `Dev/tasks/` directory.

- **Before Starting New Work:**
  - Review `Dev/tasks/ongoing.md` to see if any tasks are in progress.
  - Review `Dev/tasks/todo.md` for planned tasks.
- **Working on a Task:**
  - If continuing a previous task, ensure `Dev/tasks/ongoing.md` reflects this.
  - When starting a new task (usually from `Dev/tasks/todo.md` or a new user request):
    - **Update `Dev/tasks/ongoing.md`**: Describe the task you are about to work on, including its objectives and your name/session identifier.
    - If the task was from `Dev/tasks/todo.md`, remove it from there.
- **Completing a Task:**
  - Upon successful completion and submission of all changes for a task:
    - **Update `Dev/tasks/completed.md`**: Add a summary of the completed task, including the work done and a reference to the submission (e.g., branch name or commit message theme).
    - **Clear/Update `Dev/tasks/ongoing.md`**: If no immediate follow-up task, clear it to indicate no task is ongoing. If starting another task, update it for the new task.
- **Identifying New Work:**
  - If you identify potential future work, bugs, or ideas during your session, add them as new items to `Dev/tasks/todo.md` with a suggested priority if possible.

## 4. Documentation Responsibilities

- **Update Root `README.md`**: If you add significant new user-facing features or make major changes to the addon's functionality or setup, you **must** also update the main project `README.md` (located in the repository root) to reflect these changes. This keeps the primary user documentation current.
- **Update `Docs/` Folder**: For substantial feature changes or additions, relevant files in the `Docs/` folder (e.g., `FeaturesOverview.md`, `ConfigurationGuide.md`, `Commands.md`) should also be updated.
- **JSDoc Comments**: Adhere to the JSDoc standards outlined in `Dev/StandardizationGuidelines.md`. Add JSDoc comments for new functions (especially exported ones) and complex logic. Ensure `@param` and `@returns` types are accurate, referencing `types.js` where appropriate.

## 5. Code Style and Quality

- **Adherence to Guidelines:** Strictly follow `Dev/CodingStyle.md` and `Dev/StandardizationGuidelines.md`.
- **Plain JavaScript:** All Behavior Pack scripts are written in plain JavaScript. Do not use TypeScript syntax.
- **Error Handling:** Implement robust error handling (e.g., `try...catch` blocks for risky operations, validation of inputs). Refer to `Dev/StandardizationGuidelines.md` (Section 6) for detailed error logging standards.
- **Logging:** Utilize the `debugLog()` function from `core/logger.js` for development messages. This is conditional on `config.debug` being true.
  - **User-Facing Text:** Most user-facing text is hardcoded directly in the command or UI files where it is used. Configurable messages (like the welcome message or rules) are in `config.js`. Button texts for dynamically generated panels are defined in `AddonExeBP/scripts/core/panelLayoutConfig.js`.
- **Linting with ESLint:** This project uses ESLint to enforce code style and catch potential errors.
  - The configuration (`eslint.config.js`) is based on `eslint:recommended` rules plus specific project style guidelines from `Dev/CodingStyle.md` and `Dev/StandardizationGuidelines.md`.
  - Run `npm run lint` to check for linting issues.
  - Run `npm run lint:fix` to automatically fix many common issues.
  - Please ensure your changes pass linting before submitting.

## 6. Planning and Communication

- **Use `set_plan()`:** Always articulate your plan using the `set_plan` tool before starting significant code changes.
- **Be Clear:** Make your plan steps clear and actionable.
- **Ask Questions:** If the user's request is ambiguous or if you encounter significant issues, use `request_user_input`.
- **Report Progress:** Use `plan_step_complete()` after each step.

## 7. Specific Technical Constraints & Patterns

The following patterns must be verified and adhered to when working on the codebase:

- **Exports:**
  - `playerDataManager.js`: Uses named exports (e.g., `export { functionName }`), not default exports.
  - `commandManager.js`: Uses named exports (e.g., `import { commandManager } from ...`).
- **Configuration:**
  - Persistence: Use `.set(newConfig)` to update and save configurations. `.save()` persists current memory state.
  - Structure: `bounties` are in `config.js`, but other economy settings are in `economyConfig.js`.
  - Validation: `xrayConfig.js` uses a `monitoredOreTypes` structure.
- **UI System:**
  - Source of Truth: `AddonExeBP/scripts/core/ui/panelRegistry.js` contains the schema for UI panels.
  - Dynamic Config IDs: Panels generated from schema use IDs like `config_<schemaId>`.
- **Floating Text:**
  - Implementation: Uses invisible entity `addonexe:floating_text`.
  - Management: `floatingTextManager.js`. Requires killing existing entity before spawning new one to prevent duplicates.
- **Scripting API Specifics:**
  - **Versions:** Use exact versions from `manifest.json` (e.g., `2.3.0-beta`).
  - **Timers:** `mc.system.runJob` requires a generator function. Use `mc.system.runTimeout` for simple delays.
  - **Entity References:** Do not cache Entity objects. They become invalid. Store IDs and query fresh objects.
  - **Dimensions:** Use `minecraft:nether` (not `the_nether`).
- **Commands:**
  - `commandManager` supports `int` parameter type.
  - Use `runCommand`, not `runCommandAsync` (deprecated).
- **Non-Existent Features (Do Not Use):**
  - `placeholderManager.js` / `resolvePlaceholders`: **Does not exist.** Use `formatString` from `utils.js`.
  - `world.playSound`: Use `dimension.playSound` or `player.playSound`.

By following these guidelines, you will help ensure the continued quality, consistency, and maintainability of the AddonExe. Thank you!
