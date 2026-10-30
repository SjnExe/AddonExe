# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2025-10-28

### Updated to 1.21.120

## [0.6.3] - 2025-10-02

### 🐛 Bug Fixes

- Fixed a bug where `/function admin` wasn't working.

## [0.6.0] - 2025-09-30

### 🚀 Performance

- **Paginated UI Lists**: Implemented pagination for the Player Management, Online Player List, Bounty List, and Report Management UIs. This prevents server lag and crashes when viewing lists with a large number of entries.
- **Efficient Leaderboard**: The economy leaderboard is now updated dynamically only when a player's balance changes significantly, removing the previous inefficient interval-based updates.
- **Optimized Data Loading**: Revamped the data loading strategy to prevent the addon from loading all player data at startup, significantly improving server start times.

### 🔒 Reliability

- **Immediate Data Saving**: Replaced the periodic auto-save system with an immediate-save mechanism. All player data (balances, homes, ranks, etc.) is now saved instantly upon modification, preventing data loss from server crashes.

This version introduces a new random teleport feature, includes bug fixes for core gameplay systems, and expands the capabilities of the in-game configuration editor.

### ✨ Features

- **Warp System**: Added `/warp`, `/setwarp`, and `/delwarp` commands, allowing admins to create and manage public teleportation points. Warps are fully configurable with cooldowns and warmup times.
- **Spawn Protection**: Implemented a comprehensive spawn protection system to prevent griefing and unauthorized building in the server's spawn area.
- **Configurable Kit System**: The kit system is now fully configurable in-game, allowing admins to create, edit, and define cooldowns for kits dynamically.
- **Rank System**: A flexible rank system with customizable permissions and chat formatting.
- **Shop System**: An in-game shop with a UI for buying and selling items, with prices and item availability configurable by admins.
- **Dimension Locking**: Admins can now lock the Nether and End dimensions using the `/netherlock` and `/endlock` commands. A configuration setting allows admins to bypass these locks.
- **Random Teleport (`/rtp`)**: Added a new `/rtp` command that allows players to teleport to a random, safe location in the Overworld. The command has a configurable cooldown and warmup period.
- **Configuration Editor Expansion**: The in-game config editor now supports modifying more settings, including `rtp`, `deathCoords`, `bounty`, and the new `dimensionLock` bypass.

### 🐛 Bug Fixes

- **Freeze Command**: The `/freeze` command has been completely overhauled to use the native `/inputpermission` command. This correctly prevents all player movement, camera rotation, and interactions, fixing a bug where frozen players could still jump and place blocks.
- **Player Management UI Display**: Fixed an issue where the Player Management list would show player names in lowercase and without their rank prefix.
- **Death Coords**: Fixed a bug where the death coordinates message was not reliably sent to the player upon death.

### 🎨 Changes

- **Rank Command Refactor**: The `/admin` command has been removed. Its functionality is now integrated into the `/rank` command, which can now be used to grant and revoke the 'Admin' rank. This streamlines rank management into a single, permission-controlled command.
- **Dimension-specific RTP**: The `/rtp` command is now restricted to the Overworld to prevent players from using it in unintended dimensions like the Nether or the End.

## [0.5.0] - 2025-09-15

This version introduces critical security fixes, bug fixes, and stability improvements to the core addon systems.

### ✨ Features

- **In-Game Shop System**: Introduced a comprehensive, GUI-based shop system.
    - Players can access the shop via the `/shop` command or the main admin panel.
    - The UI supports browsing categorized items, buying, and selling.
    - New commands were added for direct access: `/buy` opens the buy view, `/sell` opens the sell view, and `/sellhand` allows for quickly selling the item in the main hand.

### 🔒 Security

- **Punishment Reason Sanitization**: Fixed a command injection vulnerability where a ban or kick `reason` containing special characters (e.g., double quotes) could break the `kick` command. This fix prevents the kick-on-ban and kick-on-join-when-banned mechanisms from failing.

