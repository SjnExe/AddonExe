# Plan: Strict Linting & Robustness Migration

This plan outlines the steps to upgrade the codebase with strict TypeScript linting rules and a custom utility library.

## Phase 1: Setup & Infrastructure
- [x] **Install Dependencies**
    - `type-fest` (Utility types)
    - `eslint-plugin-deprecation` (Installed, but disabled in config due to ESLint 9 API incompatibility - see config comments)
- [x] **Configure ESLint (`eslint.config.js`)**
    - Enable `@typescript-eslint/no-unnecessary-condition`
    - Enable `@typescript-eslint/strict-boolean-expressions`
    - Enable `@typescript-eslint/no-unnecessary-type-assertion`
- [x] **Create Custom Library (`src/lib`)**
    - `src/lib/index.ts` (Barrel file)
    - `src/lib/types.ts` (Type definitions)
    - `src/lib/guards.ts` (Type guards like `isDefined`)
    - `src/lib/result.ts` (Result pattern for safe error handling)

## Phase 2: Batch Fixes (Linting Compliance)
*Fixing errors exposed by the new rules, one directory at a time.*

- [ ] **Batch 1: Core Infrastructure (`src/core`)**
    - [x] Fix `src/core/utils/`
    - [x] Fix `src/core/configLoader.ts`
    - [x] Fix `src/core/ui/systemRegistry.ts` & `src/core/ui/uiUtils.ts`
    - [x] Fix `src/core/commands/index.ts`
    - [ ] Fix `src/core/commands/commandManager.ts` (Partially fixed, ~30 errors remaining)
    - [ ] Fix `src/core/ui/panels/` (Pending)
    - [ ] Fix `src/core/logger.ts`, `src/core/storage/` (Status: Clean or Pending check)
- [ ] **Batch 2: Features - Economy & Ranks**
    - `src/features/economy/`
    - `src/features/ranks/`
- [ ] **Batch 3: Features - Moderation & AntiCheat**
    - `src/features/moderation/`
    - `src/features/anticheat/`
- [ ] **Batch 4: Features - World & Player**
    - `src/features/world/`
    - `src/features/player/`
    - Other remaining features
- [ ] **Batch 5: Scripts & Root Files**
    - `scripts/` directory
    - Root files (`src/main.ts` equivalent if exists)

## Phase 3: Verification
- [ ] **Final Build Check** (`npm run build`)
- [ ] **Final Test Run** (`npm test`)

## Guidelines for Future Agents
1.  **Read this Plan:** Always check the current status in this file.
2.  **Pick a Batch:** Select the next unchecked batch.
3.  **Run Linter:** Run `npx eslint <directory> --fix` (if safe) or manually fix.
4.  **Use `src/lib`:** Replace ad-hoc null checks with `isDefined()` or similar guards from `src/lib`.
5.  **Verify:** Ensure `npm run build` passes after every batch.
6.  **Update Plan:** Mark the batch as complete in this file.
