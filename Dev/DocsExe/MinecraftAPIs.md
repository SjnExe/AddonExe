# Minecraft: Bedrock Edition Scripting APIs

This document lists the Minecraft: Bedrock Edition Scripting APIs used in this project. The APIs are primarily from the `@minecraft/server` and `@minecraft/server-ui` modules and are categorized below.

---

## `@minecraft/server`

This module provides APIs to interact with the game world, entities, and other server-side features.

### Core Objects

| API | Status | Usage |
| --- | --- | --- |
| `world` | Confirmed | Provides access to the game world, including methods to get players, entities, and dimensions. It is the root for many world-related operations and events. |
| `system` | Confirmed | Provides access to system-level functionality, such as running scheduled tasks (`system.run`) and managing system-wide events. |

### Events

The `world` and `system` objects have `afterEvents` and `beforeEvents` properties that allow scripts to subscribe to a wide range of game events.

| API | Status | Usage |
| --- | --- | --- |
| `world.afterEvents` | Unconfirmed | Subscribe to events that have already occurred (e.g., `playerSpawn`, `entityDie`). |
| `world.beforeEvents` | Unconfirmed | Subscribe to events before they happen, with the ability to cancel some of them (e.g., `chatSend`, `playerBreakBlock`). |
| `system.afterEvents`| Unconfirmed | Subscribe to system-level events that have occurred. |
| `system.beforeEvents`| Unconfirmed | Subscribe to system-level events before they happen. |

### Game Objects & Classes

| API | Status | Usage |
| --- | --- | --- |
| `Player` | Confirmed | Represents a player in the world. Used to access player-specific information and methods. |
| `Entity` | Confirmed | Represents any entity in the world (mobs, items, etc.). Provides methods to interact with these entities. |
| `Block` | Confirmed | Represents a block in the world, providing information about its type, location, and state. |
| `Dimension` | Confirmed | Represents a dimension in the world (Overworld, Nether, The End). |
| `Scoreboard` | Confirmed | Used to interact with the in-game scoreboard, managing objectives and scores. |
| `Container` | Unconfirmed | Represents an inventory container, such as a chest or a player's inventory. |
| `Effect` | Unconfirmed | Represents a status effect that can be applied to an entity. |
| `Camera` | Unconfirmed | Provides methods to control the player's camera, such as setting its position or creating fade effects. |
| `Structure` | Unconfirmed | Represents a saved structure that can be placed in the world. |

### Item Management

| API | Status | Usage |
| --- | --- | --- |
| `ItemStack` | Confirmed | Represents a stack of items. Used for creating, modifying, and managing items. |
| `ItemTypes` | Confirmed | Provides a list of all available item types. |
| `EnchantmentTypes`| Confirmed | Provides a list of all available enchantments. |
| `ItemComponent` | Unconfirmed | Base class for components that can be on an `ItemStack`, defining its behavior (e.g., `ItemFoodComponent`, `ItemDurabilityComponent`). |

### Components

Components are used to add functionality and data to Blocks, Entities, and Items.

| API | Status | Usage |
| --- | --- | --- |
| `EntityComponent` | Unconfirmed | Base class for components that can be on an `Entity`, defining its state and behavior (e.g., `EntityHealthComponent`, `EntityInventoryComponent`). |
| `BlockComponent` | Unconfirmed | Base class for components that can be on a `Block`, defining its state and behavior (e.g., `BlockInventoryComponent`, `BlockSignComponent`). |

### Managers

| API | Status | Usage |
| --- | --- | --- |
| `StructureManager`| Unconfirmed | Manages the creation, loading, and placement of structures in the world. Accessed via `world.structureManager`. |
| `LootTableManager`| Unconfirmed | Manages loot tables, allowing for custom loot generation. Could be accessed via `world.lootTables`. |

### Utilities

| API | Status | Usage |
| --- | --- | --- |
| `Vector3` | Unconfirmed | Represents a 3D vector (x, y, z), commonly used for positions and velocities. |
| `MolangVariableMap` | Unconfirmed | A map for defining and using MoLang variables, which can be used in animations and other data-driven features. |
| `ScreenDisplay` | Unconfirmed | Represents the player's screen, allowing for the display of titles and action bar messages. Accessed via `player.onScreenDisplay`. |

---

## `@minecraft/server-ui`

This module provides APIs for creating and managing user interface elements.

### Forms

| API | Status | Usage |
| --- | --- | --- |
| `ActionFormData` | Confirmed | Used to create a form with a list of buttons. |
| `ModalFormData` | Confirmed | Used to create a form with various input fields (text, toggles, sliders). |
| `MessageFormData` | Confirmed | Used to create a simple dialog with a message and two buttons. |

---

## Other Modules

The documentation also lists other specialized modules that could be useful.

| API | Status | Usage |
| --- | --- | --- |
| `@minecraft/server-gametest` | Unconfirmed | Provides a framework for creating and running in-game tests. |
| `@minecraft/server-net` | Unconfirmed | Allows for server-based HTTP requests (e.g., to an external API). Requires a Bedrock Dedicated Server. |
| `@minecraft/server-admin` | Unconfirmed | Provides tools for server administration, such as managing secrets and variables. |