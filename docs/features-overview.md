# AddonExe Features Overview

AddonExe is a modular server suite for Minecraft Bedrock Edition combining a custom dark-mode UI, economy, moderation, anti-cheat, teleportation, social systems, and mini-games.

---

## 1. Custom Dark-Mode UI Panel (`/panel`)

Accessible via `/panel` (`/ui`, `/menu`) or by right-clicking/using the craftable **Admin Panel** item (`exe:panel`):

- **Adaptive Multi-Layout JSON UI (`server_form.json`):**
    - **2-Column Wide Card Grid:** Used for the Main Menu, Category Hubs, and Staff Dashboard.
    - **3-Column Compact Tile Grid:** Used for browsing categories and items in the Server Shop and Rock Paper Scissors.
    - **1-Column Reader & Detail Stack:** Used for long-text screens (`Server Rules`, `Helpful Links`, `Placeholders`, `Auction Listing Details`).
    - **Interactive Game Boards:** Dedicated 3x3 board grid for Tic-Tac-Toe and 9x9, 12x12, and 16x12 minefield grids for Minesweeper.
- **Permission-Aware Hubs:** Players only see the hubs and actions they have permission to use; staff members automatically see the **Staff Dashboard**.

---

## 2. Economy, Commerce & Rewards

- **Core Economy:** Player balances (`/balance`), offline balance lookups (`/obalance`), player-to-player transfers with high-value confirmation (`/pay`, `/payconfirm`), cached leaderboards (`/baltop`), and admin balance controls (`/setbalance`, `/addbalance`, `/removebalance`).
- **GUI Server Shop (`/shop`):** Categorized 3-column item shop supporting buy/sell quantities, search, rank price multipliers (e.g., VIP/Donator discounts), `/sellhand`, bulk inventory selling (`/sellall`), and a full in-game **Shop Editor** for admins.
- **Auction House (`/ah`):** Player-driven marketplace supporting Buy-It-Now (BIN) and Bidding listings, search, sorting, listing fees/taxes, and a Collection Bin / Mailbox for claiming items.
- **Bounty Board (`/bounty`):** Place, view, and pay off bounties on online or offline players; bounties automatically pay out on PvP kills.
- **Kits System (`/kit`, `/addkit`):** Configurable starter and rank kits with cooldowns, prices, permissions, and an in-game Kit Editor (including creating kits directly from your inventory).
- **Daily Rewards (`/daily`), Playtime Rewards (`/playtime`) & Voting (`/vote`):** Streak-based daily login rewards, automatic stay-online/AFK payouts with unlockable playtime milestones, and server-wide interactive polls.
- **PvP Duels (`/pvp`), Kill Steal & Combat Tag:** Challenge players to wagered PvP duels, steal a percentage of balance on PvP kills, and prevent teleporting or combat logging during active PvP combat.

---

## 3. Moderation, Security & Anti-Cheat

- **Punishment System:** Temporary and permanent bans (`/ban`, `/offlineban`, `/unban`), mutes (`/mute`, `/unmute`), kicks (`/xkick`), and formal warnings (`/warn`).
- **Hard Freeze (`/freeze`, `/unfreeze`):** Locks player movement and camera rotation via native `InputPermissionCategory` APIs while applying resistance and weakness.
- **Staff Vanish (`/vanish`):** Grants invisibility, suppresses join/leave presence, and hides vanished staff from the pause screen player list (`pause_screen.json`).
- **Staff Inventory Swap (`/staffinv`, `/sinv`):** Seamlessly swap between Survival and Staff inventories (including armor and XP levels) with optional auto-swap on gamemode change.
- **Inventory & Ender Chest Inspector:** View armor, offhand, and inventory slots (`/invsee`), inspect Ender Chests (`/ecsee`), clone inventories (`/copyinv`), clear inventories (`/xclear`), or wipe Ender Chests (`/ecwipe`).
- **Reports & Audit Logs:** Player reporting (`/report`, `/reports`) and a filterable in-game log viewer (`/logs`, `/chatlog`) for Punishments, Anti-Cheat Flags, and Chat History.
- **Anti-Cheat & X-Ray Detection:**
    - **Movement & Item Checks:** Detects speed/fly anomalies and scans for illegal items or over-enchanted gear.
    - **X-Ray Alerts (`/xraynotify`):** Buffered staff notifications when players mine monitored ores, with configurable ore types and Y-levels in the UI.
    - **Hidden World Seed:** Hides the world seed from the client settings screen (`world_section.json`).

---

## 4. Teleportation & World Management

- **Homes (`/home`, `/sethome`, `/delhome`, `/homes`):** Personal player homes with configurable limits, warmups, and cooldowns.
- **Server Warps (`/warp`, `/addwarp`, `/delwarp`):** Public warp points managed by admins.
- **Teleport Requests (`/tpa`, `/tpahere`, `/tpaccept`, `/tpadeny`):** Player-to-player teleport requests with per-player blocklists and privacy toggles.
- **Random Teleport (`/rtp`) & Back (`/back`):** Safe Overworld random teleportation and returning to your last death or pre-teleport location.
- **Spawn & Custom World Protection Zones:** Radius-based Spawn Protection plus custom 3D bounding-box protection zones (configurable in `/panel`) controlling PvP, block breaking/placing, explosions, projectiles, mob griefing, and fall damage.
- **World Border (`/worldborder`) & Dimension Locks (`/netherlock`, `/endlock`):** Configurable world border radius and instant Nether/End dimension locks with admin bypass.
- **Floating Text Holograms (`/floatingtext`):** Dynamic floating text entities (`exe:floating_text`) supporting live server and player placeholders (`{online}`, `{money}`, `{rank}`, `{kdr}`, `{top_money_1}`, etc.).

---

## 5. Social, Ranks, HUD & Mini-Games

- **Rank & Permission Engine (`/rank`, `/listranks`):** Priority-sorted ranks (`Owner`, `Admin`, `Moderator`, `Helper`, `Verified`, `VIP`, `Donator`, `Member`) with wildcard permission nodes, custom chat/nametag prefixes, shop discounts, and an in-game Rank Editor.
- **Friends (`/friend`), Private Messaging (`/xmsg`, `/r`, `/socialspy`) & Teams (`/team`, `/teamchat`, `/hq`):** Friend lists with auto-TPA, private whispers with staff Social Spy, and Teams/Guilds featuring shared banks, applications/invites, and team homes.
- **Adaptive Sidebar & HUD (`/sidebar`):** Customizable Top-Right Card, Top-Left Touch-Friendly Card, Bottom Compact Pill, or Dual Scoreboard layouts with built-in theme presets and live placeholders.
- **Mini-Games Suite (`/panel` -> Mini-Games):**
    - **Tic-Tac-Toe (`/ttt`):** 2-player 3x3 board matches with friend invites, matchmaking queue, and optional wagers.
    - **Rock Paper Scissors (`/rps`):** Best-of-N matches solo vs Bot or 2-player with optional wagers.
    - **Minesweeper (`/ms`):** Solo and 2P Race minefields across Beginner (9x9), Intermediate (12x12), and Expert (16x12) difficulties with speed bonus payouts.
    - **Wordle (`/wordle`, `/guess`):** Single-player Wordle in the UI and staff-hosted global Wordle rounds with prize pools.
