# AddonExe TypeScript Migration Plan

## Current Status
**Phase 6 (Commands) is in progress.** The core command manager and a few example commands have been migrated.

## Instructions for Next Session
1.  **Goal:** Continue migrating the remaining JavaScript command files to TypeScript.
2.  **Scope:** Convert all remaining `.js` files in `src/modules/commands/` to `.ts`.
3.  **Pattern:** Follow the established pattern from the initial migration:
    *   Rename the file from `.js` to `.ts`.
    *   Import the `CustomCommand` interface.
    *   Define the command object with the `CustomCommand` type.
    *   Use a default export for the command object(s).
    *   Update the command loader at `src/modules/commands/index.ts`.
4.  **Verification:** Run `npm run build` and `npm run lint:fix` frequently to ensure correctness and adherence to coding standards.

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
- [x] `src/modules/commands/commandManager.js` -> `src/modules/commands/commandManager.ts`
- [x] `src/modules/commands/index.js` -> `.ts`
- [x] `src/modules/commands/version.js` -> `.ts`
- [x] `src/modules/commands/log.js` -> `.ts`
- [x] `src/modules/commands/shop.js` -> `.ts`
- [ ] Migrate remaining individual command modules:
    - [ ] `src/modules/commands/addbalance.js` -> `.ts`
    - [ ] `src/modules/commands/announcement.js` -> `.ts`
    - [ ] `src/modules/commands/ban.js` -> `.ts`
    - [ ] `src/modules/commands/config.js` -> `.ts`
    - [ ] `src/modules/commands/freeze.js` -> `.ts`
    - [ ] `src/modules/commands/help.js` -> `.ts`
    - [ ] `src/modules/commands/hub.js` -> `.ts`
    - [ ] `src/modules/commands/kick.js` -> `.ts`
    - [ ] `src/modules/commands/kit.js` -> `.ts`
    - [ ] `src/modules/commands/motd.js` -> `.ts`
    - [ ] `src/modules/commands/mute.js` -> `.ts`
    - [ ] `src/modules/commands/removebalance.js` -> `.ts`
    - [ ] `src/modules/commands/report.js` -> `.ts`
    - [ ] `src/modules/commands/restart.js` -> `.ts`
    - [ ] `src/modules/commands/rtp.js` -> `.ts`
    - [ ] `src/modules/commands/stats.js` -> `.ts`
    - [ ] `src/modules/commands/team.js` -> `.ts`
    - [ ] `src/modules/commands/tp.js` -> `.ts`
    - [ ] `src/modules/commands/unban.js` -> `.ts`
    - [ ] `src/modules/commands/unfreeze.js` -> `.ts`
    - [ ] `src/modules/commands/unmute.js` -> `.ts`
    - [ ] `src/modules/commands/vanish.js` -> `.ts`
    - [ ] `src/modules/commands/warp.js` -> `.ts`
    - [ ] `src/modules/commands/xraynotify.js` -> `.ts`

## Phase 7: Main & Event Orchestration
- [ ] `main.js`
- [ ] `eventManager.js`
- [ ] `playerSpawn.js`
- [ ] `mobDeathEvents.js`
- [ ] Final cleanup of any remaining JS files.
