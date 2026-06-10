# AddonExe Modularization & Refactoring Plan

This document outlines the major refactoring and modularization effort required to split the addon into manageable, isolated features. The goal is to allow certain unfinished features to be shipped only in `nightly` builds while completely excluding their code from `production` builds.

To manage this large undertaking, the tasks are broken down into logical sessions. Each session should be completed by a new Jules instance, checking off tasks as they are finished.

**IMPORTANT: At the end of every session, update the "Context for Next Session" section at the bottom of this file.**

---

## 🛠️ Session 1: Build System & Feature Manifest (The Foundation)

**Goal:** Establish the build-time mechanism to filter features based on their release status (e.g., `prod` vs `dev`) and dynamically generate a feature registry.

- [ ] Create `features.yml` in the `scripts/` directory to define metadata for each feature.
    - Structure should include: `id`, `name`, `status` (`prod` | `dev`), `dependencies` (array of feature IDs), and an optional `subfeatures` array or mapping for fine-grained control (e.g., specific mini-games within a `games` feature).
    - _Note:_ The registry generator must be able to topologically sort the features based on dependencies to ensure they are initialized in the correct order.
- [ ] Update `tsup.config.ts` (or add a custom script) to read the feature manifest and the build flags (e.g., `--release`, `--nightly`).
- [ ] Create a script (e.g., `scripts/generate-feature-registry.js`) that runs _before_ the build step.
    - This script should generate a `src/core/featureRegistry.ts` file containing a dynamic array of imports for the _enabled_ features based on the build target.
    - It must also validate dependencies: If Feature A depends on Feature B, and Feature B is excluded, the script should fail the build or output a severe warning.
- [ ] Update `package.json` scripts to trigger this registry generation step during `build` and `watch`.
- [ ] Refactor `src/core/main.ts` to iterate over `src/core/featureRegistry.ts` to initialize the available features, replacing hardcoded imports.

---

## 🏗️ Session 2: Core Refactoring - Service Locator / Event Bus

**Goal:** Since features will be dynamically included/excluded, hardcoded imports between features (e.g., Economy importing from Moderation) will break the build if a feature is missing. We need a way to decouple them.

- [ ] Implement a lightweight Service Locator or Event Bus pattern in `src/core/`.
    - **Service Locator:** Allow features to register their public API (e.g., `registerService('economy', economyApi)`). Other features can safely check if a service exists before using it.
    - **Event Bus:** Allow features to emit and listen to custom events without direct imports.
- [ ] Review `src/core/featureDependencies.ts` and migrate any hardcoded feature-to-feature dependencies to use the new Service Locator/Event Bus.
- [ ] Ensure that core systems (Commands, UI Builder, Data Storage) expose a standard registration API that features can hook into during their initialization phase.

---

## 📦 Session 3: Feature Relocation - UI & Commands (Part 1)

**Goal:** Start moving feature-specific code out of `src/core/` and into `src/features/<feature_name>/`.

- [ ] **Commands:**
    - Move feature-specific commands out of `src/core/commands/` (if any exist there) into their respective feature folders (e.g., `src/features/economy/commands/`).
    - Update the Command Manager in `src/core/` so that features can register their commands dynamically during their `index.ts` initialization.
- [ ] **UI Panels:**
    - Move feature-specific UI definitions out of `src/core/ui/panels/` and into `src/features/<feature_name>/ui/`.
    - Refactor the UI registry (`src/core/ui/panels/panelRegistry.ts` or similar) to allow features to register their buttons/panels dynamically.

---

## 📦 Session 4: Feature Relocation - Data & Configs (Part 2)

**Goal:** Move configuration files and data schemas associated with specific features into their respective folders.

- [ ] Move feature-specific default configuration files (e.g., `economyConfig.default.ts`) from `src/core/` into `src/features/<feature_name>/`.
- [ ] Update `tsup.config.ts` if necessary to ensure it still finds and builds these config files correctly in their new locations.
- [ ] Refactor `src/core/configManager.ts` and `src/core/configurations.ts` to dynamically load feature configs instead of hardcoding them, or have features register their own configs during initialization.
- [ ] Move any feature-specific data managers or storage logic into the respective feature folders.

---

## 🧹 Session 5: Feature Independence & Cleanup

**Goal:** Audit the existing features to ensure they are truly independent and rely on the new service architecture.

- [ ] Review features like `economy`, `shop`, `anticheat`, `teleport`, etc.
- [ ] Ensure that if a feature is marked as "nightly" and excluded, the rest of the application compiles and runs without throwing "module not found" errors.
- [ ] Replace any remaining direct cross-feature imports with the Service Locator or Event Bus.
- [ ] Run standard tests and manual testing to verify everything functions as expected.

---

## Context for Next Session

_This section is to be updated by Jules at the end of every session._

**Current Status:** Planning phase completed. `plan.md` created.
**Next Step:** A new Jules session should begin **Session 1: Build System & Feature Manifest**.
**Notes:** The user wants a strict build-time separation. Unfinished features should physically not be in the output code for `prod` releases. Pay close attention to dependency validation during the build step.
