# Rank & Permission Overhaul Plan

## Session 1: Schema & Global Migration Cleanup
- [ ] **Define New Rank Schema:** Refactor `src/core/ranksConfig.default.ts` to replace `permissionLevel` with `priority` (lower number = higher priority). Add `groups` (array of strings), `allow` (array of node strings), and `deny` (array of node strings). Ensure every rank inherits a global `default` group.
- [ ] **Update Player Data Model:** Modify `PlayerData` in `src/core/playerDataManager.ts` to support multiple ranks natively (e.g., replace `rankId: string` and `permissionLevel: number` with `ranks: string[]`).
- [ ] **Strip Legacy Migrations:**
    - Clean up `src/core/migrationManager.ts`. Remove all legacy version migration logic (`migrateToV1`, `migrateToV2`) and leave only the core version-checking skeleton.
    - Search for and remove any other legacy data migration code across the entire codebase.

## Session 2: Core Permission Engine & Cache System
- [ ] **Create Permission Engine Module:** Create a new module (e.g., `src/core/permissionEngine.ts` or refactor `rankManager.ts`).
- [ ] **Implement Per-Rank Caching:** Pre-calculate flattened permission node maps per rank. This map MUST be initialized with `Object.create(null)` for O(1) lookups.
- [ ] **Implement Player Node Map Merge:** Calculate a player's final node map by merging their pre-calculated rank maps based on priority (highest priority rank dictates conflicts).
- [ ] **Implement `hasPermission(player, node)`:**
    - Hardcode bypass for the `Owner` rank.
    - Support wildcards (`*`, `cmd.*`). First check for exact match, then segments.
- [ ] **Cache Invalidation & Re-merge:** Ensure the engine recalculates specific rank maps and immediately re-merges for online players when an admin edits a rank in-game via the UI.
- [ ] **Hardcoded Fallbacks:** Hardcode core permissions for the `Admin` rank to prevent accidental lockouts.

## Session 3: Command & UI Panel Restructuring
- [ ] **Vanilla Command Integration (/scriptevent):** Create a listener (e.g., in `src/core/events/scriptEventReceive.ts`) for `/scriptevent myaddon:add_rank <rank>` and `myaddon:remove_rank <rank>` to allow vanilla command blocks and `/function` to assign/revoke ranks.
- [ ] **Update UI Schema & Interfaces:** Refactor `PanelItem` in `src/core/ui/types.ts` to replace `permissionLevel?: number` with `permission?: string`.
- [ ] **Refactor Panel Definitions:** Update `src/core/ui/panelRegistry.ts` (and any other panel definition files) to use permission strings instead of integer levels.
- [ ] **Dynamic UI Visibility Filtering:** Update the UI builders (`src/core/ui/panelBuilder.ts` or similar) to show or hide buttons/sections based on dynamic runtime evaluations of `hasPermission()` instead of integer logic.

---

### Handover Context
*(To be updated after each session)*

**Completed in Previous Session:**
* None.

**Current State:**
* Initial plan created. Codebase is ready for Session 1.

**Next Session Needs to Know:**
* Execute Session 1 tasks.
