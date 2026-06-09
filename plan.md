# Rank & Permission Overhaul Plan

## Context & Requirements

We are replacing the current single-rank, integer-based `permissionLevel` system with a highly optimized, multi-rank string-based permission node system.

### 1. Core Architecture & Optimizations (The "Calculated Node Map")

- **Multiple Ranks via JSON:** Players can hold multiple ranks simultaneously. Ranks are stored in the player's JSON data (e.g., `pData.ranks = ['member', 'vip', 'mod']`).
- **Rank Schema:** Ranks consist of `groups` (bundles of predefined permissions), `allow` (specific nodes), `deny` (specific overriding nodes), and a `priority` integer. Every rank inherits a global `default` group.
- **Priority & Hierarchy:** The `priority` integer replaces the old `permissionLevel`. **Lower numbers equal higher priority.** Higher priority explicitly wins all conflicts (e.g., if a high-priority rank allows a node but a low-priority rank denies it, the allow wins). Priority also determines chat prefix (highest priority rank shown) and targeting hierarchy (prevents lower staff from acting on higher staff).
- **Per-Rank Caching (Composition Optimization):** Since many players share the exact same combination of ranks, we will cache flattened nodes _per rank_ first. To calculate a player's final node map, merge their pre-calculated rank maps based on priority.
- **Calculated Node Map Engine:** To ensure O(1) runtime lookups, permissions are compiled into a flat map cache when a player joins or ranks change. This dictionary MUST be initialized with `Object.create(null)` to eliminate prototype chain overhead in the Bedrock V8 engine.
- **Wildcard Support:** The `hasPermission()` check must support wildcards (`*`, `cmd.*`). For maximum speed, it should check exact matches first, then fall back to checking segment wildcards directly against the flat map.
- **In-Game Editing Cache Invalidations:** When an admin edits a rank in-game via the UI, the engine must quickly recalculate that specific rank's map and instantly re-merge it for any online players holding that rank.
- **Hardcoded Fallbacks:** The `Owner` rank inherently bypasses all permission checks (has the literal `*` wildcard internally). The `Admin` rank has a hardcoded, uneditable set of core permissions to prevent accidental lockouts.
- **Universal Vanilla Command Integration (/scriptevent):** We are NOT doing tag syncing. To allow vanilla command blocks and `/function` to interact with the addon (including giving ranks), we will set up a universal `/scriptevent` listener (e.g., `src/core/events/scriptEventReceive.ts`). This listener will act as a router for various addon commands (e.g., listening for `/scriptevent myaddon:action {"action": "add_rank", "rank": "admin"}` targeted at a player, or a similar structured payload).
- **Clear Node Naming Conventions:** The `Owner` rank has `*` internally which grants all permissions. However, "Owner-only" features must have explicitly named nodes (e.g., `ui.panel.owner` or `cmd.op`) instead of checking for `*`. This allows server owners to selectively grant those specific capabilities to an `Admin` via the config without making them a full `Owner`.

### 2. Codebase Clean Slate (No Data Migration)

- **Strip All Legacy Migrations:** Because this is effectively a V1 release, ALL legacy data migration code across the entire codebase (for all features, not just ranks) must be deleted.
- **Keep Base Skeleton:** Only the core version-checking loop and migration system framework should remain to handle future updates.
- **Graceful Data Load Fallbacks:** While formal migrations are removed, `playerDataManager.ts` must safely default missing fields (like the new `ranks` array) to `['member']` when parsing legacy JSON, preventing crashes without needing explicit migration logic.

### 3. Panel & UI Restructuring

- **Dynamic Conditional UI Elements:** The `PanelItem` interface and UI builders must be refactored to replace integer level requirements with permission strings (e.g., `permission: 'ui.panel.admin'`).
- **Visibility Filtering:** Buttons and menu sections within the `/panel` must be dynamically shown or hidden based on runtime evaluations of `hasPermission()`.

---

## Session 1: Schema & Global Migration Cleanup

- [x] **Define New Rank Schema:** Refactor `src/core/ranksConfig.default.ts` to replace `permissionLevel` with `priority` (lower number = higher priority). Add `groups` (array of strings), `allow` (array of node strings), and `deny` (array of node strings). Ensure every rank inherits a global `default` group. Include standard properties like `chatFormatting` and `nametagPrefix`.
- [x] **Define Permission Groups Schema:** Create a structure (e.g., in `ranksConfig.default.ts` or a new config) to define what nodes belong to which `groups` (bundles of predefined permissions). Standardize permission node strings (e.g. `cmd.kick`, `ui.panel.admin`, `ui.panel.owner`).
- [x] **Update Player Data Model:** Modify `PlayerData` in `src/core/playerDataManager.ts` to support multiple ranks natively (e.g., replace `rankId: string` and `permissionLevel: number` with `ranks: string[]`). Update creation and load functions to gracefully default to `['member']`.
- [x] **Strip Legacy Migrations:**
    - Clean up `src/core/migrationManager.ts`. Remove all legacy version migration logic (`migrateToV1`, `migrateToV2`) and leave only the core version-checking skeleton.
    - Search for and remove any other legacy data migration code across the entire codebase (e.g., legacy single-prop code in `playerDataManager.ts`).

