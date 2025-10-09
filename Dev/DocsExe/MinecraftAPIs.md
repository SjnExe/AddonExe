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

### Events System

The `world` and `system` objects have `afterEvents` and `beforeEvents` properties that allow scripts to subscribe to a wide range of game events.

| API | Status | Usage |
| --- | --- | --- |
| `world.afterEvents` | Confirmed | Subscribe to events that have already occurred. |
| `world.beforeEvents` | Confirmed | Subscribe to events before they happen, with the ability to cancel some of them. |
| `system.afterEvents`| Confirmed | Subscribe to system-level events that have occurred. |
| `system.beforeEvents`| Confirmed | Subscribe to system-level events before they happen. |

#### Specific Events (Examples)
| Event | Status | Description |
| --- | --- | --- |
| `PlayerJoinAfterEvent` | Confirmed | Fires after a player has joined the world. |
| `PlayerLeaveAfterEvent` | Confirmed | Fires after a player has left the world. |
| `PlayerSpawnAfterEvent` | Confirmed | Fires after a player has spawned or respawned. |
| `PlayerBreakBlockAfterEvent` | Confirmed | Fires after a player breaks a block. |
| `PlayerPlaceBlockAfterEvent` | Confirmed | Fires after a player places a block. |
| `EntityDieAfterEvent` | Confirmed | Fires after an entity dies. |
| `WeatherChangeAfterEvent` | Confirmed | Fires after the weather changes. |

### Game Objects & Classes

| API | Status | Usage |
| --- | --- | --- |
| `Player` | Confirmed | Represents a player in the world. |
| `Entity` | Confirmed | Represents any entity in the world (mobs, items, etc.). |
| `Block` | Confirmed | Represents a block in the world. |
| `Dimension` | Confirmed | Represents a dimension (Overworld, Nether, etc.). |
| `Scoreboard` | Confirmed | The world's scoreboard. |
| `Container` | Confirmed | An inventory container. |
| `Effect` | Confirmed | A status effect that can be applied to an entity. |
| `Camera` | Confirmed | Controls the player's camera. Accessed via `player.camera`. |
| `Structure` | Confirmed | A saved structure that can be placed in the world. |
| `BlockPermutation` | Unconfirmed (Test Skipped) | Represents a specific state of a block. Test requires player to be looking at a block. |
| `ContainerSlot` | Confirmed | Represents a single slot in a container. |
| `EffectType` | Confirmed | Represents a type of status effect. |
| `ScoreboardIdentity` | Unconfirmed (Test Skipped) | Represents a single entry on a scoreboard. Test requires a scoreboard objective named "test". |
| `ScoreboardObjective`| Unconfirmed (Test Skipped) | Represents a single objective on a scoreboard. Test requires a scoreboard objective named "test". |

### World Properties & Methods

| API | Status | Usage |
| --- | --- | --- |
| `world.getDefaultSpawnLocation` | Confirmed | Retrieves the world's default spawn location as a `Vector3`. |
| `world.getTimeOfDay` / `setTimeOfDay` | Confirmed | Gets or sets the current time of day. |

### Player Properties & Methods

| API | Status | Usage |
| --- | --- | --- |
| `player.isEmoting` | Confirmed | A boolean property that is `true` if the player is currently emoting. |
| `player.onScreenDisplay` | Confirmed | Provides access to the player's screen display for showing titles and action bars via methods like `setTitle()`. |

### System Properties & Methods

| API | Status | Usage |
| --- | --- | --- |
| `system.currentTick` | Confirmed | A read-only property that returns the current server tick. |

### Item Management

| API | Status | Usage |
| --- | --- | --- |
| `ItemStack` | Confirmed | Represents a stack of items. |
| `ItemTypes` | Confirmed | A collection of all available item types. |
| `EnchantmentTypes`| Confirmed | A collection of all available enchantments. |
| `ItemComponent` | Confirmed | Base class for components on an `ItemStack`. |
| `ItemDurabilityComponent` | Confirmed | Manages the durability of an item. |
| `ItemFoodComponent` | Confirmed | Defines the food properties of an item. |
| `ItemEnchantableComponent` | Confirmed | Manages the enchantments that can be applied to an item. |

### Components
Components add functionality to Blocks, Entities, and Items.

#### Entity Components (Examples)
| API | Status | Usage |
| --- | --- | --- |
| `EntityHealthComponent` | Confirmed | Manages the health of an entity. |
| `EntityInventoryComponent`| Confirmed | Manages the inventory of an entity. |
| `EntityMovementComponent` | Confirmed | Manages the movement speed of an entity. |
| `EntityRideableComponent` | Confirmed | Allows an entity to be ridden by other entities. |
| `EntityEquippableComponent`| Confirmed | Manages the equipment that can be worn by an entity. |

#### Block Components (Examples)
| API | Status | Usage |
| --- | --- | --- |
| `BlockInventoryComponent`| Confirmed | Provides access to a block's inventory (e.g., a chest). |
| `BlockSignComponent` | Confirmed | Manages the text content of a sign. |
| `BlockPistonComponent` | Unconfirmed (Test Skipped) | Provides information about a piston's state. Test requires player to be looking at a piston. |
| `BlockRecordPlayerComponent`| Unconfirmed (Test Skipped) | Manages a jukebox. Test requires player to be looking at a jukebox. |

### Managers

| API | Status | Usage |
| --- | --- | --- |
| `StructureManager`| Confirmed | Manages the creation, loading, and placement of structures. Accessed via `world.structureManager`. |
| `LootTableManager`| Unconfirmed (Not Found) | Manages loot tables. Test showed `world.lootTables` does not exist. |

### Utilities

| API | Status | Usage |
| --- | --- | --- |
| `Vector3` | Confirmed | Represents a 3D vector using an object literal (e.g., `{ x, y, z }`). |
| `MolangVariableMap`| Confirmed | A map for defining MoLang variables for use in animations. |
| `BlockRaycastOptions`| Confirmed | Options for casting a ray to find a block. |
| `EntityQueryOptions` | Confirmed | Options for querying entities in the world. |
| `RawMessage` | Confirmed | A raw JSON message that can be displayed in chat, allowing for translatable text and scores. |

---

## `@minecraft/server-ui`

This module provides APIs for creating and managing user interface elements.

### Forms

| API | Status | Usage |
| --- | --- | --- |
| `ActionFormData` | Confirmed | Used to create a form with a list of buttons. |
| `ModalFormData` | Confirmed | Used to create a form with various input fields. |
| `MessageFormData` | Confirmed | Used to create a simple dialog with a message and two buttons. |
---