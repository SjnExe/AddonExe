# AddonExe TypeScript Migration Plan

## Current Status
**Phase 6 (Commands) is in progress.** The core manager and all "General" commands have been migrated.

## Instructions for Next Session
1.  **Goal:** Continue migrating the remaining JavaScript command files to TypeScript.
2.  **Scope:** The next batch is the **TPA System**, followed by the Home System, Economy System, etc.
3.  **Pattern:** Follow the established pattern: rename to `.ts`, implement the `CustomCommand` interface, use a default export, and update the command loader.
4.  **Verification:** Run `npm run build` and `npm run lint:fix` frequently.

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
- [x] Convert independent config files.
- [x] Convert Ranks System.
- [x] Convert Data & Config Managers.
- [x] Convert `playerDataManager.js` -> `.ts`.

## Phase 3: Managers (Part 1 - Chat & Moderation) (Completed)
- [x] `messaging.js` -> `.ts`
- [x] `punishmentManager.js` -> `.ts`
- [x] `reportManager.js` -> `.ts`
- [x] `cooldownManager.js` -> `.ts`
- [x] `helpfulLinksManager.js` -> `.ts`
- [x] `rulesManager.js` -> `.ts`

## Phase 4: Managers (Part 2 - Gameplay Systems) (Completed)
- [x] `shopManager.js` (and related)
- [x] `kitsManager.js` (and related)
- [x] `warpsManager.js`, `homesManager.js`, `tpaManager.js`
- [x] `bountyManager.js`, `floatingTextManager.js`, `teamManager.js`, `economyUtils.js`

## Phase 5: UI System (Completed)
- [x] `src/core/iconDB.js` -> `.ts`
- [x] All files in `src/core/ui/`
- [x] `src/core/uiManager.js` -> `.ts`

## Phase 6: Commands
- [x] **Core:**
    - [x] `src/modules/commands/commandManager.js` -> `.ts`
    - [x] `src/modules/commands/index.js` -> `.ts`
- [x] **Initial Batch:**
    - [x] `src/modules/commands/version.js` -> `.ts`
    - [x] `src/modules/commands/log.js` -> `.ts`
    - [x] `src/modules/commands/shop.js` -> `.ts`
- [x] **General Commands:**
    - [x] `src/modules/commands/help.js` -> `.ts`
    - [x] `src/modules/commands/panel.js` -> `.ts`
    - [x] `src/modules/commands/rules.js` -> `.ts`
    - [x] `src/modules/commands/links.js` -> `.ts`
    - [x] `src/modules/commands/status.js` -> `.ts`
    - [x] `src/modules/commands/deathcoords.js` -> `.ts`
    - [x] `src/modules/commands/spawn.js` -> `.ts`
    - [x] `src/modules/commands/rtp.js` -> `.ts`
- [ ] **TPA System:**
    - [ ] `src/modules/commands/tpa.js` -> `.ts`
    - [ ] `src/modules/commands/team.js` -> `.ts`
- [ ] **Home System:**
    - [ ] `src/modules/commands/home.js` -> `.ts`
    - [ ] `src/modules/commands/warp.js` -> `.ts`
- [ ] **Economy System:**
    - [ ] `src/modules/commands/balance.js` -> `.ts`
    - [ ] `src/modules/commands/pay.js` -> `.ts`
    - [ ] `src/modules/commands/bounty.js` -> `.ts`
    - [ ] `src/modules/commands/kit.js` -> `.ts`
- [ ] **Moderation Commands:**
    - [ ] `src/modules/commands/report.js` -> `.ts`
    - [ ] `src/modules/commands/kick.js` -> `.ts`
    - [ ] `src/modules/commands/ban.js` -> `.ts`
    - [ ] `src/modules/commands/mute.js` -> `.ts`
    - [ ] `src/modules/commands/freeze.js` -> `.ts`
    - [ ] `src/modules/commands/vanish.js` -> `.ts`
    - [ ] `src/modules/commands/clear.js` -> `.ts`
    - [ ] `src/modules/commands/ecwipe.js` -> `.ts`
    - [ ] `src/modules/commands/invsee.js` -> `.ts`
    - [ ] `src/modules/commands/copyinv.js` -> `.ts`
    - [ ] `src/modules/commands/clearchat.js` -> `.ts`
- [ ] **Administration Commands:**
    - [ ] `src/modules/commands/announcement.js` -> `.ts`
    - [ ] `src/modules/commands/dimensionLock.js` -> `.ts`
    - [ ] `src/modules/commands/gamemode.js` -> `.ts`
    - [ ] `src/modules/commands/rank.js` -> `.ts`
    - [ ] `src/modules/commands/reload.js` -> `.ts`
    - [ ] `src/modules/commands/restart.js` -> `.ts`
    - [ ] `src/modules/commands/save.js` -> `.ts`
    - [ ] `src/modules/commands/setbalance.js` -> `.ts`
    - [ ] `src/modules/commands/tp.js` -> `.ts`
    - [ ] `src/modules/commands/chattoconsole.js` -> `.ts`
    - [ ] `src/modules/commands/xraynotify.js` -> `.ts`
    - [ ] `src/modules/commands/floatingtext.js` -> `.ts`

## Phase 7: Main & Event Orchestration
- [ ] `main.js`
- [ ] `eventManager.js`
- [ ] `playerSpawn.js`
- [ ] `mobDeathEvents.js`
- [ ] Final cleanup of any remaining JS files.
