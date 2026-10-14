# Rank and Permission System

AddonExe uses a priority-based Rank and Permission Engine defined in `src/features/ranks/ranksConfig.ts` and managed in-game via `/rank`, `/listranks`, or `/panel`.

---

## 1. Default Ranks Overview

Lower `priority` numbers take visual precedence for chat and nametag formatting:

| Rank ID     | Display Name  | Priority | Tag Condition | Default Permission Groups                    | Shop Multiplier      |
| :---------- | :------------ | :------- | :------------ | :------------------------------------------- | :------------------- |
| `owner`     | **Owner**     | `0`      | `owner`       | `default`, `mod`, `admin`, `owner` (`*`)     | 1.0x                 |
| `admin`     | **Admin**     | `10`     | `admin`       | `default`, `mod`, `admin`                    | 1.0x                 |
| `moderator` | **Moderator** | `30`     | `moderator`   | `default`, `mod`                             | 1.0x                 |
| `helper`    | **Helper**    | `50`     | `helper`      | `default` (+ `cmd.kick.mod`, `cmd.mute.mod`) | 1.0x                 |
| `verified`  | **Verified**  | `700`    | `verified`    | `default`                                    | 1.0x                 |
| `vip`       | **VIP**       | `800`    | `vip`         | `default`                                    | Buy 0.8x / Sell 1.2x |
| `donator`   | **Donator**   | `850`    | `donator`     | `default`                                    | Buy 0.9x / Sell 1.1x |
| `member`    | **Member**    | `1000`   | _(None)_      | `default`                                    | 1.0x                 |

---

## 2. Assigning Ranks In-Game

### Granting Owner Access

Run `/function owner` or `/tag @s add owner` (followed by `/xreload`).

### Managing Ranks via Commands

- **Grant a rank:** `/rank set <player> <rankId>`
- **Remove a rank:** `/rank remove <player> <rankId>` (or `/rank rm`)
- **View a player's ranks:** `/rank list <player>` (or `/rank ls`)
- **List all ranks:** `/listranks`

### Managing Ranks via UI (`/panel`)

- **Assign/Remove Player Ranks:** `/panel` -> **Staff Dashboard** -> **Player Management** -> **Active Player Inspector** -> _Select Player_ -> **Manage Ranks**.
- **Create/Edit Rank Definitions:** `/panel` -> **Staff Dashboard** -> **Player Management** -> **Rank System & Permissions**.

---

## 3. How Permission Evaluation Works

Every command and UI section checks a dot-separated permission node (e.g., `cmd.ban.admin`, `ui.panel.mod`). When a player has multiple ranks, permissions from all of their ranks are combined and evaluated in this order:

1. **Owner Bypass:** Players with the `owner` rank or `*` allow rule are granted access automatically.
2. **Deny Rules (`deny`):** If any possessed rank explicitly denies the node, access is denied.
3. **Allow Rules (`allow`):** If any possessed rank explicitly allows the node, access is granted.
4. **Permission Groups (`groups`):** Checks group wildcards defined in `permissionGroups`:
    - `default`: `['**.member']`
    - `mod`: `['**.mod']`
    - `admin`: `['**.admin']`
    - `owner`: `['**.owner']`
