/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import * as mc from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import * as reportManager from '../../features/moderation/reportManager.js';
import * as bountyManager from '../bountyManager.js';
import { loadConfig } from '../configLoader.js';
import { getConfig } from '../configManager.js';
import { getEconomyConfig, getKitsConfig, getShopConfig, getTeamConfig, getXrayConfig } from '../configurations.js';
import { getAllKits } from '../kitAdminManager.js';
import { errorLog } from '../logger.js';
import { getValueFromPath } from '../objectUtils.js';
import {
    getAllKnownPlayers,
    getAllPlayerNameIdMap,
    getOrCreatePlayer,
    getPlayer,
    loadPlayerData,
    PlayerData
} from '../playerDataManager.js';
import * as rankManager from '../rankManager.js';
import * as rulesManager from '../rulesManager.js';
import { formatCurrency, resolveIcon, formatLocation } from '../utils.js';

import { configPanelSchema } from './configPanelRegistry.js';
import { panelDefinitions } from './panelRegistry.js';
import { MainConfig, PanelDefinition, PanelItem, ShopListEntry, UIContext } from './types.js';
import {
    configHandlers,
    getPaginatedItems,
    getSystemsByCategory,
    getVisibleCategories,
    itemsPerPage
} from './uiUtils.js';

import type { TeamData } from '../../features/teams/teamManager.js';

interface Item {
    displayName?: string;
    icon?: string;
    buyPrice?: number;
    sellPrice?: number;
}

let allItems: Record<string, Item> = {};

// --- Helper Functions ---

function getStaticMenuItems(panelDef: PanelDefinition, permissionLevel: number): PanelItem[] {
    const config = getConfig() as unknown as MainConfig;
    const items = (panelDef.items || [])
        .filter((item: PanelItem) => {
            if (item.actionValue === 'shopMainPanel' && !config.shop.enabled) {
                return false;
            }
            return permissionLevel <= item.permissionLevel;
        })
        .sort((a: PanelItem, b: PanelItem) => (a.sortId || 0) - (b.sortId || 0));

    // Create a copy to avoid mutating the registry
    const resultItems: PanelItem[] = items.map((i) => ({ ...i }));

    if (panelDef.parentPanelId) {
        resultItems.unshift({
            id: '__back__',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: panelDef.parentPanelId
        });
    }
    return resultItems;
}

async function addPanelBody(form: ActionFormData, player: mc.Player, panelId: string, context: UIContext) {
    if (panelId === 'myStatsPanel') {
        const pData = getOrCreatePlayer(player);
        const rank = rankManager.getPlayerRank(player, getConfig());
        if (!pData || !rank) {
            form.body('§4Could not retrieve your stats.');
            return;
        }
        const bounty = bountyManager.getBounty(player.id)?.amount ?? 0;
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        const teamName = team ? `§3${team.name}` : '§8None';

        form.body(
            [
                `§8Rank: §r${rank.chatFormatting?.nameColor ?? '§8'}${rank.name}`,
                `§8Team: ${teamName}`,
                `§8Balance: §2${formatCurrency(pData.balance)}`,
                `§8Bounty on you: §6${formatCurrency(bounty)}`
            ].join('\n')
        );
    } else if (panelId === 'playerActionsPanel' && context.targetPlayerId) {
        const pData = (context.targetData as PlayerData | undefined) || loadPlayerData(String(context.targetPlayerId));
        if (!pData) {
            form.body('§4Could not load player data.');
            return;
        }
        const rank = rankManager.getRankById(pData.rankId);
        const bounty = bountyManager.getBounty(context.targetPlayerId as string)?.amount ?? 0;
        form.body(
            [
                `§8Rank: §r${rank?.chatFormatting?.nameColor ?? '§8'}${rank?.name ?? 'Unknown'}`,
                `§8Balance: §2${formatCurrency(pData.balance)}`,
                `§8Bounty: §6${formatCurrency(bounty)}`
            ].join('\n')
        );
    } else if (panelId === 'reportActionsPanel') {
        let targetReport = context.targetReport as reportManager.Report | undefined;
        if (!targetReport && context.selectedItemId) {
            const reports = reportManager.getAllReports();
            targetReport = reports.find((r) => r.id === context.selectedItemId);
        }

        if (targetReport) {
            // Update context so handlers have it
            context.targetReport = targetReport;
            form.body(
                [
                    `§8Report ID: §6${String(targetReport.id)}`,
                    `§8Reported Player: §6${targetReport.reportedPlayerName}`,
                    `§8Reporter: §6${targetReport.reporterName}`,
                    `§8Reason: §6${targetReport.reason}`,
                    `§8Status: §6${targetReport.status}`,
                    `§8Date: §6${new Date(targetReport.timestamp).toLocaleString()}`
                ].join('\n')
            );
        } else {
            form.body('§4Report not found.');
        }
    } else if (panelId === 'placeholderListPanel') {
        form.body(
            `§l§6Global Placeholders§r (Scoreboard, Floating Text)\n` +
                `{server_name}, {tps}, {online}, {max_players}, {time}, {date}\n\n` +
                `§l§dPersonal Placeholders§r (Action Bar Only)\n` +
                `{name}, {money}, {rank}, {kills}, {deaths}, {streak}, {kdr}, {playtime}, {team}, {ping}, {x}, {y}, {z}, {dimension}`
        );
    }
}

export function getVisiblePlayerActionItems(
    context: UIContext,
    permissionLevel: number,
    viewerId?: string
): PanelItem[] {
    const panelDef = panelDefinitions.playerActionsPanel;
    const config = getConfig() as unknown as MainConfig;
    const menuItems = getStaticMenuItems(panelDef, permissionLevel);
    const visibleItems: PanelItem[] = [];

    const isSelf = viewerId && context.targetPlayerId === viewerId;
    const selfDisabledActions = ['kick', 'ban', 'mute', 'unmute', 'freeze', 'unfreeze', 'tpa', 'tpahere', 'report'];

    for (const item of menuItems) {
        if (item.id === '__back__') {
            visibleItems.push(item);
            continue;
        }
        if (isSelf && selfDisabledActions.includes(item.id)) {
            continue;
        }
        const commandName = item.id;
        const settings = config.commandSettings || {};
        if (settings[commandName]?.enabled === false) {
            continue;
        }
        if (context.fromPanel === 'playerManagementPanel' && item.permissionLevel < 1024) {
            visibleItems.push(item);
        } else if (context.fromPanel === 'playerListPanel' && item.permissionLevel >= 1024) {
            visibleItems.push(item);
        }
    }
    return visibleItems;
}

// --- Main Item Generator ---

