# Rank and Permission System

This addon features a flexible rank system to grant permissions and customize player appearances (chat and nametags). This guide explains how the system works, from basic setup to advanced customization.

## How Ranks and Permissions Work

The system is designed with a clear hierarchy:

1.  **`config.js` is for Quick Setup:** You can set up your server's owners and admins in seconds by editing this one file.
2.  **`ranksConfig.js` is for Advanced Customization:** This file controls the properties of _all_ ranks, including their names, permission levels, visual styles, and allowed/denied permissions. You edit this file if you want to add new ranks (like "Moderator" or "VIP") or change how existing ranks look.

---

## 1. Quick Setup (`config.js`)

This is the fastest way to manage your server's staff roles.

- **File:** `AddonExeBP/scripts/config.js`

### Set Server Owner(s)

- **What it does:** The `ownerPlayerNames` array grants the highest permission level (0) to the listed players.
- **Action:** Add the **exact** in-game names of all owners to this array.
- **➡️ For a summary, see the [F.A.Q.](F.A.Q.md#how-do-i-change-the-server-owner)**

### Set Server Admin(s)

- **What it does:** The `Admin` rank grants the Admin permission level (1).
- **Action:** To make someone an admin, use the command: `/rank set "PlayerName" admin`.
- **➡️ For a summary, see the [F.A.Q.](F.A.Q.md#how-do-i-make-myself-an-admin)**

---

## 2. Managing Ranks In-Game

You can use the `/rank` command to manage custom ranks directly in-game.

### Available Commands:

- `/rank set <player> <rankId>`: Grants a player a specific rank.
- `/rank remove <player> <rankId>`: Removes a specific rank from a player. (Aliases: `rm`)
- `/rank list <player>`: Views all ranks a player currently possesses. (Aliases: `ls`)
- `/listranks`: Lists all configured ranks and their IDs/priorities.

---

## 3. Advanced Customization (`ranksConfig.js`)

Edit this file only if you want to create new ranks or change the appearance (colors, prefixes) or permissions of the default ranks.

- **File:** `AddonExeBP/scripts/core/ranksConfig.js` (Compiled) or `src/features/ranks/ranksConfig.ts` (Source)

This file contains the `rankDefinitions` array. Each object in this array is a rank.

### Rank Properties

- `id` (string): A unique, lowercase identifier (e.g., "owner", "vip"). This is the ID used with the `/rank` command.
- `name` (string): The user-friendly display name (e.g., "Owner", "VIP").
- `priority` (number): Determines precedence. **Lower numbers are higher priority**. If a player has multiple ranks, the one with the lowest priority number determines their name tag and chat formatting.
- `permissionLevel` (number): Determines power for targeting (e.g. kicking). **Lower numbers are more powerful** (Owner=0, Admin=1, Member=1024). A player with a lower `permissionLevel` cannot be targeted by a player with a higher `permissionLevel`.
- `chatFormatting` (object): Controls how chat messages look.
- `nametagPrefix` (string): The text that appears above a player's head.
- `groups` (array): A list of permission group IDs this rank inherits.
- `allow` (array): A list of specific permission nodes this rank is granted.
- `deny` (array): A list of specific permission nodes this rank is denied.
- `conditions` (array): The rules that assign a player to this rank automatically.

### How Permissions Work

AddonExe uses a granular permission node system. Every command and restricted action has an associated permission node (e.g., `cmd.ban.admin`, `ui.panel.mod`).

Permissions are evaluated in the following order:

1. **Deny list:** If a node is in the rank's `deny` array, permission is denied.
2. **Allow list:** If a node is in the rank's `allow` array, permission is granted.
3. **Groups list:** If a node is included in one of the rank's `groups`, permission is granted.

#### Wildcards

Permission arrays support wildcards (`*`) to grant or deny access to entire namespaces:

- `*` or `**`: Grants/denies ALL permissions.
- `cmd.*`: Grants/denies all commands.
- `**.admin`: Grants/denies all permission nodes ending in `.admin`.

#### Permission Groups

In `ranksConfig.js`, the `permissionGroups` object defines reusable collections of nodes.

```javascript
export const permissionGroups = {
    default: ['**.member'],
    mod: ['**.mod'],
    admin: ['**.admin'],
    owner: ['**.owner']
};
```

By adding a group ID to a rank's `groups` array, the rank inherits all nodes defined in that group.

### Example: Adding a "Moderator" Rank

To add a new "Moderator" rank, you would add a new object to the `rankDefinitions` array in `ranksConfig.js`:

```javascript
// In AddonExeBP/scripts/core/ranksConfig.js
export const rankDefinitions = [
    // ... Owner and Admin ranks are here ...

    {
        id: 'moderator',
        name: 'Moderator',
        priority: 30,
        permissionLevel: 3, // Less powerful than Admin (1) but more than Member (1024)
        chatFormatting: {
            prefixText: '§8[§2Mod§8] ',
            nameColor: '§a',
            messageColor: '§f'
        },
        nametagPrefix: '§2Mod §f\n',
        groups: ['default', 'mod'], // Inherits member and mod permissions
        allow: ['cmd.kick.mod', 'cmd.mute.mod'], // Optionally grant specific nodes
        deny: ['cmd.ban.mod'], // Prevent moderators from banning
        conditions: [
            { type: 'hasTag', value: 'moderator' } // Assign this rank to players with the 'moderator' tag (Optional)
        ]
    }

    // ... Member rank is here ...
];
```

To assign this new rank, you can use the command: `/rank set "PlayerName" moderator`.

### Rank Precedence

If a player possesses multiple ranks, their visual formatting (chat, nametag) is determined by the rank with the **lowest `priority` number**. However, they will inherit the permissions (`allow`, `deny`, `groups`) of **all** their possessed ranks combined.
