import { ActionFormData } from '@minecraft/server-ui';

import { Config, getConfig, updateMultipleConfig } from '@core/configManager.js';
import {
    GamesConfig,
    getAuctionHouseConfig,
    getEconomyConfig,
    getGamesConfig,
    getSidebarConfig,
    getSpawnConfig,
    getTeamConfig,
    getXrayConfig,
    saveAuctionHouseConfig,
    saveEconomyConfig,
    saveGamesConfig,
    saveSidebarConfig,
    saveSpawnConfig,
    saveTeamConfig,
    saveXrayConfig,
    SidebarConfig
} from '@core/configurations.js';
import type { PlayerData } from '@core/playerDataManager.js';
import ranksConfig from '@core/ranksConfig.default.js';
import { spawnConfig } from '@core/spawnConfig.default.js';
import { xrayConfig } from '@core/xrayConfig.default.js';
import { AnticheatConfig, getAnticheatConfig, saveAnticheatConfig } from '@features/anticheat/anticheatConfigLoader.js';
import { auctionHouseConfig } from '@features/auctionHouse/auctionHouseConfig.default.js';
import { economyConfig } from '@features/economy/economyConfig.js';
import { kitsConfig } from '@features/kits/kitsConfig.default.js';
import { shopConfig } from '@features/shop/shopConfig.js';
import { teamConfig } from '@features/teams/teamConfig.js';
import { PanelItem } from './types.js';

type SpawnConfig = typeof spawnConfig;
type EconomyConfig = typeof economyConfig;
type XrayConfig = typeof xrayConfig;
type TeamConfig = typeof teamConfig;
type RanksConfig = typeof ranksConfig;
type KitsConfig = typeof kitsConfig;
type ShopConfig = typeof shopConfig;
type AuctionHouseConfig = typeof auctionHouseConfig;

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
        | AnticheatConfig
        | AuctionHouseConfig
        | GamesConfig;
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
    },
    auctionHouse: {
        get: getAuctionHouseConfig,
        save: (config: unknown) => saveAuctionHouseConfig(config as AuctionHouseConfig)
    },
    games: {
        get: getGamesConfig,
        save: (config: unknown) => saveGamesConfig(config as GamesConfig)
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

/**
 * Helper to add pagination items to a PanelItem array.
 */
export function addPaginationItems(items: PanelItem[], page: number, totalItems: number): void {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        items.push({
            id: '__prev__',
            text: '§6< Previous Page',
            icon: 'textures/ui/arrow_left.png',
            permissionLevel: 1024,
            actionType: 'functionCall',
            actionValue: 'prevPage'
        });
    }
    if (page < totalPages) {
        items.push({
            id: '__next__',
            text: '§6Next Page >',
            icon: 'textures/ui/arrow_right.png',
            permissionLevel: 1024,
            actionType: 'functionCall',
            actionValue: 'nextPage'
        });
    }
}

/**
 * Helper to add a standardized back button to a PanelItem array.
 */
export function addBackButton(items: PanelItem[], targetPanelId: string): void {
    items.push({
        id: '__back__',
        text: '§l§8< Back',
        icon: 'textures/gui/controls/left.png',
        permissionLevel: 1024,
        actionType: 'openPanel',
        actionValue: targetPanelId
    });
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
        if (sys.hidden === true) return false;
        return pData.permissionLevel <= 1;
    });
}

/**
 * Returns unique categories available to the player.
 */
export function getVisibleCategories(pData: PlayerData): SystemItem[] {
    const systems = getVisibleSystems(pData);
    const categories = new Set<string>();
    for (const sys of systems) {
        if (sys.category !== undefined && sys.category.length > 0) categories.add(sys.category);
    }

    const sortedCategories = [...categories].toSorted();

    // Add "Reset" category if Owner
    if (pData.permissionLevel === 0) {
        // Reset isn't a category in systemRegistry, it's a panel.
        // We handle Reset separately in panelBuilder.
    }

    return sortedCategories.map((cat) => ({
        id: cat,
        title: `§l§3${cat} Settings§r`,
        icon: categoryIcons[cat] ?? 'textures/ui/settings_glyph_color_2x'
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
        .toSorted((a, b) => a.title.replaceAll(/§./g, '').localeCompare(b.title.replaceAll(/§./g, '')));
}
