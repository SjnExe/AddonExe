# UI Panel Refactoring Plan

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

- [ ] Create `src/core/ui/builders/` directory.
- [ ] Implement and test `ActionFormBuilder`.
- [ ] Implement and test `ModalFormBuilder`.
- [ ] Implement and test `MessageFormBuilder`.

### Session 2: Refactor Core Panels

- [ ] Migrate `mainPanel` to the new functional builder pattern in `src/core/ui/panels/`.
- [ ] Migrate `adminPanel` to the new functional builder pattern.
- [ ] Migrate `playerPanel` to the new functional builder pattern.
- [ ] Migrate `configPanel` to the new functional builder pattern.

### Session 3: Refactor Feature Panels (Part 1)

- [ ] Migrate UI panels in `src/features/auction/ui/`.
- [ ] Migrate UI panels in `src/features/economy/ui/`.
- [ ] Migrate UI panels in `src/features/essentials/ui/`.
- [ ] Migrate UI panels in `src/features/games/ui/`.

### Session 4: Refactor Feature Panels (Part 2)

- [ ] Migrate UI panels in `src/features/kit/ui/`.
- [ ] Migrate UI panels in `src/features/moderation/ui/`.
- [ ] Migrate UI panels in `src/features/shop/ui/`.
- [ ] Migrate UI panels in `src/features/social/ui/`.
- [ ] Migrate UI panels in `src/features/team/ui/`.
- [ ] Migrate UI panels in `src/features/teleport/ui/`.
- [ ] Migrate UI panels in `src/features/vote/ui/`.

### Session 5: Update Systems Registry and Remove Legacy Code

- [ ] Modify `systemRegistry.ts` to accept functional callbacks for settings panels instead of mapping to string-based config schemas.
- [ ] Modify `uiUtils.ts` to support the new builder patterns.
- [ ] Delete `panelRegistry.ts`.
- [ ] Delete `actionRegistry.ts`.
- [ ] Delete `PanelRouter.ts`.
- [ ] Remove legacy UI context types in `src/core/ui/types.ts`.

## Benefits

- **Type Safety**: No more runtime errors due to misspelled panel IDs or action names.
- **Maintainability**: Logic is co-located with UI definitions.
- **Simplicity**: No complex routing logic or context passing. Context is passed simply via function arguments.
