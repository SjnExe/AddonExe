import { configPanelSchema } from './configPanelRegistry.js';

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
    /** If true, this system is managed via a standard config schema panel. */
    isSimpleConfig: boolean;
}

/**
 * Registry of all configurable systems in the addon.
 * This unifies simple schema-based configs and complex custom UI systems.
 */
let cachedSystemRegistry: SystemDefinition[] | null = null;

export function getSystemRegistry(): SystemDefinition[] {
    if (cachedSystemRegistry) {
        return cachedSystemRegistry;
    }

    cachedSystemRegistry = [
        // 1. Add simple schema-based systems first
        ...configPanelSchema
            .filter((s) => s.id !== 'sidebar')
            .map((schema) => ({
                id: schema.id,
                title: schema.title,
                icon: schema.icon,
                configPanelId: `config_${schema.id}`,
                category: schema.category,
                isSimpleConfig: true
            })),

        // 2. Add complex custom systems
        {
            id: 'kits',
            title: '§l§5Kit System§r',
            icon: 'textures/ui/inventory_icon',
            configPanelId: 'kitManagementPanel',
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'ranks',
            title: '§l§4Rank System§r',
            icon: 'textures/ui/permissions_member_star.png',
            configPanelId: 'rankManagementPanel',
            category: 'Visuals',
            isSimpleConfig: false
        },
        {
            id: 'shop',
            title: '§l§2Shop System§r',
            icon: 'textures/items/emerald',
            configPanelId: 'shopManagementPanel',
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'commands',
            title: '§l§dCommand System§r',
            icon: 'textures/ui/command_block_icon',
            configPanelId: 'commandSystemPanel',
            category: 'System',
            isSimpleConfig: false
        },
        {
            id: 'economy',
            title: '§l§6Economy System§r',
            icon: 'textures/ui/Scaffolding',
            configPanelId: 'economyPanel',
            category: 'Economy',
            isSimpleConfig: false
        },
        {
            id: 'xray_ores',
            title: '§l§4X-Ray Ores§r',
            icon: 'textures/blocks/diamond_ore',
            configPanelId: 'xrayOresPanel',
            category: 'Moderation',
            isSimpleConfig: false
        },
        {
            id: 'sidebar',
            title: '§l§eSidebar System§r',
            icon: 'textures/items/book_writable',
            configPanelId: 'sidebarMainPanel',
            category: 'Visuals',
            isSimpleConfig: false
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
