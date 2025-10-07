# Minecraft: Bedrock Edition Commands

This document lists vanilla commands available in Minecraft: Bedrock Edition.

---

## Player Commands

These commands are primarily used to affect individual players.

| Command | Syntax | Description |
| --- | --- | --- |
| `/ability` | `/ability <player> <abilities> <true|false>` | Grants or revokes player abilities. |
| `/camerashake` | `/camerashake add <player> [intensity] [seconds] [type]` | Adds a camera shake effect to a player's screen. |
| `/clear` | `/clear [player] [item] [data] [maxCount]` | Clears items from a player's inventory. |
| `/dialogue` | `/dialogue open <npc: target> <scene: string> [player: target]` | Opens a dialogue scene for a player with an NPC. |
| `/effect` | `/effect <player> <effect> [seconds] [amplifier] [hideParticles]` | Applies a status effect to a player. |
| `/enchant` | `/enchant <player> <enchantment> [level]` | Enchants an item held by a player. |
| `/fog` | `/fog <player> <push|pop|remove> <id> [transitionTime]` | Manages fog settings for a player. |
| `/gamemode` | `/gamemode <mode> [player]` | Sets a player's game mode. |
| `/give` | `/give <player> <item> [amount]` | Gives an item to a player. |
| `/kill` | `/kill [player]` | Kills a player or entity. If no target is specified, it kills the command executor. |
| `/playanimation` | `/playanimation <player> <animation> [next_state] [blend_out_time] [stop_expression] [controller]` | Plays an animation for a player. |
| `/teleport` | `/teleport [target player] <destination>` | Teleports a player to a specific location or another player. |
| `/tp` | `/tp [target player] <destination>` | Alias for `/teleport`. |
| `/xp` | `/xp <amount> [player]` | Adds or removes experience points from a player. |

---

## World and Environment Commands

These commands are used to modify the game world and its environment.

| Command | Syntax | Description |
| --- | --- | --- |
| `/clone` | `/clone <begin x y z> <end x y z> <destination x y z> [maskMode] [cloneMode]` | Clones blocks from one region to another. |
| `/fill` | `/fill <from x y z> <to x y z> <block> [dataValue|state] [replace|destroy|hollow|outline|keep]` | Fills a region with a specific block. |
| `/gamerule` | `/gamerule <rule> [value]` | Sets or queries a game rule. |
| `/locate` | `/locate <structure|biome> <name>` | Finds the nearest structure or biome of a specified type. |
| `/mobevent` | `/mobevent <event> <true|false>` | Enables or disables mob events, like raids. |
| `/ride` | `/ride <rider> start_riding <ride> [teleport_ride] [how_to_fill]` | Makes an entity ride another entity. |
| `/setblock` | `/setblock <x y z> <block> [dataValue|state] [handleMode]` | Changes a block at a specific location. |
| `/setworldspawn` | `/setworldspawn [x] y z]` | Sets the world spawn point. |
| `/structure` | `/structure save <name> <from x y z> <to x y z> [include_entities] [save_mode] [include_blocks]` | Saves a structure to a file. |
| `/summon` | `/summon <entity> [x] [y] [z]` | Summons an entity at a specific location. |
| `/tickingarea` | `/tickingarea add <from x y z> <to x y z> [name]` | Adds a ticking area to the world. |
| `/time set <value>` | `/time set <day|night|noon|midnight|tick>` | Sets the world time. |
| `/weather` | `/weather <clear|rain|thunder> [duration]` | Sets the weather. |

---

## Server Management Commands

These commands are used for managing a multiplayer server.

| Command | Syntax | Description |
| --- | --- | --- |
| `/deop` | `/deop <player>` | Revokes operator status from a player. |
| `/kick` | `/kick <player> [reason]` | Kicks a player from the server. |
| `/op` | `/op <player>` | Grants operator status to a player. |
| `/stop` | `/stop` | Stops the server. |