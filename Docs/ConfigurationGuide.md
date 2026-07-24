# AddonExe: Configuration Guide

This guide provides an overview of how to configure AddonExe. Proper configuration is key to tailoring the addon's behavior to your server's specific needs.

## ⚙️ Configuration Philosophy

The addon's configuration is split across several files, each with a specific purpose. This modular approach keeps settings organized and easier to manage.

- **`config.js`:** The main hub for most toggles and values. Use this file to enable/disable major features, define owner/admin access, and adjust feature-specific settings.
- **`ranksConfig.js`:** The definitive file for managing all permissions and visual rank styles (chat, nametags).
- **`panelLayoutConfig.js`:** Controls the structure and content of the main Admin UI (`/panel`).
- **`kitsConfig.js`:** Defines the contents and cooldowns for player kits.

---

## 🛠️ Initial Setup & Permissions (CRITICAL)

Follow these steps to gain administrative control of the addon.

### 1. Set the Server Owner(s)

- **File:** `packs/behavior/scripts/config.js`
- **Action:** Add the **exact** in-game names of all owners to the `ownerPlayerNames` array. This grants the highest permission level (0).
- **➡️ For a summary, see the [F.A.Q.](F.A.Q.md#how-do-i-change-the-server-owner)**

### 2. Set Server Admin(s)

- **File:** `packs/behavior/scripts/config.js`
- **Action:** The `adminTag` setting (default: `"admin"`) determines who gets the Admin rank.
- **Usage:** To make someone an admin, give them the tag: `/tag "PlayerName" add admin`.
- **➡️ For a summary, see the [F.A.Q.](F.A.Q.md#how-do-i-make-myself-an-admin)**

### 3. Configure Ranks and Permissions

For more advanced control over permissions and visual styles, you can edit the ranks file.

- **File:** `packs/behavior/scripts/core/ranksConfig.js`
- **Action:** Modify the `rankDefinitions` array to define your server's roles (e.g., Moderator, VIP). You can set permission levels, chat formats, and nametags for each rank.
- **➡️ For a complete guide, see: [Rank System Documentation](RankSystem.md)**

---

## 🔄 Reloading the Configuration

AddonExe features a smart reloading system to apply configuration changes without needing to restart your server.

- **Command:** `/xreload`
- **Permission:** Admin

### How it Works

The addon uses a two-state configuration system to prevent accidental loss of in-game changes (like a player's balance set via a command).

1.  **Live Config:** This is the configuration currently being used by the addon. It can be modified by in-game commands.
2.  **Last Loaded Config:** This is a snapshot of the `config.js` file from the last time the server started or `/xreload` was used.

When you run `/xreload`, the addon compares the current `config.js` file on disk to the `Last Loaded Config`.

- **If a setting has been changed in the file:** The addon will update the live config with the new value from the file. This means changes in the file always take priority.
- **If a setting has NOT been changed in the file:** The addon will leave the live config value untouched, preserving any changes made through in-game commands.

After the reload, a new snapshot is taken, and the process repeats on the next `/xreload`.

> [!IMPORTANT]
> The `/xreload` command applies to settings in `config.js`. For structural changes in other files like `ranksConfig.js`, `panelLayoutConfig.js`, and `kitsConfig.js`, a full server restart is required to ensure they are applied correctly.

---

## 📄 Core Configuration Files

### `config.ts` - The Main Hub

This is the primary file for most top-level settings. **Changes to this file can be reloaded with `/xreload`**.

- **File:** `src/config.ts` (in the repo) or `packs/behavior/scripts/config.js` (compiled)
- **Purpose:**
    - Define `ownerPlayerNames` and the `adminTag`.
    - Enable or disable major systems (`tpa.enabled`, `homes.enabled`, `economy.enabled`, etc.).
    - Configure server features like starting economy balance, max homes, or welcome messages.
    - Customize server info like Discord links and rules.
    - Toggle individual commands on or off in the `commandSettings` section.

#### TPA System (`tpa`)

- **Description:** Manages the player-to-player teleportation request system.
- **Settings:**
    - `enabled` (boolean): Toggles the entire TPA feature suite (`/tpa`, `/tpahere`, `/tpaccept`, etc.).
    - `requestTimeoutSeconds` (number): How long (in seconds) a player has to accept a TPA request before it expires.
    - `cooldownSeconds` (number): The time a player must wait after a successful teleport before sending a new `/tpa` or `/tpahere` request.
    - `teleportWarmupSeconds` (number): The time a player must stand still after a TPA request is accepted before they are teleported.

#### Home System (`homes`)

- **Description:** Configures the personal home system for players.
- **Settings:**
    - `enabled` (boolean): Toggles the home system commands (`/home`, `/sethome`, etc.).
    - `maxHomes` (number): The maximum number of homes a player can set.
    - `cooldownSeconds` (number): The time a player must wait after using `/home` before they can use it again.
    - `teleportWarmupSeconds` (number): The time a player must stand still before teleporting to their home.

#### Random Teleport (`rtp`)

- **Description:** Configures the `/rtp` command for random, safe teleportation.
- **Settings:**
    - `enabled` (boolean): Toggles the `/rtp` command.
    - `minRange` (number): The minimum distance (in blocks) a player will be teleported.
    - `maxRange` (number): The maximum distance (in blocks) a player can be teleported.
    - `cooldownSeconds` (number): The time a player must wait after a successful teleport before using `/rtp` again.
    - `teleportWarmupSeconds` (number): The time a player must stand still before being teleported.

#### Dimension Locking (`dimensionLock`)

- **Description:** Configures the dimension locking feature.
- **Settings:**
    - `allowAdminBypass` (boolean): If `true`, players with admin permissions can enter locked dimensions. If `false`, the lock applies to everyone.

### `ranksConfig.ts` - Ranks & Permissions

This file defines the entire hierarchy of roles on your server. **Requires a server restart to apply changes.**

- **File:** `src/features/ranks/ranksConfig.ts` (in the repo) or `packs/behavior/scripts/src/features/ranks/ranksConfig.js` (compiled)
- **Purpose:**
    - Define all available ranks (e.g., Owner, Admin, Member, custom ranks).
    - Customize the visual `chatFormatting` (prefix, name color) for each rank.
    - Set a `nametagPrefix` for each rank.
    - Define the `conditions` for how a rank is assigned (e.g., based on the `ownerPlayerNames` list, the `adminTag`, or being the default).

### `panelLayoutConfig.js` - Admin Panel UI

This file controls the layout, buttons, and actions of the `/panel` user interface. **Requires a server restart to apply changes.**

- **File:** `packs/behavior/scripts/core/panelLayoutConfig.js`
- **Purpose:**
    - Add, remove, or reorder categories and buttons.
    - Change button text, icons, and required permission levels.
    - Link buttons to specific actions (like running a command or opening another panel).

### Kit System Configuration (Currently Deprecated)

The kit system configuration logic is handled mostly by the in-game management panel. - **Purpose:** - Define a comprehensive list of all kits you want on your server. - For each kit, you define the `items` it contains. The `enabled` status, `cooldownSeconds` in this file act as the defaults for when a kit is first loaded. - **Note:** While you can define kits here, managing their live properties (like enabling/disabling, cooldowns, and permissions) is done in-game.

- **In-Game Kit Management**
    - The live settings for kits are configured in-game by an admin. This allows for live updates without restarting the server.
    - **Command:** `/panel` -> "Config" -> "§l§dKit System§r"
    - **Permission:** Admin
    - **How it Works:**
        - Admins can see a list of all kits defined in `kitsConfig.js`.
        - For each kit, an admin can set:
            - **Enabled/Disabled:** Toggles whether the kit can be claimed.
            - **Cooldown (seconds):** The time a player must wait between claims.
            - **Permission Level:** The minimum permission level a player must have to claim the kit (e.g., `0` for Owner, `1` for Admin, `1024` for all Members).

### Shop System Configuration

The shop system is configured through a combination of files and in-game actions.

- **`itemsConfig.ts` - Master Shop Item List**
    - This file defines all possible items that can be sold in the shop. It serves as a master list from which admins can enable items. **Requires a server restart to apply changes.**
    - **File:** `src/features/shop/itemsConfig.ts`
    - **Purpose:**
        - Define a comprehensive list of all items you might ever want to sell.
        - For each item, you can set a default buy price, sell price, category, and icon.
        - Enchanted books can be defined with their specific enchantment type and level.
    - **Note:** This file only defines what _can_ be in the shop. To actually make an item available for players to buy or sell, an admin must enable it through the in-game "Edit Shop" panel.

- **`shopCategoryConfig.ts` - Shop Category Icons**
    - This file defines the icons used for each category and sub-category in the shop UI. **Requires a server restart to apply changes.**
    - **File:** `src/features/shop/shopCategoryConfig.ts`
    - **Purpose:**
        - Assign a specific texture path to each category name (e.g., 'Building Blocks', 'Ores & Minerals').

- **In-Game Shop Management**
    - Unlike other systems, the shop's active inventory and prices are configured entirely in-game by an admin. This allows for live updates without restarting the server.
    - **Command:** `/panel` -> "Edit Shop" button
    - **Permission:** Admin
    - **How it Works:**
        - Admins can browse all items defined in `itemsConfig.js` through a categorized UI.
        - For each item, an admin can:
            - **Toggle it on/off:** An item must be enabled to appear in the player-facing shop.
            - **Set Buy/Sell Prices:** Admins can override the default prices from `itemsConfig.js`. Setting a price to `0` or `-1` will disable the buy or sell option for that item, respectively.
    - **Data Persistence:** The shop configuration is saved to the world's data and will persist across server restarts. The loading system is also designed to preserve your shop setup even when the addon is updated.

> [!IMPORTANT]
> **Cheat Detection Configuration Coming Soon**
>
> The full suite of cheat detections and automated responses (`actionProfiles`, `automodConfig`) is currently being re-developed and is not part of the addon. Configuration for these features will be added in a future update.

---

## ✅ Best Practices for Configuration

- **Read Comments:** The configuration files are well-commented. Read them carefully before changing values.
- **Start Small:** If you're unsure about a setting, change it by a small amount and observe the effect.
- **Test Thoroughly:** After making configuration changes, test them on a non-production server to ensure they work as expected.
- **Backup:** Before major changes, always back up your configuration files.
- **Consult Documentation:** For complex systems, refer to their specific detailed guides in the `Docs/` folder.
