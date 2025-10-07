# Minecraft Commands

This document lists vanilla Minecraft commands. It aims to be a comprehensive reference for both Java and Bedrock editions, with a focus on Bedrock commands where applicable.

---

## Player Commands

These commands are primarily used to affect individual players.

| Command | Syntax | Description | Edition |
| --- | --- | --- | --- |
| `/teleport` | `/teleport [target player] <destination>` | Teleports a player to a specific location or another player. | Both |
| `/tp` | `/tp [target player] <destination>` | Alias for `/teleport`. | Both |
| `/give` | `/give <player> <item> [amount]` | Gives an item to a player. | Both |
| `/kill` | `/kill [player]` | Kills a player or entity. If no target is specified, it kills the command executor. | Both |
| `/gamemode` | `/gamemode <mode> [player]` | Sets a player's game mode. | Both |
| `/enchant` | `/enchant <player> <enchantment> [level]` | Enchants an item held by a player. | Both |
| `/effect` | `/effect <player> <effect> [seconds] [amplifier] [hideParticles]` | Applies a status effect to a player. | Both |
| `/xp` | `/xp <amount> [player]` | Adds or removes experience points from a player. | Both |
| `/clear` | `/clear [player] [item] [data] [maxCount]` | Clears items from a player's inventory. | Both |

---

## World and Environment Commands

These commands are used to modify the game world and its environment.

| Command | Syntax | Description | Edition |
| --- | --- | --- | --- |
| `/time set <value>` | `/time set <day|night|noon|midnight|tick>` | Sets the world time. | Both |
| `/weather` | `/weather <clear|rain|thunder> [duration]` | Sets the weather. | Both |
| `/setworldspawn` | `/setworldspawn [x] [y] [z]` | Sets the world spawn point. | Both |
| `/locate` | `/locate <structure|biome> <name>` | Finds the nearest structure or biome of a specified type. | Both |
| `/summon` | `/summon <entity> [x] [y] [z]` | Summons an entity at a specific location. | Both |
| `/gamerule` | `/gamerule <rule> [value]` | Sets or queries a game rule. | Both |
| `/fill` | `/fill <from x y z> <to x y z> <block> [dataValue|state] [replace|destroy|hollow|outline|keep]` | Fills a region with a specific block. | Both |
| `/clone` | `/clone <begin x y z> <end x y z> <destination x y z> [maskMode] [cloneMode]` | Clones blocks from one region to another. | Both |
| `/setblock` | `/setblock <x y z> <block> [dataValue|state] [handleMode]` | Changes a block at a specific location. | Both |

---

## Server Management Commands

These commands are used for managing a multiplayer server.

| Command | Syntax | Description | Edition |
| --- | --- | --- | --- |
| `/op` | `/op <player>` | Grants operator status to a player. | Both |
| `/deop` | `/deop <player>` | Revokes operator status from a player. | Both |
| `/kick` | `/kick <player> [reason]` | Kicks a player from the server. | Both |
| `/whitelist` | `/whitelist <add|remove|on|off|list|reload>` | Manages the server's whitelist. | Java |
| `/stop` | `/stop` | Stops the server. | Both |

---

## Bedrock Edition Specific Commands

These commands are exclusive to the Bedrock Edition of Minecraft.

| Command | Syntax | Description |
| --- | --- | --- |
| `/ability` | `/ability <player> <abilities> <true|false>` | Grants or revokes player abilities. |
| `/camerashake` | `/camerashake add <player> [intensity] [seconds] [type]` | Adds a camera shake effect to a player's screen. |
| `/dialogue` | `/dialogue open <npc: target> <scene: string> [player: target]` | Opens a dialogue scene for a player with an NPC. |
| `/fog` | `/fog <player> <push|pop|remove> <id> [transitionTime]` | Manages fog settings for a player. |
| `/mobevent` | `/mobevent <event> <true|false>` | Enables or disables mob events, like raids. |
| `/playanimation` | `/playanimation <player> <animation> [next_state] [blend_out_time] [stop_expression] [controller]` | Plays an animation for a player. |
| `/ride` | `/ride <rider> start_riding <ride> [teleport_ride] [how_to_fill]` | Makes an entity ride another entity. |
| `/structure` | `/structure save <name> <from x y z> <to x y z> [include_entities] [save_mode] [include_blocks]` | Saves a structure to a file. |
| `/tickingarea` | `/tickingarea add <from x y z> <to x y z> [name]` | Adds a ticking area to the world. |