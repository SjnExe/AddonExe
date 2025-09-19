# AddonExe: Features Overview

This document provides a detailed breakdown of the features available in AddonExe. For in-depth configuration of these features, please refer to the [Configuration Guide](ConfigurationGuide.md) and for command usage, see the [Commands List](Commands.md).

> [!NOTE]
> **This addon is currently a powerful moderation and server utility tool.**
> The comprehensive suite of cheat detections from the original addon is being rebuilt and will be added in a future update.

---

## I. Administrative & Server Management Systems

### A. Core Admin Tools

- **Universal UI Panel:** Accessible via `/panel`. The panel item can also be crafted by any player. It provides a graphical user interface whose content and available actions dynamically adapt based on user permissions.
  - **For Admins & Owners:**
    - **Enhanced Player Management:** Provides lists of both online and offline players. Selecting a player opens a dedicated actions menu. This menu is now context-aware:
      - **From the Player List (online players):** Provides player-to-player interaction options like TPA, TPAHere, and a new Bounty sub-panel for placing or removing bounties.
      - **From the Player Management list (all players):** Provides a full suite of moderation tools, including Kick, Ban, Mute, Unmute, and the new Freeze/Unfreeze actions.
    The UI has been updated with clearer icons and a more logical button layout to improve usability for admins.
  - **For Regular Players:** Shows user-specific info like personal stats, server rules, and useful links.
- **Comprehensive Slash Commands:** A full suite of slash commands offers granular control over all features and administrative actions. These can be run in-game, from the server console, or using a chat-based fallback (e.g., `!panel`). (See [Commands List](Commands.md) for a complete reference).
- **Persistent Player Data:** Active mutes and bans are saved using Minecraft's dynamic properties, ensuring they persist across player sessions and server restarts.

### B. Moderation Tools
- **Freeze/Unfreeze:** A robust freeze system that completely immobilizes a player.
  - **Commands:** `/freeze <target>`, `/unfreeze <target>`.
  - **Mechanism:** Uses the native `/inputpermission` command to disable both player movement and camera control, preventing all actions including block placement, item use, and interaction. This is a much more effective "hard freeze" than simple slowness effects.

### B. Flexible Rank System

- Define roles like Owner, Admin, and Member with specific permission levels.
- Permissions control access to commands and addon features.
- Customize visual chat prefixes/suffixes and nametag appearances for each rank.
- For configuration details, see the [Configuration Guide](ConfigurationGuide.md) and [Rank System Documentation](RankSystem.md).
  - *Key Configs: `config.js`, `ranksConfig.js`*

### C. Dimension Locking
- **Description:** Provides commands for admins to lock or unlock the Nether and End dimensions, preventing players from entering them.
- **Commands:** `/netherlock [true|false]`, `/endlock [true|false]`.
- **Admin Bypass:** A configuration option (`dimensionLock.allowAdminBypass`) allows players with admin permissions to enter locked dimensions, which is useful for moderation or server maintenance.
- **Player Experience:** When a non-admin player attempts to enter a locked dimension, they are instantly teleported back to their previous location and receive a notification message.

---

## II. Server Utility & Player Experience Features

### A. Teleport Request System (TPA/TPAHere)

- Allows players to request teleports to other players (`/tpa <playerName>`) or request others to teleport to them (`/tpahere <playerName>`).
- Features include:
  - Configurable request timeout periods.
  - Cooldowns between sending requests.
  - Teleport warmup period, during which movement or taking damage can cancel the teleport.
  - *Key Configs: `config.js` (under the `tpa` section)*

### B. Economy & Bounty System

- A simple economy system that allows players to have balances and transfer money.
- A full player-driven bounty system to place bounties on other players.
- **Commands:** `/balance`, `/pay`, `/baltop`, `/bounty`, `/listbounty`, `/removebounty`.
- **New Player Balance:** New players start with a configurable amount of money.
- *Key Configs: `config.js` (under the `economy` section)*

### C. In-Game Shop System

- A fully-featured, GUI-based shop accessible via the `/shop` command or the main panel.
- **Player Features:**
  - Browse items through a categorized and paginated UI.
  - Buy and sell items with specified quantities.
  - Use `/buy` and `/sell` to open a filtered view of the shop.
  - Quickly sell the item in your main hand with `/sellhand`.
- **Admin Features:**
  - Access an "Edit Shop" panel to manage the shop's inventory.
  - Enable or disable any item from a master list.
  - Set custom buy and sell prices for each item. Setting a price to -1 or 0 disables that action.
- **Configuration:**
  - The master list of all potential shop items is defined in `AddonExeBP/scripts/core/itemsConfig.js`. Each item in this list has a default price, category, and other properties.
  - Shop categories and their icons are defined in `AddonExeBP/scripts/core/shopCategoryConfig.js`.
  - The active shop configuration (which items are enabled and their current prices) is saved to the world's dynamic properties and persists across restarts. This is modified via the in-game editor.
  - *Key Configs: `itemsConfig.js`, `shopCategoryConfig.js` (for setup); world data (for live prices)*

### D. Homes System

- Allows players to set a limited number of "homes" they can teleport back to.
- **Commands:** `/sethome`, `/home`, `/delhome`, `/homes`.
- **Max Homes:** The maximum number of homes a player can set is configurable.
- *Key Configs: `config.js` (under the `homes` section)*

### E. Random Teleport System (RTP)

- Allows players to teleport to a random, safe location in the world to encourage exploration.
- **Commands:** `/rtp`.
- **Features:**
  - Configurable minimum and maximum teleportation range.
  - Cooldown between uses.
  - Teleport warmup period to prevent abuse in combat.
- *Key Configs: `config.js` (under the `rtp` section)*

### F. Kits System

- Allows players to claim predefined kits of items.
- **Commands:** `/kit`.
- **Cooldowns:** Kits can have cooldowns to prevent them from being claimed too frequently.
- **Customizable:** Kits are defined in `AddonExeBP/scripts/core/kitsConfig.js`.
- *Key Configs: `config.js` (under the `kits` section)*

### G. Player Information & Experience
- **Customizable Welcome Message:** Automatically greet new players with a configurable message when they first join the server. The message can be customized with placeholders like `{playerName}` and `{serverName}` to create a personalized welcome.
- **Death Coordinates:** When a player dies, their coordinates are automatically sent to them in a private message upon respawning, making it easy to find their dropped items. This message is also fully customizable.
- **Server Rules Display:** Players can view server rules using the `/rules` command. The rules are defined as an array of strings in the configuration.
- *Key Configs: `config.js` (under the `playerInfo` and `serverInfo` sections)*

### H. Customizable Sound Events
- Customize sounds for specific in-game events to provide auditory feedback to players and admins.
- Events include:
  - Receiving a TPA request.
  - Receiving an admin notification.
  - Receiving a player warning.
  - Experiencing a command error.
- Sounds can be enabled/disabled and their sound ID, volume, and pitch can be configured.
- *Key Configs: `config.js` (under the `soundEvents` section)*

---

## III. Security & Anti-Cheat

### A. Hidden World Seed
- **Description:** The addon's resource pack automatically hides the world seed from the in-game settings menu.
- **Purpose:** This is a security measure to prevent players from using the world seed in third-party tools to find ore locations, biomes, or structures, which is a common form of cheating.
- **Configuration:** This feature is enabled by default and cannot be configured due to limitations in Minecraft's addon APIs.

This overview covers the primary features. For specific configuration options and command usage, please refer to the linked detailed documentation within the `Docs` folder.
