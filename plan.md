# Lint Remediation Plan

This document outlines the strategy to resolve the 500+ linting errors identified in the codebase, specifically targeting `@typescript-eslint/strict-boolean-expressions` and `@typescript-eslint/no-unnecessary-condition`.

## Strategy

**Rule:** `@typescript-eslint/strict-boolean-expressions`
**Fix:** Use explicit guards from `src/lib/guards.ts`.
- Replace `if (obj)` with `if (isDefined(obj))`
- Replace `if (str)` with `if (isNonEmptyString(str))`
- Replace `if (num)` with `if (isNumber(num))`
- **Import Path:** `import { isDefined, isNonEmptyString, isNumber } from '@lib/guards.js';`

**Rule:** `@typescript-eslint/no-unnecessary-condition`
**Fix:**
- If the check is truly redundant (e.g., TS knows the type is never null), remove it.
- If the check is defensive (runtime safety for external data), cast the variable to allow the check or keep it if it prevents a crash, but prefer fixing the upstream type definition if possible.
- **Note:** Many of these occur in UI builders or Command handlers where we interact with "any" or loose types.

## Batches

### Batch 1: Critical Fixes & Setup
**Goal:** Fix high-severity issues and setup patterns.
- **Files:**
  - `src/features/essentials/commands/help.ts` (Fix `no-unsafe-assignment`)
  - `src/core/commands/commandManager.ts` (High volume of errors, core logic)
  - `src/core/commands/index.ts`

### Batch 2: Core Event Handlers
**Goal:** Ensure event stability.
- **Files:**
  - `src/core/events/beforeChatSend.ts`
  - `src/core/events/entityDie.ts`
  - `src/core/events/entityHurt.ts`
  - `src/core/events/itemUse.ts`
  - `src/core/events/playerDimensionChange.ts`
  - `src/core/events/playerLeave.ts`
  - `src/core/events/playerSpawn.ts`
  - `src/core/events/scriptEventReceive.ts`
  - `src/core/mobDeathEvents.ts`

### Batch 3: Core Managers (Part A)
**Goal:** Fix configuration and data management.
- **Files:**
  - `src/core/configManager.ts`
  - `src/core/configManagerFactory.ts`
  - `src/core/dataManager.ts`
  - `src/core/playerDataManager.ts`
  - `src/core/rankDb.ts`
  - `src/core/rankManager.ts`

### Batch 4: Core Managers (Part B)
**Goal:** Fix gameplay systems.
- **Files:**
  - `src/core/cooldownManager.ts`
  - `src/core/diagnostics.ts`
  - `src/core/featureDependencies.ts`
  - `src/core/floatingTextManager.ts`
  - `src/core/helpfulLinksManager.ts`
  - `src/core/itemSerializer.ts`
  - `src/core/kitItemsManager.ts`
  - `src/core/kitsManager.ts`
  - `src/core/leaderboardManager.ts`
  - `src/core/teleportLogic.ts`

### Batch 5: UI System
**Goal:** Fix the UI framework.
- **Files:**
  - `src/core/ui/actionRegistry.ts`
  - `src/core/ui/actions.ts`
  - `src/core/ui/panelBuilder.ts`
  - `src/core/ui/systemRegistry.ts`
  - `src/core/uiManager.ts`
  - All files in `src/core/ui/panels/`

### Batch 6: Anti-Cheat Feature
**Goal:** Fix anti-cheat logic.
- **Files:**
  - `src/features/anticheat/commands/logs.ts`
  - `src/features/anticheat/commands/xraynotify.ts`
  - `src/features/anticheat/flagManager.ts`
  - `src/features/anticheat/itemCheck.ts`
  - `src/features/anticheat/logManager.ts`
  - `src/features/anticheat/movementCheck.ts`
  - `src/features/anticheat/xrayDetection.ts`

### Batch 7: Auction House & Economy
**Goal:** Fix complex features.
- **Files:**
  - `src/features/auctionHouse/auctionManager.ts`
  - `src/features/auctionHouse/commands/ah.ts`
  - `src/features/auctionHouse/ui/auctionPanel.ts`
  - `src/features/economy/commands/balance.ts`
  - `src/features/economy/ui/economyPanel.ts`

### Batch 8: Remaining Features
**Goal:** Final cleanup.
- **Files:**
  - `src/features/dailyRewards/dailyRewardsManager.ts`
  - `src/features/moderation/punishmentManager.ts`
  - Any remaining files in `src/core` or `src/features`.
