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

In Session 2, we completely refactored the core system panels (`mainPanel`, `adminPanel`, `playerPanel`, and `configPanel`) using the fluent builder patterns (`ActionFormBuilder`, `ModalFormBuilder`).

- Replaced class-based `IPanelHandler` implementations with direct async functional exports (e.g., `showMainPanel`, `showStaffDashboardPanel`).
- Set up interceptors in `src/core/uiManager.ts` inside `showPanel` to intercept legacy string-based panel IDs and route them directly to the new async functional UI builders.
- Updated `src/core/ui/panels/index.ts` to stop registering the refactored handlers.
- The build, format, test, and type-check steps passed successfully.

When migrating future panels (Session 3 and beyond), continue adding interceptor routes in `src/core/uiManager.ts` to maintain fallback compatibility with unmigrated panels that might still be referencing string identifiers to trigger these.

### Session 3: Refactor Feature Panels (Part 1)

- [ ] Migrate UI panels in `src/features/auction/ui/`.
- [ ] Migrate UI panels in `src/features/economy/ui/`.
- [ ] Migrate UI panels in `src/features/essentials/ui/`.
- [ ] Migrate UI panels in `src/features/games/ui/`.

#### Session 3 Handover Context

_(To be written by future sessions of Jules)_

### Session 4: Refactor Feature Panels (Part 2)

- [ ] Migrate UI panels in `src/features/kit/ui/`.
- [ ] Migrate UI panels in `src/features/moderation/ui/`.
- [ ] Migrate UI panels in `src/features/shop/ui/`.
- [ ] Migrate UI panels in `src/features/social/ui/`.
- [ ] Migrate UI panels in `src/features/team/ui/`.
- [ ] Migrate UI panels in `src/features/teleport/ui/`.
- [ ] Migrate UI panels in `src/features/vote/ui/`.

#### Session 4 Handover Context

_(To be written by future sessions of Jules)_

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
