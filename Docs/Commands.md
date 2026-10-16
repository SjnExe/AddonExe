# AddonExe Commands Reference

All commands in AddonExe are registered as native Minecraft slash commands with in-game autocomplete.

> [!IMPORTANT]
> **Using Commands from the Server Console (BDS)**
> Commands marked with Console support can be run directly from the Bedrock Dedicated Server terminal. When targeting a player from the console, always pass the player's name.

> [!NOTE]
> **Command Prefixes & Syntax**
>
> - Commands that conflict with vanilla Minecraft commands use an `x` prefix: `/xhelp`, `/xclear`, `/xgamemode`, `/xkick`, `/xreload`, `/xsave`.
> - Multi-word arguments containing spaces should be enclosed in double quotes (e.g., `/ban "Player Name" 7d "Griefing spawn"`).
> - `<param>` indicates a required parameter; `[param]` indicates an optional parameter.

---

## Member Commands (`**.member`)

### General & Info

- **`/panel`** (Aliases: `/ui`, `/menu`) — Opens the main AddonExe dark-mode UI panel.
- **`/xhelp [command|ui|chat]`** (Aliases: `/?`, `/h`, `/cmds`, `/commands`) — Displays available commands or detailed help for a specific command.
- **`/rules [ruleNumber]`** (Alias: `/rule`) — Displays the server rules.
- **`/links`** (Aliases: `/link`, `/websites`) — Displays Discord and community links.
- **`/version`** (Alias: `/ver`) — Displays the active AddonExe version.
- **`/sidebar`** (Alias: `/sb`) — Toggles your personal Scoreboard Sidebar and Action Bar HUD.
- **`/fixplayer`** — Resets your player state if stuck in spawn protection or frozen flags.
- **`/vote`** — Opens the active server poll / voting menu.

### Teleportation & Homes

- **`/spawn`** (Aliases: `/lobby`, `/hub`) — Teleports you to the server spawn point.
- **`/rtp`** — Teleports you to a random safe location in the Overworld.
- **`/back`** — Teleports you back to your last saved death or pre-teleport location.
- **`/deathcoords`** — Displays the coordinates of your most recent death.
- **`/sethome [homeName]`** — Sets a personal home at your current location.
- **`/home [homeName]`** — Teleports you to a saved home (or opens the Homes UI).
- **`/delhome <homeName>`** — Deletes a saved home.
- **`/homes`** — Lists all of your saved homes.
- **`/warp [warpName]`** — Teleports you to a server warp (or opens the Warps UI).

### Teleport Requests (TPA)

- **`/tpa <target>`** — Requests to teleport to another player.
- **`/tpahere <target>`** — Requests another player to teleport to you.
- **`/tpaccept`** — Accepts an incoming TPA request.
- **`/tpadeny`** — Denies an incoming TPA request.
- **`/tpacancel`** — Cancels your outgoing TPA request.
- **`/tpastatus`** — Shows your active incoming/outgoing TPA requests.
- **`/tpastop [targets]`** / **`/otpastop <target>`** — Blocks TPA requests from specific players (or toggles all requests).
- **`/tpastart [targets]`** / **`/otpastart <target>`** — Unblocks TPA requests from specific players (or enables all requests).

### Economy, Shop, Auction House & Kits

- **`/balance [targets]`** (Aliases: `/bal`, `/money`, `/cash`) — Checks your or another online player's balance.
- **`/baltop`** (Aliases: `/topbal`, `/leaderboard`, `/richlist`) — Displays the wealthiest players on the server.
- **`/pay <target> <amount>`** (Aliases: `/givemoney`, `/transfer`) — Sends money to another player.
- **`/payconfirm`** (Alias: `/confirmpay`) — Confirms a pending high-value payment.
- **`/shop`** — Opens the 3-column Server Shop UI.
- **`/buy`** / **`/sell`** — Opens the shop item trade menu (or inspects held item).
- **`/sellhand`** — Quickly sells the stackable item in your main hand.
- **`/ah [sell|search|help] [price|query] [bin|bid]`** (Alias: `/auction`) — Opens the Auction House UI or lists the item in your hand.
- **`/kit [kitName]`** — Opens the Kits menu or claims a specific kit.
- **`/daily`** (Alias: `/reward`) — Claims your daily login reward.
- **`/bounty <target> <amount>`** (Aliases: `/setbounty`, `/addbounty`) — Places a bounty on a player.
- **`/listbounty [target]`** (Aliases: `/bounties`, `/bountylist`, `/hitlist`) — Lists active bounties.
- **`/removebounty <target> <amount>`** (Aliases: `/rbounty`, `/delbounty`) — Pays to reduce or remove a bounty.

### Social, PvP & Mini-Games

- **`/friend [add|remove|accept|deny|list|requests|autotp] [target]`** (Aliases: `/frnd`, `/friends`) — Opens the Friends UI or manages friends via chat.
- **`/team [create|leave|invite|join|kick|promote|demote|sethome|delhome|disband|list|autotp] [target]`** — Opens the Teams / Guilds UI or manages your team.
- **`/teamchat [message]`** (Alias: `/tc`) — Sends a message to your team or toggles team chat mode.
- **`/pvp <target|accept|deny> [amount]`** — Challenges a player to a PvP duel with an optional money wager.
- **`/wordle`** (Alias: `/wrd`) — Opens the Wordle mini-game menu.
- **`/guess <word>`** (Alias: `/gs`) — Submits a word guess in an active staff-hosted Wordle game.
- **`/report [target] [reason]`** — Submits a player report to server staff.

