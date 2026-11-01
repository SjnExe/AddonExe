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
- **`/sidebar [toggle|ui|right|left|bottom|default|on|off]`** (Alias: `/sb`) — Toggles your personal HUD/Sidebar, switches screen layout, or opens the HUD settings UI.
- **`/vote [ui|results|end|create] [question | opt1 | opt2]`** — Opens the active server poll menu, views poll results, or manages polls (Admin).
- **`/afk [reason]`** — Toggles your Away-From-Keyboard (AFK) status.
- **`/trash`** (Aliases: `/dispose`, `/bin`) — Opens the safe item disposal UI.
- **`/near`** (Alias: `/nearby`) — Lists nearby visible players and their distances.
- **`/heal [target]`** / **`/feed [target]`** / **`/repair`** (Alias: `/fix`) — Restores health, hunger, or held item durability.
- **`/rename <name|reset>`** (Aliases: `/itemname`, `/setname`) — Renames the item currently held in your main hand (supports `&` color codes; disabled by default).
- **`/lore <add|set|remove|clear> [line|text] [text]`** (Aliases: `/itemlore`, `/setlore`) — Adds, modifies, or clears lore lines on held item (supports `&` color codes; disabled by default).

### Teleportation & Homes

- **`/spawn`** (Aliases: `/lobby`, `/hub`) — Teleports you to the server spawn point.
- **`/rtp`** — Teleports you to a random safe location in the Overworld.
- **`/back`** — Teleports you back to your last saved death or pre-teleport location.
- **`/deathcoords`** — Displays the coordinates of your most recent death.
- **`/sethome [homeName]`** — Sets a personal home at your current location.
- **`/home [homeName]`** — Teleports you to a saved home (or opens the Homes UI).
- **`/delhome [homeName]`** — Deletes a saved home (or opens the delete home UI).
- **`/homes`** — Lists all of your saved homes.
- **`/warp [warpName]`** — Teleports you to a server warp (or opens the Warps UI).
- **`/hq`** (Alias: `/teamhome`) — Teleports you to your team's home location.

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
- **`/sellhand`** (Alias: `/sh`) — Quickly sells the stackable item in your main hand.
- **`/sellall [confirm]`** (Alias: `/sa`) — Sells all sellable shop items in your inventory with a confirmation prompt.
- **`/trade <player|accept|deny|cancel>`** — Sends or responds to a safe 1-on-1 item and money trade offer.
- **`/ah [sell|collect|listings|cancel|search|help] [price|id|query] [bin|bid]`** (Alias: `/auction`) — Opens the Auction House UI, lists held items, claims Collection Bin items, or manages active listings.
- **`/kit [kitName]`** — Opens the Kits menu or claims a specific kit.
- **`/daily`** (Alias: `/reward`) — Claims your daily login reward.
- **`/playtime`** (Aliases: `/pt`, `/milestones`, `/afkrewards`) — Views your total playtime, stay-online/AFK reward timer, and playtime milestones.
- **`/bounty <target> <amount>`** (Aliases: `/setbounty`, `/addbounty`) — Places a bounty on a player.
- **`/listbounty [target]`** (Aliases: `/bounties`, `/bountylist`, `/hitlist`) — Lists active bounties.
- **`/removebounty <target> <amount>`** (Aliases: `/rbounty`, `/delbounty`) — Pays to reduce or remove a bounty.

### Social, PvP & Mini-Games

