# UI Panel Refactoring Plan

## Context

This project is a Minecraft Bedrock scripting/addon project written in TypeScript. We use Bun for tooling (`bun format`, `bun run build`, `bun run test`). The UI architecture aims to rely on a programmatic, type-safe fluent builder pattern wrapping the `@minecraft/server-ui` API, avoiding legacy string-based registries.

During this refactoring, we will make full use of available tooling and all relevant Minecraft dependencies (`@minecraft/server`, `@minecraft/server-ui`, `@minecraft/math`, `@minecraft/vanilla-data`) to ensure robust architecture, type safety, and optimal native integration.

## Overview

The current UI system in the addon relies on a centralized string-based registry (`panelRegistry.ts`), a centralized action registry (`actionRegistry.ts`), and a routing system (`PanelRouter.ts`) that matches string IDs to handlers. This design has several drawbacks:

- Lack of type safety when navigating between panels or triggering actions.
- Passing around a loosely typed `UIContext`.
- Distant separation of UI definition (in registries) and business logic (in handlers/actions).
- Heavy use of index-based selection for form responses, making it prone to errors when dynamic lists are modified.

**Important Note:** No backward compatibility or legacy stuff will be maintained during this refactoring. Legacy UI code, registries, and string-based routing will be completely removed, and everything will be strictly migrated to the new architecture.

## Proposed Architecture: Type-Safe Fluent Builders

We will replace the string-based registry with a programmatic, type-safe builder pattern that closely wraps the `@minecraft/server-ui` API, while adding utility functions (like pagination, back buttons, and permission checks).

### Form Builders (`src/core/ui/builders/`)

Create wrapper classes for standard UI forms that accept callbacks instead of string IDs:

- **`ActionFormBuilder`**: Wraps `ActionFormData`. Adds `.button(text, icon, onClick)` where `onClick` is a closure directly executing the logic or opening another panel.
- **`ModalFormBuilder`**: Wraps `ModalFormData`. Binds responses directly to types instead of a generic array of values.
- **`MessageFormBuilder`**: Wraps `MessageFormData`.

### Functional Panel Generation

Panels will become async functions that take a player and strongly typed arguments (replacing `UIContext`).

**Example Refactored Panel:**

```typescript
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '../builders/ActionFormBuilder';

export async function showAdminPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Admin Panel').body('Manage the server.');

    form.button('Floating Text', 'textures/ui/edit', async () => {
        await showFloatingTextPanel(player);
    });

    if (hasPermission(player, 'ui.panel.owner')) {
        form.button('Server Settings', 'textures/ui/settings', async () => {
            await showSettingsPanel(player);
        });
    }

    form.addBackButton(async () => {
        await showMainPanel(player);
    });

    await form.show(player);
}
```

## Migration Strategy (Divided into Sessions)

### Session 1: Implement Core Builders

- [x] Create `src/core/ui/builders/` directory.
- [x] Implement and test `ActionFormBuilder`.
- [x] Implement and test `ModalFormBuilder`.
- [x] Implement and test `MessageFormBuilder`.

#### Session 1 Handover Context

The core builder classes (`ActionFormBuilder`, `ModalFormBuilder`, `MessageFormBuilder`) have been created in `src/core/ui/builders/` and their respective tests have been written in `__tests__/`. `bun format` and `bun test` ran successfully for these new builders. The builders wrap `@minecraft/server-ui` API allowing callback-based button mapping (`ActionFormBuilder`), type-safe mapped form responses (`ModalFormBuilder`), and simple closures for `MessageFormBuilder`.

### Session 2: Refactor Core Panels

- [x] Migrate `mainPanel` to the new functional builder pattern in `src/core/ui/panels/`.
- [x] Migrate `adminPanel` to the new functional builder pattern.
- [x] Migrate `playerPanel` to the new functional builder pattern.
- [x] Migrate `configPanel` to the new functional builder pattern.

#### Session 2 Handover Context

The core panels (`mainPanel`, `adminPanel`, `playerPanel`, and `configPanel`) have been successfully migrated to the new functional builder pattern. They now use `ActionFormBuilder` and `ModalFormBuilder` rather than defining handlers for the legacy `panelRouter`. For unmigrated panels that are still routed through `panelRouter`, a temporary `showPanel` fallback is used within the newly refactored menus. The `ConfigPanelHandler` was entirely replaced with strongly-typed `showConfig*` async functions mapped correctly to their schema. Pre-commit tests and builds were run, and some existing tests unrelated to core panels failed due to mock issues, but core changes compile cleanly. Future sessions should replace the `showPanel` fallbacks by importing the direct functional definitions.

### Session 3: Refactor Feature Panels (Part 1)

- [x] Migrate UI panels in `src/features/auction/ui/`.
- [x] Migrate UI panels in `src/features/economy/ui/`.
- [x] Migrate UI panels in `src/features/essentials/ui/`.
- [x] Migrate UI panels in `src/features/games/ui/`.

#### Session 3 Handover Context

Successfully migrated all UI panels within the `auction`, `economy`, `essentials`, and `games` features. Replaced legacy `IPanelHandler` implementations (`BountyPanelHandler`, `EconomyPanelHandler`, `WorldProtectionPanelHandler`, and `GamesPanelHandler`) with newly created functional, callback-based panels utilizing the type-safe `ActionFormBuilder` and `ModalFormBuilder`. Eliminated the reliance on error-prone string action mapping and hardcoded index responses. To temporarily bridge the remaining un-refactored legacy systems, some panels still invoke `showPanel(player, 'legacyPanelId', context)`, which should be cleaned up as remaining modules and the central `actionRegistry`/`panelRegistry` are deprecated in subsequent sessions. All types pass compilation and the test suite is stable.

### Session 4: Refactor Feature Panels (Part 2)

- [x] Migrate UI panels in `src/features/kit/ui/`.
- [x] Migrate UI panels in `src/features/moderation/ui/`.
- [x] Migrate UI panels in `src/features/shop/ui/`.
- [x] Migrate UI panels in `src/features/social/ui/`.
- [x] Migrate UI panels in `src/features/team/ui/`.
- [x] Migrate UI panels in `src/features/teleport/ui/`.
- [x] Migrate UI panels in `src/features/vote/ui/`.

#### Session 4 Handover Context

Successfully replaced all legacy string-based `showPanel` routing with direct asynchronous functional imports (e.g. `showMainPanel`, `showMyStatsPanel`) within `shop`, `social`, `team`, and `teleport` UI feature files. The `vote` UI feature panel was also completely refactored to remove `ActionFormData` and `ModalFormData` in favor of the strongly-typed `ActionFormBuilder` and `ModalFormBuilder`, effectively decoupling it from the old manual index-matching logic. All changes were verified against `bun run check-types`. The next steps in Session 5 can now proceed to clean up the deprecated legacy routing and registry logic directly.

### Session 5: Update Systems Registry and Remove Legacy Code

- [ ] Modify `systemRegistry.ts` to accept functional callbacks for settings panels instead of mapping to string-based config schemas.
- [ ] Modify `uiUtils.ts` to support the new builder patterns.
- [ ] Delete `panelRegistry.ts`.
- [ ] Delete `actionRegistry.ts`.
- [ ] Delete `PanelRouter.ts`.
- [ ] Remove legacy UI context types in `src/core/ui/types.ts`.

#### Session 5 Handover Context

_(To be written by future sessions of Jules)_

## Benefits

- **Type Safety**: No more runtime errors due to misspelled panel IDs or action names.
- **Maintainability**: Logic is co-located with UI definitions.
- **Simplicity**: No complex routing logic or context passing. Context is passed simply via function arguments.