### 🐛 Bug Fixes

- **`/sellhand` for Unstackable Items**: Disabled the `/sellhand` command for unstackable items to prevent issues with the underlying `/clear` command. The command will now show an error message if used with an unstackable item.
- **Punishment Data Loss on Crash**: Fixed a critical bug where punishments (bans/mutes) could be lost if the server crashed. Punishments are now saved to disk immediately upon being issued or removed, instead of waiting for the next auto-save cycle.

### 🎨 Changes

- **Punishment Manager Save Interval**: The punishment manager now correctly uses the `autoSaveIntervalSeconds` value from the main configuration file for its periodic saving, instead of a hardcoded 5-minute interval.

## [0.4.0] - 2025-09-10

This version introduces a significant overhaul of the player management UI, adds new moderation features, and includes several critical bug fixes for core gameplay systems.

### ✨ Features

- **Player Management UI Overhaul**: The player action panel has been revamped with new icons, buttons, and a clearer separation between admin actions and player-to-player actions.
- **Freeze/Unfreeze Functionality**: Admins can now freeze and unfreeze players. This is available as UI buttons in the Player Management panel and as new `/freeze` and `/unfreeze` commands.
- **Bounty Sub-Panel**: The "Bounty" button in the Player List now opens a dedicated sub-panel, allowing users to either set a new bounty or remove an existing one.

### 🐛 Bug Fixes

- **Teleport on Damage**: Fixed a critical bug where teleportation warmups (for TPA, `/home`, `/spawn`) would not cancel when the player took damage. The system now uses a reliable event-based check.
- **Death Event Crash**: Fixed a server script crash that occurred when a player died from non-combat sources (e.g., fall damage, `/kill` command).
- **`/deathcoords` Command**: Fixed a race condition that made the `/deathcoords` command unreliable. The command now correctly shows the last death location even after the player has respawned.
- **UI Panel Navigation**: Fixed a bug where buttons configured to open a new panel in the player actions UI would not work.

### 🎨 Changes

- **New Icons**: Updated the icons for Kick, Ban, Mute, Unmute, Freeze, Unfreeze, TPA, TPAHere, and Bounty buttons for better visual clarity.
- **Button Order**: The buttons in the Player List actions panel are now in a more logical order: TPA, TPAHere, Bounty, Report.

## [0.3.0] - 2025-09-07

This version introduces a major performance overhaul for the bounty system, a new global command cooldown system, and several new features, fixes, and documentation improvements.

### ✨ Features

- **Bounty System Overhaul**: The bounty system has been completely rewritten for performance. It now uses a centralized manager (`bountyManager`) to track active bounties in memory, eliminating the lag spikes that occurred on servers with large player histories when viewing the bounty list.
- **Bounty Claiming**: The previously missing feature to claim bounties has been implemented. When a player with a bounty is killed by another player, the bounty is now correctly paid out to the killer.
- **Command Cooldown System**: A new system has been integrated into the `commandManager` to allow any command to have an optional, configurable cooldown period to prevent spam. The `/spawn` command is the first to use this new system.
- **New Ranks Added**: Added three new ranks to the default configuration: `VIP`, `Donator`, and `Verified`. These can be assigned to players via tags.
- **`/rank` Command Enhancements**:
    - Running `/rank` with no arguments now displays a list of all available ranks.
    - The command now provides in-game suggestions for the "set" and "remove" actions, improving usability for admins.

### 🐛 Bug Fixes

- Fixed a critical startup crash (`ReferenceError: clearExpiredPayments`) caused by an incorrect function call during initialization.
- Corrected several linting warnings by removing unused imports from the UI manager.

### 📚 Documentation

- **Command Documentation**: Updated `Docs/Commands.md` to clearly explain how slash commands (`/`) handle multi-word arguments with quotes.
- **Features Documentation**: Added details about the hidden world seed anti-cheat feature to `Docs/FeaturesOverview.md`.

