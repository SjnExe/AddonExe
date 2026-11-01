# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - Unreleased

### 🎮 Mini-Games Hub

- **10 Interactive Mini-Games:** Play solo or challenge friends via `/panel` or direct commands:
  - **Connect 4** (`/c4`) — Drop tokens to connect 4 in a row.
  - **Tic-Tac-Toe** (`/ttt`) — Classic 3x3 turn-based duel.
  - **Rock Paper Scissors** (`/rps`) — Fast-paced 2-player showdown.
  - **Coin Flip** (`/cf`) — Quick 50/50 bets and coin tosses.
  - **Minesweeper** (`/ms`) — Grid-based mine clearing with 9x9, 12x12, and 16x12 difficulties.
  - **Wordle** (`/wordle`, `/guess`) — Guess the hidden 5-letter word within 6 tries.
  - **2048** (`/2048`) — Slide and merge number tiles to reach 2048.
  - **Fast Math** (`/math`) — Quick-fire mental math challenges.
  - **Word Scramble** (`/scramble`) — Unscramble mystery words under time pressure.
  - **Number Guess** (`/numguess`, `/gamechat`) — Competitive number guessing with server chat hints.
- **Two-Player Wagers:** Challenge other players to wagered matches with configurable economy stakes and server taxes.

### 📊 Server HUD & Sidebar (`/sidebar`)

- **Multiple Layout Choices:** Toggle between **Top-Right Card**, **Top-Left Touch-Friendly Card**, and **Bottom Bar** display modes.
- **Live Stats Display:** Real-time ping, TPS, player coordinates, ranks, balances, and active teams.
- **Theme Presets:** Select from pre-configured color and styling presets to match your server's theme.
- **Smooth Updates:** Flicker-free background updates ensure zero scoreboard or action bar jitter.

### 💰 Economy, Trading & Rewards

- **In-Game Trading (`/trade`):** Secure direct player-to-player item and balance trading interface.
- **Offline Mail (`/mail`):** Send messages and notifications to players even when they are offline.
- **Playtime & AFK Rewards (`/playtime`):** Unlock tiered playtime milestone rewards and earn passive currency while online.
- **AFK Protection & Status (`/afk`):** Automatically detect AFK players to protect server economy and reward active engagement.
- **Auction House & Shop Enhancements:** Added `/ah collect`, `/ah listings`, `/ah cancel`, and `/sellall` for bulk inventory selling.

### 🛡️ Moderation, Anti-Cheat & World Protection

- **Heuristic X-Ray Detection:** Statistical and environmental X-Ray detection featuring 6-neighbor cave air exposure checking, 2-block deep cave space verification, rolling stone-to-ore ratio tracking, spatial vein clustering, and customizable staff alert thresholds.
- **Combat Monitoring:** Real-time combat analysis checking eye-origin reach distance and rolling-window CPS rates with token-bucket violation accumulation.
- **Mining Rate Limiting:** Tick-based break rate auditing with instant/soft block exemptions (foliage, crops, snow layers) and dynamic headroom expansion for Haste effects and Efficiency tools to prevent false Nuker flags during network packet batching.
- **Movement Checks & Grounding:** Mount riding exemptions, Trident Riptide velocity headroom, climbable and non-cubic block grounding (slabs, stairs, scaffolding, cobwebs, fences), and `InvalidSprint` detection.
- **Anti-Cheat Admin Forms:** Interactive dark-mode configuration forms for Combat Rules, Mining Rules, and X-Ray Heuristics in `/panel` -> **Staff Dashboard** -> **Moderation Center**.
- **Combat Tagging:** Automatically tag players entering PvP combat to prevent combat-logging, blocking teleport commands and applying disconnect penalties.
- **Staff Inspection Tools:** Seamlessly view and inspect player inventories (`/sinv`, `/invsee`) and ender chests (`/ecsee`) without disrupting gameplay.
- **World Border Controls (`/wb`, `/worldborder`):** Configurable Overworld, linked Nether (8:1 ratio), and End boundaries with smooth knockback buffers and an admin UI.
- **Chat Management:** Keep global chat clean and organized with `/mutechat`, `/slowmode`, and real-time `/chatlog` monitoring.
- **Social Spy & Private Messaging:** Monitor private messages (`/socialspy`) for server safety and enjoy streamlined direct messaging (`/xmsg`, `/r`).

### ⚡ Performance & Stability

- **Lag Reduction:** Drastically optimized inventory scans, token precomputations, and player lookups for silky-smooth multiplayer performance.
- **Non-Blocking UI Loops:** Interactive mini-games and menu panels now use clean iterative state loops, eliminating menu lag and memory leaks.
- **Fast Anti-Cheat Lookups:** Instant constant-time checks for illegal items and over-enchanted gear across all player equipment and inventory slots.

### ⚙️ Admin & Server Controls

- **Live In-Game Settings Editor (`/panel`):** Modify feature toggles, economy settings, cooldowns, and server parameters directly in-game without world restarts.
- **Enhanced Autocompletion & Feedback:** Autocomplete player names, rank identifiers, and subcommands with clean, informative error and confirmation messages.
- **Zone Selection Wand (`/zonewand`):** Visually define and protect server regions and dimensions with an intuitive wand selector.
