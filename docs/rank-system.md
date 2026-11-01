# Rank and Permission System

AddonExe uses a priority-based Rank and Permission Engine defined in `src/features/ranks/config.ts` and managed in-game via `/rank`, `/listranks`, or `/panel`.

---

## 1. Default Ranks Overview

Lower `priority` numbers take visual and hierarchical precedence:

| Rank ID     | Display Name  | Priority | Tag Condition | Default Permission Groups                                      | Shop Multiplier        |
| :---------- | :------------ | :------- | :------------ | :------------------------------------------------------------- | :--------------------- |
| `owner`     | **Owner**     | `0`      | `owner`       | `default`, `vip`, `builder`, `helper`, `mod`, `admin`, `owner` | 1.0x                   |
| `admin`     | **Admin**     | `10`     | `admin`       | `default`, `vip`, `builder`, `helper`, `mod`, `admin`          | 1.0x                   |
| `moderator` | **Moderator** | `30`     | `moderator`   | `default`, `helper`, `mod`                                     | 1.0x                   |
| `helper`    | **Helper**    | `50`     | `helper`      | `default`, `helper`                                            | 1.0x                   |
| `builder`   | **Builder**   | `60`     | `builder`     | `default`, `builder` (`/gmc`, `/gms`, spawn bypass)            | 1.0x                   |
| `media`     | **Media**     | `650`    | `media`       | `default`, `vip`                                               | Buy 0.85x / Sell 1.15x |
| `verified`  | **Verified**  | `700`    | `verified`    | `default`                                                      | 1.0x                   |
| `mvp`       | **MVP**       | `750`    | `mvp`         | `default`, `vip`                                               | Buy 0.75x / Sell 1.25x |
| `vip`       | **VIP**       | `800`    | `vip`         | `default`, `vip`                                               | Buy 0.8x / Sell 1.2x   |
| `donator`   | **Donator**   | `850`    | `donator`     | `default`, `vip`                                               | Buy 0.9x / Sell 1.1x   |
| `member`    | **Member**    | `1000`   | _(None)_      | `default`                                                      | 1.0x                   |

---

## 2. Security & Management Hierarchy

### Granting Server Owner

With operator/cheats enabled in-game, run:

```text
/function owner
```

This grants both the `owner` tag and `owner` rank immediately. The `owner` rank cannot be granted by players via `/rank`.

### Owner vs. Admin Capabilities

- **Server Owner (`owner`):**
  - Can grant or revoke **Admin** (`admin`) and any other rank to any player.
  - Can edit **all** rank definitions (including `owner` and `admin`) and **all** permission groups.
- **Administrator (`admin`):**
  - Can grant or revoke **Moderator** (`moderator` / `mod`), **Helper**, **Builder**, **Media**, **Verified**, **MVP**, **VIP**, **Donator**, and custom ranks to players below Admin.
  - Can create, edit, and delete ranks **except `owner` and `admin`** (and cannot set any rank priority `<= 10`).
  - **Cannot** assign the `owner` or `admin` permission groups or restricted nodes (`*`, `**.owner`, `**.admin`) to any rank or group.

### Managing Ranks via Commands

- **Grant a rank:** `/rank set <player> <rankId>` (supports aliases like `mod` -> `moderator`, `yt` -> `media`)
- **Remove a rank:** `/rank remove <player> <rankId>` (or `/rank rm`)
- **View a player's ranks:** `/rank list <player>` (or `/rank ls`)
- **List all server ranks:** `/listranks`

---

## 3. Universal Permission Groups & Nodes

### Permission Groups (`permissionGroups`)

- `default` (alias `member`): `['**.member']`
- `vip`: `['**.vip']`
- `builder`: `['**.builder', 'cmd.gmc.builder', 'cmd.gms.builder', 'cmd.gamemode.builder', 'bypass.spawnprotection']`
- `helper`: `['**.helper', 'cmd.kick.mod', 'cmd.mute.mod', 'cmd.unmute.mod', 'cmd.warn.mod', 'cmd.freeze.mod', 'cmd.unfreeze.mod', 'cmd.staffchat.mod', 'cmd.watch.mod', 'cmd.listwatched.mod']`
- `mod` (alias `moderator`): `['**.mod', '**.helper']`
- `admin`: `['**.admin', '**.mod', '**.helper', '**.builder', '**.vip']`
- `owner`: `['**.owner', '*']`

### Universal Node Formats

- **Short Command Nodes:** `cmd.<name>` (e.g. `cmd.kick`, `cmd.gmc`, `cmd.invsee`)
- **Tiered Command Nodes:** `cmd.<name>.<tier>` (e.g. `cmd.kick.mod`, `cmd.gmc.builder`, `cmd.ban.admin`)
- **Wildcards:** `cmd.*` (all commands), `**.mod` (all moderator commands/panels/groups), `**.builder` (all builder permissions)
- **Special Nodes:** `bypass.spawnprotection`, `ui.panel.mod`, `ui.panel.admin`, `group.mod`, `group.admin`
