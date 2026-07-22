# AddonExe Commands

Commands in AddonExe are primarily run using native slash commands, which support autocomplete in-game.

> [!IMPORTANT]
> **Using Commands from the Server Console**
> All slash commands can also be executed directly from the server console (e.g., in Bedrock Dedicated Server).
>
> - **Commands are run with a `/` prefix,** just like in-game (e.g., `/xhelp`).
> - **Specify the target player:** For commands that normally affect the person running them (like `/home` or `/clear`), you must specify the target player's name. For example: `/home "Steve" "my-base"` or `/clear "Steve"`.

> [!NOTE]
> **Slash Commands**
>
> - These are native Minecraft commands registered by the addon.
> - They support in-game argument suggestions and validation.
> - **Arguments with spaces MUST be enclosed in double quotes.** For example: `/ban "Player Name" "Griefing the server"`.
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

- **/team**
    - Opens the team panel.

- **/friend <add|remove|accept|list> [target]**
    - Manage your friend list. Can also be accessed via the UI by using `/friend` with no arguments.
    - _Aliases: `/frnd`, `/friends`_
    - _Abbreviations for subcommands: `rm` for remove, `ls` for list._

- **/teamchat [message]**
    - Toggles or sends a message in team chat.

- **/xhelp [command]**
    - Shows a list of available commands or help for a specific command.

- **/panel**
    - Opens the main UI panel.

- **/rules [ruleNumber]**
    - Displays the server rules.

- **/status**
    - Displays the current server status.

- **/version**
    - Displays the current version of the addon.

- **/deathcoords**
    - Shows your last death coordinates.

- **/spawn**
    - Teleports you to the world spawn.

- **/rtp**
    - Teleports you to a random safe location in the world.

- **/kit [kitName]**
    - Lists available kits or claims a specific kit.

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
- **/tpastop [targets]**
    - Blocks specific players or disables all TPA requests.
- **/tpastart [targets]**
    - Unblocks specific players or enables all TPA requests.
- **/otpastop <target>**
    - Blocks an offline player from sending TPA requests.
- **/otpastart <target>**
    - Unblocks an offline player.

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

- **/balance [targets]**
    - Shows your or another player's balance. Supports selectors (e.g. `@a`).
- **/obalance <target>**
    - Shows an offline player's balance.
- **/baltop**
    - Shows the players with the highest balances on the server.
- **/pay <target> <amount>**
    - Pays another player from your balance.
- **/opay <target> <amount>**
    - Pays an offline player.
- **/payconfirm**
    - Confirms a pending high-value payment.

### Bounty System

- **/bounty <target> <amount>**
    - Places a bounty on a player.
- **/obounty <target> <amount>**
    - Places a bounty on an offline player.
- **/listbounty [target]**
    - Lists active bounties.
- **/olistbounty <target>**
    - Lists bounties for an offline player.
- **/removebounty <amount> [target]**
    - Removes a portion of a bounty from a player.
- **/oremovebounty <amount> <target>**
    - Removes a portion of a bounty from an offline player.

### Shop System

- **/shop**
    - Opens the main shop interface.
- **/buy**
    - Opens the shop interface filtered to only show buyable items.
- **/sell**
    - Opens the shop interface filtered to only show sellable items.
- **/sellhand**
    - Sells the item currently in your main hand.

---

## Moderation Commands

Commands available to Admins and above.

### Player Punishment

- **/ban <target> [duration] [reason]**
    - Bans an online player.
- **/oban <target> [duration] [reason]**
    - Bans a player who is currently offline.
    - _Alias: `/offlineban`_
- **/unban <target>**
    - Unbans a player, allowing them to rejoin.
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
- **/warn <target> <reason>**
    - Issues a formal warning to a player.

### Player Management

- **/invsee <target> [page]**
    - Views a player's inventory.
- **/xclear [target]**
    - Clears another player's inventory.
- **/ecwipe [target]**
    - Clears a player's Ender Chest.
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
- **/logs**
    - Opens the main logs menu (Punishments, Flags, Chat).
- **/chatlog**
    - Opens the chat log viewer directly.

---

## Administration Commands

Commands for high-level server management.

### Core Management

- **/xreload**
    - Reloads the addon's internal configuration state. Does **not** reload file changes from disk.

- **/debug [true|false]**
    - Toggles the script debug logging mode.
- **/save**
    - Manually triggers the data saving process.
- **/restart**
    - Initiates the server restart sequence.

### Player & World

- **/setbalance <targets> <amount>**
    - Sets a player's (or players') balance. Supports selectors.
- **/osetbalance <target> <amount>**
    - Sets an offline player's balance.
- **/addbalance <targets> <amount>**
    - Adds to a player's balance.
- **/oaddbalance <target> <amount>**
    - Adds to an offline player's balance.
- **/removebalance <targets> <amount>**
    - Removes from a player's balance.
- **/oremovebalance <target> <amount>**
    - Removes from an offline player's balance.
- **/setspawn [x] [y] [z]**
    - Sets the world's default spawn point.
- **/tp <target> [destination]**
    - Teleports a player.
- **/gamemode <mode> [target]**
    - Sets a player's gamemode.
- **/rank <set|remove|list> <target> [rankId]**
    - Manages custom player ranks.
    - _Abbreviations for subcommands: `rm` for remove, `ls` for list._
- **/listranks**
    - Lists all available server ranks.
- **/warp [warpName]**
    - Teleports you to a specified warp, or opens a UI to select one.
- **/addwarp <warpName> [x] [y] [z]**
    - Creates a new warp point.
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
