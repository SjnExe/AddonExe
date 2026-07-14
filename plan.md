# UI Panel Refactoring Plan

## Overview

The current UI system in the addon relies on a centralized string-based registry (`panelRegistry.ts`), a centralized action registry (`actionRegistry.ts`), and a routing system (`PanelRouter.ts`) that matches string IDs to handlers. This design has several drawbacks:

- Lack of type safety when navigating between panels or triggering actions.
- Passing around a loosely typed `UIContext`.
- Distant separation of UI definition (in registries) and business logic (in handlers/actions).
- Heavy use of index-based selection for form responses, making it prone to errors when dynamic lists are modified.

## Proposed Architecture: Type-Safe Fluent Builders

We will replace the string-based registry with a programmatic, type-safe builder pattern that closely wraps the `@minecraft/server-ui` API, while adding utility functions (like pagination, back buttons, and permission checks).

### 1. Form Builders (`src/core/ui/builders/`)

Create wrapper classes for standard UI forms that accept callbacks instead of string IDs:

- **`ActionFormBuilder`**: Wraps `ActionFormData`. Adds `.button(text, icon, onClick)` where `onClick` is a closure directly executing the logic or opening another panel.
- **`ModalFormBuilder`**: Wraps `ModalFormData`. Binds responses directly to types instead of a generic array of values.
- **`MessageFormBuilder`**: Wraps `MessageFormData`.

### 2. Eliminating Registries

- **Delete `panelRegistry.ts`**: UI layouts will no longer be stored globally.
- **Delete `actionRegistry.ts`**: Action logic will move directly to the component/panel that triggers it.
- **Delete `PanelRouter.ts`**: Navigation will simply be calling another asynchronous builder function.

### 3. Functional Panel Generation

Panels will become async functions that take a player and strongly typed arguments (replacing `UIContext`).

**Example Refactored Panel:**

```typescript
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

### 4. Migration Strategy

1. **Implement Core Builders**: Write and test the new `ActionFormBuilder`, `ModalFormBuilder` in a new `src/core/ui/builders/` directory.
2. **Refactor Core Panels**: Migrate `mainPanel`, `adminPanel`, `playerPanel`, and `configPanel` to functional panels in `src/core/ui/panels/`.
3. **Refactor Feature Panels**: Systematically update each feature folder (`src/features/*/ui/`) to use the new builder pattern.
4. **Remove Legacy Code**: Once all panels are migrated, delete the legacy registries, router, and context types in `src/core/ui/`.
5. **Update Systems Registry**: Modify `systemRegistry.ts` and `uiUtils.ts` to accept functional callbacks for settings panels instead of mapping to string-based config schemas.

## Benefits

- **Type Safety**: No more runtime errors due to misspelled panel IDs or action names.
- **Maintainability**: Logic is co-located with UI definitions.
- **Simplicity**: No complex routing logic or context passing. Context is passed simply via function arguments.
