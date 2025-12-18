# Plan: Enable Strict Indexed Access

This plan is designed for a future development session to safely enable the TypeScript strictness flag `noUncheckedIndexedAccess`. This flag forces developers to handle cases where accessing an array or object by index might return `undefined`, significantly improving runtime safety.

## Overview

- **Goal:** Enable `noUncheckedIndexedAccess: true` in `tsconfig.json` and resolve all resulting type errors.
- **Current State:** The flag is currently disabled. Enabling it reveals approximately 600+ errors where code assumes array/map access always returns a defined value.
- **Strategy:** Enable the flag, then fix errors in logical batches to ensure stability.

## Prerequisites

1.  **Enable Flag:**
    - Open `tsconfig.json`.
    - Set `"noUncheckedIndexedAccess": true` inside `"compilerOptions"`.
2.  **Verify Baseline:**
    - Run `npm run check-types` to generate the list of errors.

## Execution Checklist

### Batch 1: Core Utilities & Managers

Focus on the foundational files in `src/core`. These are critical and heavily used.

- [x] `src/core/utils.ts` - Fix array access in `resolveTarget` and helper functions.
- [x] `src/core/playerDataManager.ts` - Verified no errors.
- [x] `src/core/configManager.ts` & `configurations.ts` - Fix config object access.
- [x] `src/core/commandManager.ts` - Fix `this.commands.get(...)` returns.
- [x] `src/core/rankDb.ts`, `src/core/helpfulLinksManager.ts`, `src/core/kitsManager.ts`, `src/core/rulesManager.ts`, `src/core/sidebarManager.ts` - Fixed various `undefined` checks.

### Batch 2: Core UI Panels

Fix UI logic which often iterates over arrays of items.

- [x] `src/core/ui/panelBuilder.ts` - Verified no errors.
- [x] `src/core/ui/panelHandlers.ts` - Verified no errors.
- [x] `src/core/ui/uiUtils.ts` - Verified no errors.
- [x] `src/core/ui/panels/*.ts` - Fixed loop iterators and safe array access in all panels.

### Batch 3: Command Modules (Part A)

Fix the simpler commands in `src/modules/commands`.

- [x] `src/modules/commands/inventory.ts` - Added dimension and object checks.
- [x] `src/modules/commands/help.ts` - Handled optional command arguments.
- [x] `src/modules/commands/bounty.ts` - Added bounty existence checks.
- [x] `src/modules/commands/kit.ts` - Added kit existence checks.
- [x] `src/modules/commands/rules.ts` - Added rule index checks.
- [x] `src/modules/commands/commandManager.ts` - Added config existence checks.
- [x] `src/modules/commands/clear.ts` - Added target player checks.

### Batch 4: Feature Modules (Part B)

Fix complex feature logic in `src/features`.

- [x] `src/features/teams/teamManager.ts` - Fixed undefined team loading.
- [x] `src/features/teams/ui/teamPanel.ts` - Fixed item undefined checks.
- [x] `src/features/teleportation/commands/*.ts` - Fixed `tp`, `tpa`, `home` argument checks.
- [x] `src/features/social/friendManager.ts` - Fixed request undefined checks.
- [x] `src/features/social/ui/friendPanel.ts` - Fixed item and values checks.
- [x] `src/features/voting/ui/votePanel.ts` - Fixed parsing and option access.
- [ ] `src/features/shop/ui/shopPanel.ts` - Requires further cleanup (deferred to final polish).

### Batch 5: Detection Systems

- [x] `src/modules/detections/xrayDetection.ts` - Fixed ore type existence checks.
- [x] `src/modules/detections/spawnProtection.ts` - Verified safe.

### Final Polish

- [x] `src/features/teleportation/commands/warp.ts` - Fixed type assertions.
- [x] `src/features/social/ui/friendPanel.ts` - Fixed undefined check.
- [x] `src/core/ui/panels/rankPanel.ts` - Fixed unnecessary assertions.
- [x] Linting: Removed unnecessary type assertions across codebase.
- [ ] `src/features/shop/ui/shopPanel.ts` - **Pending Refactor**: Contains remaining strict type errors due to complex UI flow. Recommended for future refactor.

## Fix Patterns

When fixing these errors, apply the following patterns:

1.  **Optional Chaining (`?.`)**: Use if the value might be missing and `undefined` is acceptable propagation.

    ```typescript
    // Before
    const cmd = commands.get(name);
    cmd.execute();

    // After
    const cmd = commands.get(name);
    cmd?.execute();
    ```

2.  **Null Checks / Guard Clauses**: Use when you need to ensure existence before proceeding.

    ```typescript
    const player = players[0];
    if (!player) return;
    player.sendMessage('Hi');
    ```

3.  **Non-Null Assertion (`!`)**: **Avoid this** unless you are absolutely certain the value exists (e.g., inside a check that already verified existence, but TS missed it). Prefer explicit checks.

## Verification

After completing each batch:

1.  Run `npm run check-types` to ensure the error count has decreased.
2.  Run `npm run build` to ensure no syntax errors were introduced.
