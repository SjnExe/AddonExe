import { ActionFormData } from '@minecraft/server-ui';

import { Config, getConfig, updateMultipleConfig } from '@core/configManager.js';
import {
    getAuctionHouseConfig,
    getEconomyConfig,
    getGamesConfig,
    getSidebarConfig,
    getTeamConfig,
    getWordleConfig,
    getXrayConfig,
    saveAuctionHouseConfig,
    saveEconomyConfig,
    saveGamesConfig,
    saveSidebarConfig,
    saveTeamConfig,
    saveWordleConfig,
    saveXrayConfig,
    SidebarConfig
} from '@core/configurations.js';

import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { AnticheatConfig, getAnticheatConfig, saveAnticheatConfig } from '@features/anticheat/configLoader.js';
import { xrayConfig } from '@features/anticheat/xrayConfig.js';
import { auctionHouseConfig } from '@features/auction/auctionHouseConfig.js';
import { economyConfig } from '@features/economy/economyConfig.js';
import { gamesConfig } from '@features/games/gamesConfig.js';
import { wordleConfig } from '@features/games/wordle/wordleConfig.js';
import ranksConfig from '@features/ranks/ranksConfig.js';
import { shopConfig } from '@features/shop/shopConfig.js';
import { teamConfig } from '@features/team/teamConfig.js';
import * as mc from '@minecraft/server';

type EconomyConfig = typeof economyConfig;
type XrayConfig = typeof xrayConfig;
type TeamConfig = typeof teamConfig;
type RanksConfig = typeof ranksConfig;
type ShopConfig = typeof shopConfig;
type AuctionHouseConfig = typeof auctionHouseConfig;
type GamesConfig = typeof gamesConfig;
type WordleConfig = typeof wordleConfig;

import { getSystemRegistry, SystemDefinition } from '@ui/systemRegistry.js';

export const itemsPerPage = 8;

interface ConfigHandler {
    get: () => typeof Config | EconomyConfig | XrayConfig | TeamConfig | RanksConfig | ShopConfig | SidebarConfig | AnticheatConfig | AuctionHouseConfig | GamesConfig | WordleConfig;
    save: (config: unknown) => void;
}

export const configHandlers: Record<string, ConfigHandler> = {
    main: {
        get: getConfig,
        save: (updates: unknown) => updateMultipleConfig(updates as Record<string, unknown>)
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
    },
    wordle: {
        get: getWordleConfig,
        save: (config: unknown) => saveWordleConfig(config as WordleConfig)
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
        form.button('< Previous');
    }
    if (page < totalPages) {
        form.button('Next >');
    }
}

/**
 * Helper to add pagination items to a any array.
 */
export function addPaginationItems(items: Record<string, unknown>[], page: number, totalItems: number, permission: string = 'ui.panel.member'): void {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        items.push({
            id: '__prev__',
            text: '< Previous Page',
            icon: 'textures/ui/arrow_left.png',
            permission,
            actionType: 'functionCall',
            actionValue: 'prevPage'
        });
    }
    if (page < totalPages) {
        items.push({
            id: '__next__',
            text: 'Next Page >',
            icon: 'textures/ui/arrow_right.png',
            permission,
            actionType: 'functionCall',
            actionValue: 'nextPage'
        });
    }
}

/**
 * Helper to add a standardized back button to a any array.
 */
export function addBackButton(items: Record<string, unknown>[], targetPanelId: string, permission: string = 'ui.panel.member'): void {
    items.push({
        id: '__back__',
        text: '< Back',
        icon: '',
        permission,
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
export function getVisibleSystems(player: mc.Player): SystemDefinition[] {
    return getSystemRegistry().filter((sys) => {
        if (sys.hidden === true) return false;
        return hasPermission(player, 'ui.panel.admin');
    });
}

/**
 * Returns unique categories available to the player.
 */
export function getVisibleCategories(player: mc.Player): SystemItem[] {
    const systems = getVisibleSystems(player);
    const categories = new Set<string>();
    for (const sys of systems) {
        if (sys.category !== undefined && sys.category.length > 0) categories.add(sys.category);
    }

    const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));

    // Add "Reset" category if Owner
    if (hasPermission(player, 'ui.panel.owner')) {
        // Reset isn't a category in systemRegistry, it's a panel.
        // We handle Reset separately in panelBuilder.
    }

    return sortedCategories.map((cat) => ({
        id: cat,
        title: cat === 'Games' ? 'Games System' : `${cat} Settings`,
        icon: categoryIcons[cat] ?? 'textures/ui/settings_glyph_color_2x'
    }));
}

/**
 * Returns systems belonging to a specific category.
 */
export function getSystemsByCategory(player: mc.Player, category: string): SystemItem[] {
    const systems = getVisibleSystems(player).filter((sys) => sys.category === category);
    return systems
        .map((sys) => ({
            id: sys.id,
            title: sys.title,
            icon: sys.icon
        }))
        .toSorted((a, b) => a.title.replaceAll(/§./g, '').localeCompare(b.title.replaceAll(/§./g, '')));
}

/**
 * Handles common selection actions like opening a panel or pagination.
 * Returns true if an action was handled, false otherwise.
 */
export function handleCommonSelection(player: mc.Player, panelId: string, item: Record<string, unknown>, context: Record<string, unknown>): boolean {
    const actionType = item.actionType as string | undefined;
    const actionValue = item.actionValue as string | undefined;
    const id = item.id as string | undefined;

    if (actionType === 'openPanel' && actionValue) {
        void showPanel(player, actionValue, {
            ...context,
            page: 1,
            selectedItemId: id,
            id: id
        });
        return true;
    }
    if (actionValue === 'prevPage') {
        const currentPage = (context.page as number) || 1;
        void showPanel(player, panelId, {
            ...context,
            page: Math.max(1, currentPage - 1)
        });
        return true;
    }
    if (actionValue === 'nextPage') {
        void showPanel(player, panelId);
        return true;
    }
    return false;
}
