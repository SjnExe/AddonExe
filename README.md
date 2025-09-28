<div align="center">
  
# AddonExe for Minecraft BE
</div>
<div align="center">

[![Latest Release](https://img.shields.io/github/v/release/SjnExe/AddonExe?label=latest%20version&display_name=tag&style=for-the-badge)](https://github.com/SjnExe/AddonExe/releases/latest)
[![GitHub All Releases](https://img.shields.io/github/downloads/SjnExe/AddonExe/total?style=for-the-badge)](https://github.com/SjnExe/AddonExe/releases/latest)
![Minecraft BE Version](https://img.shields.io/badge/Minecraft_BE-1.21.100%2B-brightgreen?style=for-the-badge&logo=minecraft)
[![GitHub Issues](https://img.shields.io/github/issues/SjnExe/AddonExe?style=for-the-badge&logo=github)](https://github.com/SjnExe/AddonExe/issues)
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
- **User-Friendly Tools:** Manage your server with ease using an intuitive in-game UI (`/panel`) and extensive slash commands, which can be used in-game, from the server console, or via a chat-based fallback (e.g. `!panel`).
- **Highly Customizable:** Fine-tune almost every aspect, from feature toggles to command permissions, to perfectly suit your server's needs.
- **Active Development:** Continuously updated with new features, improvements, and compatibility for the latest Minecraft versions.
- **Open & Documented:** With clear documentation and an open codebase, understand how it works and even contribute!
- **Enhanced Stability:** Includes robust error handling and a watchdog to prevent script-related server crashes, ensuring a more stable experience.

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
  - Extensive slash commands for all administrative functions (Note: a `!` prefix is available as a fallback).
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
  - **Random Teleport (RTP):** A command for players to teleport to a random, safe location in the world.
  - **Kits:** A system for players to claim predefined kits of items with cooldowns.

> [!NOTE]
> **Cheat Detection Suite (Under Redevelopment)**
> A comprehensive suite of cheat detections is being redesigned and will be re-introduced in a future update. The old system has been removed to ensure stability.

➡️ **Dive Deeper:** For a full list and details of all features, check out our [**Features Overview in the Docs**](Docs/FeaturesOverview.md)!

---

## 🚀 Installation & Setup

We recommend the following manual installation method, as it makes future configuration much easier.

1.  **Download:** Grab the latest `.mcaddon` file from our [**GitHub Releases**](https://github.com/SjnExe/AddonExe/releases/latest).
2.  **Extract the Packs (Recommended Method):**
    - Do **not** open the `.mcaddon` file directly. Instead, rename it to end in `.zip` (e.g., `AddonExe.mcaddon` -> `AddonExe.zip`).
    - Unzip the file. Inside, you will find two folders: `AddonExeBP` (the Behavior Pack) and `AddonExeRP` (the Resource Pack).
    - Move these two folders into your Minecraft's `behavior_packs` and `resource_packs` folders, respectively.
    > **Why this method?** Installing the folders directly makes it simple to find and edit the `config.js` file later. Installing a sealed `.mcpack` or `.mcaddon` makes configuration much more difficult.
3.  **Apply to Your World:**
    - Open Minecraft and go to your world's settings.
    - Apply both `AddonExeBP` and `AddonExeRP` to your world.
4.  **Enable World Settings (CRITICAL!):**
    - In your world settings, go to the "Game" section and enable **"Activate Cheats"**. This is required for slash commands to work.
    - Next, go to the "Experiments" section and **enable the "Beta APIs" toggle.** This addon relies on beta Minecraft Scripting API features and will not function without this setting enabled.
    > **For Bedrock Dedicated Server (BDS) users:**
    > - You must also edit your `server.properties` file and set `allow-cheats=true`.
    > - Commands can be run directly from the server console using the leading slash (e.g., `/xreload`). See the [Commands List](Docs/Commands.md) for more details.
5.  **Prioritize:** Ensure `AddonExeBP` is at the **TOP** of your behavior pack list in the world settings. This is crucial for AddonExe to function correctly.
6.  **👑 Set Owner(s) (CRUCIAL!):**
    - Now that you've installed the folders, navigate to `behavior_packs/AddonExeBP/scripts/` and open `config.js` in a text editor.
    - Find the `ownerPlayerNames` setting.
    - Add your **exact** in-game name (case-sensitive) to the array. You can add multiple owner names.
      ```javascript
      // Example in AddonExeBP/scripts/config.js
      ownerPlayerNames: ['YourNameHere', 'AnotherOwnerName'],
      ```
    - To apply changes made to `config.js` on a live server, you must use Minecraft's vanilla `/reload` command after saving the file. This reloads all behavior packs and applies your file modifications.
    - **Note:** Failure to set an owner will not lock you out. Admin permissions can still be granted via the `/function admin` command or by giving a player the `admin` tag.
7.  **🎮 Explore:** Join your world and open the Admin UI. Admins can get the panel item directly by typing `/panel`. Any player can also craft the item using a single stick.
8.  **🔧 Configure (Optional but Recommended):**
    - Review `AddonExeBP/scripts/config.js` for other core settings (like the chat command `prefix`).
    - For detailed setup and advanced options, visit our [**Setup and Configuration Guide**](Docs/ConfigurationGuide.md).

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
