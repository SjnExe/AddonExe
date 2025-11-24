# AddonExe TypeScript Migration Plan

## Current Status
**Phase 4 Completed.** The next task is **Phase 5: UI System**.

## Instructions for Next Session
1. **Goal:** Migrate the UI system to TypeScript.
2. **Scope:** Convert all files in `src/core/ui/` and `src/core/uiManager.js`.
3. **Verification:** Run `npm run build` frequently. Use `npm run lint:fix` to clean up.
4. **Note:** The UI system relies heavily on `@minecraft/server-ui`. Ensure strict typing is applied where possible, but use `any` if necessary for complex dynamic panel generators to avoid getting stuck on circular type definitions.

## Phase 1: Environment Setup & Utils (Completed)
- [x] Create `src` directory and move files.
- [x] Install TypeScript, Prettier, ESLint plugins, and MC types.
- [x] Configure `tsconfig.json`, `.prettierrc`, `eslint.config.js`.
- [x] Update `package.json` scripts.
- [x] Migrate Batch 1 files:
  - [x] `src/core/utils.js` -> `src/core/utils.ts`
  - [x] `src/core/constants.js` -> `src/core/constants.ts`
  - [x] `src/core/logger.js` -> `src/core/logger.ts`
  - [x] `src/core/objectUtils.js` -> `src/core/objectUtils.ts`
  - [x] `src/config.js` -> `src/config.ts`
- [x] Update `release.yml` and `scripts/prepare-release.js`.

## Phase 2: Core Configuration & Data (Completed)
- [x] Convert independent config files:
    - [x] `src/core/economyConfig.js` -> `.ts`
    - [x] `src/core/itemsConfig.js` -> `.ts`
    - [x] `src/core/kitsConfig.js` -> `.ts`
    - [x] `src/core/shopConfig.js` -> `.ts`
    - [x] `src/core/shopCategoryConfig.js` -> `.ts`
    - [x] `src/core/spawnConfig.js` -> `.ts`
    - [x] `src/core/teamConfig.js` -> `.ts`
    - [x] `src/core/xrayConfig.js` -> `.ts`
- [x] Convert Ranks System:
    - [x] `src/core/ranksConfig.js` -> `.ts`
    - [x] `src/core/rankDb.js` -> `.ts`
    - [x] `src/core/rankManager.js` -> `.ts`
- [x] Convert Data & Config Managers:
    - [x] `src/core/dataManager.js` -> `.ts`
    - [x] `src/core/configManager.js` -> `.ts`
    - [x] `src/core/configManagerFactory.js` -> `.ts`
    - [x] `src/core/configurations.js` -> `.ts`
- [x] Convert `playerDataManager.js` -> `.ts`

## Phase 3: Managers (Part 1 - Chat & Moderation) (Completed)
- [x] `messaging.js` -> `.ts`
- [x] `punishmentManager.js` -> `.ts`
- [x] `reportManager.js` -> `.ts`
- [x] `cooldownManager.js` -> `.ts`
- [x] `helpfulLinksManager.js` -> `.ts`
- [x] `rulesManager.js` -> `.ts`

## Phase 4: Managers (Part 2 - Gameplay Systems) (Completed)
- [x] `shopManager.js` (including `shopAdminManager.js`)
- [x] `kitsManager.js` (including `kitAdminManager.js`, `kitItemsManager.js`)
- [x] `warpsManager.js`
- [x] `homesManager.js`
- [x] `tpaManager.js`
- [x] `bountyManager.js`
- [x] `floatingTextManager.js`
- [x] `teamManager.js`
- [x] `economyUtils.js`

## Phase 5a: UI System - Part 1 (Foundations)
- [ ] `src/core/iconDB.js` -> `src/core/iconDB.ts`
- [ ] `src/core/ui/components.js` -> `src/core/ui/components.ts`
- [ ] `src/core/ui/actionRegistry.js` -> `src/core/ui/actionRegistry.ts`
- [ ] `src/core/ui/configPanelRegistry.js` -> `src/core/ui/configPanelRegistry.ts`
- [ ] `src/core/ui/panelRegistry.js` -> `src/core/ui/panelRegistry.ts`
- [ ] `src/core/ui/uiUtils.js` -> `src/core/ui/uiUtils.ts`

## Phase 5b: UI System - Part 2 (Logic)
- [ ] `src/core/ui/panelBuilder.js`
- [ ] `src/core/ui/panelHandlers.js`
- [ ] `src/core/uiManager.js`

## Phase 6: Commands
- [ ] `commandManager.js`
- [ ] `modules/commands/*.js` (Iterative)

## Phase 7: Main & Event Orchestration
- [ ] `main.js`
- [ ] `eventManager.js`
- [ ] `playerSpawn.js`
- [ ] `mobDeathEvents.js`
- [ ] Final cleanup of any remaining JS files.
