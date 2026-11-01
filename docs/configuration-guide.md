# AddonExe: Configuration Guide

AddonExe compiles all default configurations into `packs/behavior/scripts/main.js` and is configured **live in-game** via the `/panel` Staff Dashboard (with JSON Export/Import support for backups).

---

## 🛠️ Initial Setup: Owner, Admins & Feature Toggles

### 1. Grant Yourself the Owner Rank

With cheats/operator enabled in your world, run either command in chat:

```text
/function owner
```

or:

```text
/tag @s add owner
```

This assigns the `owner` tag, which matches the **Owner** rank condition (Priority `0`, full wildcard `*` permissions).

### 2. Grant Staff Ranks (Admin, Moderator, Helper)

Once you have Owner access, you can grant ranks to other players via the UI (`/panel` -> **Staff Dashboard** -> **Player Management**) or via slash commands:

```text
/rank set "PlayerName" admin
/rank set "PlayerName" moderator
/rank set "PlayerName" helper
```

You can also assign ranks via vanilla tags (`/tag "PlayerName" add admin`) followed by `/xreload`.

### 3. Enable Economy & Optional Features

To keep fresh installations lightweight, **Economy**, **Shop**, **Auction House**, **Kits**, **Daily Rewards**, **Bounties**, and **Voting** default to `enabled: false` in `src/config.ts`.

To enable them in-game:

1. Run `/panel` (or use the craftable **Admin Panel** item).
2. Open **Staff Dashboard** -> **Addon Configuration** -> **System Configs**.
3. Select the desired category (e.g., **Economy Settings**, **Survival & Utilities**, **Teleportation & World**), toggle on the features you want, and click **Save Settings**.

---

## 🔄 How Configuration Saving, Deep Merge & `/xreload` Work

1. **In-Game Changes (`/panel`):** Saved immediately to sharded world dynamic properties via `StorageManager`.
2. **Version-Safe Deep Merge:** On world load or `/xreload`, saved dynamic properties are merged on top of default configurations (`deepMerge(defaultConfig, savedConfig)`), preserving all server customizations while automatically populating newly added configuration keys after an addon update.

---

## 📂 Configuration Files Overview

| Source File (`src/`)                                                      | Purpose                                                                                                                                    | In-Game UI Location (`/panel`)                                                        |
| :------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ |
| `src/config.ts`                                                           | Root config composition, Chat, Restart & Sound Events                                                                                      | **Staff Dashboard -> Addon Configuration -> System Configs**                          |
| `src/features/essentials/config.ts`                                       | Spawn, Spawn Protection, Combat Tag, Dimension Lock, AFK, Survival QoL, ClearLag, Player Utilities, Announcements, Welcomer, Rules & Links | **System Configs -> Survival & Utilities / Teleportation & World / Server & Network** |
| `src/features/teleport/config.ts`                                         | TPA, Homes, Warps, Random Teleport (`/rtp`), and `/back` settings                                                                          | **System Configs -> Teleportation & World Settings**                                  |
| `src/features/economy/kit/config.ts`                                      | Starter kit & default kit definitions                                                                                                      | **Addon Configuration -> Kit Editor**                                                 |
| `src/features/economy/config.ts`                                          | Currency symbol, starting/min/max balance, Mob Money rewards, PvP wager settings, Kill Steal settings                                      | **System Configs -> Economy Settings -> Economy / Mob Money / PvP / Steal**           |
| `src/features/economy/shop/config.ts` & `itemsConfig.ts`                  | Shop categories, sub-categories, item prices, and rank discounts                                                                           | **Addon Configuration -> Shop Editor**                                                |
| `src/features/economy/auction/config.ts`                                  | Tax rate, listing fee, max listings per player, duration, bidding toggle, blocked items                                                    | **System Configs -> Economy Settings -> Auction System**                              |
| `src/features/economy/daily/config.ts`                                    | Daily login reward tiers, claim cooldown, and streak reset window                                                                          | **System Configs -> Economy Settings -> Daily Rewards Tier Editor**                   |
| `src/features/ranks/config.ts`                                            | Rank definitions, priorities, chat/nametag prefixes, permission groups, shop multipliers                                                   | **Staff Dashboard -> Player Management -> Ranks & Perms**                             |
| `src/features/anticheat/config.ts` & `xray/config.ts`                     | Movement check, illegal item/enchantment check, Nether roof check, monitored X-Ray ores                                                    | **Staff Dashboard -> Moderation Center -> X-Ray Ores** & **Moderation Rules**         |
| `src/features/sidebar/config.ts`                                          | Adaptive HUD layouts (Right, Left, Bottom, Dual), theme presets, sidebar & actionbar lines                                                 | **System Configs -> Visuals & UI Settings -> Sidebar System**                         |
| `src/features/social/friends/config.ts` & `team/config.ts`                | Friend limits & expiry, Team creation cost, max members, name blacklist, team home warmup                                                  | **System Configs -> Social Settings -> Friend System / Team System**                  |
| `src/features/games/config.ts` & `wordle/config.ts`                       | Tic-Tac-Toe, Rock Paper Scissors, Minesweeper rewards/par times, and Wordle settings                                                       | **System Configs -> Games System -> Games Config / Wordle Config**                    |
| `src/features/essentials/protection/config.ts` & `worldBorder/manager.ts` | Custom 3D world protection zones and linked Overworld+Nether (8:1) & End world borders                                                     | **Staff Dashboard -> World & Essentials -> Protection Zones / World Border**          |
