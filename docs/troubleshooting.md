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
- Open `/panel` -> **Staff Dashboard** -> **Addon Configuration** -> **System Configs** -> **Economy Settings**, enable **Enable Economy** (and any desired sub-systems), and click **Save Settings**.

**Problem: Vanilla commands like `/clear`, `/gamemode`, `/kick`, or `/help` run Minecraft's built-in command instead of AddonExe's.**

- AddonExe prefixes conflicting slash commands with `x`: use **`/xclear`**, **`/xgamemode`** (or `/gms`, `/gmc`), **`/xkick`**, **`/xhelp`**, **`/xreload`**, and **`/xsave`**.

**Problem: A player is stuck unable to move after staff moderation.**

- Run `/unfreeze <player>` as staff to clear their movement lock.

---

## 4. Anti-Cheat & Moderation Questions

**Problem: Legitimate players are getting flagged for mining speed.**

- Mining rate limiting automatically provides headroom expansion for Haste effects (+2) and Efficiency tools (+2).
- If players experience heavy client ping fluctuations or packet batching, open `/panel` -> **Staff Dashboard** -> **Moderation Center** -> **Mining Rules** and adjust `Max Breaks Per Second` (e.g. from 24 to 28) or reduce `VL Increment`.

**Problem: Staff are receiving alerts for naturally exposed ores in caves.**

- AddonExe includes 6-neighbor cave air exposure and 2-block deep cave space verification.
- Verify that **Check Air Exposure** is enabled in `/panel` -> **Staff Dashboard** -> **Moderation Center** -> **X-Ray Heuristics**. This ensures only buried, unexposed ores increment suspicion.

**Problem: Combat checks trigger flags during intense mob swarms or server TPS drops.**

- Reach checks measure distance from the attacker's eye level with a token-bucket accumulator to avoid single-tick spikes.
- If needed, adjust `Max Reach Distance` (default 4.25 blocks) or `Max CPS` (default 20 CPS) in `/panel` -> **Staff Dashboard** -> **Moderation Center** -> **Combat Rules**.

---

## 5. UI (`/panel`) Issues

**Problem: The UI panel looks like the default light-gray vanilla form or buttons do not render properly.**

- Confirm **AddonExeRP** is active in your world's Resource Packs and placed above other UI packs that modify `ui/server_form.json`.
- Fully close and relaunch the world after updating the Resource Pack so Minecraft reloads `server_form.json`.

---

## 6. Reporting Bugs

If an issue persists, open a report on the [GitHub Issues Page](https://github.com/SjnExe/AddonExe/issues) with:

- Your Minecraft Bedrock version and AddonExe version (`/version`).
- Exact steps to reproduce.
- Any `[Scripting][error]` or `[UI][error]` lines from the Creator Content Log.
