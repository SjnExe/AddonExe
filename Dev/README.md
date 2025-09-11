# Addon Development Resources

This folder contains useful resources, documentation links, and potentially helper scripts for the development and debugging of this Minecraft Bedrock Edition addon.

## Official Minecraft Bedrock Creator Documentation

The primary hub for all official Bedrock addon development documentation is:

- **[Minecraft Creator Documentation (Bedrock)](https://learn.microsoft.com/en-us/minecraft/creator/?view=minecraft-bedrock-stable)**

Below are links to specific sections particularly relevant for Add-On development, with an emphasis on Anti-Cheat capabilities:

### Scripting APIs (`@minecraft/server`)

- **Overview & Getting Started:**
  - [Introduction to Scripting](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/introduction?view=minecraft-bedrock-stable)
  - [Scripting API Reference (Main Page)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/?view=minecraft-bedrock-stable)
  - [Next Steps: Scripting with TypeScript](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/next-steps?view=minecraft-bedrock-stable)
- **Core World & Event Handling:**
  - [World Class (world, events)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/world?view=minecraft-bedrock-stable)
  - [WorldBeforeEvents Class (cancellable events)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldbeforeevents?view=minecraft-bedrock-stable)
  - [WorldAfterEvents Class (post-action events)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable)
- **Entities & Players:**
  - [Entity Class (base for all entities)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)
  - [Player Class (specific to players)](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-stable)
  - [Entity Behavior Introduction](https://learn.microsoft.com/en-us/minecraft/creator/documents/entitybehaviorintroduction?view=minecraft-bedrock-stable)
  - [Entity Events (JSON-based)](https://learn.microsoft.com/en-us/minecraft/creator/documents/entityevents?view=minecraft-bedrock-stable)
- **Items:**
  - [ItemStack Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable)
  - [Item JSON Reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/?view=minecraft-bedrock-stable)
- **Blocks:**
  - [Block Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/block?view=minecraft-bedrock-stable)
  - [Block JSON Reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/?view=minecraft-bedrock-stable)
- **User Interface (Server-Side):**
  - [@minecraft/server-ui Module](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/minecraft-server-ui?view=minecraft-bedrock-stable)
  - [ActionFormData Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/actionformdata?view=minecraft-bedrock-stable)
  - [MessageFormData Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/messageformdata?view=minecraft-bedrock-stable)
  - [ModalFormData Class](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/modalformdata?view=minecraft-bedrock-stable)
- **Other Useful Links:**
  - [Introduction to Behavior Packs](https://learn.microsoft.com/en-us/minecraft/creator/documents/behaviorpack?view=minecraft-bedrock-stable)
  - [Introduction to Resource Packs](https://learn.microsoft.com/en-us/minecraft/creator/documents/resourcepack?view=minecraft-bedrock-stable)
  - [Commands Introduction](https://learn.microsoft.com/en-us/minecraft/creator/documents/commandsintroduction?view=minecraft-bedrock-stable)
  - [Command Reference](https://learn.microsoft.com/en-us/minecraft/creator/commands/?view=minecraft-bedrock-stable)

### Key Version Updates & Overviews

- [Minecraft Bedrock 1.21.100 Update Notes for Creators](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.21.100?view=minecraft-bedrock-stable)
- [Scripting V2.0.0 Overview](https://learn.microsoft.com/en-us/minecraft/creator/documents/scriptingv2.0.0overview?view=minecraft-bedrock-stable) (Details on API v2 changes and Custom Components V2)

### Official Minecraft Changelogs

- **[Minecraft Feedback - Release Changelogs](https://feedback.minecraft.net/hc/en-us/sections/360001186971-Release-Changelogs)**
  - This page contains changelogs for both the Bedrock and Java editions of Minecraft. For addon development, refer to the **Bedrock** changelogs.

### Official Mojang & Microsoft Samples/Tools

- **Mojang Bedrock Addon Samples**:
  - [https://github.com/Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples)
- **Mojang Minecraft Creator Tools**:
  - [https://github.com/Mojang/minecraft-creator-tools](https://github.com/Mojang/minecraft-creator-tools)
- **Microsoft Minecraft Samples**:
  - [https://github.com/microsoft/minecraft-samples](https://github.com/microsoft/minecraft-samples)
- **Microsoft Minecraft Scripting Samples**:
  - [https://github.com/microsoft/minecraft-scripting-samples](https://github.com/microsoft/minecraft-scripting-samples)
  - Contains many useful examples, including for custom commands.
- **Mojang Minecraft Scripting Libraries**:
  - [https://github.com/Mojang/minecraft-scripting-libraries](https://github.com/Mojang/minecraft-scripting-libraries)
- **Minecraft Creator Tools Website**:
  - [https://mctools.dev/](https://mctools.dev/)
  - A web-based suite of tools for creators, including project starters and a validator.

## Community Documentation

- **Bedrock.dev**:
  - [https://bedrock.dev/](https://bedrock.dev/)
  - A community-driven documentation website for Minecraft Bedrock Edition. It provides detailed information on various aspects of addon development, including blocks, items, entities, and more.

## Performance Profiling

To help identify potential bottlenecks, the addon includes a basic performance profiling feature.

- **Enable:** Set `enablePerformanceProfiling: true` in `AddonExeBP/scripts/config.js`.
- **Logging:** When enabled, aggregated performance data for the main tick loop, individual checks, and event handlers will be logged periodically to the server console/logs (via `playerUtils.debugLog` with a `PerformanceProfile` tag).
- **Usage:** This data can help developers pinpoint specific areas that might be consuming more resources than expected. It's recommended to only enable this for temporary debugging sessions, as continuous profiling can itself have a minor performance overhead.
- **Configuration:** The logging interval can be adjusted with `logPerformanceProfileIntervalTicks` in the config.

## Purpose of this Folder

This directory can be used by developers (including AI assistants like Jules) to:

- Store links to relevant external documentation.
- Keep notes on development practices specific to this addon.
- Place utility scripts for debugging or build processes.
- Maintain any other resources that facilitate understanding and working on this addon.

## Target Minecraft Version

The addon currently targets Minecraft Bedrock version 1.21.100 and newer. Please ensure development and testing align with this version.

## Codebase Architecture Overview

The AddonExe is structured to be modular and configurable. Here's a high-level overview of the new, streamlined architecture:

- **`AddonExeBP/scripts/`**: The root for all behavior pack scripts.
  - **`main.js`**: The primary entry point for the addon. It handles the initialization of all core managers and subscribes to necessary game events (e.g., `beforeChatSend`, `playerJoin`). It also defines the main `system.runInterval` tick loop for periodic tasks.
  - **`config.js`**: Contains a wide array of configurable settings for features, system behaviors, and command toggles.
  - **`core/`**: Houses the central manager modules that form the backbone of the addon.
    - `playerDataManager.js`: Manages runtime and persistent data for each player, including rank, punishments, and other states.
    - `rankManager.js`: Manages player ranks, permission levels, and their display properties based on `ranksConfig.js` and `config.js`.
    - `punishmentManager.js`: A new manager responsible for handling bans and mutes, including checking for expired punishments.
    - `cooldownManager.js`: A new manager providing a generic system for handling cooldowns for features like TPA and homes.
    - `configManager.js`: Manages the loading and accessibility of configuration files.
    - `economyManager.js`: Handles all economy-related logic, including balances and bounties.
    - `homesManager.js`: Manages player homes.
    - `kitsManager.js`: Manages the player kit system.
    - `reportManager.js`: Manages player-submitted reports.
    - `tpaManager.js`: Manages the Teleport Ask (TPA/TPAHere) system.
    - `uiManager.js`: Core module for displaying all UI panels and forms.
    - `panelLayoutConfig.js`: Defines the structure, content, and actions for all dynamic UI panels.
    - `ranksConfig.js`: Defines the properties of all available ranks.
    - `kitsConfig.js`: Defines the content and properties of all available kits.
    - `logger.js`: A simple, centralized logger for debug messages.
    - `utils.js`: A collection of general utility functions.
  - **`modules/`**: Contains feature-specific logic, separated from the core managers.
    - **`commands/`**: Contains the definition for every chat command.
      - `commandManager.js`: This is the central command processor. It is instantiated once and used by individual command files to register themselves. It handles parsing, permission checks, and execution.
    - **`detections/`**: This directory is currently reserved for the future cheat detection system.
    - **`utils/`**: Contains utility functions that are more feature-specific than the core `utils.js`.
      - `playerUtils.js`: A key utility file with helper functions for finding players, sending formatted messages, etc.

> [!IMPORTANT]
> **Cheat Detection System (Under Redevelopment)**
>
> The previous architecture for cheat detection (`actionManager`, `automodManager`, `actionProfiles.js`, `checks/` directory, etc.) has been removed in this version of the addon. It is being redesigned and will be re-introduced in a future update. As such, documentation related to flags, violation levels, and specific check configurations is no longer applicable.

## Task Management for Development

To help track the development progress of this addon, especially when working with AI assistants or multiple developers, a simple task management system is maintained within the `Dev/tasks/` directory. This directory contains the following files:

- **`Dev/tasks/completed.md`**: Lists tasks and features that have been successfully implemented, tested (where applicable), and submitted to the main codebase. Each entry should ideally include a brief description of the completed work and a reference to the submission (e.g., date, commit SHA if available).
- **`Dev/tasks/ongoing.md`**: Details the task(s) currently being actively worked on. This file should be updated when a developer or AI assistant begins work on a new task from the `todo.md` list. It should clearly state the objectives of the ongoing task. *This file should be updated by the AI at the start of its work session.*
- **`Dev/tasks/todo.md`**: A list of planned features, improvements, bug fixes, and areas for future investigation. Tasks are generally categorized by priority (e.g., High, Medium, Low) or by type (e.g., New Features, Refactoring, Documentation). When a task is selected for development, it should be moved from this file to `ongoing.md`. *New tasks identified by the AI can be added here.*

Maintaining these files helps ensure clarity on project status and facilitates smoother handoffs or continuations of work.

## Scripting Language Notes

**Current Scripting Language: Plain JavaScript**

The Behavior Pack scripts for this addon (`AddonExeBP/scripts/`) are currently written in plain JavaScript (.js files).

- **Rationale:** While TypeScript was initially considered for its benefits (static typing, modern features), complexities were encountered in establishing a consistent and reliable TypeScript-to-JavaScript compilation process within the GitHub Actions CI/CD workflow. To ensure a stable and functional build pipeline for releases, the decision was made to use plain JavaScript directly.
- **Future Considerations for TypeScript:** If TypeScript is to be reintroduced in the future, it would require:
  - A robust local development setup for TypeScript compilation (e.g., using `tsc` with a `tsconfig.json`).
  - A reliable method for managing TypeScript type definitions (e.g., via a `package.json` and `npm install`).
  - Ensuring that the CI/CD workflow can replicate this compilation process consistently to produce valid JavaScript for the game.
- **Guidance for Now:** Please write all new Behavior Pack scripts in plain JavaScript. Ensure that the `entry` point in `AddonExeBP/manifest.json` correctly points to the JavaScript main file.

## Important Workflow Notes for AI Assistants

For detailed guidelines, project-specific conventions, and workflow instructions tailored for AI assistants (like Jules) working on this codebase, please refer to the main **[AGENTS.md](../../AGENTS.md)** file located in the root of the repository.

This includes crucial information on:

- Task management using the `Dev/tasks/` directory.
- Responsibilities for updating user-facing documentation (e.g., root `README.md`, files in `Docs/`).
- Adherence to coding standards (`Dev/CodingStyle.md`, `Dev/StandardizationGuidelines.md`) and JSDoc practices.
- Key architectural points and critical naming conventions (e.g., `camelCase` for `checkType` and `actionType`).