---

## Moderator Commands (`**.mod`)

- **`/xkick <target> [reason]`** (Alias: `/boot`) — Kicks an online player from the server.
- **`/mute <target> [duration] [reason]`** (Alias: `/silence`) — Temporarily or permanently mutes a player.
- **`/unmute <target>`** (Alias: `/um`) — Unmutes a muted player.
- **`/warn <player> <reason>`** — Issues a logged warning to a player.
- **`/freeze <target>`** / **`/unfreeze <target>`** — Immobilizes or releases a player by locking movement and camera input permissions.
- **`/vanish`** (Alias: `/v`) — Toggles full staff vanish (invisibility + hidden from pause screen player list).
- **`/staffchat [message]`** (Alias: `/sc`) — Sends a message to online staff or toggles Staff Chat mode.
- **`/staffinv [toggle|staff|survival|auto|status]`** (Aliases: `/sinv`, `/staffmode`) — Swaps between your Survival and Staff inventories without losing items, or toggles auto-swap on gamemode change.
- **`/invsee <player>`** — Displays a player's inventory, hotbar, armor, and offhand contents.
- **`/watch <target>`** / **`/listwatched`** — Toggles or lists players on the staff watchlist.
- **`/notify`** — Toggles Anti-Cheat violation alerts for yourself (or console).
- **`/xraynotify`** (Alias: `/xray`) — Toggles X-Ray mining notifications for yourself (or console).

---

## Administrator & Owner Commands (`**.admin` / `**.owner`)

### Punishments, Logs & Inventories

- **`/ban <target> [duration] [reason]`** — Bans an online player (supports durations like `30m`, `24h`, `7d`, or `perm`).
- **`/offlineban <target> [duration] [reason]`** (Alias: `/oban`) — Bans an offline player by name.
- **`/unban <target>`** (Alias: `/pardon`) — Unbans a banned player.
- **`/reports`** / **`/clearreports`** — Opens the active reports UI or clears all reports.
- **`/logs`** — Opens the unified Punishment, Anti-Cheat Flag, and Chat Logs UI.
- **`/chatlog`** — Opens the filterable Chat Log viewer directly.
- **`/clearchat`** (Alias: `/cc`) — Clears the in-game chat for all players.
- **`/xclear [target]`** (Aliases: `/ci`, `/clearinv`) — Clears your or another player's inventory.
- **`/copyinv <player>`** — Copies another player's inventory into yours.
- **`/ecwipe <player>`** — Wipes a player's Ender Chest (supports online and offline players).

### Economy & Rank Administration

- **`/setbalance <targets> <amount>`** / **`/osetbalance <target> <amount>`** — Sets online or offline player balances.
- **`/addbalance <targets> <amount>`** / **`/oaddbalance <target> <amount>`** — Adds money to online or offline players.
- **`/removebalance <targets> <amount>`** / **`/oremovebalance <target> <amount>`** — Removes money from online or offline players.
- **`/obalance <target>`** / **`/opay <target> <amount>`** — Checks balance or pays an offline player.
- **`/obounty <target> <amount>`** / **`/oremovebounty <target> <amount>`** / **`/olistbounty <target>`** — Offline bounty management.
- **`/rank <set|remove|list> <target> [rankId]`** — Grants, revokes, or lists a player's ranks.
- **`/listranks`** — Lists all configured ranks, IDs, and priorities.
- **`/addkit [kitName]`** — Creates a new kit directly from your current inventory and opens the Kit Editor UI.

### World, Teleport & Server Control

- **`/xgamemode <s|c|a|sp> [targets]`** (Aliases: `/gm`, plus `/gms`, `/gmc`, `/gma`, `/gmsp`) — Changes player gamemode.
- **`/tp <target> [destination]`** — Teleports yourself or a target player.
- **`/setspawn [x] [y] [z]`** — Sets the server spawn point and updates spawn protection.
- **`/addwarp <warpName> [x] [y] [z]`** (Alias: `/setwarp`) / **`/delwarp [warpName]`** — Creates or deletes server warps.
- **`/worldborder <on|off|set|info> [radius] [x] [z]`** (Alias: `/wb`) — Configures and toggles the world border.
- **`/netherlock [true|false]`** / **`/endlock [true|false]`** — Locks or unlocks the Nether and End dimensions.
- **`/floatingtext <create|delete|list|tp> <id> [text]`** — Manages floating text holograms.
- **`/announce <message>`** — Broadcasts a server-wide announcement.
- **`/chattoconsole [true|false]`** (Alias: `/ctc`) — Toggles printing player chat to the server console.
- **`/xreload`** — Reloads and priority-merges configuration changes from disk and refreshes player ranks.
- **`/xsave`** — Manually flushes all cached world and player data to dynamic properties.
- **`/restart`** — Starts a countdown and kicks players for a scheduled server restart.
- **`/newui [testOption]`** — Opens the UI test panel.
- **`/status`** _(Owner)_ — Shows current player count and server tick status.
- **`/debug`** _(Owner)_ — Shows tick count, active timers, intervals, and jobs.
