# Troubleshooting Guide - AddonExe

This guide helps you resolve common issues you might encounter with AddonExe. For answers to common setup questions, **please check the [Frequently Asked Questions](F.A.Q.md) first!**

If your issue isn't listed in the F.A.Q. or this guide, please consider [reporting an issue](https://github.com/SjnExe/AddonExe/issues) with as much detail as possible.

---

## Table of Contents

1. [Installation Issues](#1-installation-issues)
2. [Configuration & Permission Problems](#2-configuration--permission-problems)
3. [Commands Not Working](#3-commands-not-working)
4. [Admin UI (`/panel`) Issues](#4-admin-ui-panel-issues)
5. [General Tips](#5-general-tips)
6. [Reporting Bugs Effectively](#6-reporting-bugs-effectively)

---

## 1. Installation Issues

**Problem: The addon doesn't seem to be working at all.**

- **Behavior Pack Order:** Ensure `AddonExeBP` is at the **VERY TOP** of your Behavior Pack list in your world settings. This is the most common cause of issues.
- **Resource Pack Applied:** Make sure `AddonExeRP` is also applied in the Resource Pack section of your world settings.
- **Enable Cheats & Beta APIs:** In your World Settings, ensure both **"Activate Cheats"** (under the "Game" tab) and **"Beta APIs"** (under the "Experiments" tab) are turned ON.
- **Correct Files:** Double-check you've downloaded the latest `.mcaddon` file from the official [GitHub Releases](https://github.com/SjnExe/AddonExe/releases/latest) and applied both packs from it.

**Problem: World fails to load or crashes on load after adding AddonExe.**

- **Pack Order:** Again, verify `AddonExeBP` is at the top.
- **Corrupted Download:** Try re-downloading and reapplying the addon.
- **Addon Conflict:** See [General Tips](#5-general-tips) for testing addon conflicts.

---

## 2. Configuration & Permission Problems

**Problem: I'm not recognized as the Owner after editing `config.js`.**

This is the most common setup issue. The key is understanding that the addon's configuration is loaded when the server starts, but the Owner rank might not update automatically if it was already set to someone else.

**Solution:**

1.  **Stop your server.**
2.  **Open the correct file:** `AddonExeBP/scripts/config.js`.
3.  **Add your name:** Find the `ownerPlayerNames` setting and add your **exact**, case-sensitive in-game name.
4.  **Save and restart your server.**
5.  **Run the reload command:** Once you are in-game, run the command `/xreload`. This will force the addon to sync the owner name from the file and apply the rank.

For a quick summary, see the [F.A.Q.](F.A.Q.md#how-do-i-change-the-server-owner).

**Problem: An admin player doesn't have their rank.**

- **Check the `adminTag`:** In `config.js`, verify the `adminTag` value (e.g., `"admin"`).
- **Apply the tag in-game:** Make sure you have given the player the correct tag using `/tag "PlayerName" add admin`.
- **Check for overrides:** The Owner rank will always override the Admin rank. Ensure the player is not also listed in the `ownerPlayerNames`.

**Problem: Changes I made to `config.js` aren't taking effect.**

- **Editing Correct File:** Ensure you are editing the `config.js` within the `AddonExeBP` (Behavior Pack) and not a stray copy.
- **Re-Applying Packs:** If you edit `config.js` _after_ the pack is already applied to a world, Minecraft might not always pick up the changes immediately. The most reliable way is to:
    1. Remove `AddonExeBP` and `AddonExeRP` from your world.
    2. Make your changes to `config.js` in your source/downloaded pack.
    3. Re-import the modified `.mcaddon` or re-apply the modified packs to your world.
- **Server vs. Local:** If on a server, ensure the server has fully restarted after updating the pack files.

---

## 3. Commands Not Working

**Problem: Commands like `/xhelp` or `/panel` do nothing.**

1.  **Check Installation:** First, double-check all steps in the [Installation Issues](#1-installation-issues) section. If the addon isn't running, commands won't work.
2.  **Check Permissions:**
    - Admin commands (like `/kick`, `/ban`) require appropriate permissions. Ensure you are set up correctly as an Owner or Admin. (See [Configuration & Permission Problems](#2-configuration--permission-problems)).
    - Use `/xhelp` to see the commands available to your rank.
3.  **Check if Command is Disabled:** In `config.js`, there is a `commandSettings` section. Verify that the command you are trying to use is not set to `enabled: false`.
4.  **Check for Typos:** Ensure you're typing the command correctly.

**Problem: The `/baltop` command is slow or seems to lag the first time it's run.**

- **This is expected on first use.** The first time `/baltop` is run on a world, the addon needs to scan every player file to generate the leaderboard cache. This can take a few seconds on servers with a very large player history.
- **Subsequent uses will be instant.** After the initial scan, the leaderboard is cached and will be extremely fast to access. This one-time scan is necessary to include offline players in the leaderboard.

---

## 4. Admin UI (`/panel`) Issues

**Problem: `/panel` command doesn't open the UI, or the UI is broken.**

- **Resource Pack:** The UI relies on `AddonExeRP`. Ensure it's applied and active.
- **Permissions:** You need to be Owner or have an Admin rank with UI permissions.
- **Scripting Errors:** If there are underlying scripting errors in the addon (possibly from a bad update or conflict), the UI might fail to load. This would usually show errors in the in-game content log if accessible.
- **Minecraft UI Bugs:** Rarely, Minecraft's UI rendering can have temporary glitches. Try closing and reopening the game or world.

> [!NOTE]
> **Cheat Detections Are a Future Feature**
> The cheat detection and auto-moderation systems from the original addon are not included in this version and are being re-developed. Any issues related to false positives or detections not working are not applicable to this version of the addon.

---

## 5. General Tips

- **Restart:** Sometimes, simply restarting your Minecraft client, server, or world can resolve temporary glitches.
- **Check Minecraft Version:** Ensure your AddonExe version is designed for your current Minecraft Bedrock Edition version. Check the [GitHub Releases](https://github.com/SjnExe/AddonExe/releases/latest) page.
- **Test with No Other Addons:** To rule out addon conflicts, try running AddonExe on a test world with _no other Behavior Packs or Resource Packs_ applied. If it works fine, then another addon is likely causing the issue. You can then add your other addons back one by one to find the culprit.
- **Check for Updates:** Make sure you are using the latest version of AddonExe.

---

## 6. Reporting Bugs Effectively

If you've tried these steps and are still facing issues, please help us by reporting the bug. The more information you provide, the faster we can help.

- **AddonExe Version:** Specify the version you are using (e.g., v1.2.0).
- **Minecraft Version:** Specify your Minecraft Bedrock version (e.g., 1.20.80).
- **Clear Description:** What is the problem? What did you expect to happen?
- **Steps to Reproduce:** Provide a clear, step-by-step list of actions to trigger the bug.
- **Screenshots/Videos:** Visual proof can be very helpful.
- **Relevant Configuration:** If the issue is related to a specific setting, share your relevant configuration from `config.js` or `ranksConfig.js`.
- **Error Messages (If Any):** If you see any error messages on screen or in logs (like the Content Log viewer if you have access), please include them.
- **Other Addons:** List any other behavior packs you are using.

**Where to Report:** [GitHub Issues Page](https://github.com/SjnExe/AddonExe/issues)

---

Thank you for using AddonExe!
