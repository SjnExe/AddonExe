# Rank and Permission System

This addon features a flexible rank system to grant permissions and customize player appearances (chat and nametags). This guide explains how the system works, from basic setup to advanced customization.

## How Ranks and Permissions Work

The system is designed with a clear hierarchy:

1.  **`config.js` is for Quick Setup:** You can set up your server's owners and admins in seconds by editing this one file.
2.  **`ranksConfig.js` is for Advanced Customization:** This file controls the properties of _all_ ranks, including their names, permission levels, and visual styles. You edit this file if you want to add new ranks (like "Moderator" or "VIP") or change how existing ranks look.

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

## 2. Advanced Customization (`ranksConfig.js`)

Edit this file only if you want to create new ranks or change the appearance (colors, prefixes) of the default ranks.

- **File:** `AddonExeBP/scripts/core/ranksConfig.js`

This file contains the `rankDefinitions` array. Each object in this array is a rank.

### Rank Properties

- `id` (string): A unique, lowercase identifier (e.g., "owner", "vip").
- `name` (string): The user-friendly display name (e.g., "Owner", "VIP").
- `permissionLevel` (number): Determines power. **Lower numbers are more powerful** (Owner=0, Admin=1, Member=1024).
- `chatFormatting` (object): Controls how chat messages look.
- `nametagPrefix` (string): The text that appears above a player's head.
- `conditions` (array): The rules that assign a player to this rank.

### How Conditions Work

The `conditions` array tells the addon who should get the rank.

- The `Owner` rank has a condition `{ type: 'isOwner' }`, which automatically links it to the `ownerPlayerNames` list in `config.js`.
- The `Admin` rank has `{ type: 'hasTag', value: 'admin' }`. The `/rank` command automatically manages this tag.
- The `Member` rank has `{ type: 'default' }`, making it the fallback for everyone else.

### Example: Adding a "Moderator" Rank

To add a new "Moderator" rank, you would add a new object to the `rankDefinitions` array in `ranksConfig.js`:

```javascript
// In AddonExeBP/scripts/core/ranksConfig.js
export const rankDefinitions = [
    // ... Owner and Admin ranks are here ...

    {
        id: 'moderator',
        name: 'Moderator',
        permissionLevel: 3, // Less powerful than Admin (1) but more than Member (1024)
        chatFormatting: {
            prefixText: '§8[§2Mod§8] ',
            nameColor: '§a',
            messageColor: '§f'
        },
        nametagPrefix: '§2Mod §f\n',
        conditions: [
            { type: 'hasTag', value: 'moderator' } // Assign this rank to players with the 'moderator' tag
        ]
    }

    // ... Member rank is here ...
];
```

To assign this new rank, you would use the command: `/tag "PlayerName" add moderator`.

### Rank Precedence

If a player meets the conditions for multiple ranks (e.g., they have both an "admin" tag and a "moderator" tag), the rank with the **lowest `permissionLevel` number** will always be used.
