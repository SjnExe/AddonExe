# Minecraft APIs

This document lists the Minecraft APIs used in this project. APIs are categorized by their respective modules.

---

## `@minecraft/server`

This module provides APIs to interact with the game world, entities, and other server-side features.

### Core Objects

| API | Status | Usage |
| --- | --- | --- |
| `world` | Confirmed | Provides access to the game world, including methods to get players, entities, and dimensions. It also exposes events that happen in the world. |
| `system` | Confirmed | Provides access to system-level functionality, such as running scheduled tasks (`system.run`). |

### Player and Entity Management

| API | Status | Usage |
| --- | --- | --- |
| `Player` | Confirmed | Represents a player in the world. Used to access player-specific information and methods, such as their name, location, and inventory. |
| `Entity` | Unconfirmed | Could be used to represent any entity in the world, including mobs and items. It would provide methods to interact with these entities. |

### Item Management

| API | Status | Usage |
| --- | --- | --- |
| `ItemStack` | Confirmed | Represents a stack of items. Used for creating, modifying, and managing items in inventories. |
| `ItemTypes` | Confirmed | Provides a list of all available item types, allowing for the creation of specific `ItemStack` objects. |
| `EnchantmentTypes` | Confirmed | Provides a list of all available enchantments that can be applied to items. |

### Game Mechanics

| API | Status | Usage |
| --- | --- | --- |
| `GameMode` | Confirmed | Used to get or set a player's game mode (e.g., Survival, Creative). |
| `Block` | Unconfirmed | Could be used to represent a block in the world, providing information about its type, location, and state. |
| `Dimension` | Unconfirmed | Could be used to get information about the different dimensions in the world (Overworld, Nether, The End). |
| `Scoreboard` | Unconfirmed | Could be used to interact with the in-game scoreboard, managing objectives and scores. |

---

## `@minecraft/server-ui`

This module provides APIs for creating and managing user interface elements.

### Forms

| API | Status | Usage |
| --- | --- | --- |
| `ActionFormData` | Confirmed | Used to create a form with a list of buttons that the player can interact with. |
| `ModalFormData` | Confirmed | Used to create a form with various input fields, such as text boxes, toggles, and sliders. |
| `MessageFormData` | Confirmed | Used to create a simple form with a message and two buttons (e.g., "OK" and "Cancel"). |