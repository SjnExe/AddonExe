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

- [x] **Batch 1: Core Infrastructure (`src/core`)**
    - [x] Fix `src/core/utils/`
    - [x] Fix `src/core/configLoader.ts`
    - [x] Fix `src/core/ui/systemRegistry.ts` & `src/core/ui/uiUtils.ts`
    - [x] Fix `src/core/commands/index.ts`
    - [x] Fix `src/core/commands/commandManager.ts` (Completed)
    - [x] Fix `src/core/ui/panels/` (Completed: Refactored to strict null safety and aliased imports)
    - [x] Fix `src/core/logger.ts`, `src/core/storage/` (Verified clean)
- [x] **Batch 2: Features - Economy & Ranks**
    - `src/features/economy/`
    - `src/features/ranks/` (Refactored from `src/core/`)
- [x] **Batch 3: Features - Moderation & AntiCheat**
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

### Learned Best Practices
*   **Use `isDefined`:** Always import `{ isDefined } from '@lib/guards.js'` for null/undefined checks. Avoid loose boolean checks on objects or strings.
*   **Overwrite for Reliability:** When applying broad fixes to a file, prefer `overwrite_file_with_block` over `replace_with_git_merge_diff` if the diffs are complex or if you suspect partial application issues.
*   **ESLint Caching:** If `eslint` reports errors that contradict the file content (verified via `read_file`), run `npx eslint --no-cache` to clear stale results.
*   **Strict Boolean Expressions:** The linter forbids `if (nullableString)`. Use `if (isDefined(nullableString) && nullableString.length > 0)` or similar explicit checks.
