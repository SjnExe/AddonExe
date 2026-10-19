<div align="center">

# AddonExe for Minecraft BE

[![Latest Release](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FSjnExe%2FAddonExe%2Fmain%2Fpackage.json&query=%24.version&prefix=v&label=latest%20version&style=for-the-badge&color=blue)](https://github.com/SjnExe/AddonExe/releases/latest)
[![GitHub All Releases](https://custom-icon-badges.demolab.com/github/downloads/SjnExe/AddonExe/total?style=for-the-badge&logo=github)](https://github.com/SjnExe/AddonExe/releases/latest)
![Minecraft BE Version](https://img.shields.io/badge/Minecraft_BE-Latest-brightgreen?style=for-the-badge&logo=minecraft)
[![GitHub Issues](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Fsearch%2Fissues%3Fq%3Drepo%3ASjnExe%2FAddonExe%2Bis%3Aissue%2Bis%3Aopen&query=%24.total_count&label=issues&style=for-the-badge&logo=github&color=blue)](https://github.com/SjnExe/AddonExe/issues)
[![Discord Server](https://img.shields.io/discord/633296555650318346?style=for-the-badge&logo=discord&logoColor=white&label=Discord&color=7289DA)](https://discord.gg/SMUHUnGyyz)

**A comprehensive, modular server management, economy, moderation, and gameplay suite for Minecraft Bedrock Edition.**

</div>

---

## 🌟 Core Features at a Glance

- 🖥️ **Custom Dark-Mode Server UI (`/panel`):**
    - Adaptive 2-column category hubs, 3-column item shop grids, and 1-column long-text readers styled with a custom dark-mode frame.
    - Permission-aware navigation—regular players see gameplay hubs while moderators and admins see the **Staff Dashboard**.
- 💰 **Full Economy, Shop & Auction House:**
    - Player balances (`/balance`), transfers (`/pay`), leaderboards (`/baltop`), Daily Rewards (`/daily`), and Server Voting (`/vote`).
    - **Server Shop (`/shop`):** 3-column visual item shop with buy/sell quantities, search, rank discounts, `/sellhand`, and a live in-game **Shop Editor**.
    - **Auction House (`/ah`):** Player marketplace with Buy-It-Now (BIN) and Bidding modes, search/sort filters, and a Mailbox collection bin.
    - **Bounties (`/bounty`) & PvP Duels (`/pvp`):** Place bounties on players, challenge others to wagered duels, or configure PvP kill-steal percentages.
    - **Kits (`/kit`, `/addkit`):** Starter and custom kits with cooldowns, prices, and an in-game Kit Editor.
- 🛡️ **Moderation, Anti-Cheat & Security:**
    - Ban/Offline-Ban (`/ban`, `/oban`), Mute (`/mute`), Kick (`/xkick`), Warn (`/warn`), Hard Freeze (`/freeze`), and Staff Vanish (`/vanish`).
    - Inspect inventories & armor (`/invsee`), clone inventories (`/copyinv`), clear inventories (`/xclear`), and wipe Ender Chests (`/ecwipe`).
    - Filterable in-game **Punishment, Anti-Cheat Flag & Chat Logs** (`/logs`, `/chatlog`) and player reporting (`/report`).
    - **Anti-Cheat & X-Ray Detection:** Movement speed/fly checks, illegal item & over-enchanted gear checks, monitored X-Ray ore alerts (`/xraynotify`), and hidden world seed protection.
- 🌍 **Teleportation & World Protection:**
    - Player Homes (`/home`, `/sethome`), Server Warps (`/warp`), TPA/TPAHere (`/tpa`), Random Teleport (`/rtp`), and Back on death/teleport (`/back`).
    - Radius-based **Spawn Protection**, custom 3D **World Protection Zones**, **World Border** (`/worldborder`), **Dimension Locks** (`/netherlock`, `/endlock`), and **Floating Text Holograms** (`/floatingtext`).
- 🤝 **Social, Ranks, HUD & Mini-Games:**
    - **Rank & Permission Engine (`/rank`, `/listranks`):** Customizable ranks with wildcard permissions, chat/nametag formatting, and shop multipliers.
    - **Friends (`/friend`) & Teams/Guilds (`/team`, `/teamchat`):** Friend lists with quick TPA, plus Teams with shared bank balances and team homes.
    - **Scoreboard Sidebar & Action Bar HUD (`/sidebar`):** Customizable live server/player stats display.
    - **Wordle Mini-Game (`/wordle`, `/guess`):** Single-player and staff-hosted global Wordle games with prize pools.

---

## 🚀 Quick Installation & Setup

1. **Download:** Grab the latest `.mcaddon` release from [GitHub Releases](https://github.com/SjnExe/AddonExe/releases/latest) and open it in Minecraft.
2. **Apply Packs:** Activate **AddonExeBP** (at the top of Behavior Packs) and **AddonExeRP** (in Resource Packs) on your world.
3. **Enable Required World Settings:**
    - Turn ON **Activate Cheats** (_Game_ settings).
    - Turn ON **Beta APIs** (_Experiments_ settings).
4. **Become Server Owner:** Join the world and run:
    ```text
    /function owner
    ```
    _(Or run `/tag @s add owner` followed by `/xreload`.)_
5. **Configure & Enable Features:** Run `/panel` -> **Staff Dashboard** -> **Addon Configuration** -> **Master Feature Toggles** to enable Economy, Shop, Kits, and other optional modules.

---

## 📖 Documentation Hub

- 📜 [**Commands Reference**](docs/commands.md) — Every member, moderator, and admin slash command.
- ✨ [**Features Overview**](docs/features-overview.md) — Detailed breakdown of all systems and modules.
- ⚙️ [**Configuration Guide**](docs/configuration-guide.md) — In-game config editor, `/xreload` merging, and config files.
- 🏅 [**Rank & Permission System**](docs/rank-system.md) — Ranks, permission wildcards, and chat/nametag styling.
- ❓ [**F.A.Q.**](docs/faq.md) & 🛠️ [**Troubleshooting Guide**](docs/troubleshooting.md) — Solutions to common setup questions.
- 💻 [**Developer Guide**](Dev/README.md) & [**Agent Instructions**](AGENTS.md) — Architecture, build scripts, and coding standards.

---

## 🤝 Contributing & License

Contributions, bug reports, and feature requests are welcome! Please read our [Contributing Guide](.github/CONTRIBUTING.md).

Licensed under the [MIT License](LICENSE).
