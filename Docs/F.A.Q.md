# Frequently Asked Questions (F.A.Q.)

## How do I make myself the Server Owner?

Make sure cheats/operator permissions are enabled, then run:

```text
/function owner
```

Alternatively, run `/tag @s add owner` and then `/xreload`. This grants the **Owner** rank (Priority `0`) with full access to all commands and the **Staff Dashboard** in `/panel`.

---

## How do I make someone an Admin or Moderator?

If you already have Owner or Admin permissions, run:

```text
/rank set "PlayerName" admin
/rank set "PlayerName" moderator
```

You can also manage a player's ranks visually in `/panel` -> **Staff Dashboard** -> **Player Management** -> **Active Player Inspector** -> _Select Player_ -> **Manage Ranks**.

---

## Why does it say Economy, Shop, or Kits is disabled?

Economy-dependent modules (**Economy**, **Shop**, **Auction House**, **Kits**, **Daily Rewards**, **Bounties**, and **Voting**) are disabled by default so server owners can customize prices and kits before opening them to players.

To enable them:

1. Run `/panel`.
2. Go to **Staff Dashboard** -> **Addon Configuration** -> **Master Feature Toggles**.
3. Toggle on **Enable Economy** and the specific features you want to use, then click **Save Settings**.

---

## How do I install AddonExe?

1. **Download:** Grab the latest `AddonExe.*.mcaddon` file from [GitHub Releases](https://github.com/SjnExe/AddonExe/releases/latest).
2. **Import:** Open the `.mcaddon` file with Minecraft to import both **AddonExeBP** (Behavior Pack) and **AddonExeRP** (Resource Pack).
3. **Activate on World:**
    - Place **AddonExeBP** at the **top** of your world's Behavior Packs list.
    - Activate **AddonExeRP** in your world's Resource Packs list.
4. **Enable Required Settings:**
    - Turn ON **Activate Cheats** under _Game_ settings.
    - Turn ON **Beta APIs** under _Experiments_.

### Installing on Bedrock Dedicated Server (BDS)

1. Rename the downloaded `.mcaddon` file to `.zip` and extract the Behavior Pack and Resource Pack folders into your server's `behavior_packs/` and `resource_packs/` directories.
2. Add the pack UUIDs and versions (found in each pack's `manifest.json`) to your world's `world_behavior_packs.json` and `world_resource_packs.json`.
3. Set `allow-cheats=true` in `server.properties` and ensure the **Beta APIs** experiment is enabled in your world's `level.dat`.

---

## How do I customize settings without losing in-game data?

- **In-Game (Recommended):** Use `/panel` -> **Staff Dashboard** -> **Addon Configuration**. All changes save immediately to world dynamic properties.
- **Config Files:** If you edit compiled `*Config.js` files on disk and run `/xreload`, AddonExe only updates the specific properties you changed on disk while keeping all other in-game settings intact.
