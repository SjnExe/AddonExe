# Admin Guide

## Core Commands
*   `/admin` - Opens the main Admin Dashboard UI.
*   `/config` - Quick access to configuration settings.
*   `/rank` - Manage player ranks via command or UI.
*   `/freeze <player>` - Freeze a player (stops movement, interaction, commands).
*   `/unfreeze <player>` - Unfreeze a player.
*   `/ban <player> [duration] [reason]` - Ban a player. Duration examples: `1d`, `30m`.
*   `/mute <player>` - Mute a player.
*   `/xkick <player>` - Kick a player.
*   `/invsee <player>` - View a player's inventory and armor.
*   `/ecwipe <player>` - Clear a player's Ender Chest.
*   `/deathcoords <player>` - View a player's last death location.

## Configuration
All configuration can be managed via the `/admin` -> `Configuration` menu.
*   **Spawn:** Set spawn location, radius, and protection rules.
*   **Economy:** Set starting balance, max balance, currency symbol.
*   **TPA/Homes/Warps:** Enable/disable features and set cooldowns.
*   **Anti-Cheat:** Enable/disable checks for items and movement.

## Ranks
Ranks control permissions.
*   **0 (Owner):** Full access.
*   **1 (Admin):** Management access.
*   **2 (Mod):** Enforcement access (Ban, Freeze, Invsee).
*   **1024 (Member):** Default player access.

Create custom ranks via the Rank System UI in the Admin Panel.

## Features
*   **Floating Text:** Create holographic text using `/admin` -> `Floating Text`.
*   **X-Ray Detection:** Alerts staff when players mine valuable ores too quickly.
*   **Chat Logs:** Chat can be logged to the console via config settings.
