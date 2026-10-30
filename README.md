<div align="center">

# AddonExe for Minecraft BE

</div>
<div align="center">

[![Latest Release](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FSjnExe%2FAddonExe%2Fmain%2Fpackage.json&query=%24.version&prefix=v&label=latest%20version&style=for-the-badge&color=blue)](https://github.com/SjnExe/AddonExe/releases/latest)
[![GitHub All Releases](https://custom-icon-badges.demolab.com/github/downloads/SjnExe/AddonExe/total?style=for-the-badge&logo=github)](https://github.com/SjnExe/AddonExe/releases/latest)
![Minecraft BE Version](https://img.shields.io/badge/Minecraft_BE-26.20.0%2B-brightgreen?style=for-the-badge&logo=minecraft)
[![GitHub Issues](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github.com%2Fsearch%2Fissues%3Fq%3Drepo%3ASjnExe%2FAddonExe%2Bis%3Aissue%2Bis%3Aopen&query=%24.total_count&label=issues&style=for-the-badge&logo=github&color=blue)](https://github.com/SjnExe/AddonExe/issues)
[![Status: Stable Release](https://img.shields.io/badge/Status-Stable%20Release-green?style=for-the-badge)](https://github.com/SjnExe/AddonExe/releases/latest)
[![Discord Server](https://img.shields.io/discord/633296555650318346?style=for-the-badge&logo=discord&logoColor=white&label=Discord&color=7289DA)](https://discord.gg/SMUHUnGyyz)

</div>

> [!WARNING]
> **Do not use pre-release versions for public servers.**
>
> Pre-releases are intended for development and testing purposes only. They may be unstable, contain bugs, or cause unintended issues. For the best experience, please use the [latest stable release](https://github.com/SjnExe/AddonExe/releases/latest).

> [!NOTE]
> **Always Use the Latest Version**
> This addon is designed for and tested on the **latest stable version of Minecraft Bedrock Edition**. It is intended for servers and realms that are kept up-to-date. Support for older versions of Minecraft is not maintained.

---

<div align="center">

**The ultimate scripting-based solution for your Minecraft Bedrock Edition world!**
Designed to be robust, highly configurable, and packed with features to ensure fair and fun gameplay.

</div>

---

## ✨ Why Choose AddonExe?

- **Scripting Power:** Built entirely with the Minecraft Scripting API, offering flexibility and complex detection logic not always possible with traditional methods.
- **Comprehensive Detection (Under Redevelopment):** While currently a powerful moderation tool, a full suite of cheat detections is being redesigned and will be re-introduced in a future update.
- **User-Friendly Tools:** Manage your server with ease using an intuitive in-game UI (`/panel`) and extensive slash commands, which can be used in-game or from the server console.
- **Highly Customizable:** Fine-tune almost every aspect, from feature toggles to command permissions, to perfectly suit your server's needs.
- **Active Development:** Continuously updated with new features, improvements, and compatibility for the latest Minecraft versions.
- **Open & Documented:** With clear documentation and an open codebase, understand how it works and even contribute!
- **Enhanced Stability & Safety:** Includes robust error handling, transaction safety logic to prevent economy exploits, and a watchdog to prevent script-related server crashes.

---

## 🌟 Core Features at a Glance

This addon is packed with features to keep your server clean:

- 🛠️ **Powerful Admin & Moderation Tools:**
    - A universal, dynamic in-game UI panel that shows each player only the buttons they are permitted to see. The panel item can be crafted by anyone, or spawned directly with the admin-only `/panel` command.
    - **Enhanced Player Management Panel:**
        - View online players, sorted by rank and name.
        - Player names are clearly marked with `(Owner)`, `(Admin)`, and `(You)` suffixes.
        - Perform a wide range of actions: Kick, Ban/Unban, Mute/Unmute, Freeze, View/Clear Inventory, Teleport.
    - **New Commands:** `/xclear` (clear inventory), `/ecwipe` (wipe ender chest), `/invsee` (view inventory).
    - Extensive slash commands for all administrative functions.
- 💾 **Persistent Player Data Management:**
    - Mutes and bans are saved across player sessions using dynamic properties.
- ⚙️ **Highly Configurable System:**
    - Toggle major features, customize messages, and define all permissions and ranks in easy-to-edit configuration files.
- 🏅 **Flexible Rank System:**
    - Define Owner, Admin, Member, and custom roles with specific permissions and visual chat/nametag prefixes.
- 📞 **Teleport Request System (TPA/TPAHere):**
    - Allows players to request teleports to others or summon others, with configurable cooldowns and warmup periods.
- ✨ **Player & Server Utilities:**
    - **Economy & Bounties:** A simple economy system with player balances, payment commands, and a full bounty system.
    - **In-Game Shop:** A fully-featured, GUI-based shop where players can buy and sell items. Admins can configure all items and prices from an in-game panel.
    - **Homes:** Allows players to set and teleport to their own personal "homes".
    - **Mini-Games:** Includes built-in games like Tic Tac Toe (with a custom 3x3 Grid UI) and more to come.
    - **Random Teleport (RTP):** A command for players to teleport to a random, safe location in the world.
    - **Kits:** A system for players to claim predefined kits of items with cooldowns.

> [!NOTE]
> **Cheat Detection Suite (Under Redevelopment)**
> A comprehensive suite of cheat detections is being redesigned and will be re-introduced in a future update. The old system has been removed to ensure stability.

➡️ **Dive Deeper:** For a full list and details of all features, check out our [**Features Overview in the Docs**](Docs/FeaturesOverview.md)!

---

## 🚀 Installation

For a standard installation, follow these steps:

1.  **Download:** Grab the latest `.mcaddon` file from our [**GitHub Releases**](https://github.com/SjnExe/AddonExe/releases/latest).
    - **Stable Releases:** Best for public servers.
    - **Nightly Builds:** Available in the "Nightly" tag, containing the absolute latest changes (potentially unstable).
2.  **Install:** Open the `.mcaddon` file with Minecraft. It will automatically install both the Behavior Pack and Resource Pack.
3.  **Apply to Your World:**
    - Open Minecraft and go to your world's settings.
    - Apply both `AddonExeBP` and `AddonExeRP` to your world. Make sure the Behavior Pack is at the **top** of the list.
4.  **Enable World Settings (CRITICAL!):**
    - In "Game" settings, enable **"Activate Cheats"**.
    - In the "Experiments" section, enable the **"Beta APIs"** toggle.

    > **For Bedrock Dedicated Server (BDS) users:**
    >
    > - You must also edit your `server.properties` file and set `allow-cheats=true`.

5.  **Configure:** Once in-game, you can configure most of the addon's features via the `/panel` command or by editing the configuration files directly.

---

## 🔧 Configuration

AddonExe is designed to be highly customizable. There are two main ways to configure the addon, depending on your needs.

### 1. In-Game Configuration (Recommended for most users)

- **Admin Panel:** The easiest way to configure the addon is through the in-game UI. As an Owner or Admin, type `/panel` to open the main configuration menu.
- **Live Reloading:** Changes made in the panel are applied instantly. For manual file changes, they are safely merged and applied after using the `/reload` or `/xreload` commands.

### 2. File-Based Configuration (For developers and advanced users)

This method is ideal for those who fork the repository to make their own custom versions, as it prevents merge conflicts with future updates.

1.  **Fork the Repository:** Start by forking the [AddonExe repository](https://github.com/SjnExe/AddonExe).
2.  **Locate Configs:** Inside the `src/` and `src/features/` directories, you will find several configuration files ending in `.ts` (e.g., `config.ts`, `economyConfig.ts`). These are the primary settings files.
3.  **Customize:** Open the `config.ts` file (or any feature configuration file) and make any changes you desire.
4.  **Build:** Run `bun run build` to compile your changes into the `packs/behavior` folder.

**How it Works:**

- When you build the addon, the system will compile these configuration files directly.

<details>
<summary><strong>💡 Quick Troubleshooting Tips & Full Guide</strong></summary>

Common quick checks:

- **Enable Cheats & Beta APIs:** Make sure both "Activate Cheats" and the "Beta APIs" experimental toggle are ON in your world settings.
- Ensure `AddonExeBP` is at the very top of your behavior packs.
- Verify you have added your exact, case-sensitive name to the `ownerPlayerNames` array in `config.js`.
- Check Minecraft version compatibility (see badge above).
- Test for conflicts with other addons, especially those modifying player behavior.

➡️ For a comprehensive guide, see our [**Troubleshooting Guide**](Docs/Troubleshooting.md).

If problems persist after checking the guide, please [report an issue](https://github.com/SjnExe/AddonExe/issues)!

</details>

---

## 📖 Documentation Hub

All detailed information has been moved to our `Docs` folder for clarity:

- 📜 [**Commands List**](Docs/Commands.md) - Every command for players and admins.
- 🏅 [**Rank System**](Docs/RankSystem.md) - How to configure and use ranks.
- ✨ [**Full Features Overview**](Docs/FeaturesOverview.md) - A detailed breakdown of all addon features.
- ⚙️ [**Configuration Guide**](Docs/ConfigurationGuide.md) - In-depth look at `config.js` and other settings.

---

## Performance Considerations

This addon is designed to be as lightweight as possible. However, performance can be influenced by the number of checks enabled, their sensitivity, and the server's player count. We recommend starting with default configurations and adjusting based on your server's needs.

For developers, the addon includes a basic performance profiling feature that can be enabled in `config.js` to help identify potential bottlenecks. For more details, see the [**Developer README**](Dev/README.md).

---

## 🤝 Contributing

Contributions are highly welcome and appreciated! Help us make this addon even better.

**Project Philosophy:** Our goal is to keep this addon clean, universal, and easy to maintain. A planned future feature is full internationalization (i18n) support.

**Review Process:** All contributions will be reviewed by SjnExe or Jules AI assistant to ensure they align with the project's goals and coding standards.

**Crediting:** Please note that contributions are generally not credited directly in the codebase. Significant contributions will be acknowledged in the project's changelog or a dedicated contributors file.

- **Fork & Branch:** Create your own fork and make changes in a dedicated branch.
- **Code Style:** Follow our 📄 [**Coding Style Guide**](Dev/CodingStyle.md).
- **Test Thoroughly:** Ensure your changes are stable and don't introduce new issues.
- **Document Changes:** Update relevant documentation in the `Docs` folder if you add or modify features.
- **Pull Request:** Submit your changes for review. Explain what you've changed and why.

Looking for a place to start? Check out our [**issues tab**](https://github.com/SjnExe/AddonExe/issues) – we often tag issues that are great for new contributors.

➡️ For more on development processes, see our [**Developer README**](Dev/README.md).

---

## ❤️ Acknowledgements & Contributors

This addon was developed by SjnExe with significant assistance from Jules, an AI software engineer.

This project is also made possible by the community and all the developers who dedicate their time to contribute. We are incredibly grateful for every contribution, from reporting issues and suggesting new ideas to writing code and improving documentation.

➡️ You can see a list of code contributors on [**GitHub**](https://github.com/SjnExe/AddonExe/graphs/contributors).

---

<div align="center">

## ⚖️ License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

In the spirit of open source, you are free to use, modify, and distribute this code with or without credit to SjnExe.

</div>
Thank you for using AddonExe!
We hope it helps create a fairer and more enjoyable Minecraft experience for your community.