export async function getPanelItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
    const pData = getPlayer(player.id);
    if (!pData) return [];

    // Initialize items config if needed
    if (Object.keys(allItems).length === 0) {
        try {
            allItems = await loadConfig('./core/itemsConfig.js');
        } catch {
            // Ignore error
        }
    }

    const permissionLevel = pData.permissionLevel;
    const items: PanelItem[] = [];

    const addBack = (target: string) => {
        items.push({
            id: '__back__',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: target
        });
    };

    if (panelId === 'placeholderListPanel') {
        addBack('adminPanel'); // Fixed back target to Admin Panel, not Sidebar
        return items;
    }

    if (panelId === 'sidebarLineActionPanel' || panelId === 'actionBarLineActionPanel') {
        const isSidebar = panelId === 'sidebarLineActionPanel';
        addBack(isSidebar ? 'sidebarLinesPanel' : 'actionBarLinesPanel');
        items.push({
            id: 'edit',
            text: 'Edit',
            icon: 'textures/ui/icon_setting',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'editLine'
        });
        items.push({
            id: 'moveUp',
            text: 'Move Up',
            icon: 'textures/gui/controls/up',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'moveUp'
        });
        items.push({
            id: 'moveDown',
            text: 'Move Down',
            icon: 'textures/gui/controls/down',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'moveDown'
        });
        items.push({
            id: 'delete',
            text: 'Delete',
            icon: 'textures/ui/trash',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'deleteLine'
        });
        return items;
    }

    // --- Admin: Floating Text ---
    if (panelId === 'floatingTextListPanel') {
        addBack('adminPanel');
        items.push({ id: 'placeholderList', text: '§l§6View Placeholders', icon: 'textures/ui/icon_sign', permissionLevel: 1, actionType: 'openPanel', actionValue: 'placeholderListPanel' });
        items.push({ id: 'create', text: '§l§2+ Create New', icon: 'textures/ui/color_plus', permissionLevel: 1, actionType: 'openPanel', actionValue: 'floatingTextCreatePanel' });

        const { floatingTextManager } = await import('../floatingTextManager.js');
        const texts = floatingTextManager.getAllTexts();

        texts.forEach(text => {
             items.push({
                 id: text.id,
                 text: `§6${text.id}§r\n${formatLocation(text.location)}`,
                 permissionLevel: 1,
                 actionType: 'openPanel',
                 actionValue: 'floatingTextActionPanel' // Needs context.id
             });
        });
        return items;
    }

    if (panelId === 'floatingTextActionPanel') {
        addBack('floatingTextListPanel');
        items.push({ id: 'edit', text: 'Edit Settings', icon: 'textures/ui/icon_setting', permissionLevel: 1, actionType: 'openPanel', actionValue: 'floatingTextEditPanel' });
        items.push({ id: 'respawn', text: 'Respawn Entity', icon: 'textures/ui/refresh_light', permissionLevel: 1, actionType: 'functionCall', actionValue: 'respawnText' });
        items.push({ id: 'despawn', text: 'Despawn Entity', icon: 'textures/ui/cancel', permissionLevel: 1, actionType: 'functionCall', actionValue: 'despawnText' });
        items.push({ id: 'delete', text: '§4Delete Text', icon: 'textures/ui/trash', permissionLevel: 1, actionType: 'functionCall', actionValue: 'deleteText' });
        return items;
    }

    // --- Config & Categories ---
    if (panelId === 'configCategoryPanel') {
        addBack('adminPanel');
        const categories = getVisibleCategories(pData);
        const paginated = getPaginatedItems(categories, context.page || 1);
        paginated.forEach((cat) => {
            items.push({
                id: cat.id,
                text: cat.title,
                icon: cat.icon,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: `configSubCategoryPanel_${cat.id}`
            });
        });
        if (permissionLevel === 0) {
            items.push({
                id: 'resetSettings',
                text: '§l§cReset Settings§r',
                icon: 'textures/ui/wysiwyg_reset',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: 'configResetPanel'
            });
        }
        addPaginationButtonsToItems(items, context.page || 1, categories.length);
        return items;
    }

    if (panelId.startsWith('configSubCategoryPanel_')) {
        const category = panelId.replace('configSubCategoryPanel_', '');
        addBack('configCategoryPanel');
        const systems = getSystemsByCategory(pData, category);
        const paginated = getPaginatedItems(systems, context.page || 1);
        paginated.forEach((sys) => {
            items.push({
                id: sys.id,
                text: sys.title,
                icon: sys.icon,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: sys.id.startsWith('config_') ? sys.id : sys.id
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, systems.length);
        return items;
    }

    if (panelId === 'configResetPanel') {
        addBack('configCategoryPanel');
        const categories = getVisibleCategories(pData);
        const paginated = getPaginatedItems(categories, context.page || 1);
        paginated.forEach((cat) => {
            items.push({
                id: cat.id,
                text: `Reset ${cat.title}`,
                icon: cat.icon,
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `configResetCategoryPanel_${cat.id}`
            });
        });
        if (context.page! >= Math.ceil(categories.length / itemsPerPage)) {
            items.push({
                id: 'resetAll',
                text: '§l§4Reset All Systems',
                icon: 'textures/ui/trash',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'resetAllConfig'
            });
        }
        addPaginationButtonsToItems(items, context.page || 1, categories.length);
        return items;
    }

    if (panelId.startsWith('configResetCategoryPanel_')) {
        const category = panelId.replace('configResetCategoryPanel_', '');
        addBack('configResetPanel');
        const systems = getSystemsByCategory(pData, category);
        const paginated = getPaginatedItems(systems, context.page || 1);

        items.push({
            id: 'resetCategory',
            text: `§l§4Reset All ${category}§r`,
            icon: 'textures/ui/trash',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: `resetCategory_${category}`
        });

        paginated.forEach((sys) => {
            items.push({
                id: sys.id,
                text: `§4Reset ${sys.title}`,
                icon: sys.icon,
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: `resetSystem_${sys.id}`
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, systems.length);
        return items;
    }

    // --- TPA Panels ---
    if (panelId === 'tpaSettingsPanel') {
        const isEnabled = !pData.tpaRequestsDisabled;
        items.push({
            id: 'toggleTpa',
            text: isEnabled ? '§2Requests: Allowed' : '§4Requests: Blocked',
            icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
            permissionLevel: 1024,
            actionType: 'functionCall',
            actionValue: 'toggleTpa'
        });
        items.push({
            id: 'blockList',
            text: 'Blocked Players',
            icon: 'textures/ui/icon_multiplayer',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: 'tpaBlockListPanel'
        });
        return items;
    }

    if (panelId === 'tpaBlockListPanel') {
        addBack('tpaSettingsPanel');
        const blocked = pData.tpaBlockedPlayerIds || [];
        for (const id of blocked) {
            const name = loadPlayerData(id)?.name || id;
            items.push({
                id: id,
                text: name,
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'unblockPlayer'
            });
        }
        return items;
    }

    // --- Shop Panels ---

    if (panelId === 'shopMainPanel') {
        addBack('mainPanel');
        const shopConfig = getShopConfig() as any;
        const validCategories = Object.keys(shopConfig.categories)
            .filter((categoryName: string) => {
                const category = shopConfig.categories[categoryName];
                if (!category) return false;
                return Object.keys(category.items).length > 0 || Object.keys(category.subCategories).length > 0;
            })
            .sort();

        validCategories.forEach((catName: string) => {
            const cat = shopConfig.categories[catName];
            items.push({
                id: catName,
                text: catName,
                icon: cat.icon,
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: `shopCategoryPanel_${catName}`
            });
        });
        return items;
    }

    if (panelId.startsWith('shopCategoryPanel_')) {
        const categoryName = context.categoryName as string;
        addBack('shopMainPanel');
        const shopConfig = getShopConfig() as any;
        const category = shopConfig.categories[categoryName];
        if (category) {
            const subCategories: ShopListEntry[] = Object.keys(category.subCategories)
                .sort()
                .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' as const }));
            const shopItems: ShopListEntry[] = Object.keys(category.items).map((id) => ({
                id,
                ...category.items[id],
                type: 'item' as const
            }));
            const allEntries = [...subCategories, ...shopItems];
            const paginated = getPaginatedItems(allEntries, context.page || 1);

            paginated.forEach((entry) => {
                if (entry.type === 'subCategory') {
                    items.push({
                        id: entry.name,
                        text: `§6${entry.name}`,
                        icon: entry.icon,
                        permissionLevel: 1024,
                        actionType: 'openPanel',
                        actionValue: `shopItemListPanel_${categoryName}_${entry.name}`
                    });
                } else {
                    const masterItem = allItems[entry.id] || {};
                    const displayName = entry.displayName || masterItem.displayName || entry.id;
                    const buy = entry.buyPrice > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                    const sell = entry.sellPrice > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                    const priceString = [buy, sell].filter(Boolean).join(' ');
                    items.push({
                        id: entry.id,
                        text: `${displayName}\n${priceString}`,
                        icon: entry.icon || masterItem.icon,
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'buyOrSell'
                    });
                }
            });
            addPaginationButtonsToItems(items, context.page || 1, allEntries.length);
        }
        return items;
    }

    if (panelId.startsWith('shopItemListPanel_')) {
        const { categoryName, subCategoryName } = context;
        addBack(`shopCategoryPanel_${categoryName}`);
        const shopConfig = getShopConfig() as any;
        const category = shopConfig.categories[categoryName as string];
        const subCategory = category?.subCategories[subCategoryName as string];

        if (subCategory) {
            const shopItems = Object.keys(subCategory.items).map((id) => ({
                id,
                ...subCategory.items[id],
                type: 'item' as const
            }));
            const paginated = getPaginatedItems(shopItems, context.page || 1);
            paginated.forEach((entry) => {
                const masterItem = allItems[entry.id] || {};
                const displayName = entry.displayName || masterItem.displayName || entry.id;
                const buy = entry.buyPrice > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                const sell = entry.sellPrice > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                const priceString = [buy, sell].filter(Boolean).join(' ');
                items.push({
                    id: entry.id,
                    text: `${displayName}\n${priceString}`,
                    icon: entry.icon || masterItem.icon,
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'buyOrSell'
                });
            });
            addPaginationButtonsToItems(items, context.page || 1, shopItems.length);
        }
        return items;
    }

    // --- Admin Shop Panels ---

    if (panelId === 'shopManagementPanel') {
        addBack('configCategoryPanel');
        const mainConfig = getConfig() as unknown as MainConfig;
        const isEnabled = mainConfig.shop.enabled;
        const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED';
        items.push({
            id: 'toggleShop',
            text: toggleText,
            icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'toggleShop'
        });
        items.push({
            id: 'addCategory',
            text: '§l§2+ Add Category',
            icon: 'textures/ui/color_plus',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'addCategory'
        });

        const shopConfig = getShopConfig() as any;
        const categories = Object.keys(shopConfig.categories).sort();
        const paginated = getPaginatedItems(categories, context.page || 1);

        paginated.forEach((catName: string) => {
            const cat = shopConfig.categories[catName];
            items.push({
                id: catName,
                text: catName,
                icon: cat.icon,
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAdminCategoryPanel_${catName}`
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, categories.length);
        return items;
    }

    if (panelId.startsWith('shopAdminCategoryPanel_')) {
        const categoryName = context.categoryName as string;
        addBack('shopManagementPanel');
        items.push({
            id: 'addItem',
            text: '§l§2+ Add Item',
            icon: 'textures/ui/color_plus',
            permissionLevel: 0,
            actionType: 'openPanel',
            actionValue: `shopAddItemPanel_${categoryName}`
        });
        items.push({
            id: 'addSubCategory',
            text: '§l§2+ Add Subcategory',
            icon: 'textures/ui/color_plus',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'addSubCategory'
        });
        items.push({
            id: 'editCategory',
            text: '§l§9* Edit Category',
            icon: 'textures/ui/icon_setting',
            permissionLevel: 0,
            actionType: 'openPanel',
            actionValue: `shopAdminCategoryActionPanel_${categoryName}`
        });

        const shopConfig = getShopConfig() as any;
        const category = shopConfig.categories[categoryName];
        if (category) {
            const subCategories = Object.keys(category.subCategories).sort();
            const shopItems = Object.keys(category.items);
            const allEntries = [
                ...subCategories.map((n) => ({ id: n, type: 'subCategory' })),
                ...shopItems.map((n) => ({ id: n, type: 'item' }))
            ];
            const paginated = getPaginatedItems(allEntries, context.page || 1);

            paginated.forEach((entry: any) => {
                if (entry.type === 'subCategory') {
                    const sub = category.subCategories[entry.id];
                    items.push({
                        id: entry.id,
                        text: `§6${entry.id}`,
                        icon: sub.icon,
                        permissionLevel: 0,
                        actionType: 'openPanel',
                        actionValue: `shopAdminSubCategoryItemPanel_${categoryName}_${entry.id}`
                    });
                } else {
                    const item = category.items[entry.id];
                    const masterItem = allItems[entry.id] || {};
                    items.push({
                        id: entry.id,
                        text: item.displayName || masterItem.displayName || entry.id,
                        icon: item.icon || masterItem.icon,
                        permissionLevel: 0,
                        actionType: 'functionCall',
                        actionValue: 'editItem'
                    });
                }
            });
            addPaginationButtonsToItems(items, context.page || 1, allEntries.length);
        }
        return items;
    }

    if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
        const { categoryName, subCategoryName } = context;
        addBack(`shopAdminCategoryPanel_${categoryName}`);
        items.push({
            id: 'addItem',
            text: '§l§2+ Add Item',
            icon: 'textures/ui/color_plus',
            permissionLevel: 0,
            actionType: 'openPanel',
            actionValue: `shopAddItemPanel_${categoryName}`
        }); // Pass subCat in context
        items.push({
            id: 'editSubCategory',
            text: '§l§9* Edit Subcategory',
            icon: 'textures/ui/icon_setting',
            permissionLevel: 0,
            actionType: 'openPanel',
            actionValue: `shopAdminSubCategoryActionPanel_${subCategoryName}`
        });

        const shopConfig = getShopConfig() as any;
        const subCategory = shopConfig.categories[categoryName as string]?.subCategories[subCategoryName as string];
        if (subCategory) {
            const shopItems = Object.keys(subCategory.items);
            const paginated = getPaginatedItems(shopItems, context.page || 1);
            paginated.forEach((id: string) => {
                const item = subCategory.items[id];
                const masterItem = allItems[id] || {};
                items.push({
                    id: id,
                    text: item.displayName || masterItem.displayName || id,
                    icon: item.icon || masterItem.icon,
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: 'editItem'
                });
            });
            addPaginationButtonsToItems(items, context.page || 1, shopItems.length);
        }
        return items;
    }

    if (panelId.startsWith('shopAddItemPanel_')) {
        const { categoryName } = context;
        // This panel has back button + "Add Custom Item" + List of all items
        addBack(`shopAdminCategoryPanel_${categoryName}`); // Or subCat parent
        items.push({
            id: 'addCustomItem',
            text: '§l§2+ Add Custom Item',
            icon: 'textures/ui/color_plus',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'addCustomItem'
        });

        const allPossibleItems = Object.keys(allItems);
        const paginated = getPaginatedItems(allPossibleItems, context.page || 1);
        paginated.forEach((itemId) => {
            const masterItem = allItems[itemId];
            items.push({
                id: itemId,
                text: masterItem.displayName ?? itemId,
                icon: masterItem.icon,
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'addItemFromList'
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, allPossibleItems.length);
        return items;
    }

    if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
        const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
        items.push({
            id: 'edit',
            text: 'Edit',
            icon: 'textures/ui/icon_setting',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'editCategory'
        });
        items.push({
            id: 'delete',
            text: '§4Delete',
            icon: 'textures/ui/trash',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'deleteCategory'
        });
        items.push({
            id: 'back',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 0,
            actionType: 'openPanel',
            actionValue: `shopAdminCategoryPanel_${categoryName}`
        });
        return items;
    }

    if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
        const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        items.push({
            id: 'edit',
            text: 'Edit',
            icon: 'textures/ui/icon_setting',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'editSubCategory'
        });
        items.push({
            id: 'delete',
            text: '§4Delete',
            icon: 'textures/ui/trash',
            permissionLevel: 0,
            actionType: 'functionCall',
            actionValue: 'deleteSubCategory'
        });
        items.push({
            id: 'back',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 0,
            actionType: 'openPanel',
            actionValue: `shopAdminSubCategoryItemPanel_${subCategoryName}`
        });
        return items;
    }

    // --- Team Panels ---

    if (panelId === 'teamMainPanel') {
        addBack('mainPanel');
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        const teamConfig = getTeamConfig();

        if (team) {
            const isOwnerOrAdmin = team.ownerId === player.id || team.admins.includes(player.id);
            items.push({
                id: 'teamMembersPanel',
                text: '§l§3Team Members',
                icon: 'textures/ui/icon_multiplayer',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamMembersPanel'
            });
            if (isOwnerOrAdmin) {
                items.push({
                    id: 'teamManagePanel',
                    text: '§l§4Manage Team',
                    icon: 'textures/ui/op',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamManagePanel'
                });
            }
            items.push({
                id: 'teamSettingsPanel',
                text: '§l§6Team Settings',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamSettingsPanel'
            });
            items.push({
                id: 'leaveTeam',
                text: '§4Leave Team',
                icon: 'textures/ui/cancel',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'leaveTeam'
            });
        } else {
            items.push({
                id: 'createTeam',
                text: `§l§2Create Team\n§r§6Cost: ${formatCurrency(teamConfig.creationCost)}`,
                icon: 'textures/ui/color_plus',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamCreatePanel'
            });
            items.push({
                id: 'joinTeam',
                text: '§l§9Join Team',
                icon: 'textures/ui/world_glyph_color',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'teamBrowserPanel'
            });
        }
        return items;
    }

    if (panelId === 'teamBrowserPanel') {
        addBack('teamMainPanel');
        const { getAllTeams } = await import('../../features/teams/teamManager.js');
        let teams = getAllTeams();
        if (permissionLevel >= 1024) {
            teams = teams.filter((t) => t.open !== false);
        }
        teams = teams.sort((a, b) => b.members.length - a.members.length);
        const paginated = getPaginatedItems(teams, context.page || 1);

        paginated.forEach((team) => {
            const ownerData = loadPlayerData(team.ownerId);
            items.push({
                id: String(team.id),
                text: `${team.name} §8(ID: ${team.id})\n§rOwner: ${ownerData?.name ?? 'Unknown'} | Members: ${team.members.length}`,
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'applyToTeam'
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, teams.length);
        return items;
    }

    if (panelId === 'teamMembersPanel') {
        addBack('teamMainPanel');
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (team) {
            for (const memberId of team.members) {
                const memData = loadPlayerData(memberId);
                const onlineP = mc.world.getAllPlayers().find((p) => p.id === memberId);
                const status = onlineP ? '§2(Online)' : '§8(Offline)';
                let role = 'Member';
                if (team.ownerId === memberId) role = '§4Owner';
                else if (team.admins.includes(memberId)) role = '§2Admin';

                items.push({
                    id: memberId,
                    text: `${role} §r${memData?.name ?? 'Unknown'}\n${status}`,
                    icon: 'textures/ui/icon_steve',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'memberActionPanel'
                });
            }
        }
        return items;
    }

    if (panelId === 'memberActionPanel') {
        addBack('teamMembersPanel');
        const memberId = context.selectedItemId;
        if (!memberId) return items;

        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        const targetTeam = getTeamByPlayer(memberId);

        if (team && targetTeam && team.id === targetTeam.id) {
            const isOwner = team.ownerId === player.id;
            const isAdmin = team.admins.includes(player.id);
            const targetIsOwner = team.ownerId === memberId;
            const targetIsAdmin = team.admins.includes(memberId);

            if ((isOwner || isAdmin) && !targetIsOwner) {
                items.push({ id: 'kick', text: '§4Kick Member', icon: 'textures/ui/cancel', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'kickTeamMember' });
            }
            if (isOwner) {
                if (targetIsAdmin) {
                    items.push({ id: 'demote', text: 'Demote to Member', icon: 'textures/ui/arrow_down_icon', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'demoteTeamMember' });
                } else {
                    items.push({ id: 'promote', text: 'Promote to Admin', icon: 'textures/ui/arrow_up_icon', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'promoteTeamMember' });
                }
                items.push({ id: 'transfer', text: 'Transfer Ownership', icon: 'textures/ui/op', permissionLevel: 1024, actionType: 'functionCall', actionValue: 'transferTeamOwnership' });
            }
        }
        return items;
    }

    if (panelId === 'teamManagePanel') {
        addBack('teamMainPanel');
        const { getTeamByPlayer, getTeam } = await import('../../features/teams/teamManager.js');
        const { teamId } = context;
        let team: TeamData | null = null;
        if (teamId && permissionLevel < 1024) {
            team = getTeam(Number(teamId)) ?? null;
        } else {
            team = getTeamByPlayer(player.id);
        }

        if (team) {
            const isOwner = team.ownerId === player.id;
            const isAdmin = team.admins.includes(player.id);
            const isServerAdmin = permissionLevel < 1024;

            if (isOwner || isAdmin || isServerAdmin) {
                items.push({
                    id: 'invitePlayer',
                    text: '§l§2Invite Player',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'playerSearchPanel'
                });
                items.push({
                    id: 'joinRequests',
                    text: `§l§6Join Requests §r(${team.applications.length})`,
                    icon: 'textures/ui/mail_icon',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamRequestsPanel'
                });
                // Manage members not implemented as separate panel yet, reusing list
                items.push({
                    id: 'manageMembers',
                    text: '§l§3Manage Members',
                    icon: 'textures/ui/icon_multiplayer',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamMembersPanel'
                });
            }
            if (isOwner || isAdmin) {
                items.push({
                    id: 'teamHome',
                    text: '§l§5Team Home',
                    icon: 'textures/ui/icon_recipe_nature',
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: 'teamHomePanel'
                });
            }
            if (isOwner || isServerAdmin) {
                items.push({
                    id: 'deleteTeam',
                    text: '§l§4Delete Team',
                    icon: 'textures/ui/trash',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'deleteTeam'
                });
            }
        }
        return items;
    }

    if (panelId === 'teamHomePanel') {
        addBack('teamManagePanel');
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (team) {
            if (team.home) {
                items.push({
                    id: 'teleportHome',
                    text: '§l§2Teleport',
                    icon: 'textures/items/ender_pearl',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'teleportHome'
                });
            }
            const canManage = team.ownerId === player.id || team.admins.includes(player.id);
            if (canManage) {
                items.push({
                    id: 'setHome',
                    text: '§l§6Update Location',
                    icon: 'textures/ui/icon_recipe_nature',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'setHome'
                });
                if (team.home) {
                    items.push({
                        id: 'deleteHome',
                        text: '§l§4Delete Home',
                        icon: 'textures/ui/trash',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'deleteHome'
                    });
                }
            }
        }
        return items;
    }

    if (panelId === 'teamRequestsPanel') {
        addBack('teamManagePanel');
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const team = getTeamByPlayer(player.id);
        if (team && team.applications.length > 0) {
            team.applications.forEach((app) => {
                items.push({
                    id: app.playerId,
                    text: app.playerName,
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'manageRequest'
                });
            });
        }
        return items;
    }

    if (panelId === 'teamInvitesPanel') {
        addBack('teamMainPanel');
        const invites = pData.pendingInvites || [];
        if (invites.length > 0) {
            invites.forEach((invite) => {
                const date = new Date(invite.timestamp).toLocaleDateString();
                items.push({
                    id: String(invite.teamId),
                    text: `${invite.teamName}\n§8Received: ${date}`,
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'manageInvite'
                });
            });
            items.push({
                id: 'denyAll',
                text: '§4Deny All Invites',
                icon: 'textures/ui/cancel',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'denyAllInvites'
            });
        }
        return items;
    }

    // --- Player Lists ---
    if (panelId === 'playerListPanel' || panelId === 'playerManagementPanel') {
        addBack('mainPanel');
        items.push({
            id: 'searchPlayer',
            text: '§l§2Search',
            icon: 'textures/ui/magnifyingGlass',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: 'playerSearchPanel'
        });

        const isOnlineList = panelId === 'playerListPanel';
        let playerEntries: { name: string; id: string }[] = [];

        if (isOnlineList) {
            playerEntries = Array.from(mc.world.getAllPlayers()).map((p) => ({ name: p.name, id: p.id }));
        } else {
            playerEntries = getAllKnownPlayers();
        }
        playerEntries.sort((a, b) => a.name.localeCompare(b.name));

        const paginated = getPaginatedItems(playerEntries, context.page || 1);
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const config = getConfig();

        for (const entry of paginated) {
            const targetP = isOnlineList ? mc.world.getAllPlayers().find((p) => p.id === entry.id) : null;
            const rank = targetP
                ? rankManager.getPlayerRank(targetP, config)
                : rankManager.getRankById(loadPlayerData(entry.id)?.rankId || '');
            const team = getTeamByPlayer(entry.id);
            const prefix = rank?.chatFormatting?.prefixText ? `§6[§r${rank.chatFormatting.prefixText}§6]§r ` : '';
            const teamSuffix = team ? `\n§6[§r${team.name}§6]` : '';

            items.push({
                id: entry.id,
                text: `${prefix}${entry.name}${teamSuffix}`,
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'playerActionsPanel'
            });
        }
        addPaginationButtonsToItems(items, context.page || 1, playerEntries.length);
        return items;
    }

    if (panelId === 'playerActionsPanel') {
        const visible = getVisiblePlayerActionItems(context, permissionLevel, player.id);
        return visible;
    }

    // --- Misc Panels ---
    if (panelId === 'rulesManagementPanel') {
        addBack('mainPanel');
        if (permissionLevel <= 1) {
            items.push({
                id: 'addRule',
                text: '§l§2+ Add Rule',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'addRulePanel'
            });
        }
        const rules = rulesManager.getRules();
        const paginated = getPaginatedItems(rules, context.page || 1);
        paginated.forEach((rule, idx) => {
            const realIndex = (context.page! - 1) * itemsPerPage + idx;
            items.push({
                id: String(realIndex),
                text: rule,
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'ruleActionPanel'
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, rules.length);
        return items;
    }

    // --- Economy & Mob Drops ---
    if (panelId === 'mobDropsSystemPanel') {
        addBack('economyPanel');
        items.push({
            id: 'addMob',
            text: '§l§2+ Add New Mob§r',
            icon: 'textures/ui/realms_green_check.png',
            permissionLevel: 1,
            actionType: 'openPanel',
            actionValue: 'addMobDropPanel'
        });

        const economyConfig = getEconomyConfig();
        const mobIds = Object.keys(economyConfig.mobMoney || {}).sort();
        const paginated = getPaginatedItems(mobIds, context.page || 1);

        paginated.forEach((mobId) => {
            const amount = economyConfig.mobMoney[mobId];
            const icon = resolveIcon(`${mobId}_spawn_egg`);
            items.push({
                id: mobId,
                text: `${mobId}\n§2${formatCurrency(amount)}`,
                icon: icon,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'editMobDropPanel'
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, mobIds.length);
        return items;
    }

    // --- Kits ---
    if (panelId === 'kitManagementPanel') {
        addBack('configCategoryPanel');
        const mainConfig = getConfig() as unknown as MainConfig;
        const isEnabled = mainConfig.kits.enabled;
        items.push({
            id: 'toggleKits',
            text: isEnabled ? '§2Kit System: ENABLED' : '§4Kit System: DISABLED',
            icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'toggleKits'
        });
        items.push({
            id: 'createKit',
            text: '§l§2+ Create New Kit',
            icon: 'textures/ui/color_plus',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'createKit'
        });

        const allKits = getAllKits();
        const kitNames = Object.keys(allKits);
        const paginated = getPaginatedItems(kitNames, context.page || 1);
        paginated.forEach((name) => {
            const kit = allKits[name];
            items.push({
                id: name,
                text: `${name}\n${kit.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
                icon: 'textures/ui/inventory_icon',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: `kitActionMenu_${name}`
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, kitNames.length);
        return items;
    }

    if (panelId.startsWith('kitActionMenu_')) {
        const kitName = panelId.replace('kitActionMenu_', '');
        addBack('kitManagementPanel');
        items.push({
            id: 'editSettings',
            text: 'Edit Settings',
            icon: 'textures/ui/icon_setting',
            permissionLevel: 1,
            actionType: 'openPanel',
            actionValue: `kitSettingsPanel_${kitName}`
        });
        items.push({
            id: 'editItems',
            text: 'Edit Items',
            icon: 'textures/ui/inventory_icon',
            permissionLevel: 1,
            actionType: 'openPanel',
            actionValue: `kitItemsPanel_${kitName}`
        });
        items.push({
            id: 'deleteKit',
            text: '§4Delete Kit',
            icon: 'textures/ui/cancel',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'deleteKit'
        });
        return items;
    }

    if (panelId.startsWith('kitItemsPanel_')) {
        const kitName = panelId.replace('kitItemsPanel_', '');
        addBack(`kitActionMenu_${kitName}`);
        items.push({
            id: 'addItem',
            text: '§l§2+ Add New Item',
            icon: 'textures/ui/color_plus',
            permissionLevel: 1,
            actionType: 'functionCall',
            actionValue: 'addKitItem'
        });

        const allKits = getAllKits();
        const kit = allKits[kitName];
        if (kit) {
            const paginated = getPaginatedItems(kit.items, context.page || 1);
            paginated.forEach((item, idx) => {
                const realIdx = (context.page! - 1) * itemsPerPage + idx;
                items.push({
                    id: String(realIdx),
                    text: `${realIdx + 1}. ${item.typeId.replace('minecraft:', '')} x${item.amount}`,
                    icon: 'textures/items/item_frame',
                    permissionLevel: 1,
                    actionType: 'functionCall',
                    actionValue: 'removeKitItem'
                });
            });
            addPaginationButtonsToItems(items, context.page || 1, kit.items.length);
        }
        return items;
    }

    // --- Bounties & Reports ---
    if (panelId === 'bountyListPanel') {
        addBack('gameplayPanel');
        const allBounties = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);
        const paginated = getPaginatedItems(allBounties, context.page || 1);
        paginated.forEach((bounty) => {
            items.push({
                id: bounty.targetId,
                text: `${bounty.name}\n§6${formatCurrency(bounty.amount)}`,
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'viewBounty' // Placeholder
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, allBounties.length);
        return items;
    }

    if (panelId === 'reportListPanel') {
        addBack('adminPanel');
        const reports = reportManager
            .getAllReports()
            .filter((r) => r.status === 'open' || r.status === 'assigned')
            .sort((a, b) => a.timestamp - b.timestamp);
        const paginated = getPaginatedItems(reports, context.page || 1);
        paginated.forEach((report) => {
            const statusColor = report.status === 'assigned' ? '§6' : '§4';
            items.push({
                id: report.id,
                text: `[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`,
                permissionLevel: 2,
                actionType: 'openPanel',
                actionValue: 'reportActionsPanel' // Needs context injection (selectedItemId)
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, reports.length);
        return items;
    }

    // --- Config Lists (Xray, Sidebar, Commands) ---
    if (panelId === 'xrayOresPanel') {
        addBack('configCategoryPanel');
        items.push({
            id: 'addOre',
            text: '§l§2+ Add New Ore§r',
            icon: 'textures/ui/color_plus',
            permissionLevel: 1,
            actionType: 'openPanel',
            actionValue: 'addXrayOrePanel'
        });
        const xrayConfig = getXrayConfig();
        const ores = Object.values(xrayConfig.monitoredOreTypes || {}).sort((a, b) =>
            a.oreName.localeCompare(b.oreName)
        );
        ores.forEach((ore, idx) => {
            items.push({
                id: String(idx),
                text: `§6${ore.oreName}§r\n§8${ore.blocks?.[0]?.blockId ?? 'Unknown'}`,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'editXrayOrePanel' // Context: oreIndex (selectedItemId)
            });
        });
        return items;
    }

    if (panelId === 'commandSystemPanel') {
        addBack('configCategoryPanel');
        const config = getConfig() as unknown as MainConfig;
        const allCommands = Object.keys(config.commandSettings || {})
            .filter((c) => !c.startsWith('_'))
            .sort();
        const paginated = getPaginatedItems(allCommands, context.page || 1);
        paginated.forEach((cmd) => {
            const enabled = config.commandSettings[cmd]?.enabled ?? false;
            items.push({
                id: cmd,
                text: `${cmd}\n${enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: 'commandSettingsPanel' // Context: commandName (selectedItemId)
            });
        });
        addPaginationButtonsToItems(items, context.page || 1, allCommands.length);
        return items;
    }

    if (panelId === 'sidebarLinesPanel' || panelId === 'actionBarLinesPanel') {
        addBack('sidebarMainPanel');
        const isSidebar = panelId === 'sidebarLinesPanel';
        items.push({
            id: 'addLine',
            text: '§l§2+ Add Line',
            icon: 'textures/ui/color_plus',
            permissionLevel: 1,
            actionType: 'openPanel',
            actionValue: isSidebar ? 'sidebarLineAddPanel' : 'actionBarLineAddPanel'
        });

        const { getSidebarConfig } = await import('../configurations.js');
        const sbConfig = getSidebarConfig();
        const lines = isSidebar ? sbConfig.sidebarLines : sbConfig.actionBarLines;

        lines.forEach((line, idx) => {
            items.push({
                id: String(idx),
                text: `${idx + 1}. ${line}`,
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: isSidebar ? 'sidebarLineActionPanel' : 'actionBarLineActionPanel' // Context: lineIndex
            });
        });
        return items;
    }

    if (panelId === 'sidebarMainPanel') {
        // Fallthrough to getStaticMenuItems which handles the registry items
    }

    // --- Default Registry Fallback ---
    const def = panelDefinitions[panelId];
    if (def) {
        return getStaticMenuItems(def, permissionLevel);
    }

    return items;
}

// --- Helper for Pagination Buttons ---
function addPaginationButtonsToItems(items: PanelItem[], page: number, totalItems: number) {
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

// --- Form Builder ---

export async function buildPanelForm(
    player: mc.Player,
    panelId: string,
    context: UIContext
): Promise<ActionFormData | ModalFormData | null> {
    try {
        // Modal Forms (Handled directly)
        if (
            panelId.startsWith('config_') ||
            panelId === 'teamCreatePanel' ||
            panelId === 'teamSearchPanel' ||
            panelId === 'playerSearchPanel' ||
            panelId === 'teamSettingsPanel' ||
            panelId === 'addRulePanel' ||
            panelId === 'addHelpfulLinkPanel' ||
            panelId === 'floatingTextCreatePanel' ||
            panelId === 'floatingTextEditPanel' ||
            panelId === 'addMobDropPanel' ||
            panelId === 'editMobDropPanel' ||
            panelId === 'addRankPanel' ||
            panelId === 'editRankPanel' ||
            panelId === 'rankSettingsPanel' ||
            panelId === 'sidebarLineEditPanel' ||
            panelId === 'sidebarLineAddPanel' || // ADDED
            panelId === 'actionBarLineEditPanel' || // ADDED
            panelId === 'actionBarLineAddPanel' || // ADDED
            panelId === 'commandSettingsPanel' ||
            panelId === 'addXrayOrePanel' ||
            panelId === 'editXrayOrePanel' ||
            panelId.startsWith('kitSettingsPanel_') ||
            panelId.startsWith('kitDetailPanel_') ||
            panelId === 'tpaSettingsPanel' ||
            panelId === 'tpaBlockListPanel'
        ) {
            return buildModalForm(player, panelId, context);
        }

        // Action Forms (Use getPanelItems)
        const items = await getPanelItems(player, panelId, context);
        const form = new ActionFormData();

        // Set Title & Body
        const panelDef = panelDefinitions[panelId];
        let title = panelDef ? panelDef.title : panelId;
        // Generic title fallback
        if (context.customTitle) title = context.customTitle;
        if (panelId.startsWith('shopCategoryPanel_')) title = `§l§2Shop - ${context.categoryName}`;
        if (panelId.startsWith('shopItemListPanel_')) title = `§l§2Shop - ${context.subCategoryName}`;
        form.title(title);

        await addPanelBody(form, player, panelId, context);

        for (const item of items) {
            form.button(item.text, item.icon);
        }

        return form;
    } catch (e) {
        errorLog(`[UIManager] Error building panel ${panelId}`, e);
        return null;
    }
}

// --- Internal Modal Builder (Legacy Logic) ---
async function buildModalForm(player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
    if (panelId.startsWith('config_')) {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find((c) => c.id === categoryId);
        if (!category) return null;
        const form = new ModalFormData().title(category.title);
        const configSource = category.configSource || 'main';
        const handler = configHandlers[configSource];
        if (!handler) return null;
        const config = handler.get() as unknown as Record<string, unknown>;

        for (const setting of category.settings) {
            const currentValue = getValueFromPath(config, setting.key);
            if (setting.type === 'toggle') {
                form.toggle(setting.label, { defaultValue: !!currentValue });
            } else if (setting.type === 'textField') {
                const val = currentValue ?? '';
                const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | boolean);
                form.textField(setting.label, setting.description || '', { defaultValue: strVal });
            } else if (setting.type === 'dropdown') {
                let index = -1;
                const options = setting.options || [];
                if (setting.key === 'logLevel' && typeof currentValue === 'number') index = currentValue;
                else index = options.indexOf(currentValue as string);
                form.dropdown(setting.label, options, { defaultValueIndex: Math.max(0, index) });
            }
        }
        return form;
    }

    if (panelId === 'teamCreatePanel') {
        const teamConfig = getTeamConfig();
        return new ModalFormData()
            .title('Create Team')
            .textField('Team Name', `Enter name (${teamConfig.nameMinLength}-${teamConfig.nameMaxLength} chars)`);
    }
    if (panelId === 'teamSearchPanel') return new ModalFormData().title('Search Team').textField('Team ID', 'Enter ID');
    if (panelId === 'playerSearchPanel')
        return new ModalFormData().title('Search Player').textField('Name', 'Enter name');

    if (panelId === 'teamSettingsPanel') {
        const { getTeamByPlayer } = await import('../../features/teams/teamManager.js');
        const pData = getOrCreatePlayer(player);
        const team = getTeamByPlayer(player.id);
        if (!team) return null;
        const canManage = team.ownerId === player.id || team.admins.includes(player.id);
        const form = new ModalFormData().title('Team Settings');
        form.toggle('Auto-Accept Team Teleport', { defaultValue: pData.teamSettings?.autoTpAccept ?? false });
        if (canManage) form.toggle('Allow Join Requests', { defaultValue: team.open ?? true });
        return form;
    }

    if (panelId === 'addRulePanel') return new ModalFormData().title('Add Rule').textField('Rule', 'Enter rule');
    if (panelId === 'addHelpfulLinkPanel')
        return new ModalFormData().title('Add Link').textField('Title', 'Title').textField('URL', 'URL');

    if (panelId === 'floatingTextCreatePanel') {
        return new ModalFormData()
            .title('Create New Floating Text')
            .textField('Unique ID (no spaces)', 'e.g., "welcome_message"')
            .textField('Text Content', 'Enter text to display');
    }

    if (panelId === 'floatingTextEditPanel') {
        const { floatingTextManager } = await import('../floatingTextManager.js');
        const id = context.id as string;
        const text = floatingTextManager.getTextById(id);
        if (!text) return null;
        const expiresAt = text.expiresAt ?? null;
        const updateInterval = text.updateInterval ?? 0;
        const dimensionOptions = ['Overworld', 'Nether', 'The End'];
        const dimensionIds = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
        const defaultDimensionIndex = Math.max(0, dimensionIds.indexOf(text.dimension));
        return new ModalFormData()
            .title(`Edit: ${id}`)
            .textField('Text Content', 'Enter the text to display', { defaultValue: text.text ?? '' })
            .textField('X', 'X', { defaultValue: String(+(text.location?.x ?? 0).toFixed(2)) })
            .textField('Y', 'Y', { defaultValue: String(+(text.location?.y ?? 0).toFixed(2)) })
            .textField('Z', 'Z', { defaultValue: String(+(text.location?.z ?? 0).toFixed(2)) })
            .dropdown('Dimension', dimensionOptions, { defaultValueIndex: defaultDimensionIndex })
            .textField('Update Interval', '0 to disable', { defaultValue: String(updateInterval) })
            .toggle('Expiration', { defaultValue: !!expiresAt })
            .textField('Expiration (mins)', 'mins', {
                defaultValue: expiresAt ? String(Math.round((expiresAt - Date.now()) / 60000)) : '0'
            });
    }

    if (panelId === 'addMobDropPanel')
        return new ModalFormData()
            .title('Add Mob Drop')
            .textField('Mob ID', 'minecraft:creeper')
            .textField('Amount', '10');

    if (panelId === 'editMobDropPanel') {
        const mobId = context.mobId as string | undefined;
        const economyConfig = getEconomyConfig();
        const currentAmount = economyConfig.mobMoney[mobId ?? ''] ?? 0;
        return new ActionFormData()
            .title(`Edit: ${mobId}`)
            .body(`Current amount: §2${formatCurrency(currentAmount)}`)
            .button('Edit Amount', 'textures/ui/icon_setting')
            .button('Delete', 'textures/ui/trash')
            .button('Back', 'textures/gui/controls/left.png') as any;
    }

    if (panelId === 'addRankPanel')
        return new ModalFormData()
            .title('Add Rank')
            .textField('Name', 'Name')
            .textField('ID', 'tag')
            .textField('Level', '0-1024')
            .textField('Name Color', '§6')
            .textField('Chat Color', '§f')
            .textField('Prefix', 'Prefix');

    if (panelId === 'editRankPanel') {
        const rankId = context.rankId as string | undefined;
        const rank = rankManager.getRankById(rankId ?? '');
        if (!rank) return null;
        return new ModalFormData()
            .title(`Edit Rank: ${rank.name}`)
            .textField('Name', 'Name', { defaultValue: rank.name })
            .textField('ID', 'ID', { defaultValue: rank.id })
            .textField('Level', 'Level', { defaultValue: String(rank.permissionLevel) })
            .textField('Name Color', 'Color', { defaultValue: rank.chatFormatting?.nameColor })
            .textField('Chat Color', 'Color', { defaultValue: rank.chatFormatting?.messageColor })
            .textField('Prefix', 'Prefix', { defaultValue: rank.chatFormatting?.prefixText })
            .textField('Nametag', 'Nametag', { defaultValue: rank.nametagPrefix });
    }

    if (panelId === 'rankSettingsPanel') {
        const config = getConfig() as unknown as MainConfig;
        const styles = ['Above Name', 'Before Name', 'After Name', 'Under Name'];
        const internal = ['above', 'before', 'after', 'under'];
        const current = config.ranks?.nameTagStyle || 'above';
        const idx = internal.indexOf(current);
        return new ModalFormData()
            .title('Rank Settings')
            .dropdown('Nametag Style', styles, { defaultValueIndex: Math.max(0, idx) });
    }

    if (panelId === 'sidebarLineEditPanel') {
        const { getSidebarConfig } = await import('../configurations.js');
        const config = getSidebarConfig();
        const lines = config.sidebarLines;
        const index = context.lineIndex ?? 0;
        const line = lines[index] ?? '';
        return new ModalFormData()
            .title(`Edit Line ${index + 1}`)
            .textField('Content', 'Content', { defaultValue: line });
    }

    if (panelId === 'sidebarLineAddPanel' || panelId === 'actionBarLineAddPanel') {
        return new ModalFormData().title('Add Line').textField('Content', 'Supports {money}, {name}, etc.');
    }

    if (panelId === 'actionBarLineEditPanel') {
        const { getSidebarConfig } = await import('../configurations.js');
        const config = getSidebarConfig();
        const lines = config.actionBarLines;
        const index = context.lineIndex ?? 0;
        const line = lines[index] ?? '';
        return new ModalFormData()
            .title(`Edit Line ${index + 1}`)
            .textField('Content', 'Content', { defaultValue: line });
    }

    if (panelId === 'commandSettingsPanel') {
        const commandName = context.commandName as string;
        const config = getConfig() as unknown as MainConfig;
        const settings = config.commandSettings?.[commandName] || {};
        return new ModalFormData()
            .title(`${commandName} Settings`)
            .toggle('Enable', { defaultValue: settings.enabled ?? false })
            .textField('Permission', 'Level', { defaultValue: String(settings.permissionLevel ?? 1024) });
    }

    if (panelId === 'addXrayOrePanel')
        return new ModalFormData()
            .title('Add Ore')
            .textField('Block', 'id')
            .textField('Dim', 'id')
            .textField('MinY', '-64')
            .textField('MaxY', '320')
            .textField('Name', 'Name');

    if (panelId === 'editXrayOrePanel') {
        const xrayConfig = getXrayConfig();
        const ores = Object.values(xrayConfig.monitoredOreTypes || {});
        const ore = ores[context.oreIndex as number];
        return new ModalFormData()
            .title('Edit Ore')
            .textField('Block', 'id', { defaultValue: ore.blocks?.[0]?.blockId })
            .textField('Dim', 'id', { defaultValue: ore.blocks?.[0]?.dimensionId })
            .textField('MinY', 'min', { defaultValue: String(ore.blocks?.[0]?.minY) })
            .textField('MaxY', 'max', { defaultValue: String(ore.blocks?.[0]?.maxY) })
            .textField('Name', 'Name', { defaultValue: ore.oreName });
    }

    if (panelId.startsWith('kitSettingsPanel_')) {
        const kitName = panelId.replace('kitSettingsPanel_', '');
        const kitsConfig = getKitsConfig();
        const kit = kitsConfig.kitDefinitions[kitName];
        if (!kit) return null;
        return new ModalFormData()
            .title(`Edit Kit: ${kitName}`)
            .toggle('Enabled', { defaultValue: kit.enabled })
            .textField('Name', 'Name', { defaultValue: kitName })
            .textField('Description', 'Description', { defaultValue: kit.description || '' })
            .textField('Icon', 'Icon', { defaultValue: kit.icon || '' })
            .textField('Cooldown', 'Cooldown', { defaultValue: String(kit.cooldownSeconds) })
            .textField('Permission', 'Level', { defaultValue: String(kit.permissionLevel) })
            .textField('Price', 'Price', { defaultValue: String(kit.price || 0) });
    }

    if (panelId.startsWith('kitDetailPanel_')) {
        const kitName = panelId.replace('kitDetailPanel_', '');
        const kitsConfig = getKitsConfig();
        const kit = kitsConfig.kitDefinitions[kitName];
        if (!kit) return null;
        return new ModalFormData()
            .title(`Edit Kit: ${kitName}`)
            .toggle('Enabled', { defaultValue: kit.enabled })
            .textField('Cooldown', 'Cooldown', { defaultValue: String(kit.cooldownSeconds) })
            .textField('Permission', 'Level', { defaultValue: String(kit.permissionLevel ?? 1024) });
    }

    return null;
}
