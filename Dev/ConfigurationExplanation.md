# Configuration Loading, Saving, and Merging Explained (V2)

This document provides a detailed, technical explanation of how AddonExe's configuration system works. It covers how settings are loaded, saved, and merged in various scenarios, with a focus on preserving manual file edits while maintaining in-game changes.

## Adding a New Configuration File

The configuration system is designed to be scalable and developer-friendly. Adding a new configuration file is automated.

### 1. Create the Config File

Create a new TypeScript file in your feature directory (e.g., `src/features/myFeature/myFeatureConfig.ts`).
The file name **must** end with `Config.ts` or `Config.default.ts` to be automatically detected by the build system.

**Example (`src/features/myFeature/myFeatureConfig.ts`):**

```typescript
export const myFeatureConfig = {
    enabled: true,
    someSetting: 100
};

export default myFeatureConfig;
```

### 2. Build Process (Automated)

The `scripts/build.js` script automatically scans the `src/` directory for any file matching `*Config.ts` or `*Config.default.ts`.
It compiles these files into the `packs/behavior/scripts/` directory, maintaining the folder structure (e.g., `features/myFeature/myFeatureConfig.js`).
You do **not** need to manually register the file in the build script.

### 3. Registering for Usage (Runtime)

To use the config in-game and support reloading/merging, you must register it in `src/core/configurations.ts`.

**Example:**

```typescript
// src/core/configurations.ts
import myFeatureConfig from '../features/myFeature/myFeatureConfig.js'; // Import default

// ... inside the file ...
export const getMyFeatureConfig = () => myFeatureConfigManager.get() as typeof myFeatureConfig;

export function initializeConfigurations(isMigration: boolean) {
    // ...
    // Initialize manager
    myFeatureConfigManager = createConfigManager('exe:myFeature', myFeatureConfig, 'MyFeature');
    myFeatureConfigManager.load(isMigration);
}
```

### 4. Adding to UI (Optional)

To make the settings editable in-game, add an entry to `src/core/ui/configPanelRegistry.ts`.

---

## Core Concepts

The configuration system is built on four fundamental components:

1.  **Current Configuration (Dynamic Property)**: This is Minecraft's native key-value storage (`world.getDynamicProperty`) that persists the "live" or "current" configuration the addon is actively using (e.g., `exe:config:current`). This is modified by in-game commands and actions.

2.  **Last Loaded Configuration (Dynamic Property)**: A new, second dynamic property (e.g., `exe:config:current:last_loaded`) that stores a snapshot of the default configuration _as it was on disk_ the last time the addon was loaded or reloaded. This acts as a reference to detect manual file changes.

3.  **Default Configuration (In-File)**: These are the `.js` files in the behavior pack (e.g., `config.js`). They serve as the "source of truth" or the base template for the configuration. Admins can edit these files directly.

4.  **`ConfigManager` (`configManagerFactory.js`)**: The heart of the system. It orchestrates the loading, saving, and complex merging of the three configuration sources.

---

## Initial Loading (First Server Run)

1.  The `ConfigManager` finds no existing configuration.
2.  It takes the **Default Configuration** from the `.js` file.
3.  It saves this default config to **both** the **Current Configuration** and the **Last Loaded Configuration** dynamic properties.

**Outcome**: The server starts with a clean, default configuration, and the "last loaded" state is initialized.

---

## Configuration Saving

- **Current Config**: Saved automatically whenever a setting is changed in-game (e.g., via `/panel`).
- **Last Loaded Config**: Saved only during a server start, addon update, or a `/xreload` command. It always reflects the state of the `.js` file at that moment.

---

## Scenario 1: Addon Update (Migration Logic)

This process preserves user settings across updates while adding new features.

1.  **Version Mismatch Detected**: The addon detects it has been updated. This occurs *anytime* the version string changes (e.g., from `1.2.4` to `1.2.5`, or during nightly development builds), ensuring all updates trigger the merge.
2.  **Load Configs**: It loads the user's **Current Configuration** (from before the update) and the **New Default Configuration** from the updated `.js` file.
3.  **The Merge (`deepMerge`)**: The manager performs a standard deep merge:
    - It starts with the **New Default Configuration** as the base.
    - It merges the user's **Current Configuration** on top, preserving their settings.
    - New properties from the update are added; deprecated ones are removed.
4.  **Save Merged Config**: The result becomes the new **Current Configuration**.
5.  **Update Last Loaded**: The **New Default Configuration** (from the file) is saved as the new **Last Loaded Configuration**.

**Outcome**: User settings are preserved, new features are added, and the system is primed for the new version.

---

## Scenario 2: Standard Start or Manual Reload (`/xreload`)

This is where the new priority logic shines, protecting manual file edits.

1.  **Load All Configs**: The manager loads the **Current Configuration** (with in-game changes), the **Last Loaded Configuration**, and the **Default Configuration** (from the `.js` file on disk).
2.  **The Priority Merge**: A property-by-property comparison occurs:
    - The manager starts with a copy of the **Current Configuration**.
    - It then iterates through every property in the **Default Configuration** file.
    - For each property, it compares the value in the **Default Configuration** file to the value in the **Last Loaded Configuration**.
        - **If the values are different**, it means a server admin has manually edited the file. The file's new value **overwrites** the value in the **Current Configuration**.
        - **If the values are the same**, it means the admin has not touched this setting in the file. The **Current Configuration's** value is kept, preserving any in-game changes.
3.  **Save Merged Config**: The result of this merge becomes the new **Current Configuration**.
4.  **Update Last Loaded**: The **Default Configuration** (from the file) is saved as the new **Last Loaded Configuration**, setting the baseline for the next load.

**Example**:

- `Last Loaded Config`: `{ "tpa": { "requestTimeoutSeconds": 60 } }`
- `Current Config` (in-game): `{ "tpa": { "requestTimeoutSeconds": 60 }, "economy": { "startBalance": 500 } }`
- Admin edits `config.js` to change the TPA timeout: `{ "tpa": { "requestTimeoutSeconds": 30 } }`
- On `/xreload`:
    - The system sees `tpa.requestTimeoutSeconds` is `30` in the file but was `60` in the last load. The file wins.
    - The system sees `economy.startBalance` was not changed in the file compared to the last load. The in-game value (`500`) is kept.
- **Result**: `{ "tpa": { "requestTimeoutSeconds": 30 }, "economy": { "startBalance": 500 } }`. Both the manual file edit and the separate in-game change are correctly preserved.

---

## Summary Table

| Scenario            | Starting Point              | Reference                                 | Merge Strategy                                                                      | Result                                                                                                     |
| :------------------ | :-------------------------- | :---------------------------------------- | :---------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| **First Run**       | No saved config             | `config.js` file                          | Direct copy                                                                         | `Current` and `Last Loaded` are both set to the default file config.                                       |
| **Addon Update**    | User's old `Current` config | New `config.js` file                      | `deepMerge(newDefault, userCurrent)`                                                | User settings are preserved, new settings added. `Last Loaded` is updated to the new file's content.       |
| **Standard/Reload** | User's `Current` config     | `Last Loaded` config vs. `config.js` file | Priority merge: file changes overwrite current config; untouched properties remain. | Manual file edits are prioritized, in-game changes are preserved where possible. `Last Loaded` is updated. |
