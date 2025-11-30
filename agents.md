# Agent Instructions for AddonExe Development

Welcome, AI Assistant (Jules)! This document provides specific guidelines and tips for working effectively on the AddonExe codebase. Please adhere to these instructions in addition to your general knowledge and the user's direct requests.

## 1. Core Objective

Your primary goal is to assist users by completing coding tasks, such as solving bugs, implementing features, writing tests, and updating documentation, all while maintaining code quality, consistency, and adhering to project conventions.

## 2. Understanding the Codebase

Before implementing changes, strive to understand the relevant parts of the codebase. Key architectural information can be found in `Docs/Development/README.md`. Pay attention to:

- **Source Directory (`src/`):** All Behavior Pack scripts are now located in the `src/` directory. They are compiled to `packs/behavior/scripts/`.
- **Core Managers (`src/core/`):** Understand how modules like `playerDataManager.js` (or `.ts`), `rankManager.js`, `punishmentManager.js`, and `cooldownManager.js` interact. The `commandManager.js` in `src/modules/commands/` is also critical.
- **Configuration Files:**
  - `src/config.js` (or `.ts`): Main settings, feature toggles, owner/admin setup.
  - `src/core/ranksConfig.js`: Defines all ranks and their visual styles.
  - `src/core/panelLayoutConfig.js`: Defines the layout and content of the UI panels.
- **Coding Conventions:** Strictly follow guidelines in `Docs/Development/CodingStyle.md` and `Docs/Development/StandardizationGuidelines.md`.
- **Naming Conventions:**
  - The general rule for all project-specific JavaScript/TypeScript identifiers is that **any code style is allowed, but not snake_case**.
  - The use of `snake_case` (e.g., `my_variable`) or `UPPER_SNAKE_CASE` (e.g., `MY_CONSTANT`) is disallowed.
  - An exception is when interacting with native Minecraft APIs that require `snake_case` identifiers. In those cases, the required style must be used.
  - For full details, always refer to the latest `Docs/Development/CodingStyle.md` and `Docs/Development/StandardizationGuidelines.md`.

## 3. Workflow and Task Management

This project uses a simple task management system in the `Docs/Development/tasks/` directory.

- **Before Starting New Work:**
  - Review `Docs/Development/tasks/ongoing.md` to see if any tasks are in progress.
  - Review `Docs/Development/tasks/todo.md` for planned tasks.
- **Working on a Task:**
  - If continuing a previous task, ensure `Docs/Development/tasks/ongoing.md` reflects this.
  - When starting a new task (usually from `Docs/Development/tasks/todo.md` or a new user request):
    - **Update `Docs/Development/tasks/ongoing.md`**: Describe the task you are about to work on, including its objectives and your name/session identifier.
    - If the task was from `Docs/Development/tasks/todo.md`, remove it from there.
- **Completing a Task:**
  - Upon successful completion and submission of all changes for a task:
    - **Update `Docs/Development/tasks/completed.md`**: Add a summary of the completed task, including the work done and a reference to the submission (e.g., branch name or commit message theme).
    - **Clear/Update `Docs/Development/tasks/ongoing.md`**: If no immediate follow-up task, clear it to indicate no task is ongoing. If starting another task, update it for the new task.
- **Identifying New Work:**
  - If you identify potential future work, bugs, or ideas during your session, add them as new items to `Docs/Development/tasks/todo.md` with a suggested priority if possible.

## 4. Documentation Responsibilities

- **Update Root `README.md`**: If you add significant new user-facing features or make major changes to the addon's functionality or setup, you **must** also update the main project `README.md` (located in the repository root) to reflect these changes. This keeps the primary user documentation current.
- **Update `Docs/` Folder**: For substantial feature changes or additions, relevant files in the `Docs/` folder (e.g., `FeaturesOverview.md`, `ConfigurationGuide.md`, `Commands.md`) should also be updated.
- **JSDoc/TSDoc Comments**: Adhere to the JSDoc/TSDoc standards outlined in `Docs/Development/StandardizationGuidelines.md`. Add comments for new functions (especially exported ones) and complex logic. Ensure types are accurate (now enforced by TypeScript).

## 5. Code Style and Quality

- **Adherence to Guidelines:** Strictly follow `Docs/Development/CodingStyle.md` and `Docs/Development/StandardizationGuidelines.md`.
- **TypeScript:** All Behavior Pack scripts are written in TypeScript (or JavaScript migrating to TypeScript) in the `src/` directory.
- **Build Artifacts:** Do not edit files in `packs/behavior/scripts/` directly. Always edit the source in `src/` and run `npm run build`.
- **Error Handling:** Implement robust error handling (e.g., `try...catch` blocks for risky operations, validation of inputs). Refer to `Docs/Development/StandardizationGuidelines.md` (Section 6) for detailed error logging standards.
- **Logging:** Utilize the `debugLog()` function from `core/logger.ts` for development messages. This is conditional on `config.debug` being true.
  - **User-Facing Text:** Most user-facing text is hardcoded directly in the command or UI files where it is used. Configurable messages (like the welcome message or rules) are in `config.js`. Button texts for dynamically generated panels are defined in `src/core/panelLayoutConfig.js`.
- **Linting & Formatting:**
  - Run `npm run lint` to check for linting issues (ESLint).
  - Run `npm run format` to format code (Prettier).
  - Please ensure your changes pass linting and build (`npm run build`) before submitting.

## 6. Planning and Communication

- **Use `set_plan()`:** Always articulate your plan using the `set_plan` tool before starting significant code changes.
- **Be Clear:** Make your plan steps clear and actionable.
- **Ask Questions:** If the user's request is ambiguous or if you encounter significant issues, use `request_user_input`.
- **Report Progress:** Use `plan_step_complete()` after each step.

## 7. Specific Technical Constraints & Patterns

The following patterns must be verified and adhered to when working on the codebase:

- **Exports:**
  - `playerDataManager.ts`: Uses named exports (e.g., `export { functionName }`), not default exports.
  - `commandManager.ts`: Uses named exports.
- **Configuration:**
  - Persistence: Use `.set(newConfig)` to update and save configurations. `.save()` persists current memory state.
  - Structure: `bounties` are in `config.js`, but other economy settings are in `economyConfig.js`.
  - Validation: `xrayConfig.js` uses a `monitoredOreTypes` structure.
- **UI System:**
  - Source of Truth: `src/core/ui/panelRegistry.js` contains the schema for UI panels.
  - Dynamic Config IDs: Panels generated from schema use IDs like `config_<schemaId>`.
- **Floating Text:**
  - Implementation: Uses invisible entity `exe:floating_text`.
  - Management: `floatingTextManager.js`. Requires killing existing entity before spawning new one to prevent duplicates.
- **Scripting API Specifics:**
  - **Versions:** Use exact versions from `manifest.json`.
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
