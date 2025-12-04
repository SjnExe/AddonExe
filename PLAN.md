# AddonExe Refactoring & Feature Plan

## Phase 1: Core Infrastructure Refactor

- [x] Create `src/core/storage/StorageManager.ts` (Unified storage with sharding).
- [x] Create `src/features/` directory.
- [x] Update `src/core/configManagerFactory.ts` to support dynamic feature configs.
- [x] Update `AGENTS.md` with new directory structure.

## Phase 2: Feature Migration (Economy & Shop)

- [x] Create `src/features/economy/`.
- [x] Move `src/core/economyManager.ts` -> `src/features/economy/economyManager.ts`.
- [x] Move `src/core/economyConfig.default.ts` -> `src/features/economy/economyConfig.ts`.
- [x] Move economy commands (`pay.ts`, `balance.ts`, etc.) to `src/features/economy/commands/`.
- [x] Create `src/features/shop/`.
- [x] Move shop related files.
- [x] Update `src/core/main.ts` to dynamically load Economy and Shop if enabled.

## Phase 3: Feature Migration (Teleportation & Teams)

- [x] Create `src/features/teleportation/`.
- [x] Move TPA, RTP, Warps, Homes logic and commands.
- [x] Create `src/features/teams/`.
- [x] Move Team logic and commands.
- [x] Ensure dynamic loading.

## Phase 4: Moderation & Anti-Cheat

- [x] Create `src/features/moderation/`.
- [x] Refactor `punishmentManager.ts` to use `StorageManager` (sharding) and move to `src/features/moderation/`.
- [x] Implement `Freeze` system (Tag + Movement cancel).
- [x] Implement `Mute` system (Chat event filter).
- [x] Create `src/features/anticheat/`.
- [x] Implement `ItemCheck` (Inventory scan on tick/event).
- [x] Implement `MovementCheck` (Velocity/Position heuristic foundation).

## Phase 5: Configuration & Defaults

- [x] Update `src/config.default.ts`: Disable Economy, Shop, TPA, Homes, RTP, Kits. Keep Ranks, Moderation enabled.
- [x] Refactor `src/core/ui/panelBuilder.ts` to dynamically build menus based on enabled features (improving UI structure).
- [x] Verify build and linting.
