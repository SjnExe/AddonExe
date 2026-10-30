# AddonExe: Features Overview

This document provides a detailed breakdown of the features available in AddonExe. For in-depth configuration of these features, please refer to the [Configuration Guide](ConfigurationGuide.md) and for command usage, see the [Commands List](Commands.md).

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
- **Comprehensive Slash Commands:** A full suite of slash commands offers granular control over all features and administrative actions. These can be run in-game or from the server console. (See [Commands List](Commands.md) for a complete reference).
- **Persistent Player Data:** Active mutes and bans are saved using Minecraft's dynamic properties, ensuring they persist across player sessions and server restarts.

### B. Moderation Tools

- **Freeze/Unfreeze:** A robust freeze system that completely immobilizes a player.
    - **Commands:** `/freeze <target>`, `/unfreeze <target>`.
    - **Mechanism:** Uses the native `/inputpermission` command to disable both player movement and camera control, preventing all actions including block placement, item use, and interaction. This is a much more effective "hard freeze" than simple slowness effects.
- **Chat Logging & History:**
    - **Description:** Automatically records all chat messages. Admins can view and search chat history in-game.
    - **Features:** Supports filtering by player, keyword, and date. Logs are automatically pruned after a configurable period (default 7 days).
    - **Commands:** `/logs` (Main Menu), `/chatlog` (Direct access).
- **Warnings:**
    - **Description:** Issue formal warnings to players. Warnings are logged and displayed to the player.
    - **Command:** `/warn <player> <reason>`.

### B. Flexible Rank System

- Define roles like Owner, Admin, and Member with specific permission levels.
- Permissions control access to commands and addon features.
- Customize visual chat prefixes/suffixes and nametag appearances for each rank.
- For configuration details, see the [Configuration Guide](ConfigurationGuide.md) and [Rank System Documentation](RankSystem.md).
    - _Key Configs: `config.js`, `ranksConfig.js`_

### C. Dimension Locking

- **Description:** Provides commands for admins to lock or unlock the Nether and End dimensions, preventing players from entering them.
- **Commands:** `/netherlock [true|false]`, `/endlock [true|false]`.
- **Admin Bypass:** A configuration option (`dimensionLock.allowAdminBypass`) allows players with admin permissions to enter locked dimensions, which is useful for moderation or server maintenance.
- **Player Experience:** When a non-admin player attempts to enter a locked dimension, they are instantly teleported back to their previous location and receive a notification message.

### D. Spawn Protection

- **Description:** A comprehensive system to protect the world's spawn area from griefing.
- **Protection Features:** Prevents unauthorized players from breaking blocks, placing blocks, opening chests, or using items within a configurable radius of the world spawn.
- **Admin Bypass:** Players with admin permissions can bypass all spawn protection restrictions.

---

## II. Server Utility & Player Experience Features

### A. Warp System

- **Description:** Allows admins to create, manage, and delete public warp points that players can teleport to.
- **Commands:**
    - `/warp [warpName]`: Teleports the player to the specified warp.
    - `/addwarp <warpName>`: Creates a new warp at the admin's current location. (Alias: `/setwarp`)
    - `/delwarp [warpName]`: Deletes a warp.
- **Configuration:** Features a configurable cooldown and teleport warmup period to prevent abuse.

### B. Teleport Request System (TPA/TPAHere)

- Allows players to request teleports to other players (`/tpa <playerName>`) or request others to teleport to them (`/tpahere <playerName>`).
- Players can respond to requests using `/tpaccept` and `/tpadeny`, and cancel their own requests with `/tpacancel`.
- Features include:
    - Configurable request timeout periods.
    - Cooldowns between sending requests.
    - Teleport warmup period, during which movement or taking damage can cancel the teleport.
    - _Key Configs: `config.js` (under the `tpa` section)_

### C. Economy & Bounty System

- A simple economy system that allows players to have balances and transfer money.
- A full player-driven bounty system to place bounties on other players.
- **Commands:** `/balance`, `/pay`, `/baltop`, `/bounty`, `/listbounty`, `/removebounty`.
- **New Player Balance:** New players start with a configurable amount of money.
- _Key Configs: `config.js` (under the `economy` section)_

