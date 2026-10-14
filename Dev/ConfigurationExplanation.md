# Configuration Loading, Saving, and Merging Explained

This document explains how AddonExe's configuration system manages default files, in-game UI edits, version migrations, and `/xreload`.

## 1. Architecture Overview

AddonExe uses a two-state dynamic property persistence model managed by `src/core/configManagerFactory.ts`, `src/core/configManager.ts`, and `src/core/configurations.ts`:

1. **Default Configuration (Compiled File):** Defined in `src/config.ts` and feature config files (`*Config.ts`), compiled into `packs/behavior/scripts/` during build.
2. **Current Configuration (Dynamic Property):** Stored in world dynamic properties (e.g., `exe:config`) and updated immediately when admins change settings in-game via `/panel`.
3. **Last Loaded Snapshot (Dynamic Property):** Stored alongside the current config (e.g., `exe:config:last_loaded`) to record the state of the disk file the last time the server loaded or ran `/xreload`.

## 2. Adding a New Feature Configuration

### Step 1: Create `*Config.ts`

Create a config file in your feature folder (e.g., `src/features/myFeature/myFeatureConfig.ts`):

```typescript
export const myFeatureConfig = {
    enabled: true,
    cooldownSeconds: 30
};

export default myFeatureConfig;
```

The build script (`scripts/build.ts`) automatically discovers any file matching `*Config.ts` and compiles it as an external module in `packs/behavior/scripts/` so server admins can edit it directly on disk.

### Step 2: Register in `src/core/configurations.ts`

Instantiate a config manager with `createConfigManager()` and expose `get*` and `save*` helpers in `src/core/configurations.ts`.

### Step 3: Expose in the Admin UI

Add a category entry in `src/core/ui/configPanelRegistry.ts` and map its `configSource` in `src/core/ui/uiUtils.ts`.

## 3. Merge Behavior Across Scenarios

| Scenario                      | Strategy                                             | Result                                                                                                          |
| :---------------------------- | :--------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| **First World Run**           | Direct initialization from `*Config.js`              | Both `Current` and `Last Loaded` dynamic properties are initialized from the file defaults.                     |
| **Addon Version Update**      | Deep merge (`deepMerge(newDefault, currentSaved)`)   | Preserves existing server customizations while adding newly introduced config keys.                             |
| **Server Start / `/xreload`** | Priority diff merge (`fileDefault` vs. `lastLoaded`) | Properties edited on disk overwrite `Current`; properties untouched on disk keep their in-game `/panel` values. |
