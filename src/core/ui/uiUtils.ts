import { ActionFormData } from '@minecraft/server-ui';

import { Config, getConfig, updateMultipleConfig } from '@core/configManager.js';
import {
    getEconomyConfig,
    getSidebarConfig,
    getSpawnConfig,
    getTeamConfig,
    getXrayConfig,
    saveEconomyConfig,
    saveSidebarConfig,
    saveSpawnConfig,
    saveTeamConfig,
    saveXrayConfig,
    SidebarConfig
} from '@core/configurations.js';
import { kitsConfig } from '@core/kitsConfig.default.js';
import { PlayerData } from '@core/playerDataManager.js';
import ranksConfig from '@core/ranksConfig.default.js';
import { spawnConfig } from '@core/spawnConfig.default.js';
import { xrayConfig } from '@core/xrayConfig.default.js';
import { AnticheatConfig, getAnticheatConfig, saveAnticheatConfig } from '@features/anticheat/anticheatConfigLoader.js';
import { economyConfig } from '@features/economy/economyConfig.js';
import { shopConfig } from '@features/shop/shopConfig.js';
import { teamConfig } from '@features/teams/teamConfig.js';

type SpawnConfig = typeof spawnConfig;
type EconomyConfig = typeof economyConfig;
type XrayConfig = typeof xrayConfig;
type TeamConfig = typeof teamConfig;
type RanksConfig = typeof ranksConfig;
type KitsConfig = typeof kitsConfig;
type ShopConfig = typeof shopConfig;

import { getSystemRegistry, SystemDefinition } from './systemRegistry.js';

export const itemsPerPage = 8;

interface ConfigHandler {
    get: () =>
        | typeof Config
        | SpawnConfig
        | EconomyConfig
        | XrayConfig
        | TeamConfig
        | RanksConfig
        | KitsConfig
        | ShopConfig
        | SidebarConfig
        | AnticheatConfig;
    save: (config: unknown) => void;
}

export const configHandlers: Record<string, ConfigHandler> = {
    main: {
        get: getConfig,
        save: (updates: unknown) => updateMultipleConfig(updates as Record<string, unknown>)
    },
    spawn: {
        get: getSpawnConfig,
        save: (config: unknown) => saveSpawnConfig(config as SpawnConfig)
    },
    economy: {
        get: getEconomyConfig,
        save: (config: unknown) => saveEconomyConfig(config as EconomyConfig)
    },
    xray: {
        get: getXrayConfig,
        save: (config: unknown) => saveXrayConfig(config as XrayConfig)
    },
    team: {
        get: getTeamConfig,
        save: (config: unknown) => saveTeamConfig(config as TeamConfig)
    },
    sidebar: {
        get: getSidebarConfig,
        save: (config: unknown) => saveSidebarConfig(config as SidebarConfig)
    },
    anticheat: {
        get: getAnticheatConfig,
        save: (config: unknown) => saveAnticheatConfig(config as AnticheatConfig)
    }
};

/**
 * Helper to slice items for pagination.
 */
export function getPaginatedItems<T>(items: T[], page: number): T[] {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

/**
 * Helper to add pagination buttons to a form.
 */
export function addPaginationButtons(form: ActionFormData, page: number, totalItems: number): void {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        form.button('§l§4< §1Previous');
    }
    if (page < totalPages) {
        form.button('§l§1Next §4>');
    }
}

export interface SystemItem {
    id: string;
    title: string;
    icon: string;
    category?: string;
}

export const categoryIcons: Record<string, string> = {
    Server: 'textures/ui/icon_book_writable',
    Gameplay: 'textures/items/iron_sword',
    System: 'textures/ui/settings_glyph_color_2x',
    Economy: 'textures/items/emerald',
    Moderation: 'textures/ui/WarningGlyph',
    World: 'textures/blocks/beacon',
    Visuals: 'textures/items/book_writable',
    Social: 'textures/ui/icon_multiplayer',
    Chat: 'textures/ui/chat_send'
};

/**
 * Returns all registered systems.
 */
export function getAllSystems(): SystemDefinition[] {
    return getSystemRegistry();
}

/**
 * Returns all visible systems for a player (permission filtered).
 */
export function getVisibleSystems(pData: PlayerData): SystemDefinition[] {
    return getSystemRegistry().filter((sys) => {
        if (sys.id === 'economyGeneralSettings') return false; // Handled by Economy Panel
        if (sys.id === 'xray_ores') return false; // Handled by X-Ray Panel button, not main config
        return pData.permissionLevel <= 1;
    });
}

/**
 * Returns unique categories available to the player.
 */
export function getVisibleCategories(pData: PlayerData): SystemItem[] {
    const systems = getVisibleSystems(pData);
    const categories = new Set<string>();
    systems.forEach((sys) => {
        if (sys.category) categories.add(sys.category);
    });

    const sortedCategories = Array.from(categories).sort();

    // Add "Reset" category if Owner
    if (pData.permissionLevel === 0) {
        // Reset isn't a category in systemRegistry, it's a panel.
        // We handle Reset separately in panelBuilder.
    }

    return sortedCategories.map((cat) => ({
        id: cat,
        title: `§l§3${cat} Settings§r`,
        icon: categoryIcons[cat] || 'textures/ui/settings_glyph_color_2x'
    }));
}

/**
 * Returns systems belonging to a specific category.
 */
export function getSystemsByCategory(pData: PlayerData, category: string): SystemItem[] {
    const systems = getVisibleSystems(pData).filter((sys) => sys.category === category);
    return systems
        .map((sys) => ({
            id: sys.configPanelId,
            title: sys.title,
            icon: sys.icon
        }))
        .sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));
}
