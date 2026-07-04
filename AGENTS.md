# Agent Instructions for AddonExe Development

Welcome, AI Assistant (Jules)! This document provides specific guidelines and tips for working effectively on the AddonExe codebase. Please adhere to these instructions in addition to your general knowledge and the user's direct requests.

## 1. Core Objective

Your primary goal is to assist users by completing coding tasks, such as solving bugs, implementing features, writing tests, and updating documentation, all while maintaining code quality, consistency, and adhering to project conventions.

## 2. Environment Setup

If you need to initialize or reset the environment, use the following commands. These handle dependencies, system tools, and repository state.

```bash
sudo rm -rf /usr/local/bun
sudo curl -fsSL https://bun.sh/install | sudo BUN_INSTALL=/usr/local/bun bash
sudo ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun
bun install --frozen-lockfile --no-progress --no-summary
```

## 3. Understanding the Codebase

Before implementing changes, strive to understand the relevant parts of the codebase. Key architectural information can be found in `Docs/Development/README.md`. Pay attention to:

- **Project Structure Overview:**
    - `src/core/`: Infrastructure (Config, Logging, Events, Storage).
    - `src/features/`: Modular features (Economy, Moderation, Teleportation, etc.).
    - `packs/`: Compiled Addon files.
- **Utilizing Behavior and Resource Packs:**
    - Do not rely solely on scripts (`src/`) for features.
    - Use JSON files in `packs/behavior/` (e.g., loot tables, recipes, entities, functions) and `packs/resource/` (e.g., UI, textures) whenever possible for better performance and native integration.
    - Scripts should primarily handle complex logic, state management, and dynamic interactions that JSONs cannot cover.
- **Core Managers:** `src/core` handles cross-cutting concerns.
- **Features:** Each feature in `src/features/` should be self-contained (Manager, Config, Commands).
- **Configuration Files:**
    - `src/config.ts`: Main settings, feature toggles, owner/admin setup.
    - `src/features/ranks/ranksConfig.ts`: Defines all ranks and their visual styles.
- **Coding Conventions:** Strictly follow guidelines in `Docs/Development/CodingStyle.md` and `Docs/Development/StandardizationGuidelines.md`.
- **Naming Conventions:**
    - The general rule for all project-specific JavaScript/TypeScript identifiers is that **any code style is allowed, but not snake_case**.
    - The use of `snake_case` (e.g., `my_variable`) or `UPPER_SNAKE_CASE` (e.g., `MY_CONSTANT`) is disallowed.
    - An exception is when interacting with native Minecraft APIs that require `snake_case` identifiers. In those cases, the required style must be used.
    - For full details, always refer to the latest `Docs/Development/CodingStyle.md` and `Docs/Development/StandardizationGuidelines.md`.

## 4. Workflow and Task Management

- **Chat-First Workflow:** The primary mode of operation is through the chat session. Tasks, plans, and execution happen dynamically here.

## 5. Documentation Responsibilities

- **Update Root `README.md`**: If you add significant new user-facing features or make major changes to the addon's functionality or setup, you **must** also update the main project `README.md` (located in the repository root) to reflect these changes. This keeps the primary user documentation current.
- **Update `Docs/` Folder**: For substantial feature changes or additions, relevant files in the `Docs/` folder (e.g., `FeaturesOverview.md`, `ConfigurationGuide.md`, `Commands.md`) should also be updated.
- **JSDoc/TSDoc Comments**: Adhere to the JSDoc/TSDoc standards outlined in `Docs/Development/StandardizationGuidelines.md`. Add comments for new functions (especially exported ones) and complex logic. Ensure types are accurate (now enforced by TypeScript).

## 6. Code Style and Quality

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
    - **No Log Files:** Do not create `.txt` or other log files to store lint or build output (e.g., `lint_errors.txt`, `build.log`).
    - **Check Console:** Always read errors and warnings directly from the terminal/console output.
    - **Fixing Workflow:** When fixing issues, run the command (e.g., `npm run lint`), check the console for remaining errors, fix them, and repeat.

## 7. Planning and Communication

- **Use `set_plan()`:** Always articulate your plan using the `set_plan` tool before starting significant code changes.
- **Be Clear:** Make your plan steps clear and actionable.
- **Ask Questions:** If the user's request is ambiguous or if you encounter significant issues, use `request_user_input`.
- **Report Progress:** Use `plan_step_complete()` after each step.

## 8. Specific Technical Constraints & Patterns

The following patterns must be verified and adhered to when working on the codebase:

- **Exports:**
    - `playerDataManager.ts`: Uses named exports (e.g., `export { functionName }`), not default exports.
    - `commandManager.ts`: Uses named exports.
- **Configuration:**
    - Persistence: Use `.set(newConfig)` to update and save configurations. `.save()` persists current memory state.
    - Structure: `bounties` are in `config.ts`, but other economy settings are in `economyConfig.ts`.
    - Validation: `xrayConfig.ts` uses a `monitoredOreTypes` structure.
- **UI System:**
    - Source of Truth: `src/core/ui/panelRegistry.js` contains the schema for UI panels.
    - Dynamic Config IDs: Panels generated from schema use IDs like `config_<schemaId>`.
- **Floating Text:**
    - Implementation: Uses invisible entity `exe:floating_text`.
    - Management: `floatingTextManager.js`. Requires killing existing entity before spawning new one to prevent duplicates.
- **Performance Guidelines:**
    - **Task Scheduling:** For heavy or long-running tasks (e.g., iterating over large areas or many entities), prefer using `mc.system.runJob` with a generator function to spread execution across ticks and prevent server lag.
    - **Config Loading:** Configuration files should be loaded in parallel (e.g., using `Promise.all`) during initialization to minimize startup time.
- **Scripting API Specifics:**
    - **Versions:** Use exact versions from `manifest.json`.
    - **Timers:** Use `mc.system.runTimeout` for simple delays.
    - **Entity References:** Do not cache Entity objects. They become invalid. Store IDs and query fresh objects.
    - **Dimensions:** Use `minecraft:nether` (not `the_nether`).
- **Commands:**
    - `commandManager` supports `int` parameter type.
    - Use `runCommand`, not `runCommandAsync` (deprecated).
- **Non-Existent Features (Do Not Use):**
    - `placeholderManager.js` / `resolvePlaceholders`: **Does not exist.** Use `formatString` from `utils.js`.
    - `world.playSound`: Use `dimension.playSound` or `player.playSound`.
- **Linting & Dependencies:**
    - `eslint.config.js` now enables strict type-checking rules (e.g., `no-unsafe-assignment`) as **warnings**. Strive to resolve these when working on files.
    - Use `@minecraft/vanilla-data` for strict typing of Block, Item, and Entity IDs (e.g., `MinecraftItemTypes.Diamond`) instead of string literals.
    - Use `@minecraft/math` for vector math operations (e.g., `Vector3Utils.distance`) instead of manual calculations.
    - Run `npm run check-deps` to verify that `package.json` dependencies match `manifest.json` dependencies. This is integrated into `npm run validate`.
    - Run `npm run project-info` to view project details via `@minecraft/creator-tools`.
    - Run `npm run fix-project` to apply automated fixes via `@minecraft/creator-tools`.

By following these guidelines, you will help ensure the continued quality, consistency, and maintainability of the AddonExe. Thank you!
