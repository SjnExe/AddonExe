# AddonExe Development Plan

This document outlines the step-by-step plan to complete the codebase refactoring, UI logic updates, and build system migration. The tasks are divided into logical sessions. Tasks within a single session should be completed together before moving to the next session.

Please mark the checkboxes as `[x]` when you complete each task. Whenever a session is finished and you perform a handover, please update the "Session Handover Context" at the bottom of this file.

## Context & User Answers

- **`scripts/generate-command-index.js`:** We will KEEP this script as it avoids the need to manually import every single command file into a central registry. We will improve its integration into the build setup (e.g., as a pre-build step before tsup runs).
- **`packs/` Directory:** Everything inside `packs/` is considered source code. There are no pre-generated files we need to exclude when migrating assets to the new `build/` output directory.
- **UI Layout Logic:** The "Reset Settings" section should appear on the **very last page** of the paginated list in the configuration panel, nowhere else.
- **`tsup` Configuration:** The `*Config.ts` files will be specified as multiple entry points in `tsup` to ensure they are compiled but not bundled with the main script.

---

## Session 1a: Types and Configuration Setup

_Goal: Set up the types folder and configuration._

- [x] **Create Shared Types Folder:** Create a dedicated `src/types/` directory for global/shared TypeScript interfaces.
- [x] **Config Update:** Update `tsconfig.json` to include a `@types/*` alias pointing to `./src/types/*`.

---

## Session 1b: Core Absolute Aliases Refactoring

_Goal: Enforce absolute aliases within the core directory._

- [x] **Enforce Absolute Aliases in `src/core/`:** Scan the `src/core/` directory and replace all relative imports with absolute aliases defined in `tsconfig.json`.

---

## Session 1c: Features Absolute Aliases Refactoring

_Goal: Enforce absolute aliases within the features directory._

- [x] **Enforce Absolute Aliases in `src/features/`:** Scan the `src/features/` directory and replace all relative imports with absolute aliases defined in `tsconfig.json`.

---

## Session 1d: Other Directories Refactoring & Strictness Check

_Goal: Enforce absolute aliases in remaining directories and verify strictness._

- [x] **Enforce Absolute Aliases in other directories:** Scan remaining directories (e.g., `src/lib/`, root `src/` files) and replace all relative imports with absolute aliases.
- [x] **Strictness Check:** Ensure no relative paths remain that cross the boundaries between `core/`, `features/`, `ui/`, etc.

---

## Session 2: UI Layout Logic (Reset Config Placement)

_Goal: Fix the layout issue in the configuration panel._

- [ ] **Modify Panel Logic:** Edit `src/core/ui/panels/configPanel.ts`.
- [ ] **Programmatic Placement:** Force the "Reset Settings" button/section to be the absolute last element in the configuration list.
- [ ] **Pagination Check:** Ensure the "Reset Settings" section does not get floated or pushed to earlier pages; it should strictly be the final entry on the very last page of the multi-page menu.

---

## Session 3: Build System Migration (Asset Management & TypeScript Compilation)

_Goal: Replace custom esbuild logic with `tsup` and migrate output to the `build/` directory._
_(Note: These tasks are grouped because replacing `build.js` requires the new asset manager and tsup config to be ready simultaneously.)_

- [ ] **Asset Management Script:** Create `scripts/build-assets.js`. It must copy all non-script assets (JSON, .lang, .mcfunction, etc.) from `packs/` to `build/` (mirroring `build/behavior/` and `build/resource/`). It should include logic to minify these files if it detects a CI environment.
- [ ] **Manifest Generation:** Update `scripts/generate-manifests.js` to output the generated `manifest.json` files directly into `build/behavior/` and `build/resource/`.
- [ ] **tsup Configuration:** Create a `tsup.config.ts` file:
    - Compile main entry points in `src/` to `build/behavior/scripts/`.
    - Configure `*Config.ts` files as separate entry points so they are compiled but _not bundled_ into the main script.
    - Handle cleaning the `build/` directory before building.
- [ ] **Package.json Scripts Update:** Update `package.json`:
    - Remove references to `scripts/build.js` and delete the old file.
    - Update the `build` script to run the index generator, manifests generator, `build-assets.js`, and `tsup`.
    - Update the `dev` or `watch` script to run `tsup --watch` alongside an asset watcher (if applicable).
    - Ensure `scripts/generate-command-index.js` is properly integrated as a pre-build step.
- [ ] **Gitignore Update:** Update `.gitignore` to completely ignore the new `build/` directory. Remove old ignores for `packs/behavior/scripts` since `packs/` is now entirely source.

---

## Session 4: Validation Tools, CI/CD Pipelines & Final Verification

_Goal: Point all tools to the new `build/` directory and verify the entire system._

- [ ] **Validation Tools:** Update `package.json` scripts for Minecraft Creator Tools (`mct validate`) to look at the `build/` directory instead of the root or `packs/` (e.g., using `-i build`).
- [ ] **GitHub Actions Update:** Modify `.github/workflows/build.yml` so that it copies the final assets from the `build/` directory to the staging directory for deployment/packaging instead of `packs/`.
- [ ] **Pre-commit Hooks:** Check and update any lint-staged or pre-commit hooks in `package.json` if they are looking at incorrect paths.
- [ ] **Verify Build:** Run a full clean build (`npm run build`) to ensure tsup correctly compiles the project and the `*Config.js` files are editable and present in `build/behavior/scripts/`.
- [ ] **Verify Aliases:** Verify that all imports are correctly resolving using the `@alias` format.
- [ ] **Verify UI Logic:** Run pre-commit/test scripts to ensure UI logic changes for the "Reset Config" button have not introduced any regressions.
- [ ] **Node 24 Compatibility:** Confirm that the project builds and runs compatibly with Node 24 (the current LTS).

---

## Session Handover Context

_(Update this section whenever you perform a handover to keep track of state and any important discoveries)_

- **Current Status:** Session 1 completed. All absolute aliases in `src/features/` and remaining directories were converted, tested and passing.
- **Completed Sessions:** Session 1a, Session 1b, Session 1c, Session 1d.
- **Next Steps:** Proceed to session 2.