## Session 2: Core Permission Engine & Cache System

- [x] **Create Permission Engine Module:** Create a new module (e.g., `src/core/permissionEngine.ts` or refactor `rankManager.ts`).
- [x] **Implement Per-Rank Caching:** Pre-calculate flattened permission node maps per rank. This map MUST be initialized with `Object.create(null)` for O(1) lookups.
- [x] **Implement Player Node Map Merge:** Calculate a player's final node map by merging their pre-calculated rank maps based on priority (highest priority rank dictates conflicts).
- [x] **Implement `hasPermission(player, node)`:**
    - Hardcode bypass for the `Owner` rank (treat as if they have `*`).
    - Support wildcards (`*`, `cmd.*`). First check for exact match, then segments.
- [x] **Cache Invalidation & Re-merge:** Ensure the engine recalculates specific rank maps and immediately re-merges for online players when an admin edits a rank in-game via the UI.
- [x] **Hardcoded Fallbacks:** Hardcode core permissions for the `Admin` rank to prevent accidental lockouts.
- [x] **Chat Prefix & Nametag Resolution:** Update `updatePlayerNameTag` (or equivalent) to dynamically resolve a player's display prefix and chat formatting based on their highest-priority rank.

## Session 3: Script Events & Handlers

- [x] **Universal Script Event Listener:** Create a universal listener (e.g., `src/core/events/scriptEventReceive.ts`) to act as a router for `/scriptevent` commands. Implement an action handler system so new capabilities can be easily added.
- [x] **Secure the Script Event Listener:** Ensure the universal script event listener validates the `sourceType` (e.g., `MessageSourceType.Server` or `MessageSourceType.Entity`). If the source is a player, verify they have the appropriate permissions to prevent exploits.
- [x] **Rank Action Handlers:** Implement specific handlers within the universal script event listener for adding and removing ranks (e.g., parsing a payload to assign a rank to the target player).

## Session 4: Targeting & Hierarchy

- [x] **Update `.mcfunction` Files:** Modify `packs/behavior/functions/admin.mcfunction` (and any related function files like `setup.mcfunction` or `owner.mcfunction`) to replace old tag commands (`/tag @s add admin`) with the new `/scriptevent` command (e.g., `/scriptevent myaddon:action {"action":"add_rank","rank":"admin"}`) so that `/function admin` properly assigns the admin rank using the new system.
- [x] **Targeting Hierarchy Enforcement (Online & Offline):** Implement a utility function to compare two players' highest priorities. Apply this check to all moderation commands and UI actions (kick, ban, mute, freeze) to prevent lower-priority staff from targeting higher-priority staff. This must safely load offline player data if targeting an offline player.

## Session 5: UI Refactoring

- [x] **Update UI Schema & Interfaces:** Refactor `PanelItem` in `src/core/ui/types.ts` to replace `permissionLevel?: number` with `permission?: string`.
- [x] **Refactor Panel Definitions:** Update `src/core/ui/panelRegistry.ts` (and any other panel definition files) to use permission strings instead of integer levels. Convert old level checks to explicit node names (e.g. `ui.panel.owner` instead of level `0`).

## Session 6: Config and UI Cleanup

**Goal:** Remove centralized command settings and command panel UI.

- [x] **Remove `commandSettings`:**
    - Delete `commandSettings` entirely from `config.default.ts`, `config.schema.ts`, and the `Config` interface. Command toggles and cooldowns will no longer be centralized.
- [x] **Remove Command Panel UI:**
    - Delete `src/core/ui/panels/commandPanel.ts`. The `/panel` UI will no longer have a "Commands" section at all.
    - Remove `commandSystemPanel` and related config bindings from `src/core/ui/panelRegistry.ts` and `src/core/ui/systemRegistry.ts`.

## Session 7: Command Manager Core Refactoring

**Goal:** Update `CustomCommand` interface and execution logic.

- [x] **Update `CustomCommand` Interface:**
    - In `src/core/commands/commandManager.ts`, replace `permissionLevel?: number` with `permissionNode: string` (This is REQUIRED, no fallbacks).
    - Remove `cooldown` and `enabled` properties from the interface, as these will be handled by feature-specific systems later.
