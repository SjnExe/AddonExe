# AddonExe TypeScript Migration Plan

## Current Status
**Phase 5 (UI System) Completed.** The next task is **Phase 6: Commands**.

## Instructions for Next Session
1. **Goal:** Migrate the command system to TypeScript.
2. **Scope:** Convert `src/modules/commands/commandManager.js` and all individual command files in `src/modules/commands/`.
3. **Verification:** Run `npm run build` frequently. Use `npm run lint:fix` to clean up.
4. **Note:** The command manager is a critical component. Ensure type safety for command registration and execution.

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

## Phase 5: UI System (Completed)
- [x] `src/core/iconDB.js` -> `src/core/iconDB.ts`
- [x] `src/core/ui/components.js` -> `src/core/ui/components.ts`
- [x] `src/core/ui/actionRegistry.js` -> `src/core/ui/actionRegistry.ts`
- [x] `src/core/ui/configPanelRegistry.js` -> `src/core/ui/configPanelRegistry.ts`
- [x] `src/core/ui/panelRegistry.js` -> `src/core/ui/panelRegistry.ts`
- [x] `src/core/ui/uiUtils.js` -> `src/core/ui/uiUtils.ts`
- [x] `src/core/ui/panelBuilder.js` -> `src/core/ui/panelBuilder.ts`
- [x] `src/core/ui/panelHandlers.js` -> `src/core/ui/panelHandlers.ts`
- [x] `src/core/uiManager.js` -> `src/core/uiManager.ts`

## Phase 6: Commands
- [ ] `src/modules/commands/commandManager.js` -> `src/modules/commands/commandManager.ts`
- [ ] Migrate individual command modules:
    - [ ] `src/modules/commands/addbalance.js` -> `.ts`
    - [ ] `src/modules/commands/announcement.js` -> `.ts`
    - [ ] `src/modules/commands/ban.js` -> `.ts`
    - [ ] `src/modules/commands/config.js` -> `.ts`
    - [ ] `src/modules/commands/freeze.js` -> `.ts`
    - [ ] `src/modules/commands/help.js` -> `.ts`
    - [ ] `src/modules/commands/hub.js` -> `.ts`
    - [ ] `src/modules/commands/index.js` -> `.ts`
    - [ ] `src/modules/commands/kick.js` -> `.ts`
    - [ ] `src/modules/commands/kit.js` -> `.ts`
    - [ ] `src/modules/commands/log.js` -> `.ts`
    - [ ] `src/modules/commands/motd.js` -> `.ts`
    - [ ] `src/modules/commands/mute.js` -> `.ts`
    - [ ] `src/modules/commands/removebalance.js` -> `.ts`
    - [ ] `src/modules/commands/report.js` -> `.ts`
    - [ ] `src/modules/commands/restart.js` -> `.ts`
    - [ ] `src/modules/commands/rtp.js` -> `.ts`
    - [ ] `src/modules/commands/shop.js` -> `.ts`
    - [ ] `src/modules/commands/stats.js` -> `.ts`
    - [ ] `src/modules/commands/team.js` -> `.ts`
    - [ ] `src/modules/commands/tp.js` -> `.ts`
    - [ ] `src/modules/commands/unban.js` -> `.ts`
    - [ ] `src/modules/commands/unfreeze.js` -> `.ts`
    - [ ] `src/modules/commands/unmute.js` -> `.ts`
    - [ ] `src/modules/commands/vanish.js` -> `.ts`
    - [ ] `src/modules/commands/version.js` -> `.ts`
    - [ ] `src/modules/commands/warp.js` -> `.ts`
    - [ ] `src/modules/commands/xraynotify.js` -> `.ts`

## Phase 7: Main & Event Orchestration
- [ ] `main.js`
- [ ] `eventManager.js`
- [ ] `playerSpawn.js`
- [ ] `mobDeathEvents.js`
- [ ] Final cleanup of any remaining JS files.