### D. In-Game Shop System

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
    - The master list of all potential shop items is defined in `src/features/shop/itemsConfig.ts`. Each item in this list has a default price, category, and other properties.
    - Shop categories and their icons are defined in `src/features/shop/shopCategoryConfig.ts`.
    - The active shop configuration (which items are enabled and their current prices) is saved to the world's dynamic properties and persists across restarts. This is modified via the in-game editor.
    - _Key Configs: `itemsConfig.ts`, `shopCategoryConfig.ts` (for setup); world data (for live prices)_

### E. Homes System

- Allows players to set a limited number of "homes" they can teleport back to.
- **Commands:** `/sethome`, `/home`, `/delhome`, `/homes`.
- **Max Homes:** The maximum number of homes a player can set is configurable.
- _Key Configs: `config.js` (under the `homes` section)_

### F. Random Teleport System (RTP)

- Allows players to teleport to a random, safe location in the world to encourage exploration.
- **Commands:** `/rtp`.
- **Features:**
    - Configurable minimum and maximum teleportation range.
    - Cooldown between uses.
    - Teleport warmup period to prevent abuse in combat.
- _Key Configs: `config.js` (under the `rtp` section)_

### G. Kits System

- Allows players to claim predefined kits of items.
- **Commands:** `/kit`.
- **Cooldowns:** Kits can have cooldowns to prevent them from being claimed too frequently.
- **Customizable:** Kits are defined via the in-game panel, replacing the old file structure.
- _Key Configs: `config.ts` (under the `kits` section)_

### H. Player Information & Experience

- **Customizable Welcome Message:** Automatically greet new players with a configurable message when they first join the server. The message can be customized with placeholders like `{playerName}` and `{serverName}` to create a personalized welcome.
- **Death Coordinates:** When a player dies, their coordinates are automatically sent to them in a private message upon respawning, making it easy to find their dropped items. This message is also fully customizable.
- **Server Rules Display:** Players can view server rules using the `/rules` command. The rules are defined as an array of strings in the configuration.
- _Key Configs: `config.js` (under the `playerInfo` and `serverInfo` sections)_

### I. Team System

- **Description:** A comprehensive team system that allows players to form groups, chat privately, manage a shared balance, and set a team home.
- **Commands:** `/team` opens the main team UI, `/teamchat` (`/tc`) allows for private team communication.
- **Features:**
    - Team creation (costs a configurable amount of money).
    - Team members can deposit money into the team's shared balance.
    - Admins/Owners can set a team home (`/setteamhome` via UI), teleport to it, or delete it.
    - Support for joining through invites and join requests, which can be managed from the UI.
    - Search for a specific team or browse available teams.

### J. Customizable Sound Events

- Customize sounds for specific in-game events to provide auditory feedback to players and admins.
- Events include:
    - Receiving a TPA request.
    - Receiving an admin notification.
    - Receiving a player warning.
    - Experiencing a command error.
- Sounds can be enabled/disabled and their sound ID, volume, and pitch can be configured.
- _Key Configs: `config.js` (under the `soundEvents` section)_

---

## III. Security & Anti-Cheat

### A. Anti-Cheat System

- **Movement Checks:** Detects abnormal movement speeds (Speed hacks) and Fly hacks.
    - **Smart Detection:** Handles Elytra gliding, Speed effects, and vertical velocity (falling) to minimize false positives.
    - **Violation System:** Uses a token-bucket violation system to prevent instant bans due to lag spikes.
- **X-Ray Detection:** Monitors ore mining patterns to detect potential X-Ray users. Alerts admins when suspicious mining behavior is detected.
- **World Border & Nether Roof:** Enforces boundaries to keep players within playable areas and prevents access to the Nether roof.

### B. Hidden World Seed

- **Description:** The addon's resource pack automatically hides the world seed from the in-game settings menu.
- **Purpose:** Prevents players from using the world seed in third-party tools to find ore locations or structures.

This overview covers the primary features. For specific configuration options and command usage, please refer to the linked detailed documentation within the `Docs` folder.
