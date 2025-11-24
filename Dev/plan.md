# AddonExe TypeScript Migration Plan

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

## Phase 4: Managers (Part 2 - Gameplay Systems)
- [ ] `shopManager.js`
- [ ] `kitsManager.js`
- [ ] `warpsManager.js`
- [ ] `homesManager.js`
- [ ] `tpaManager.js`
- [ ] `bountyManager.js`
- [ ] `floatingTextManager.js`
- [ ] `teamManager.js`

## Phase 5: UI System
- [ ] `uiManager.js`
- [ ] `panelBuilder.js`
- [ ] `panelRegistry.js`
- [ ] `panelHandlers.js`

## Phase 6: Commands
- [ ] `commandManager.js`
- [ ] `modules/commands/*.js` (Iterative)

## Phase 7: Main & Event Orchestration
- [ ] `main.js`
- [ ] `eventManager.js`
- [ ] `playerSpawn.js`
- [ ] `mobDeathEvents.js`
- [ ] Final cleanup of any remaining JS files.
