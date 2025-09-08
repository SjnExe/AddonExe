# AddonExe for Minecraft BE

**The ultimate scripting-based solution for your Minecraft Bedrock Edition world!** Designed to be robust, highly configurable, and packed with features to ensure fair and fun gameplay.

---

## ✨ Why Choose AddonExe?

- **Scripting Power:** Built entirely with the Minecraft Scripting API, offering flexibility and complex detection logic not always possible with traditional methods.
- **User-Friendly Tools:** Manage your server with ease using an intuitive in-game UI (`/panel`) and extensive slash commands.
- **Highly Customizable:** Fine-tune almost every aspect, from feature toggles to command permissions, to perfectly suit your server's needs.
- **Active Development:** Continuously updated with new features, improvements, and compatibility for the latest Minecraft versions.
- **Open & Documented:** With clear documentation and an open codebase, understand how it works and even contribute!
- **Enhanced Stability:** Includes robust error handling to prevent script-related server crashes.

---

## 🌟 Core Features

- 🛠️ **Powerful Admin & Moderation Tools:**
  - A universal, dynamic in-game UI panel (`/panel`) that shows each player only the buttons they are permitted to see.
  - Perform a wide range of actions: Kick, Ban/Unban, Mute/Unmute, Freeze, View/Clear Inventory, Teleport.
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
  - **Economy & Bounties:** A simple economy system with player balances, payment commands, and a full bounty system. Includes a high-performance, cached `/baltop` leaderboard.
  - **Homes:** Allows players to set and teleport to their own personal "homes".
  - **Kits:** A system for players to claim predefined kits of items with cooldowns.
  - **Death Coordinates:** Automatically informs players of their death location upon respawning.

➡️ **For a full list and details of all features, check out our [Features Overview](https://github.com/SjnExe/AddonExe/blob/exe/Docs/FeaturesOverview.md)!**

---

## 🚀 Installation & Setup

We recommend the following manual installation method, as it makes future configuration much easier.

### For All Platforms (Windows, iOS, Android)

1.  **Download:** Grab the latest `.mcaddon` file from the [**GitHub Releases**](https://github.com/SjnExe/AddonExe/releases).
2.  **Extract the Packs:**
    - Do **not** open the `.mcaddon` file directly. Instead, rename it to end in `.zip` (e.g., `AddonExe.mcaddon` -> `AddonExe.zip`).
    - Unzip the file. Inside, you will find two folders: `AddonExeBP` (the Behavior Pack) and `AddonExeRP` (the Resource Pack).
    - Move these two folders into your Minecraft's `behavior_packs` and `resource_packs` folders, respectively.
    > **Why this method?** Installing the folders directly makes it simple to find and edit the `config.js` file later.
3.  **Apply to Your World:**
    - Open Minecraft and go to your world's settings.
    - Apply both `AddonExeBP` and `AddonExeRP` to your world.
4.  **Enable World Settings (CRITICAL!):**
    - In your world settings, go to the "Game" section and enable **"Activate Cheats"**.
    - Next, go to the "Experiments" section and **enable the "Beta APIs" toggle.** The addon will not function without this setting.
5.  **Prioritize:** Ensure `AddonExeBP` is at the **TOP** of your behavior pack list in the world settings.

### For Bedrock Dedicated Server (BDS)

Follow steps 1 & 2 above, then:
1.  **Place the Pack Folders:**
    -   Move the extracted `AddonExeBP` and `AddonExeRP` folders into your BDS's `behavior_packs` and `resource_packs` folders.
2.  **Activate the Packs:**
    -   Download the following two files from the root of the repository:
        -   [**`world_behavior_packs.json`**](https://github.com/SjnExe/AddonExe/blob/exe/world_behavior_packs.json)
        -   [**`world_resource_packs.json`**](https://github.com/SjnExe/AddonExe/blob/exe/world_resource_packs.json)
    -   Place both of these files into the root folder of your world (the same folder that contains your `level.dat`).
3.  **Enable Beta APIs:**
    -   The easiest method is to download your world, open it in a local version of Minecraft, enable the "Beta APIs" experiment, and then re-upload the world to your server.

---

## 👑 Initial Configuration (CRUCIAL!)

After installing, you **must** set yourself as the owner to access admin commands.

1.  Navigate to `behavior_packs/AddonExeBP/scripts/` and open `config.js` in a text editor.
2.  Find the `ownerPlayerNames` setting.
3.  Add your **exact** in-game name (case-sensitive) to the array.
    ```javascript
    // Example in AddonExeBP/scripts/config.js
    ownerPlayerNames: ['YourNameHere', 'AnotherOwnerName'],
    ```
4.  Save the file. If your server is live, run the `/reload` command in-game.

➡️ For a detailed guide on all settings, see our [**Configuration Guide**](https://github.com/SjnExe/AddonExe/blob/exe/Docs/ConfigurationGuide.md).

---

## 📖 Full Documentation & Support

- 📜 [**Commands List**](https://github.com/SjnExe/AddonExe/blob/exe/Docs/Commands.md) - Every command for players and admins.
- 🏅 [**Rank System**](https://github.com/SjnExe/AddonExe/blob/exe/Docs/RankSystem.md) - How to configure and use ranks.
- ❓ [**F.A.Q.**](https://github.com/SjnExe/AddonExe/blob/exe/Docs/F.A.Q.md) - Answers to common questions.
- 🛠️ [**Troubleshooting Guide**](https://github.com/SjnExe/AddonExe/blob/exe/Docs/Troubleshooting.md) - Solutions for common problems.

### Need Help?
- **Join our [Discord Server](https://discord.gg/SMUHUnGyyz)** for community support.
- **Report Bugs** on our [GitHub Issues Page](https://github.com/SjnExe/AddonExe/issues).

---

## ⚖️ License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/SjnExe/AddonExe/blob/exe/LICENSE) file for details.