- [x] **Update Execution Logic (`commandManager.ts`):**
    - Remove all logic checking `config.commandSettings` (enabled, cooldown, permissionLevel).
    - Update command execution to explicitly use: `hasPermission(player, command.permissionNode)`.

## Session 8: Feature Commands Refactoring

**Goal:** Migrate from integer-based permission levels to string-based permission nodes for all feature commands.

- [x] **Fix Compilation (Find-and-Replace):**
    - Run a global regex/replace across `src/features/**/commands/*.ts`.
    - Replace `permissionLevel: <number>` with an explicitly defined `permissionNode: 'cmd.<commandName>'` (e.g., `cmd.reset` for owner commands, `cmd.tp` for teleport). The node must be short and understandable.
    - CRITICAL: Because `cooldown` and `enabled` are being removed from the `CustomCommand` interface, you must ALSO remove any `cooldown` or `enabled` fields from the command definitions in these files during the find-and-replace so the codebase compiles.
- [x] **Wrap Up (When Session 8 is eventually executed):**
    - Run `npm run format`.
    - Run `npx tsc --noEmit` to verify type safety.
    - Call `pre_commit_instructions`.

## Sessions 9 & 10: Feature Systems Refactoring

**Goal:** Delegate toggles, cooldowns, and feature-specific logic to their respective systems (Shop, TPA, Spawn, Kits, etc.).

- [ ] **System-Specific Enable/Disable:**
    - If a system (e.g., Shop) is disabled, all related UI, commands, and logic are disabled _only for the public_.
    - **Crucial:** Staff/Admin configurations must not be soft-locked. Owner/Admin facing tools remain functional even if the public system is disabled.
- [ ] **System-Specific Cooldowns:**
    - Most commands do _not_ need a specific cooldown. Move general anti-spam global cooldowns to an Anti-Cheat or Chat system.
    - Move specific cooldown logic out of the command manager. `/spawn` cooldown belongs in the Spawn system; `/tpa` cooldown belongs in the TPA system. (Note: `/setspawn` does not get the spawn cooldown, only the anti-spam one).
- [ ] **Kits System Updates:**
    - Needs node-based exclusivity (tie specific kits to ranks/nodes).
    - Add custom prices (0 or positive integers) per kit.
    - Add specific cooldowns per kit (not just a global kit system cooldown).

## Future Sessions: Rank & Permission Security Engine

**Goal:** Fix security flaws in the Rank Editing UI using a Priority-Based Hierarchy Enforcement.

- [ ] **Priority Numbers:** `0` = Owner, `1` = Admin, `2+` = Mods/Members. `1024` = Default Member rank. Lower number = higher authority.
- [ ] **Hierarchy Enforcement:**
    - **Editing Ranks:** An editor can only create or edit a rank with a priority _strictly greater_ than their own. (e.g., Admin [Priority 1] can only edit/create ranks at Priority 2 or higher. They cannot grant Owner [0] or Admin [1] powers).
    - **Editing Players:** An Admin cannot edit the rank assignment of a player whose highest rank priority is `<= ` the Admin's highest rank priority.
- [ ] **Permission Delegation (Option A Logic):**
    - When adding permission nodes via the UI, an editor can _only_ grant nodes they already possess.
    - _Edge Cases to Handle:_ Wildcard expansion (if Admin has `ui.*` but not explicitly `ui.shop`, they can still grant it), and arrays of denied permissions must be strictly respected.
- [ ] **Immutable Core Ranks:**
    - **Owner Rank (0):** Possesses the `*` wildcard permission. Core properties (ID, priority, permissions) are completely locked. Not even the Owner can edit them (to prevent accidental breakage). The Owner _can_ edit cosmetic properties (prefix, nametag, chat colors).
    - **Member Rank (1024):** Default rank given to everyone at all times. Contains default permissions. Needs to be partially locked.

---

### Handover Context

_(To be updated after each session)_

**Completed in Previous Session:**

- Session 8 completed: Fixed compilation errors, removed `enabled` and `cooldown` from commands definitions in `src/features/**/commands/*.ts`, updated logic to use `hasPermission` over `permissionLevel` checks, and verified the output with `tsc --noEmit` and `npm run format`.

**Current State:**

- The `CustomCommand` interface changes are fully implemented and the command commands across the feature modules compile. Feature-specific logic refactoring (toggles, cooldowns) is up next in Sessions 9 & 10.

**Next Session Needs to Know:**

- Begin Sessions 9 & 10: Delegate toggles, cooldowns, and feature-specific logic to their respective systems (Shop, TPA, Spawn, Kits, etc.).
