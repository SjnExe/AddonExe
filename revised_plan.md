# UI Panel Refactoring Plan

## Overview

The current UI system in the addon relies on a centralized string-based registry (`panelRegistry.ts`), a centralized action registry (`actionRegistry.ts`), and a routing system (`PanelRouter.ts`) that matches string IDs to handlers. This design has several drawbacks:

- Lack of type safety when navigating between panels or triggering actions.
- Passing around a loosely typed `UIContext`.
- Distant separation of UI definition (in registries) and business logic (in handlers/actions).
- Heavy use of index-based selection for form responses, making it prone to errors when dynamic lists are modified.

## Proposed Architecture: Type-Safe Fluent Builders

We will introduce a programmatic, type-safe builder pattern that closely wraps the `@minecraft/server-ui` API, adding utility functions (like pagination, back buttons, and permission checks) while directly binding closures for actions instead of string IDs.

### 1. Form Builders (`src/core/ui/builders/`)

Create wrapper classes for standard UI forms that accept callbacks instead of string IDs:

- **`ActionFormBuilder`**: Wraps `ActionFormData`. Adds `.button(text, icon, onClick)` where `onClick` is a closure directly executing the logic or opening another panel.
- **`ModalFormBuilder`**: Wraps `ModalFormData`. Binds responses directly to typed objects.
- **`MessageFormBuilder`**: Wraps `MessageFormData`.

### 2. Incremental Migration & Routing

To avoid a "Big Bang" rewrite that touches dozens of files and risks regressions, we will use an **incremental migration strategy**.

- We will update `showPanel` (or introduce a new method) to support these functional panels directly.
- We will migrate the core menu (`mainPanel`) and a few related generic panels first.
- The legacy `panelRegistry`, `actionRegistry`, and `PanelRouter` will remain intact for this session to support unmigrated feature panels, but will be marked as `@deprecated`.

### 3. Functional Panel Generation

Migrated panels will become async functions that take a player and strongly typed arguments.

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

### 4. Execution Steps for This Session

1. **Implement Core Builders**: Write `ActionFormBuilder`, `ModalFormBuilder`, and `MessageFormBuilder` in a new `src/core/ui/builders/` directory.
2. **Update UI Manager**: Extend `uiManager.ts` (or add utilities) to facilitate showing these new builder forms.
3. **Migrate Main/General Panels**: Refactor `src/core/ui/panels/generalPanel.ts` and `mainPanel` definitions to use the new builder pattern, demonstrating the new architecture.
4. **Complete Pre-commit Steps**: Ensure proper testing, verifications, reviews, and reflections are done.
5. **Submit**: Commit the changes. (Full migration of feature panels and deletion of deprecated registries will follow in future tasks).
