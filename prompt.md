# AddonExe Modernization and Refactoring Plan

This document outlines a comprehensive plan to modernize the AddonExe project, based on our detailed discussion. The goal is to improve the developer experience, make the project more maintainable for forks, and complete the migration to TypeScript.

### Task 1: Improve Linting and Tooling

**Goal:** Establish a single source of truth for code formatting and improve code quality with stricter, automated checks.

1.  **Integrate Prettier with ESLint:**
    *   Modify `eslint.config.js` to correctly use `eslint-config-prettier`. This will disable all of ESLint's stylistic rules, making Prettier the sole tool responsible for formatting and preventing any conflicts.
2.  **Enforce Import Sorting:**
    *   Add the `eslint-plugin-import` rule to `eslint.config.js` to automatically sort and organize `import` statements. This improves code readability and consistency.

### Task 2: Implement a Robust Configuration Strategy for Forks

**Goal:** Allow users to fork the repository and customize configuration without causing merge conflicts when they pull future updates.

1.  **Create Default Configs:**
    *   Rename every configuration file (e.g., `src/config.ts`, `src/core/economyConfig.ts`) to its "default" version (e.g., `src/config.default.ts`).
2.  **Implement a Silent Fallback Loader:**
    *   Create a new module, `src/core/configLoader.ts`.
    *   This loader will dynamically and asynchronously attempt to `import` a user's local config (e.g., `config.ts`).
    *   If the local config is not found, it will **silently** fall back to loading the corresponding `config.default.ts` without generating any warnings.
    *   If the `.default.ts` file is also missing, it should throw a fatal error to prevent the addon from running in a broken state.
3.  **Refactor Initialization Logic:**
    *   Modify the addon's startup sequence in `src/core/main.ts`, `src/core/configManager.ts`, and `src/core/configurations.ts`.
    *   The entire process must be converted from synchronous to asynchronous to support the new dynamic loader.
    *   All direct config imports must be replaced with calls to the new async loader.
4.  **Update `.gitignore`:**
    *   Add entries for all the local configuration files (e.g., `src/config.ts`, `src/core/economyConfig.ts`) to `.gitignore` to ensure they are never tracked.

### Task 3: Complete the TypeScript Migration

**Goal:** Convert the entire `src` codebase to TypeScript.

1.  **Identify Remaining Files:**
    *   Scan the `src` directory and all subdirectories for any remaining JavaScript (`.js`) files.
2.  **Convert to TypeScript:**
    *   Rename every identified `.js` file to `.ts`.

### Task 4: Update Documentation

**Goal:** Ensure the project's documentation reflects the new changes.

1.  **Update `README.md`:**
    *   Rewrite the "Configuration" section to clearly explain the new `.default.ts` system. Instruct users to copy the default file to create their own local config for customization.
2.  **Update `Dev/plan.md`:**
    *   Modify the TypeScript migration plan to mark all tasks as 100% complete.

### Task 5: Full Codebase Cleanup and Verification

**Goal:** Apply the new standards to the entire project and ensure it is in a stable, error-free state.

1.  **Apply Linting and Formatting:**
    *   Run `npm install` to ensure all tools are up to date.
    *   Run `npm run lint:fix` and `npm run format` to automatically fix all existing issues across the entire codebase.
2.  **Manually Fix Remaining Errors:**
    *   Address any critical errors the automated tools could not fix, such as:
        *   Unresolved imports resulting from the config file renames.
        *   Incorrect `@ts-ignore` comments (replace with `@ts-expect-error`).
3.  **Final Build Verification:**
    *   Run `npm run build` to compile the entire TypeScript project.
    *   Confirm that the build completes successfully with **zero errors**.
