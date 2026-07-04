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
    configPanelId: string;
    /** The category of the system. */
    category?: string;
    /** Whether this system is hidden from the main menu. */
    hidden?: boolean;
    /** If true, this system is managed via a standard config schema panel. */
    isSimpleConfig: boolean;
}

/**
 * Registry of all configurable systems in the addon.
 * This unifies simple schema-based configs and complex custom UI systems.
 */
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

                {
            id: 'economyMain',
            title: 'Economy Main Config',
            icon: 'textures/ui/Scaffolding',
            configPanelId: 'config_economyMain',
            category: 'Economy',
            hidden: true,
            isSimpleConfig: true
        },
                {
            id: 'shopSettings',
            title: 'Shop Settings',
            icon: 'textures/items/emerald',
            configPanelId: 'config_shopSettings',
            category: 'Economy',
            hidden: true,
            isSimpleConfig: true
        },
        // 2. Add complex custom systems
        {
            id: 'kits',
            title: 'Kit System',
            icon: 'textures/ui/inventory_icon',
            configPanelId: 'kitManagementPanel',
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
            configPanelId: 'shopManagementPanel',
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'economy',
            title: 'Economy System',
            icon: 'textures/ui/Scaffolding',
            configPanelId: 'economyPanel',
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'xray_ores',
            title: 'X-Ray Ores',
            icon: 'textures/blocks/diamond_ore',
            configPanelId: 'xrayOresPanel',
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
            configPanelId: 'worldProtectionListPanel',
            category: 'World',
            isSimpleConfig: false
        },
        {
            id: 'games',
            title: 'Games Config',
            icon: 'textures/ui/controller_icon',
            configPanelId: 'config_games',
            category: 'Games',
            isSimpleConfig: true
        },
        {
            id: 'wordle',
            title: 'Wordle Config',
            icon: 'textures/ui/icon_recipe_item',
            configPanelId: 'config_wordle',
            category: 'Games',
            isSimpleConfig: true
        }
    ];

    return cachedSystemRegistry;
}

/**
 * Helper to get a system definition by ID.
 */
export function getSystemDefinition(id: string): SystemDefinition | undefined {
    return getSystemRegistry().find((s) => s.id === id);
}
