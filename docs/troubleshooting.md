# Troubleshooting Guide - AddonExe

For quick setup questions, check the [Frequently Asked Questions (F.A.Q.)](faq.md) first.

---

## 1. Installation & Startup Issues

**Problem: Slash commands (`/panel`, `/xhelp`) do not appear or do nothing.**

- **Enable Cheats & Beta APIs:** Open your World Settings -> _Game_ -> enable **Activate Cheats**, then go to _Experiments_ -> enable **Beta APIs**.
- **Pack Load Order:** Place **AddonExeBP** at the very top of your Behavior Packs list and ensure **AddonExeRP** is active in Resource Packs.
- **Check Content Log:** Enable **Content Log GUI** and **Content Log File** in Minecraft _Settings -> Creator_ to inspect any startup errors.

---

## 2. Permission & Rank Issues

**Problem: I cannot see the Staff Dashboard in `/panel` or run admin commands.**

1. Run `/function owner` or `/tag @s add owner` in chat (requires operator/cheats enabled).
2. Run `/xreload` to immediately re-evaluate online player ranks.
3. For other staff members, grant them a staff rank using `/rank set "PlayerName" admin` or `/rank set "PlayerName" moderator`.

---

## 3. Feature & Command Questions

**Problem: `/shop`, `/ah`, `/pay`, or `/kit` says the system is disabled globally.**

- Economy and its sub-modules are disabled by default on new worlds.
- Open `/panel` -> **Staff Dashboard** -> **Addon Configuration** -> **Master Feature Toggles**, enable **Enable Economy** and the desired sub-systems, and click **Save Settings**.

**Problem: Vanilla commands like `/clear`, `/gamemode`, `/kick`, or `/help` run Minecraft's built-in command instead of AddonExe's.**

- AddonExe prefixes conflicting slash commands with `x`: use **`/xclear`**, **`/xgamemode`** (or `/gms`, `/gmc`), **`/xkick`**, **`/xhelp`**, **`/xreload`**, and **`/xsave`**.

**Problem: A player is stuck unable to move or take damage after leaving spawn.**

- Have the player run **`/fixplayer`** (or run `/unfreeze <player>` as staff) to reset their spawn protection and movement flags.

---

## 4. UI (`/panel`) Issues

**Problem: The UI panel looks like the default light-gray vanilla form or buttons do not render properly.**

- Confirm **AddonExeRP** is active in your world's Resource Packs and placed above other UI packs that modify `ui/server_form.json`.
- Fully close and relaunch the world after updating the Resource Pack so Minecraft reloads `server_form.json`.

---

## 5. Reporting Bugs

If an issue persists, open a report on the [GitHub Issues Page](https://github.com/SjnExe/AddonExe/issues) with:

- Your Minecraft Bedrock version and AddonExe version (`/version`).
- Exact steps to reproduce.
- Any `[Scripting][error]` or `[UI][error]` lines from the Creator Content Log.