## [0.1.0] - 2025-09-06

This is the second public release of AddonExe, introducing a wide range of features and a comprehensive command system to enhance server management and gameplay.

### Features

- **Slash Commands**: All commands are available as native slash commands (e.g., `/xhelp`, `/status`). Commands with potential vanilla conflicts are prefixed with `x`.
- **Rank System**: A comprehensive rank system with configurable permissions, chat formatting, and inheritance.
- **Economy System**: A basic economy with player balances, a `/pay` command, and an API for other features to use.
- **Punishment System**: Commands for banning, muting, and kicking players, with support for temporary and permanent durations.
- **Admin Panel**: A custom item (`exe:panel`) that opens a UI for server administration.
- **Player Data Management**: Robust system for tracking player data, including ranks, balances, homes, and more.
- **Home System**: Allows players to set and teleport to their own homes.
- **Teleportation System**: `/tpa` and `/tpahere` commands for players to request teleportation to each other.
- **Kit System**: Create kits of items that players can claim on a cooldown.
- **Report System**: A system for players to report issues and for admins to manage them.
- **Server Restart Manager**: A scheduled and manual server restart system with warnings.
- **Welcomer**: Automatically welcomes new players to the server.
- **Death Coordinates**: Notifies players of their coordinates upon death.
- **X-Ray Ore Notifications**: Alerts admins when players mine valuable ores.
- **Chat to Console**: Option to log all in-game chat to the server console.
- **Bounty System**: Place bounties on other players.
- **Vanish**: Allows admins to become invisible to other players.
- **Player Inventory Management**: Admins can view and copy player inventories.
- **Server Status**: A command to view server performance and player count.

### Commands

_Commands are run with a `/` prefix. For example: `/status`._
_Some commands use an `x` prefix (e.g. `/xhelp`) to avoid conflicts with vanilla commands._

#### General Commands

- `/xhelp`: Displays a list of available commands.
- `/rules`: Shows the server rules.
- `/spawn`: Teleports you to the world spawn.
- `/status`: Shows server status and player count.
- `/version`: Shows the addon version.
- `/report`: Reports a player.

#### Economy Commands

- `/balance`: Checks your balance.
- `/pay`: Pays another player.
- `/bounty`: Sets a bounty on a player.

#### Teleportation Commands

- `/home`: Teleports you to your home.
- `/sethome`: Sets your home location.
- `/delhome`: Deletes your home.
- `/tpa`: Requests to teleport to another player.
- `/tpaccept`: Accepts a teleport request.
- `/tpdeny`: Denies a teleport request.

#### Kit Commands

- `/kit`: Claims a kit.
- `/kits`: Lists available kits.

#### Admin Commands

- `/admin`: Provides access to admin functions.
- `/ban`: Bans a player.
- `/unban`: Unbans a player.
- `/mute`: Mutes a player.
- `/unmute`: Unmutes a player.
- `/kick`: Kicks a player.
- `/freeze`: Freezes a player in place.
- `/unfreeze`: Unfreezes a player.
- `/gamemode`: Changes a player's gamemode.
- `/clear`: Clears a player's inventory.
- `/clearchat`: Clears the chat for all players.
- `/invsee`: Views a player's inventory.
- `/copyinv`: Copies a player's inventory.
- `/vanish`: Toggles vanish mode.
- `/tp`: Teleports to a player.
- `/xreload`: Reloads the addon's configuration.
- `/save`: Saves all addon data.
- `/restart`: Initiates a server restart.
- `/ecwipe`: Wipes all economy data.
- `/setbalance`: Sets a player's balance.
- `/rank`: Manages player ranks.
- `/xraynotify`: Toggles X-ray notifications.
- `/deathcoords`: Toggles death coordinate messages.
- `/chattoconsole`: Toggles logging chat to the console.
- `/debug`: Toggles debug mode.
