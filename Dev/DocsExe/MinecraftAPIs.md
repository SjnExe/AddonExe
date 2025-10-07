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
| `world.afterEvents` | Confirmed | Subscribe to events that have already occurred (e.g., `playerSpawn`, `entityDie`). |
| `world.beforeEvents` | Confirmed | Subscribe to events before they happen, with the ability to cancel some of them (e.g., `chatSend`, `playerBreakBlock`). |
| `system.afterEvents`| Confirmed | Subscribe to system-level events that have occurred. |
| `system.beforeEvents`| Confirmed | Subscribe to system-level events before they happen. |

### Game Objects & Classes

| API | Status | Usage |
| --- | --- | --- |
| `Player` | Confirmed | Represents a player in the world. Used to access player-specific information and methods. |
| `Entity` | Confirmed | Represents any entity in the world (mobs, items, etc.). Provides methods to interact with these entities. |
| `Block` | Confirmed | Represents a block in the world, providing information about its type, location, and state. |
| `Dimension` | Confirmed | Represents a dimension in the world (Overworld, Nether, The End). |
| `Scoreboard` | Confirmed | Used to interact with the in-game scoreboard, managing objectives and scores. |
| `Container` | Confirmed | Represents an inventory container, such as a chest or a player's inventory. |
| `Effect` | Confirmed | Represents a status effect that can be applied to an entity. |
| `Camera` | Confirmed | Provides methods to control the player's camera, such as setting its position or creating fade effects. Accessed via `player.camera`. |
| `Structure` | Confirmed | Represents a saved structure that can be placed in the world, managed by the `StructureManager`. |

### Item Management

| API | Status | Usage |
| --- | --- | --- |
| `ItemStack` | Confirmed | Represents a stack of items. Used for creating, modifying, and managing items. |
| `ItemTypes` | Confirmed | Provides a list of all available item types. |
| `EnchantmentTypes`| Confirmed | Provides a list of all available enchantments. |
| `ItemComponent` | Confirmed | Base class for components that can be on an `ItemStack`, defining its behavior (e.g., `ItemFoodComponent`, `ItemDurabilityComponent`). |

### Components

Components are used to add functionality and data to Blocks, Entities, and Items.

| API | Status | Usage |
| --- | --- | --- |
| `EntityComponent` | Confirmed | Base class for components that can be on an `Entity`, defining its state and behavior (e.g., `EntityHealthComponent`, `EntityInventoryComponent`). |
| `BlockComponent` | Confirmed | Base class for components that can be on a `Block`, defining its state and behavior (e.g., `BlockInventoryComponent`, `BlockSignComponent`). |

### Managers

| API | Status | Usage |
| --- | --- | --- |
| `StructureManager`| Confirmed | Manages the creation, loading, and placement of structures in the world. Accessed via `world.structureManager`. |
| `LootTableManager`| Unconfirmed | Manages loot tables, allowing for custom loot generation. Could be accessed via `world.lootTables`. |

### Utilities

| API | Status | Usage |
| --- | --- | --- |
| `Vector3` | Confirmed | Represents a 3D vector using an object literal (e.g., `{ x, y, z }`), commonly used for positions and velocities. |
| `MolangVariableMap`| Confirmed | A map for defining and using MoLang variables, which can be used in animations and other data-driven features. |
| `ScreenDisplay` | Confirmed | Represents the player's screen, allowing for the display of titles and action bar messages. Accessed via `player.onScreenDisplay`. |

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

The documentation also lists other specialized modules that could be useful. These require being added to the `manifest.json` file to be accessible.

| API | Status | Usage |
| --- | --- | --- |
| `@minecraft/server-gametest` | Confirmed (Unavailable) | Provides a framework for creating and running in-game tests. Not enabled in `manifest.json`. |
| `@minecraft/server-net` | Confirmed (Unavailable) | Allows for server-based HTTP requests. Not enabled in `manifest.json`. |
| `@minecraft/server-admin` | Confirmed (Unavailable) | Provides tools for server administration. Not enabled in `manifest.json`. |