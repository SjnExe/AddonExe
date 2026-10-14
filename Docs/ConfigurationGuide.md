# AddonExe: Configuration Guide

AddonExe can be configured either **live in-game** via the `/panel` Staff Dashboard or **via configuration files** in `src/` (source) / `packs/behavior/scripts/` (compiled).

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
2. Open **Staff Dashboard** -> **Addon Configuration** -> **Master Feature Toggles**.
3. Toggle on **Enable Economy**, **Enable Shop System**, **Enable Kit System**, etc., and click **Save Settings**.

---

## 🔄 How Configuration Saving & `/xreload` Work

AddonExe uses a two-state priority merge system so you never lose in-game changes when editing files:

1. **In-Game Changes (`/panel`):** Saved immediately to world dynamic properties.
2. **Disk File Edits (`config.js`):** When you edit a compiled config file on disk and run `/xreload`, AddonExe compares the file against the last loaded snapshot:
    - Any setting you modified in the file **overwrites** the live in-game setting.
    - Any setting you did not touch in the file **keeps** its live in-game value.

---

## 📂 Configuration Files Overview

| Source File (`src/`)                                          | Purpose                                                                                                                            | In-Game UI Location (`/panel`)                                                   |
| :------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| `src/config.ts`                                               | Master feature toggles, Spawn, Spawn Protection, TPA, Homes, Warps, RTP, Back, Kits, Bounties, Chat, Dimension Lock, Rules & Links | **Staff Dashboard -> Addon Configuration**                                       |
| `src/features/economy/economyConfig.ts`                       | Currency symbol, starting/min/max balance, PvP wager settings, Kill Steal settings                                                 | **Detailed System Configs -> Economy Settings**                                  |
| `src/features/shop/shopConfig.ts` & `itemsConfig.ts`          | Shop categories, sub-categories, item prices, and rank discounts                                                                   | **Addon Configuration -> Shop Editor**                                           |
| `src/features/auction/auctionHouseConfig.ts`                  | Tax rate, listing fee, max listings per player, duration, bidding toggle                                                           | **Detailed System Configs -> Economy -> Auction System**                         |
| `src/features/ranks/ranksConfig.ts`                           | Rank definitions, priorities, chat/nametag prefixes, permission groups, shop multipliers                                           | **Staff Dashboard -> Player Management -> Rank System**                          |
| `src/features/anticheat/anticheatConfig.ts` & `xrayConfig.ts` | Movement check, illegal item/enchantment check, monitored X-Ray ores                                                               | **Staff Dashboard -> Moderation Center -> X-Ray Ores** & **Moderation Settings** |
| `src/features/sidebar/sidebarConfig.ts`                       | Scoreboard sidebar lines, Action Bar HUD lines, update intervals                                                                   | **Detailed System Configs -> Visuals & UI -> Sidebar System**                    |
| `src/features/team/teamConfig.ts`                             | Team creation cost, max members, name length limits, team home warmup                                                              | **Detailed System Configs -> Social -> Team System**                             |
| `src/features/games/wordle/wordleConfig.ts`                   | Single-player and staff-hosted Wordle settings, entry fee & tax rate                                                               | **Detailed System Configs -> Games -> Wordle Config**                            |
| `src/features/essentials/worldProtectionConfig.ts`            | Custom 3D world protection zones and interaction flags                                                                             | **Staff Dashboard -> World & Essentials -> Spawn & Protection Zones**            |