- **`/friend [add|remove|accept|deny|list|requests|autotp] [target]`** (Aliases: `/frnd`, `/friends`) — Opens the Friends UI or manages friends via chat.
- **`/team [create|leave|invite|join|kick|promote|demote|sethome|delhome|disband|list|autotp] [target]`** — Opens the Teams / Guilds UI or manages your team.
- **`/teamchat [toggle|on|off|status]`** (Alias: `/tc`) — Toggles Team Chat mode or checks your active chat channel.
- **`/xmsg <target> <message>`** (Aliases: `/tell`, `/w`, `/whisper`, `/pm`, `/dm`) — Sends a private message to an online player.
- **`/reply <message>`** (Alias: `/r`) — Replies to the last player who private messaged you.
- **`/mail [read|send|clear|ui] [target] [message]`** (Alias: `/inbox`) — Reads or sends offline mail messages.
- **`/coinflip [heads|tails|player|ui] [wager]`** (Aliases: `/cf`, `/flip`) — Flips a random 50/50 coin in chat, wagers solo, or challenges another player.
- **`/2048 [play|new|menu]`** — Plays the 4x4 2048 puzzle game with Endless Mode support.
- **`/connect4 [actionOrFriend] [wager]`** (Alias: `/c4`) — Plays 2-player 7x6 Connect 4.
- **`/codebreaker [actionOrFriend] [wager]`** (Aliases: `/cb`, `/mastermind`) — Plays Solo or 2P Codebreaker (Mastermind).
- **`/scramble [word]`** (Alias: `/unscramble`) — Submits an answer to an active staff-hosted Scramble round.
- **`/math [answer]`** (Aliases: `/fastmath`, `/solve`) — Submits an answer to an active staff-hosted Fast Math round.
- **`/numguess [number]`** (Aliases: `/ng`, `/numberguess`) — Submits a number in an active Number Guess round via Game Chat.
- **`/gamechat [toggle|join|leave|on|off|status]`** (Alias: `/gc`) — Joins, leaves, or toggles talking in the active Game Chat channel.
- **`/pvp <target|accept|deny> [amount]`** — Challenges a player to a PvP duel with an optional money wager.
- **`/ttt [actionOrFriend] [wagerOrPlayer]`** (Alias: `/tictactoe`) — Opens Tic-Tac-Toe, joins the 2P queue, or invites a friend.
- **`/rps [actionOrFriend] [wagerOrPlayer]`** (Alias: `/rockpaperscissors`) — Plays Rock Paper Scissors solo vs Bot, in 2P queue, or against a friend.
- **`/minesweeper [easy|medium|hard|queue|accept|deny|cancel|friend] [wager]`** (Aliases: `/ms`, `/sweeper`) — Plays Beginner (9x9), Intermediate (12x12), or Expert (16x12) Minesweeper solo or in a 2P Race.
- **`/game [queue|invite|accept|deny|cancel|stop|start] [target]`** (Alias: `/match`) — Universal multiplayer mini-game invitation and privacy controls.
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
- **`/staffchat [toggle|on|off|status]`** (Alias: `/sc`) — Toggles Staff Chat mode or checks your active chat channel.
- **`/staffinv [toggle|staff|survival|auto|status]`** (Aliases: `/sinv`, `/staffmode`) — Swaps between your Survival and Staff inventories without losing items, or toggles auto-swap on gamemode change.
- **`/invsee <player>`** — Displays a player's inventory, hotbar, armor, and offhand contents.
- **`/ecsee <player> [chat|ui]`** (Aliases: `/enderchestsee`, `/viewec`) — Views a player's 27 Ender Chest slots in chat or UI.
- **`/socialspy [toggle|on|off|status]`** (Alias: `/ss`) — Toggles viewing private messages sent between players.
- **`/mutechat [toggle|on|off]`** / **`/slowmode [seconds]`** — Toggles global chat mute or sets live chat slowmode.
- **`/history <player>`** — Views a player's past punishment and anti-cheat flag history.
- **`/watch <target>`** / **`/listwatched`** — Toggles or lists players on the staff watchlist.
- **`/notify [on|off|status]`** — Toggles live in-game Anti-Cheat violation alerts (combat, movement, mining rate, illegal items) for staff or console.
- **`/xraynotify [on|off|status]`** (Alias: `/xray`) — Toggles live heuristic X-Ray ore mining alerts and suspicion score updates for staff or console.

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
- **`/shopedit`** (Alias: `/editshop`) — Opens the in-game Shop Management UI.
- **`/addshop <category> <buyPrice> <sellPrice> [subCategory]`** — Adds the item in your main hand to a shop category.

### World, Teleport & Server Control

- **`/xgamemode <s|c|a|sp> [targets]`** (Aliases: `/gm`, plus `/gms`, `/gmc`, `/gma`, `/gmsp` — `/gms` & `/gmc` are available to Builders) — Changes player gamemode.
- **`/xtp <target|x> [destination|y] [z]`** (Alias: `/teleport`) — Teleports yourself or a target player to a player or coordinates.
- **`/setspawn [x] [y] [z]`** — Sets the server spawn point and updates spawn protection.
- **`/addwarp <warpName> [x] [y] [z]`** (Alias: `/setwarp`) / **`/delwarp [warpName]`** — Creates or deletes server warps.
- **`/worldborder [ui|info|overworld|end|on|off|set] [radius|on|off] [x] [z]`** (Alias: `/wb`) — Opens the World Border Manager UI or configures the linked Overworld+Nether (8:1) and End borders.
- **`/zonewand [wand|pos1|pos2|clear|status]`** (Aliases: `/wand`, `/pos1`, `/pos2`) — Gives the World Protection Selection Wand or sets Pos1/Pos2 at your feet.
- **`/netherlock [true|false]`** / **`/endlock [true|false]`** — Locks or unlocks the Nether and End dimensions.
- **`/floatingtext <create|delete|list|tp> <id> [text]`** — Manages floating text holograms.
- **`/clearlag [run [now|seconds] | info | cancel]`** (Aliases: `/lagsweep`, `/cleanlag`) — Displays entity counts, cancels sweeps, or schedules/runs entity lag sweeps with protection for named mobs, pets, and valuables.
- **`/announce <message>`** — Broadcasts a server-wide announcement.
- **`/chattoconsole [true|false]`** (Alias: `/ctc`) — Toggles printing player chat to the server console.
- **`/xreload`** — Reloads and priority-merges configuration changes from disk and refreshes player ranks.
- **`/xsave`** — Manually flushes all cached world and player data to dynamic properties.
- **`/restart`** — Starts a countdown and kicks players for a scheduled server restart.
- **`/status`** _(Owner)_ — Shows current player count and server tick status.
- **`/debug`** _(Owner)_ — Shows tick count, active timers, intervals, and jobs.
