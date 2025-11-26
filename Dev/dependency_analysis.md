# Analysis of `~mc-npm` Dependencies

This report provides an analysis of the npm packages published by the `mc-npm` user, categorized into three groups: "Currently Used," "Can Be Used," and "Cannot Be Used / Unnecessary."

## Currently Used

These are the packages that are already listed in our project's `package.json`.

| Package | Description |
| --- | --- |
| `@minecraft/server` | The core API for interacting with the Minecraft world, entities, and other server-side features. |
| `@minecraft/server-ui` | Provides the API for creating simple dialog-based user interfaces, such as modal forms and message forms. |
| `@minecraft/creator-tools`| A command-line tool for validating and packaging Minecraft addons. |

## Can Be Used

These packages are not currently in our project, but they offer features that could be beneficial.

| Package | Description & Potential Advantages |
| --- | --- |
| `@minecraft/math` | Provides a set of math utilities for use with Minecraft scripting, such as vector and matrix operations. This could simplify complex calculations related to entity movement, positions, and geometry. |
| `@minecraft/vanilla-data` | Contains up-to-date type definitions for Minecraft's vanilla content, such as block types, entity IDs, and item names. Integrating this would improve type safety and reduce the chance of runtime errors from typos or incorrect IDs. |
| `@minecraft/server-gametest` | A framework for creating and running in-game tests. This would be a powerful tool for automating quality assurance and ensuring that new features or bug fixes don't introduce regressions. |
| `@minecraft/common` | Contains common types and utilities that are shared across other `@minecraft` packages. While not directly providing new features, it can be a useful dependency for ensuring compatibility with other packages. |
| `@minecraft/diagnostics` | An API for discovering and diagnosing issues with content. This could be useful for creating in-game debugging tools or for logging performance metrics. |
| `@minecraft/debug-utilities` | Provides a set of utilities for debugging scripts, such as assertions and logging helpers. This could help streamline the development process and make it easier to track down bugs. |
| `@minecraft/gameplay-utilities` | A collection of utilities for common gameplay scenarios. This could provide pre-built solutions for tasks like managing player inventories, creating leaderboards, or other common gameplay mechanics. |
| `eslint-plugin-minecraft-linting` | An ESLint plugin with custom rules for Minecraft scripting. This would help enforce best practices, catch common errors, and improve code quality and consistency across the project. |

## Cannot Be Used / Unnecessary

These packages are either incompatible with our project's scope or provide functionality that we don't need.

| Package | Reason for Exclusion |
| --- | --- |
| `@minecraft/server-net` | Designed for making HTTP requests from a Bedrock Dedicated Server, which is outside the scope of our current project. |
| `@minecraft/server-admin` | Provides APIs for administering a Bedrock Dedicated Server, which is not relevant to our addon. |
| `@minecraft/server-editor` | Contains APIs for the in-game editor, which we are not currently using. |
| `@minecraft/server-graphics`| An API for changing graphics and rendering settings, which is not a feature of our addon. |
| `@minecraft/core-build-tasks` | Internal build tools for the Minecraft scripting team. Not intended for general use. |
| `@minecraft/api-docs-generator`| A tool for generating API documentation. Not needed for our project. |
| `@minecraft/markup-generators-plugin` | A plugin for the API documentation generator. Not needed for our project. |
