# AddonExe Commands

Commands in AddonExe are primarily run using native slash commands, which support autocomplete in-game.

> [!IMPORTANT]
> **Using Commands from the Server Console**
> All slash commands can also be executed directly from the server console (e.g., in Bedrock Dedicated Server).
>
> - **Commands are run with a `/` prefix,** just like in-game (e.g., `/xhelp`).
> - **Specify the target player:** For commands that normally affect the person running them (like `/home` or `/clear`), you must specify the target player's name. For example: `/home "Steve" "my-base"` or `/clear "Steve"`.
> - The chat-based `!` prefix is not supported in the console.

> [!NOTE]
> **Slash Commands vs. Chat Commands**
>
> There are two ways to run commands, and they have important differences:
>
> 1.  **Slash Commands (e.g., `/ban`)**
>     - These are native Minecraft commands registered by the addon.
>     - They support in-game argument suggestions and validation.
>     - **Arguments with spaces MUST be enclosed in double quotes.** For example: `/ban "Player Name" "Griefing the server"`.
> 2.  **Chat Commands (e.g., `!ban`)**
>     - These are a convenient fallback, processed from chat messages.
>     - They are more lenient and can also use **double or single quotes** for arguments with spaces. For example: `!ban "Player Name" 'Griefing the server'`.
>
> **Other Important Notes:**
>
> - To use slash commands, you must **enable cheats** in your world settings.
> - Some commands have an `x` prefix (e.g., `/xhelp`) to avoid conflicts with built-in Minecraft commands.
> - The `exe:` namespace can be used as a fallback for non-'x' commands if other addons have conflicting command names (e.g. `/exe:status`).
> - Angle brackets `< >` denote required parameters. Square brackets `[ ]` denote optional parameters.

---

## Member Commands

Commands available to all players by default.

### General

- **/xhelp [command]**
    - Shows a list of available commands or help for a specific command.
    - _Chat Alias: `!help`_
- **/panel**
    - Opens the main UI panel.
    - _Chat Alias: `!panel`_
- **/rules [ruleNumber]**
    - Displays the server rules.
    - _Chat Alias: `!rules`_
- **/status**
    - Displays the current server status.
    - _Chat Alias: `!status`_
- **/version**
    - Displays the current version of the addon.
    - _Chat Alias: `!version`_
- **/deathcoords**
    - Shows your last death coordinates.
    - _Chat Alias: `!deathcoords`_
- **/spawn**
    - Teleports you to the world spawn.
    - _Chat Alias: `!spawn`_
- **/rtp**
    - Teleports you to a random safe location in the world.
    - _Chat Alias: `!rtp` or `!randomtp`_
- **/kit [kitName]**
    - Lists available kits or claims a specific kit.
    - _Chat Alias: `!kit`_

### TPA System

- **/tpa <target>**
    - Sends a teleport request to another player.
- **/tpahere <target>**
    - Requests another player to teleport to you.
- **/tpaccept**
    - Accepts an incoming teleport request.
- **/tpadeny**
    - Denies an incoming teleport request.
- **/tpacancel**
    - Cancels your outgoing teleport request.
- **/tpastatus**
    - Checks the status of your TPA requests.

### Home System

- **/sethome [homeName]**
    - Sets a home at your current location.
- **/home [homeName]**
    - Teleports you to a set home.
- **/delhome <homeName>**
    - Deletes a home.
- **/homes**
    - Lists all of your set homes.

### Economy System

- **/balance [target]**
    - Shows your or another player's balance.
- **/baltop**
    - Shows the players with the highest balances on the server.
- **/pay <target> <amount>**
    - Pays another player from your balance.
- **/payconfirm**
    - Confirms a pending high-value payment.

### Bounty System

- **/bounty <target> <amount>**
    - Places a bounty on a player.
- **/listbounty [target]**
    - Lists active bounties.
- **/removebounty <amount> [target]**
    - Removes a portion of a bounty from a player.

### Shop System

- **/shop**
    - Opens the main shop interface.
- **/buy**
    - Opens the shop interface filtered to only show buyable items.
- **/sell**
    - Opens the shop interface filtered to only show sellable items.
- **/sellhand**
    - Sells the item currently in your main hand.
    - _Chat Alias: `!sellhand` or `!sh`_

---

## Moderation Commands

Commands available to Admins and above.

### Player Punishment

- **/ban <target> [duration] [reason]**
    - Bans an online player. For offline players, use `/offlineban`.
- **/unban <target>**
    - Unbans a player, allowing them to rejoin.
- **/offlineban <target> [duration] [reason]**
    - Bans a player who is currently offline.
- **/kick <target> [reason]**
    - Kicks a player from the server.
- **/mute <target> [duration] [reason]**
    - Mutes a player in chat.
- **/unmute <target>**
    - Unmutes a player.
- **/freeze <target>**
    - Freezes a player, preventing them from moving or looking around.
- **/unfreeze <target>**
    - Unfreezes a player, allowing them to move and look around again.

### Player Management

- **/invsee <target> [page]**
    - Views a player's inventory.
- **/xclear [target]**
    - Clears another player's inventory.
    - _Chat Alias: `!clear`_
- **/ecwipe [target]**
    - Clears a player's Ender Chest.
- **/ecsee <target>**
    - _Note: Currently unavailable due to API limitations._
- **/copyinv <target>**
    - Copies the inventory of another player.
- **/vanish**
    - Toggles your visibility to other players.

### Server Moderation

- **/report <target>**
    - Reports a player for misconduct.
- **/reports**
    - Views the list of active reports.
- **/clearreports**
    - Clears all player-submitted reports.
- **/clearchat**
    - Clears the chat for all players.
- **/xraynotify**
    - Toggles X-ray detection notifications for yourself.

---

## Administration Commands

Commands for high-level server management.

### Core Management

- **/xreload**
    - Reloads the addon's internal configuration state. Does **not** reload file changes from disk.
    - _Chat Alias: `!reload`_
- **/debug [true|false]**
    - Toggles the script debug logging mode.
- **/save**
    - Manually triggers the data saving process.
- **/restart**
    - Initiates the server restart sequence.

### Player & World

- **/setbalance <target> <amount>**
    - Sets a player's balance.
- **/setspawn [x] [y] [z]**
    - Sets the world's default spawn point.
- **/tp <target> [destination]**
    - Teleports a player.
- **/gamemode <mode> [target]**
    - Sets a player's gamemode.
- **/rank <set|remove> <target> <rankId>**
    - Manages custom player ranks.
- **/warp [warpName]**
    - Teleports you to a specified warp, or opens a UI to select one.
- **/addwarp <warpName> [x] [y] [z]**
    - Creates a new warp point.
    - _Chat Alias: `!setwarp`_
- **/delwarp [warpName]**
    - Deletes an existing warp point.

### World Management

- **/netherlock [true|false]**
    - Toggles or sets the lock for the Nether dimension.
- **/endlock [true|false]**
    - Toggles or sets the lock for the End dimension.

### Utilities

- **/chattoconsole**
    - Toggles sending player chat messages to the console.
