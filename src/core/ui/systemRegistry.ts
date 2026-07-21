import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';

export interface SystemDefinition {
    /** Unique identifier for the system (used for reset logic). */
    id: string;
    /** Display title for the system button. */
    title: string;
    /** Icon path for the system button. */
    icon: string;
    /** The panel ID to open when configured. */
    showFunction?: (player: import('@minecraft/server').Player) => Promise<void> | void;
    configPanelId?: string;
    /** The category of the system. */
    category?: string;
    /** Whether this system is hidden from the main menu. */
    hidden?: boolean;
    /** If true, this system is managed via a standard config schema panel. */
    isSimpleConfig: boolean;
}

let cachedSystemRegistry: SystemDefinition[] | undefined;

export function getSystemRegistry(): SystemDefinition[] {
    if (isDefined(cachedSystemRegistry)) {
        return cachedSystemRegistry;
    }

    cachedSystemRegistry = [
        // 1. Add simple schema-based systems first
        ...configPanelSchema
            .filter((s) => s.id !== 'sidebar')
            .map((schema) => {
                const def: SystemDefinition = {
                    id: schema.id,
                    title: schema.title,
                    icon: schema.icon,
                    configPanelId: `config_${schema.id}`,
                    isSimpleConfig: true
                };
                if (isNonEmptyString(schema.category)) def.category = schema.category;
                if (schema.hidden === true) def.hidden = schema.hidden;
                return def;
            }),
        // 2. Add complex custom systems
        {
            id: 'kits',
            title: 'Kit System',
            icon: 'textures/ui/inventory_icon',
            showFunction: async (player) => {
                const { showKitManagementPanel } = await import('@features/kit/ui/panel.js');
                await showKitManagementPanel(player);
            },
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'ranks',
            title: 'Rank System',
            icon: 'textures/ui/permissions_member_star.png',
            configPanelId: 'rankManagementPanel',
            category: 'Visuals',
            isSimpleConfig: false
        },
        {
            id: 'shop',
            title: 'Shop System',
            icon: 'textures/items/emerald',
            showFunction: async (player) => {
                const { showShopManagementPanel } = await import('@features/shop/ui/adminPanel.js');
                await showShopManagementPanel(player);
            },
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'xray_ores',
            title: 'X-Ray Ores',
            icon: 'textures/blocks/diamond_ore',
            showFunction: async (player) => {
                const { showXrayOresPanel } = await import('@features/moderation/ui/xrayPanel.js');
                await showXrayOresPanel(player);
            },
            category: 'Moderation',
            hidden: true,
            isSimpleConfig: false
        },
        {
            id: 'sidebar',
            title: 'Sidebar System',
            icon: 'textures/items/book_writable',
            configPanelId: 'sidebarMainPanel',
            category: 'Visuals',
            isSimpleConfig: false
        },
        {
            id: 'worldProtection',
            title: 'World Protection System',
            icon: 'textures/ui/icon_recipe_nature',
            showFunction: async (player) => {
                const { showWorldProtectionListPanel } = await import('@features/essentials/ui/worldProtectionPanel.js');
                await showWorldProtectionListPanel(player);
            },
            category: 'World',
            isSimpleConfig: false
        }
    ];

    return cachedSystemRegistry;
}

export function getSystemDefinition(id: string): SystemDefinition | undefined {
    return getSystemRegistry().find((s) => s.id === id);
}
