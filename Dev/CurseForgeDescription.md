<div align="center">

# AddonExe for Minecraft BE

**A complete, modular server management, economy, moderation, and gameplay suite for Minecraft Bedrock Edition!**

</div>

---

## ✨ Why Choose AddonExe?

- **Custom Dark-Mode Server UI (`/panel`):** Navigate 2-column category hubs, a 3-column item shop, and 1-column text readers—all styled natively with dark borders and buttons.
- **Complete Economy & Market Suite:** Player balances, transfers (`/pay`), leaderboards (`/baltop`), GUI Shop (`/shop`), player-to-player Auction House (`/ah`), Bounty Board (`/bounty`), Daily Rewards (`/daily`), Kits (`/kit`), and PvP Wager Duels (`/pvp`).
- **Moderation & Anti-Cheat:** Ban/Offline-Ban, Mute, Kick, Hard Freeze (via input permissions), Inventory & Ender Chest inspection (`/invsee`, `/copyinv`, `/ecwipe`), Vanish (`/vanish`), Player Reports (`/report`), Chat/Flag/Punishment Logs (`/logs`), Movement & Illegal Item Anti-Cheat, and X-Ray Detection (`/xraynotify`).
- **Teleportation & World Management:** Homes (`/home`, `/sethome`), Server Warps (`/warp`), TPA/TPAHere (`/tpa`), Random Teleport (`/rtp`), Back on death/teleport (`/back`), Spawn Protection, custom World Protection Zones, World Border (`/worldborder`), Dimension Locks (`/netherlock`, `/endlock`), and Floating Text Holograms (`/floatingtext`).
- **Social, Ranks & Mini-Games:** Granular Rank & Permission system (`/rank`), Friends UI (`/friend`), Teams/Guilds with shared bank and team home (`/team`), customizable Scoreboard Sidebar & Action Bar HUD (`/sidebar`), and single-player / staff-hosted **Wordle** (`/wordle`, `/guess`).

---

## 🚀 Installation & Setup

1. **Download:** Grab the latest `.mcaddon` file from [GitHub Releases](https://github.com/SjnExe/AddonExe/releases/latest).
2. **Import & Apply:** Open the `.mcaddon` file in Minecraft and activate both **AddonExeBP** (at the top of Behavior Packs) and **AddonExeRP** (in Resource Packs) on your world.
3. **Required World Settings:**
    - Enable **Activate Cheats** under _Game_.
    - Enable **Beta APIs** under _Experiments_.

---

## 👑 Granting Owner & Admin Access

Once in-game with operator/cheat permissions:

1. **Become Server Owner:** Run `/function owner` (or `/tag @s add owner`).
2. **Grant Ranks to Staff:** Open `/panel` -> **Staff Dashboard** -> **Player Management**, or run:
    ```text
    /rank set "PlayerName" admin
    /rank set "PlayerName" moderator
    ```
3. **Enable Optional Modules:** Economy, Shop, Auction House, Kits, and Daily Rewards are disabled by default so you can configure them first. Enable them anytime in `/panel` -> **Staff Dashboard** -> **Addon Configuration** -> **Master Feature Toggles**.

---

## 📖 Documentation & Support

- [Full Features Overview](https://github.com/SjnExe/AddonExe/blob/main/Docs/FeaturesOverview.md)
- [Commands Reference](https://github.com/SjnExe/AddonExe/blob/main/Docs/Commands.md)
- [Configuration Guide](https://github.com/SjnExe/AddonExe/blob/main/Docs/ConfigurationGuide.md)
- [Rank & Permission System](https://github.com/SjnExe/AddonExe/blob/main/Docs/RankSystem.md)
- [Troubleshooting](https://github.com/SjnExe/AddonExe/blob/main/Docs/Troubleshooting.md) & [F.A.Q.](https://github.com/SjnExe/AddonExe/blob/main/Docs/F.A.Q.md)
- **Community Support:** [Join our Discord Server](https://discord.gg/SMUHUnGyyz)
