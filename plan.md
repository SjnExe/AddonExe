# Refactoring Plan: Folder Shortening and Name Deduplication

This plan outlines the steps required to refactor the feature directories to shorter, more appropriate names, and remove prefix duplications in file names inside these directories. The work is split across multiple sessions for balance and clarity. Each session should be fully completed and all typescript/test errors resolved before moving to the next.

## Overall Goals

1. Shorten feature directory names:
    - `auctionHouse` -> `auction`
    - `voting` -> `vote`
    - `teleportation` -> `teleport`
    - `kits` -> `kit`
    - `teams` -> `team`
    - `dailyRewards` -> `daily`
      _(Note: `moderation`, `anticheat`, `economy`, and `essentials` will remain unchanged)._
2. Standardize all usage of "teams" to "team" (singular) codebase-wide. This applies to directory names, variables, class names, interfaces, etc.
3. Remove redundant prefixes in file names within feature directories so they don't duplicate the directory name (e.g., `src/features/shop/shopManager.ts` -> `src/features/shop/manager.ts`).
4. Update all relevant imports across the codebase after moving or renaming files.

---

## Session 1: Directory Renames & Global "team" Standardization

**Tasks:**

- [ ] Rename `src/features/auctionHouse` to `src/features/auction`.
- [ ] Rename `src/features/dailyRewards` to `src/features/daily`.
- [ ] Rename `src/features/kits` to `src/features/kit`.
- [ ] Rename `src/features/teams` to `src/features/team`.
- [ ] Rename `src/features/teleportation` to `src/features/teleport`.
- [ ] Rename `src/features/voting` to `src/features/vote`.
- [ ] Update all import paths across `src/**/*.ts` to reflect the new directory names.
- [ ] Globally standardize the word "teams" to "team":
    - Change variables like `teamsManager` to `teamManager`.
    - Change interface names like `TeamsConfig` to `TeamConfig`.
    - Change class names like `TeamsManager` to `TeamManager`.
    - Apply this rigorously to code logic, while being careful not to break user-facing messages unless appropriate.
- [ ] Run typescript compiler/checker (`tsc --noEmit` if available) and ensure all imports are resolved correctly without errors.

**Handover Context for Session 2:**

> Session 1 completed the directory renaming (`auctionHouse` -> `auction`, `voting` -> `vote`, etc.) and the global code refactor changing "teams" to "team". Feature imports have been updated and are functional. We are now ready to begin removing the duplicate prefix names from individual files inside the feature directories.

---

## Session 2: Internal File Deduplication (Part 1)

**Tasks:**

- [ ] **`anticheat`**:
    - Rename `anticheatConfig.ts` -> `config.ts`
    - Rename `anticheatConfigLoader.ts` -> `configLoader.ts`
    - Update imports.
- [ ] **`auction`**:
    - Rename `auctionHouseConfig.default.ts` -> `config.default.ts`
    - Rename `auctionManager.ts` -> `manager.ts`
    - Rename `ui/auctionPanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] **`daily`**:
    - Rename `dailyRewardsConfig.default.ts` -> `config.default.ts`
    - Rename `dailyRewardsManager.ts` -> `manager.ts`
    - Update imports.
- [ ] **`economy`**:
    - Rename `economyConfig.ts` -> `config.ts`
    - Rename `economyUtils.ts` -> `utils.ts`
    - Rename `ui/economyPanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] **`kit`**:
    - Rename `kitAdminManager.ts` -> `adminManager.ts`
    - Rename `kitItemsManager.ts` -> `itemsManager.ts`
    - Rename `kitsConfig.default.ts` -> `config.default.ts`
    - Rename `kitsManager.ts` -> `manager.ts`
    - Rename `ui/kitPanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] Run typescript compiler/checker to ensure imports and logic references are intact.

**Handover Context for Session 3:**

> Session 2 completed the first half of the internal file deduplication (for `anticheat`, `auction`, `daily`, `economy`, and `kit`). Imports have been corrected. We are now ready to finish deduplicating the files in the remaining feature directories and perform a final validation.

---

## Session 3: Internal File Deduplication (Part 2) & Final Validation

**Tasks:**

- [ ] **`shop`**:
    - Rename `shopAdminManager.ts` -> `adminManager.ts`
    - Rename `shopCategoryConfig.ts` -> `categoryConfig.ts`
    - Rename `shopConfig.ts` -> `config.ts`
    - Rename `shopManager.ts` -> `manager.ts`
    - Rename `shopUtils.ts` -> `utils.ts`
    - Rename `ui/shopAdminPanel.ts` -> `ui/adminPanel.ts`
    - Rename `ui/shopUserPanel.ts` -> `ui/userPanel.ts`
    - Update imports.
- [ ] **`moderation`**:
    - Rename `ui/moderationPanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] **`sidebar`**:
    - Rename `sidebarConfig.default.ts` -> `config.default.ts`
    - Rename `sidebarManager.ts` -> `manager.ts`
    - Update imports.
- [ ] **`social`**:
    - Since the directory is `social` and files are `friend*`, there is no direct directory-name duplication. Review if any `social` prefixed files exist and rename them if necessary.
- [ ] **`team`**:
    - Rename `teamConfig.ts` -> `config.ts`
    - Rename `teamManager.ts` -> `manager.ts`
    - Rename `teamTypes.ts` -> `types.ts`
    - Rename `ui/teamPanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] **`teleport`**:
    - Rename `teleportUtils.ts` -> `utils.ts`
    - Rename `ui/teleportPanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] **`vote`**:
    - Rename `voteManager.ts` -> `manager.ts`
    - Rename `ui/votePanel.ts` -> `ui/panel.ts`
    - Update imports.
- [ ] Perform a final codebase-wide sweep with the typescript compiler/checker (`tsc --noEmit`).
- [ ] Run tests (if applicable) and manually review core features to guarantee everything is correctly linked.

**Handover Context (Final):**

> All directories have been shortened appropriately, the "team" terminology is standardized, and all feature-specific files have had their redundant folder-name prefixes removed. The refactor is complete.
