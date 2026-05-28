# Rank & Permission Overhaul Plan

## Context & Requirements

We are replacing the current single-rank, integer-based `permissionLevel` system with a highly optimized, multi-rank string-based permission node system.

### 1. Core Architecture & Optimizations (The "Calculated Node Map")
* **Multiple Ranks via JSON:** Players can hold multiple ranks simultaneously. Ranks are stored in the player's JSON data (e.g., `pData.ranks = ['member', 'vip', 'mod']`).
* **Rank Schema:** Ranks consist of `groups` (bundles of predefined permissions), `allow` (specific nodes), `deny` (specific overriding nodes), and a `priority` integer. Every rank inherits a global `default` group.
* **Priority & Hierarchy:** The `priority` integer replaces the old `permissionLevel`. **Lower numbers equal higher priority.** Higher priority explicitly wins all conflicts (e.g., if a high-priority rank allows a node but a low-priority rank denies it, the allow wins). Priority also determines chat prefix (highest priority rank shown) and targeting hierarchy (prevents lower staff from acting on higher staff).
* **Per-Rank Caching (Composition Optimization):** Since many players share the exact same combination of ranks, we will cache flattened nodes *per rank* first. To calculate a player's final node map, merge their pre-calculated rank maps based on priority.
* **Calculated Node Map Engine:** To ensure O(1) runtime lookups, permissions are compiled into a flat map cache when a player joins or ranks change. This dictionary MUST be initialized with `Object.create(null)` to eliminate prototype chain overhead in the Bedrock V8 engine.
* **Wildcard Support:** The `hasPermission()` check must support wildcards (`*`, `cmd.*`). For maximum speed, it should check exact matches first, then fall back to checking segment wildcards directly against the flat map.
* **In-Game Editing Cache Invalidations:** When an admin edits a rank in-game via the UI, the engine must quickly recalculate that specific rank's map and instantly re-merge it for any online players holding that rank.
* **Hardcoded Fallbacks:** The `Owner` rank inherently bypasses all permission checks. The `Admin` rank has a hardcoded, uneditable set of core permissions to prevent accidental lockouts.
* **Vanilla Command Integration (/scriptevent):** We are NOT doing tag syncing. To allow vanilla command blocks and `/function` to give ranks, we will set up a `/scriptevent` listener (e.g., listening for `/scriptevent myaddon:add_rank admin` targeted at a player).

### 2. Codebase Clean Slate (No Data Migration)
* **Strip All Legacy Migrations:** Because this is effectively a V1 release, ALL legacy data migration code across the entire codebase (for all features, not just ranks) must be deleted.
* **Keep Base Skeleton:** Only the core version-checking loop and migration system framework should remain to handle future updates.

### 3. Panel & UI Restructuring
* **Dynamic Conditional UI Elements:** The `PanelItem` interface and UI builders must be refactored to replace integer level requirements with permission strings (e.g., `permission: 'ui.panel.admin'`).
* **Visibility Filtering:** Buttons and menu sections within the `/panel` must be dynamically shown or hidden based on runtime evaluations of `hasPermission()`.

---

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
