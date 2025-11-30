import * as mc from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import { commandManager } from '../../modules/commands/commandManager.js';
import * as bountyManager from '../bountyManager.js';
import { loadConfig } from '../configLoader.js';
import { getConfig } from '../configManager.js';
import {
    getKitsConfig,
    getShopConfig,
    getEconomyConfig,
    getXrayConfig,
    getTeamConfig
} from '../configurations.js';
import * as helpfulLinksManager from '../helpfulLinksManager.js';
import { iconDB } from '../iconDB.js';
import { getAllKits } from '../kitAdminManager.js';
import { debugLog, errorLog } from '../logger.js';
import { getValueFromPath } from '../objectUtils.js';
import { getPlayer, getOrCreatePlayer, loadPlayerData, getAllPlayerNameIdMap } from '../playerDataManager.js';
import * as rankManager from '../rankManager.js';
import * as reportManager from '../reportManager.js';
import * as rulesManager from '../rulesManager.js';
import { formatCurrency } from '../utils.js';

import { configPanelSchema } from './configPanelRegistry.js';
import { panelDefinitions, UIContext, PanelDefinition, PanelItem } from './panelRegistry.js';
import {
    getVisibleConfigSystems,
    itemsPerPage,
    configHandlers,
    getPaginatedItems,
    addPaginationButtons
} from './uiUtils.js';

interface Item {
    displayName?: string;
    icon?: string;
    buyPrice?: number;
    sellPrice?: number;
}

let allItems: Record<string, Item> = {};

export function getMenuItems(panelDef: PanelDefinition, permissionLevel: number) {
    const config = getConfig();

    const items = (panelDef.items || [])
        .filter((item: PanelItem) => {
            if (item.actionValue === 'shopMainPanel' && !config.shop.enabled) {
                return false;
            }
            return permissionLevel <= item.permissionLevel;
        })
        .sort((a: PanelItem, b: PanelItem) => (a.sortId || 0) - (b.sortId || 0));

    if (panelDef.parentPanelId) {
        items.unshift({
            id: '__back__',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: panelDef.parentPanelId
        });
    }
    return items;
}

async function addPanelBody(form: ActionFormData, player: mc.Player, panelId: string, context: UIContext) {
    const config = getConfig();
    if (panelId === 'myStatsPanel') {
        const pData = getOrCreatePlayer(player);
        const rank = rankManager.getPlayerRank(player, config);
        if (!pData || !rank) {
            form.body('§4Could not retrieve your stats.');
            return;
        }
        const bounty = bountyManager.getBounty(player.id)?.amount ?? 0;
        const { getTeamByPlayer } = await import('../teamManager.js');
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
        const pData = context.targetData || loadPlayerData(context.targetPlayerId);
        if (!pData) {
            form.body('§4Could not load player data.');
            return;
        }
        const rank = rankManager.getRankById(pData.rankId);
        const bounty = bountyManager.getBounty(context.targetPlayerId)?.amount ?? 0;
        form.body(
            [
                `§8Rank: §r${rank?.chatFormatting?.nameColor ?? '§8'}${rank?.name ?? 'Unknown'}`,
                `§8Balance: §2${formatCurrency(pData.balance)}`,
                `§8Bounty: §6${formatCurrency(bounty)}`
            ].join('\n')
        );
    } else if (panelId === 'reportActionsPanel' && context.targetReport) {
        const { targetReport } = context;
        form.body(
            [
                `§8Report ID: §6${targetReport.id}`,
                `§8Reported Player: §6${targetReport.reportedPlayerName}`,
                `§8Reporter: §6${targetReport.reporterName}`,
                `§8Reason: §6${targetReport.reason}`,
                `§8Status: §6${targetReport.status}`,
                `§8Date: §6${new Date(targetReport.timestamp).toLocaleString()}`
            ].join('\n')
        );
    }
}

export function getVisiblePlayerActionItems(context: UIContext, permissionLevel: number, viewerId?: string) {
    const panelDef = panelDefinitions.playerActionsPanel;
    const config = getConfig();
    const menuItems = getMenuItems(panelDef, permissionLevel);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((config.commandSettings as any)[commandName]?.enabled === false) {
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

function buildShopMainPanel(form: ActionFormData, _context: UIContext) {
    const shopConfig = getShopConfig();

    const validCategories = Object.keys(shopConfig.categories)
        .filter((categoryName: string) => {
            const category = shopConfig.categories[categoryName];
            const hasItems = Object.keys(category.items).length > 0;
            const hasSubCategories = Object.keys(category.subCategories).length > 0;
            return hasItems || hasSubCategories;
        })
        .sort();

    if (validCategories.length === 0) {
        form.body('§4The shop is currently empty.');
        return;
    }

    for (const categoryName of validCategories) {
        const category = shopConfig.categories[categoryName];
        form.button(categoryName, category.icon);
    }
}

function buildShopCategoryPanel(form: ActionFormData, context: UIContext) {
    const { categoryName, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName ?? ''];

    if (!category) {
        form.body('§4Category not found.');
        return;
    }

    const subCategories = Object.keys(category.subCategories)
        .sort()
        .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' }));
    const items = Object.keys(category.items).map((id) => ({ id, ...category.items[id], type: 'item' }));

    const allEntries = [...subCategories, ...items];
    const paginatedEntries = getPaginatedItems(allEntries, page);

    for (const entry of paginatedEntries) {
        if ('items' in entry) {
            form.button(`§6${entry.name}`, entry.icon);
        } else {
            const masterItem = allItems[entry.id] || {};
            const displayName = entry.displayName || masterItem.displayName || entry.id;
            const icon = entry.icon || masterItem.icon;
            let priceString = '';
            if (view === 'buy' && (entry.buyPrice || 0) > 0) {
                priceString = `§2Buy: ${formatCurrency(entry.buyPrice)}`;
            } else if (view === 'sell' && (entry.sellPrice || 0) > 0) {
                priceString = `§4Sell: ${formatCurrency(entry.sellPrice)}`;
            } else {
                const buy = (entry.buyPrice || 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                const sell = (entry.sellPrice || 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                priceString = [buy, sell].filter(Boolean).join(' ');
            }
            form.button(`${displayName}\n${priceString}`, icon);
        }
    }
    addPaginationButtons(form, page, allEntries.length);
}

function buildShopItemListPanel(form: ActionFormData, context: UIContext) {
    const { categoryName, subCategoryName, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName ?? ''];
    if (!category) {
        form.body('§4Category not found.');
        return;
    }
    const subCategory = category.subCategories[subCategoryName ?? ''];
    if (!subCategory) {
        form.body('§4Subcategory not found.');
        return;
    }

    const items = Object.keys(subCategory.items).map((id) => ({ id, ...subCategory.items[id], type: 'item' }));
    const paginatedItems = getPaginatedItems(items, page);

    for (const item of paginatedItems) {
        const masterItem = allItems[item.id] || {};
        const displayName = item.displayName || masterItem.displayName || item.id;
        const icon = item.icon || masterItem.icon;
        let priceString = '';
        if (view === 'buy' && item.buyPrice > 0) {
            priceString = `§2Buy: ${formatCurrency(item.buyPrice)}`;
        } else if (view === 'sell' && item.sellPrice > 0) {
            priceString = `§4Sell: ${formatCurrency(item.sellPrice)}`;
        } else {
            const buy = item.buyPrice > 0 ? `§2B: ${formatCurrency(item.buyPrice)}` : '';
            const sell = item.sellPrice > 0 ? `§4S: ${formatCurrency(item.sellPrice)}` : '';
            priceString = [buy, sell].filter(Boolean).join(' ');
        }
        form.button(`${displayName}\n${priceString}`, icon);
    }
    addPaginationButtons(form, page, items.length);
}

function buildShopAdminMainPanel(form: ActionFormData, context: UIContext) {
    const { page = 1 } = context;
    const mainConfig = getConfig();

    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const isEnabled = mainConfig.shop.enabled;
    const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED';
    form.button(toggleText, isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel');

    form.button('§l§2+ Add Category', 'textures/ui/color_plus');

    const shopConfig = getShopConfig();
    const categories = Object.keys(shopConfig.categories).sort();
    const paginatedCategories = getPaginatedItems(categories, page);

    for (const categoryName of paginatedCategories) {
        const category = shopConfig.categories[categoryName];
        form.button(categoryName, category.icon);
    }

    addPaginationButtons(form, page, categories.length);
}

function buildShopAdminCategoryPanel(form: ActionFormData, context: UIContext) {
    const { categoryName, page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Item', 'textures/ui/color_plus');
    form.button('§l§2+ Add Subcategory', 'textures/ui/color_plus');
    form.button('§l§9* Edit Category', 'textures/ui/icon_setting');

    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName ?? ''];

    if (!category) {
        form.body('§4Category not found.');
        return;
    }

    const items = Object.keys(category.items).map((id) => ({ id, ...category.items[id], type: 'item' }));
    const subCategories = Object.keys(category.subCategories)
        .sort()
        .map((name) => ({ name, ...category.subCategories[name], type: 'subCategory' }));

    const allEntries = [...subCategories, ...items];
    const paginatedEntries = getPaginatedItems(allEntries, page);

    for (const entry of paginatedEntries) {
        if ('items' in entry) {
            // subCategory
            form.button(`§6${entry.name}`, entry.icon);
        } else {
            const masterItem = allItems[entry.id] || {};
            const displayName = entry.displayName || masterItem.displayName || entry.id;
            const icon = entry.icon || masterItem.icon;
            form.button(displayName, icon);
        }
    }

    addPaginationButtons(form, page, allEntries.length);
}

function buildShopAdminSubCategoryItemPanel(form: ActionFormData, context: UIContext) {
    const { categoryName, subCategoryName, page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Item', 'textures/ui/color_plus');
    form.button('§l§9* Edit Subcategory', 'textures/ui/icon_setting');

    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName ?? ''];
    if (!category) {
        form.body('§4Category not found.');
        return;
    }
    const subCategory = category.subCategories[subCategoryName ?? ''];
    if (!subCategory) {
        form.body('§4Subcategory not found.');
        return;
    }

    const items = Object.keys(subCategory.items).map((id) => ({ id, ...subCategory.items[id], type: 'item' }));
    const paginatedItems = getPaginatedItems(items, page);

    for (const item of paginatedItems) {
        const masterItem = allItems[item.id] || {};
        const displayName = item.displayName || masterItem.displayName || item.id;
        const icon = item.icon || masterItem.icon;
        form.button(displayName, icon);
    }

    addPaginationButtons(form, page, items.length);
}

function buildShopAddItemPanel(form: ActionFormData, context: UIContext) {
    const { page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Custom Item', 'textures/ui/color_plus');

    const allPossibleItems = Object.keys(allItems);
    const paginatedItems = getPaginatedItems(allPossibleItems, page);

    for (const itemId of paginatedItems) {
        const masterItem = allItems[itemId];
        form.button(masterItem.displayName ?? itemId, masterItem.icon);
    }

    addPaginationButtons(form, page, allPossibleItems.length);
}

async function buildPlayerManagementForm(title: string, context: UIContext) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    // Add Search button
    form.button('§l§2Search Player', 'textures/ui/magnifyingGlass');

    const allPlayersMap = getAllPlayerNameIdMap();
    const playerEntries = Array.from(allPlayersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const totalPages = Math.ceil(playerEntries.length / itemsPerPage);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (playerEntries.length === 0) {
        form.body('§4No player data found.');
    } else {
        const { getTeamByPlayer } = await import('../teamManager.js');
        const paginatedEntries = getPaginatedItems(playerEntries, page);
        for (const [lowerCaseName, id] of paginatedEntries) {
            const pData = loadPlayerData(id); // Load data for the player on the current page
            const rank = pData ? rankManager.getRankById(pData.rankId) : null;
            const prefix = rank?.chatFormatting?.prefixText ?? '';
            const rankPrefix = prefix ? `§6[§r${prefix}§6]§r ` : '';
            const properName = pData ? pData.name : lowerCaseName; // Fallback to lowercase name if data fails to load
            const team = getTeamByPlayer(id);
            const teamSuffix = team ? `\n§6[§r${team.name}§6]` : '';
            form.button(`${rankPrefix}${properName}${teamSuffix}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildPlayerListForm(title: string, context: UIContext) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    // Add Search button
    form.button('§l§2Search Online Player', 'textures/ui/magnifyingGlass');

    const onlinePlayers = Array.from(mc.world.getAllPlayers()).sort((a, b) => a.name.localeCompare(b.name));
    const totalPages = Math.ceil(onlinePlayers.length / itemsPerPage);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (onlinePlayers.length === 0) {
        form.body('§4No players are currently online.');
    } else {
        const { getTeamByPlayer } = await import('../teamManager.js');
        const paginatedPlayers = getPaginatedItems(onlinePlayers, page);
        const config = getConfig();
        for (const player of paginatedPlayers) {
            const rank = rankManager.getPlayerRank(player, config);
            const prefix = rank?.chatFormatting?.prefixText ?? '';
            const rankPrefix = prefix ? `§6[§r${prefix}§6]§r ` : '';
            const team = getTeamByPlayer(player.id);
            const teamSuffix = team ? `\n§6[§r${team.name}§6]` : '';
            form.button(`${rankPrefix}${player.name}${teamSuffix}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildBountyListForm(title: string, context: UIContext) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allBounties = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);
    const totalPages = Math.ceil(allBounties.length / itemsPerPage);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (allBounties.length === 0) {
        form.body('§2There are currently no active bounties.');
    } else {
        const paginatedBounties = getPaginatedItems(allBounties, page);
        for (const bounty of paginatedBounties) {
            form.button(`${bounty.name}\n§6${formatCurrency(bounty.amount)}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

function buildReportListForm(title: string, context: UIContext) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const reports = reportManager
        .getAllReports()
        .filter((r) => r.status === 'open' || r.status === 'assigned')
        .sort((a, b) => a.timestamp - b.timestamp);
    const totalPages = Math.ceil(reports.length / itemsPerPage);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (reports.length === 0) {
        form.body('§2There are no active reports.');
    } else {
        const paginatedReports = getPaginatedItems(reports, page);
        for (const report of paginatedReports) {
            const statusColor = report.status === 'assigned' ? '§6' : '§4';
            form.button(
                `[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`
            );
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

function buildRankManagementPanel(form: ActionFormData, context: UIContext) {
    const { page = 1 } = context;
    const pData = getPlayer((context.player as mc.Player).id);
    if (!pData) {
        return;
    }

    const panelDef = panelDefinitions.rankManagementPanel;
    const settingsItem = panelDef.items.find((item) => item.id === 'rankSettings');

    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    if (settingsItem && pData.permissionLevel <= settingsItem.permissionLevel) {
        form.button(settingsItem.text, settingsItem.icon);
    }
    form.button('§l§2+ Add New Rank', 'textures/ui/color_plus');

    const allRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);

    if (allRanks.length === 0) {
        form.body('§4No ranks have been defined.');
        return;
    }

    const paginatedRanks = getPaginatedItems(allRanks, page);

    for (const rank of paginatedRanks) {
        const name = rank.name;
        const permLevel = rank.permissionLevel;
        form.button(`${name}\n§8(ID: ${rank.id}, Level: ${permLevel})`);
    }

    addPaginationButtons(form, page, allRanks.length);
}

function buildKitManagementPanel(form: ActionFormData, context: UIContext) {
    const { page = 1 } = context;
    const mainConfig = getConfig();

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    // Add the global toggle button
    const isEnabled = mainConfig.kits.enabled;
    const toggleText = isEnabled ? '§2Kit System: ENABLED' : '§4Kit System: DISABLED';
    form.button(toggleText, isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel');

    // Add Create New Kit button
    form.button('§l§2+ Create New Kit', 'textures/ui/color_plus');

    // Get all kit names and paginate them
    const allKits = getAllKits();
    const kitNames = Object.keys(allKits);

    if (kitNames.length === 0) {
        form.body('§4No kits have been defined.');
        return;
    }

    const paginatedKits = getPaginatedItems(kitNames, page);

    for (const kitName of paginatedKits) {
        const kit = allKits[kitName];
        const status = kit.enabled ? '§2[Enabled]' : '§4[Disabled]';
        form.button(`${kitName}\n${status}`, 'textures/ui/inventory_icon');
    }

    addPaginationButtons(form, page, kitNames.length);
}

function buildCommandSystemPanel(form: ActionFormData, context: UIContext) {
    const { page = 1 } = context;
    const config = getConfig();
    const commandSettings = config.commandSettings || {};

    // Get all command names, filter out hidden ones, and sort alphabetically

    const allCommands = Object.keys(commandSettings)
        .filter((cmd: string) => !cmd.startsWith('_')) // Assuming internal/hidden commands start with an underscore
        .sort();

    if (allCommands.length === 0) {
        form.body('§4No commands are available for configuration.');
        return;
    }

    const paginatedCommands = getPaginatedItems(allCommands, page);

    form.body('Toggle commands on or off.\n§2[Enabled]§r / §4[Disabled]§r');

    for (const commandName of paginatedCommands) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isEnabled = (commandSettings as any)[commandName]?.enabled ?? false;
        const statusText = isEnabled ? '§2[Enabled]' : '§4[Disabled]';
        form.button(`${commandName}\n${statusText}`);
    }

    addPaginationButtons(form, page, allCommands.length);
}

export async function buildPanelForm(player: mc.Player, panelId: string, context: UIContext) {
    try {
        debugLog(`[UIManager] Building form for panel '${panelId}' for player ${player.name}.`);

        // Load items config if not loaded
        if (Object.keys(allItems).length === 0) {
            try {
                // Try loading user config first
                allItems = await loadConfig('./itemsConfig.js', true);
            } catch {
                // If failed, try loading default config
                try {
                    allItems = await loadConfig('./itemsConfig.default.js');
                } catch (defaultError) {
                    errorLog('[UIManager] Failed to load default items config.', defaultError);
                }
            }
        }

        if (panelId.startsWith('config_')) {
            const categoryId = panelId.replace('config_', '');
            const category = configPanelSchema.find((c) => c.id === categoryId);
            if (!category) {
                errorLog(`[UIManager] Could not find config category for ID: ${categoryId}`);
                return null;
            }
            debugLog(`[UIManager] Building config settings form for category: ${categoryId}`);
            const form = new ModalFormData().title(category.title);

            const configSource = category.configSource || 'main';
            const handler = configHandlers[configSource];
            if (!handler) {
                errorLog(`[UIManager] No config handler found for source: ${configSource}`);
                return null;
            }
            const config = handler.get();

            for (const setting of category.settings) {
                const currentValue = getValueFromPath(config, setting.key);
                switch (setting.type) {
                    case 'toggle':
                        form.toggle(setting.label, { defaultValue: !!currentValue });
                        break;
                    case 'textField':
                        form.textField(setting.label, setting.description || '', {
                            defaultValue: String(currentValue ?? '')
                        });
                        break;
                    case 'dropdown': {
                        let index = -1;
                        const options = setting.options || [];
                        // Special handling for logLevel, where the value is the index.
                        if (setting.key === 'logLevel' && typeof currentValue === 'number') {
                            index = currentValue;
                        } else {
                            index = options.indexOf(currentValue as string);
                        }
                        form.dropdown(setting.label, options, {
                            defaultValueIndex: index >= 0 && index < options.length ? index : 0
                        });
                        break;
                    }
                }
            }
            return form;
        }

        if (panelId === 'floatingTextActionPanel') {
            const { id } = context;
            const form = new ActionFormData()
                .title(`Actions for: ${id}`)
                .button('Edit', 'textures/ui/icon_setting')
                .button('Respawn', 'textures/ui/refresh_light')
                .button('Despawn', 'textures/ui/cancel')
                .button('§4Delete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId === 'teamMainPanel') {
            const { getTeamByPlayer } = await import('../teamManager.js');
            const teamConfig = getTeamConfig();
            const panelDef = panelDefinitions[panelId];

            const team = getTeamByPlayer(player.id);
            const form = new ActionFormData().title(panelDef.title);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            if (team) {
                const isOwner = team.ownerId === player.id;
                const isAdmin = team.admins.includes(player.id);
                const isOwnerOrAdmin = isOwner || isAdmin;

                const ownerData = loadPlayerData(team.ownerId);
                const ownerName = ownerData ? ownerData.name : 'Unknown';

                form.body(
                    [
                        `§l§2Team: ${team.name}`,
                        `§rID: ${team.id}`,
                        `Owner: ${ownerName}`,
                        `Members: ${team.members.length}/${teamConfig.maxMembers}`
                    ].join('\n')
                );

                form.button('§l§3Team Members', 'textures/ui/icon_multiplayer');
                if (isOwnerOrAdmin) {
                    form.button('§l§4Manage Team', 'textures/ui/op');
                }
                form.button('§l§6Team Settings', 'textures/ui/icon_setting');
                form.button('§4Leave Team', 'textures/ui/cancel');
            } else {
                // No Team
                form.button(
                    `§l§2Create Team\n§r§6Cost: ${formatCurrency(teamConfig.creationCost)}`,
                    'textures/ui/color_plus'
                );
                form.button('§l§9Join Team', 'textures/ui/world_glyph_color');
            }
            return form;
        }

        if (panelId === 'teamCreatePanel') {
            const teamConfig = getTeamConfig();
            const form = new ModalFormData().title('Create Team');
            form.textField('Team Name', `Enter name (${teamConfig.nameMinLength}-${teamConfig.nameMaxLength} chars)`);
            return form;
        }

        if (panelId === 'teamSearchPanel') {
            const form = new ModalFormData().title('Search Team');
            form.textField('Team ID', 'Enter the numeric Team ID');
            return form;
        }

        if (panelId === 'playerSearchPanel') {
            const form = new ModalFormData().title('Search Player');
            form.textField('Player Name', 'Enter partial or full name');
            return form;
        }

        if (panelId === 'teamSettingsPanel') {
            const { getTeamByPlayer } = await import('../teamManager.js');
            const pData = getOrCreatePlayer(player);
            const team = getTeamByPlayer(player.id);

            if (!team) {
                return null;
            }

            const isOwner = team.ownerId === player.id;
            const isAdmin = team.admins.includes(player.id);
            const canManage = isOwner || isAdmin;

            const form = new ModalFormData().title('Team Settings');
            // Personal Settings
            form.toggle('Auto-Accept Team Teleport', { defaultValue: pData.teamSettings?.autoTpAccept ?? false });
            if (canManage) {
                form.toggle('Allow Join Requests', { defaultValue: team.open ?? true });
            }
            return form;
        }

        if (panelId === 'teamMembersPanel') {
            const { getTeamByPlayer } = await import('../teamManager.js');
            const team = getTeamByPlayer(player.id);
            if (!team) {
                player.sendMessage('§4You are not in a team.');
                return null;
            }

            const form = new ActionFormData().title(`Members: ${team.name}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            // List members.
            for (const memberId of team.members) {
                const memData = loadPlayerData(memberId);
                const name = memData ? memData.name : 'Unknown';
                let role = 'Member';
                if (team.ownerId === memberId) {
                    role = '§4Owner';
                } else if (team.admins.includes(memberId)) {
                    role = '§2Admin';
                }

                let status = '§8(Offline)';
                // Note: This is O(n) per member, assuming team size is small (<10) it's fine.
                // For larger lists, a cache lookup is better.
                const onlineP = mc.world.getAllPlayers().find((p) => p.id === memberId);
                if (onlineP) {
                    status = '§2(Online)';
                }

                form.button(`${role} §r${name}\n${status}`, 'textures/ui/icon_steve');
            }
            return form;
        }

        if (panelId === 'teamBrowserPanel') {
            const { getAllTeams } = await import('../teamManager.js');
            const { page = 1 } = context;
            const form = new ActionFormData().title(`Browse Teams (Page ${page})`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            let teams = getAllTeams();

            // Filter out closed teams for non-admins
            const pData = getOrCreatePlayer(player);
            if (pData.permissionLevel >= 1024) {
                teams = teams.filter((t) => t.open !== false);
            }

            teams = teams.sort((a, b) => b.members.length - a.members.length);
            const paginatedTeams = getPaginatedItems(teams, page);

            for (const team of paginatedTeams) {
                const ownerData = loadPlayerData(team.ownerId);
                const ownerName = ownerData ? ownerData.name : 'Unknown';
                form.button(`${team.name} §8(ID: ${team.id})\n§rOwner: ${ownerName} | Members: ${team.members.length}`);
            }

            addPaginationButtons(form, page, teams.length);
            return form;
        }

        if (panelId === 'teamInvitesPanel') {
            const pData = getOrCreatePlayer(player);
            const invites = pData.pendingInvites || [];
            const form = new ActionFormData().title('Pending Invites');
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            if (invites.length === 0) {
                form.body('You have no pending invites.');
            } else {
                for (const invite of invites) {
                    const date = new Date(invite.timestamp).toLocaleDateString();
                    form.button(`${invite.teamName}\n§8Received: ${date}`);
                }
                form.button('§4Deny All Invites', 'textures/ui/cancel');
            }
            return form;
        }

        if (panelId === 'teamManagePanel') {
            const { getTeamByPlayer, getTeam } = await import('../teamManager.js');
            const { teamId } = context;
            // If context has teamId, it might be an admin managing another team.
            // Otherwise, manage own team.

            let team = null;
            const pData = getOrCreatePlayer(player);

            if (teamId && pData.permissionLevel < 1024) {
                team = getTeam(teamId);
            } else {
                team = getTeamByPlayer(player.id);
            }

            if (!team) {
                return null;
            }

            const form = new ActionFormData().title(`Manage: ${team.name}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            const isOwner = team.ownerId === player.id;
            const isAdmin = team.admins.includes(player.id);
            const isServerAdmin = pData.permissionLevel < 1024;

            if (isOwner || isAdmin || isServerAdmin) {
                form.button('§l§2Invite Player', 'textures/ui/color_plus');
                form.button(`§l§6Join Requests §r(${team.applications.length})`, 'textures/ui/mail_icon');
                form.button('§l§3Manage Members', 'textures/ui/icon_multiplayer');
            }

            if (isOwner || isAdmin) {
                form.button('§l§5Team Home', 'textures/ui/icon_recipe_nature');
            }

            if (isOwner || isServerAdmin) {
                form.button('§l§4Delete Team', 'textures/ui/trash');
            }
            return form;
        }

        if (panelId === 'teamHomePanel') {
            const { getTeamByPlayer } = await import('../teamManager.js');
            const team = getTeamByPlayer(player.id);
            if (!team) {
                return null;
            }

            const isOwner = team.ownerId === player.id;
            const isAdmin = team.admins.includes(player.id);
            const canManage = isOwner || isAdmin;

            const form = new ActionFormData().title(`Team Home: ${team.name}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            if (team.home && team.home.dimensionId) {
                const { x, y, z, dimensionId } = team.home;
                const dim = dimensionId.replace('minecraft:', '');
                const coords = `${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)} (${dim})`;
                form.body(`Home Location:\n§2${coords}`);
                form.button('§l§2Teleport', 'textures/items/ender_pearl');
            } else {
                form.body('§4No team home set.');
            }

            if (canManage) {
                form.button('§l§6Update Location', 'textures/ui/icon_recipe_nature');
                if (team.home) {
                    form.button('§l§4Delete Home', 'textures/ui/trash');
                }
            }
            return form;
        }

        if (panelId === 'teamRequestsPanel') {
            const { getTeamByPlayer } = await import('../teamManager.js');
            const team = getTeamByPlayer(player.id);
            if (!team) {
                return null;
            }

            const form = new ActionFormData().title('Join Requests');
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            if (team.applications.length === 0) {
                form.body('No pending join requests.');
            } else {
                for (const app of team.applications) {
                    form.button(`${app.playerName}`);
                }
            }
            return form;
        }

        // Handle dynamic shop panels before falling back to static definitions
        if (panelId.startsWith('shopCategoryPanel_')) {
            const category = panelId.replace('shopCategoryPanel_', '');
            const form = new ActionFormData().title(`§l§2Shop - ${category}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopCategoryPanel(form, { ...context, categoryName: category, page: context.page || 1 });
            return form;
        }
        if (panelId.startsWith('shopItemListPanel_')) {
            const parts = panelId.replace('shopItemListPanel_', '').split('_');
            const category = parts[0];
            const subCategory = parts.slice(1).join('_');
            const form = new ActionFormData().title(`§l§2Shop - ${subCategory}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopItemListPanel(form, {
                ...context,
                categoryName: category,
                subCategoryName: subCategory,
                page: context.page || 1
            });
            return form;
        }

        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryPanel_', '');
            const form = new ActionFormData().title(`Edit: ${categoryName}`);
            buildShopAdminCategoryPanel(form, { ...context, categoryName, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAddItemPanel_')) {
            const form = new ActionFormData().title('Add Item');
            buildShopAddItemPanel(form, { ...context, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
            const form = new ActionFormData()
                .title(`Manage Category: ${categoryName}`)
                .button('Edit', 'textures/ui/icon_setting')
                .button('§4Delete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const { categoryName, subCategoryName } = context;
            const form = new ActionFormData().title(`Edit: ${categoryName} > ${subCategoryName}`);
            buildShopAdminSubCategoryItemPanel(form, { ...context, page: context.page || 1 });
            return form;
        }

        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const { subCategoryName } = context;
            const form = new ActionFormData()
                .title(`Manage Subcategory: ${subCategoryName}`)
                .button('Edit', 'textures/ui/icon_setting')
                .button('§4Delete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitItemsPanel_')) {
            const kitName = panelId.replace('kitItemsPanel_', '');
            const allKits = getAllKits();
            const kit = allKits[kitName];
            const page = context.page || 1;

            if (!kit) {
                errorLog(`[UIManager] Could not find kit for items panel: ${kitName}`);
                return null;
            }

            const form = new ActionFormData()
                .title(`Edit Items: ${kitName}`)
                .button('§l§2+ Add New Item', 'textures/ui/color_plus');

            const paginatedItems = getPaginatedItems(kit.items, page);

            for (let i = 0; i < paginatedItems.length; i++) {
                const item = paginatedItems[i];
                const itemIndex = (page - 1) * itemsPerPage + i;
                form.button(
                    `${itemIndex + 1}. ${item.typeId.replace('minecraft:', '')} x${item.amount}`,
                    'textures/items/item_frame'
                );
            }

            addPaginationButtons(form, page, kit.items.length);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitSettingsPanel_')) {
            const kitName = panelId.replace('kitSettingsPanel_', '');
            const allKits = getAllKits();
            const kit = allKits[kitName];

            if (!kit) {
                errorLog(`[UIManager] Could not find kit for settings panel: ${kitName}`);
                return null;
            }

            const form = new ModalFormData()
                .title(`Edit Settings: ${kitName}`)
                .toggle('Enabled', { defaultValue: kit.enabled })
                .textField('Name', 'The name of the kit.', { defaultValue: kitName })
                .textField('Description', 'A short description of the kit.', { defaultValue: kit.description || '' })
                .textField('Icon', 'Texture path for the icon (e.g., textures/items/diamond_sword).', {
                    defaultValue: kit.icon || ''
                })
                .textField('Cooldown (seconds)', 'Time between uses.', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission Level', '0=Admin, 1024=Member.', { defaultValue: String(kit.permissionLevel) })
                .textField('Price', 'Cost to claim the kit.', { defaultValue: String(kit.price || 0) });

            return form;
        }

        if (panelId.startsWith('rankActionMenu_')) {
            const rankId = panelId.replace('rankActionMenu_', '');
            const rank = rankManager.getRankById(rankId);
            const form = new ActionFormData()
                .title(`Manage Rank: ${rank?.name}`)
                .button('Edit Rank', 'textures/ui/icon_setting')
                .button('§4Delete Rank', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId === 'helpfulLinksManagementPanel') {
            const panelDef = panelDefinitions[panelId];
            const page = context.page || 1;
            const form = new ActionFormData().title(`${panelDef.title} (Page ${page})`);
            const links = helpfulLinksManager.getHelpfulLinks();
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add Link', 'textures/ui/color_plus');

            const paginatedLinks = getPaginatedItems(links, page);

            paginatedLinks.forEach((link, index) => {
                const itemIndex = (page - 1) * itemsPerPage + index;
                form.button(`${itemIndex + 1}. ${link.title}`);
            });

            if (links.length > itemsPerPage) {
                addPaginationButtons(form, page, links.length);
            }

            return form;
        }

        if (panelId === 'floatingTextListPanel') {
            const { floatingTextManager } = await import('../floatingTextManager.js');
            const form = new ActionFormData()
                .title(panelDefinitions[panelId].title)
                .button('§l§8< Back', 'textures/gui/controls/left.png')
                .button('§l§2+ Create New', 'textures/ui/color_plus');

            const texts = floatingTextManager.getAllTexts();
            if (texts.length === 0) {
                form.body('No floating texts have been created yet.');
            } else {
                for (const text of texts) {
                    form.button(text.id);
                }
            }
            return form;
        }

        if (panelId === 'floatingTextEditPanel') {
            const { floatingTextManager } = await import('../floatingTextManager.js');
            const { id } = context;
            const text = floatingTextManager.getTextById(id);
            if (!text) {
                errorLog(`[UIManager] floatingTextEditPanel: Text with ID ${id} not found.`);
                return null;
            }

            // Robust handling for update interval to prevent crashes with legacy data
            const expiresAt = text.expiresAt ?? null;

            const dimensionOptions = ['Overworld', 'Nether', 'The End'];
            const dimensionIds = ['minecraft:overworld', 'minecraft:nether', 'minecraft:the_end'];
            const defaultDimensionIndex = Math.max(0, dimensionIds.indexOf(text.dimension));

            const form = new ModalFormData()
                .title(`Edit: ${id}`)
                .textField('Text Content', 'Enter the text to display', { defaultValue: text.text ?? '' })
                .textField('X Coordinate', 'Enter the X coordinate', {
                    defaultValue: String(+(text.location?.x ?? 0).toFixed(2))
                })
                .textField('Y Coordinate', 'Enter the Y coordinate', {
                    defaultValue: String(+(text.location?.y ?? 0).toFixed(2))
                })
                .textField('Z Coordinate', 'Enter the Z coordinate', {
                    defaultValue: String(+(text.location?.z ?? 0).toFixed(2))
                })
                .dropdown('Dimension', dimensionOptions, { defaultValueIndex: defaultDimensionIndex })
                .toggle('Enable Expiration Timer', { defaultValue: !!expiresAt })
                .textField('Expiration (minutes from now)', 'e.g., 60 for 1 hour', {
                    defaultValue: expiresAt ? String(Math.round((expiresAt - Date.now()) / 60000)) : '0'
                });
            return form;
        }

        if (panelId === 'floatingTextCreatePanel') {
            const form = new ModalFormData()
                .title('Create New Floating Text')
                .textField('Unique ID (no spaces)', 'e.g., "welcome_message"')
                .textField('Text Content', 'Enter text to display');
            return form;
        }

        if (panelId === 'addHelpfulLinkPanel') {
            const panelDef = panelDefinitions[panelId];
            const form = new ModalFormData()
                .title(panelDef.title)
                .textField('Link Title', 'Enter the link title (e.g., Discord)')
                .textField('Link URL', 'Enter the full URL (e.g., https://discord.gg/example)');
            return form;
        }

        if (panelId === 'helpfulLinkActionPanel') {
            const panelDef = panelDefinitions[panelId];
            const { linkIndex } = context;
            const links = helpfulLinksManager.getHelpfulLinks();
            const link = links[linkIndex ?? 0];

            if (!link) {
                errorLog(`[UIManager] Invalid link index for helpfulLinkActionPanel: ${linkIndex}`);
                await import('../uiManager.js').then(({ showPanel }) =>
                    showPanel(player, 'helpfulLinksManagementPanel', context)
                );
                return null;
            }

            const form = new ActionFormData()
                .title(panelDef.title)
                .body(`Selected Link:\nTitle: ${link.title}\nURL: ${link.url}`)
                .button('Edit', 'textures/ui/editIcon')
                .button('Move Up', 'textures/gui/controls/up')
                .button('Move Down', 'textures/gui/controls/down')
                .button('§4Delete Link', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitActionMenu_')) {
            const kitName = panelId.replace('kitActionMenu_', '');
            const form = new ActionFormData()
                .title(`Manage Kit: ${kitName}`)
                .button('Edit Settings', 'textures/ui/icon_setting')
                .button('Edit Items', 'textures/ui/inventory_icon')
                .button('§4Delete Kit', 'textures/ui/cancel')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitDetailPanel_')) {
            const kitName = panelId.replace('kitDetailPanel_', '');
            const kitsConfig = getKitsConfig();
            const kit = kitsConfig.kitDefinitions[kitName];

            if (!kit) {
                errorLog(`[UIManager] Could not find kit for detail panel: ${kitName}`);
                return null;
            }

            const form = new ModalFormData()
                .title(`Edit Kit: ${kitName}`)
                .toggle('Enable this kit', { defaultValue: kit.enabled })
                .textField('Cooldown (seconds)', 'The time a player must wait between claiming this kit.', {
                    defaultValue: String(kit.cooldownSeconds)
                })
                .textField('Permission Level', '0=Owner, 1=Admin, 2=Mod, 1024=Member. Lower is higher rank.', {
                    defaultValue: String(kit.permissionLevel ?? 1024)
                });

            return form;
        }

        const panelDef = panelDefinitions[panelId];
        if (!panelDef) {
            debugLog(`[UIManager] Panel definition not found for '${panelId}'.`);
            return null;
        }
        const pData = getPlayer(player.id);
        if (!pData) {
            debugLog(`[UIManager] Player data not found for ${player.name} (viewer). Cannot build panel.`);
            player.sendMessage('§4Could not find your player data. Please rejoin and try again.');
            return null;
        }
        let title = panelDef.title.replace('{playerName}', context.targetPlayerName ?? '');

        if (context.customTitle) {
            title = context.customTitle;
        } else if (panelId === 'mainPanel') {
            const config = getConfig();
            title = config.serverName || panelDef.title;
        }

        if (panelId === 'bountyListPanel') {
            return buildBountyListForm(title, context);
        }
        if (panelId === 'reportListPanel') {
            return buildReportListForm(title, context);
        }
        if (panelId === 'playerManagementPanel') {
            return buildPlayerManagementForm(title, context);
        }
        if (panelId === 'playerListPanel') {
            return buildPlayerListForm(title, context);
        }

        if (panelId === 'rulesManagementPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            const rules = rulesManager.getRules();

            const isAdmin = pData.permissionLevel <= 1;

            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            if (isAdmin) {
                form.button('§l§2+ Add Rule', 'textures/ui/color_plus');
            }

            const paginatedRules = getPaginatedItems(rules, page);

            paginatedRules.forEach((rule) => {
                form.button(rule);
            });

            if (rules.length > itemsPerPage) {
                addPaginationButtons(form, page, rules.length);
            }

            return form;
        }

        if (panelId === 'addRulePanel') {
            const form = new ModalFormData().title(panelDef.title).textField('New rule text', 'Enter the new rule');
            return form;
        }

        if (panelId === 'ruleActionPanel') {
            const { ruleIndex } = context;
            const rules = rulesManager.getRules();
            const ruleText = rules[ruleIndex ?? 0] || 'Invalid Rule';

            const form = new ActionFormData()
                .title(panelDef.title)
                .body(`Selected Rule: ${ruleText}`)
                .button('Edit Text', 'textures/ui/editIcon')
                .button('Move Up', 'textures/gui/controls/up')
                .button('Move Down', 'textures/gui/controls/down')
                .button('§4Delete Rule', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId === 'shopMainPanel') {
            const form = new ActionFormData().title(title);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopMainPanel(form, context);
            return form;
        }
        // --- Admin Edit Shop Panels ---
        if (panelId === 'shopManagementPanel') {
            const form = new ActionFormData().title(title);
            buildShopAdminMainPanel(form, context);
            return form;
        }

        if (panelId === 'kitManagementPanel') {
            const form = new ActionFormData().title(title);
            buildKitManagementPanel(form, context);
            return form;
        }

        if (panelId === 'commandSystemPanel') {
            const form = new ActionFormData().title(title);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildCommandSystemPanel(form, context);
            return form;
        }

        if (panelId === 'commandSettingsPanel') {
            const { commandName } = context;
            const config = getConfig();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const commandSettings = (config.commandSettings as any)[commandName ?? ''] || {};
            const command = commandManager.commands.get(commandName ?? '');

            const isEnabled = commandSettings.enabled ?? false;
            const permissionLevel = commandSettings.permissionLevel ?? command?.permissionLevel ?? 1024;

            const form = new ModalFormData()
                .title(`${commandName} Settings`)
                .toggle('Enable Command', { defaultValue: isEnabled })
                .textField('Permission Level', 'Enter a number (e.g., 0 for admin, 1024 for member)', {
                    defaultValue: String(permissionLevel)
                });

            return form;
        }

        if (panelId === 'rankManagementPanel') {
            const form = new ActionFormData().title(title);
            buildRankManagementPanel(form, { ...context, player });
            return form;
        }

        if (panelId === 'addMobDropPanel') {
            const form = new ModalFormData().title('§l§2Add Mob Drop');
            form.textField('Mob ID', 'e.g., minecraft:creeper');
            form.textField('Amount', 'e.g., 10');
            return form;
        }

        if (panelId === 'editMobDropPanel') {
            const { mobId } = context;
            const economyConfig = getEconomyConfig();
            const currentAmount = economyConfig.mobMoney[mobId ?? ''] ?? 0;
            const form = new ActionFormData()
                .title(`Edit: ${mobId}`)
                .body(`Current amount: §2${formatCurrency(currentAmount)}`)
                .button('§l§6Edit Amount§r', 'textures/ui/icon_setting')
                .button('§l§4Delete Mob Drop§r', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        // Removed duplicate addMobDropPanel block

        if (panelId === 'addRankPanel') {
            const form = new ModalFormData().title('§l§2Add New Rank');
            form.textField('Rank Name', 'e.g., VIP');
            form.textField('Rank ID (tag)', 'e.g., vip (lowercase, no spaces)');
            form.textField('Permission Level', '0-1024 (lower is more powerful)');
            form.textField('Name Color', 'e.g., §6');
            form.textField('Chat Color', 'e.g., §6');
            form.textField('Chat Prefix', 'e.g., §8[§6VIP§8]');
            return form;
        }

        if (panelId === 'mobDropsSystemPanel') {
            const { page = 1 } = context;
            const form = new ActionFormData().title('§l§2Mob Drops System');
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add New Mob§r', 'textures/ui/realms_green_check.png');

            const economyConfig = getEconomyConfig();
            const mobDrops = economyConfig.mobMoney || {};
            const mobIds = Object.keys(mobDrops).sort();

            if (mobIds.length === 0) {
                form.body('§4No mob drops have been configured.');
                return form;
            }

            const paginatedMobIds = getPaginatedItems(mobIds, page);

            for (const mobId of paginatedMobIds) {
                const amount = mobDrops[mobId];
                // Check if we have a specific spawn egg icon for this mob
                const spawnEggId = `${mobId}_spawn_egg`;
                const icon =
                    (iconDB as Record<string, { icon: string }>)[spawnEggId]?.icon || 'textures/ui/help_question_mark';

                form.button(`${mobId}\n§2${formatCurrency(amount)}`, icon);
            }

            addPaginationButtons(form, page, mobIds.length);
            return form;
        }

        if (panelId === 'rankSettingsPanel') {
            const config = getConfig();
            const form = new ModalFormData().title('§l§2Rank Settings');
            const nameTagStyles = ['Above Name', 'Before Name', 'After Name', 'Under Name'];
            const internalStyles = ['above', 'before', 'after', 'under'];
            const currentStyle = config.ranks?.nameTagStyle || 'above';
            const defaultIndex = internalStyles.indexOf(currentStyle);

            form.dropdown('Nametag Style', nameTagStyles, {
                defaultValueIndex: defaultIndex > -1 ? defaultIndex : 0
            });
            return form;
        }

        if (panelId === 'editRankPanel') {
            const rank = rankManager.getRankById(context.rankId ?? '');
            if (!rank) {
                errorLog(`[UIManager] Edit rank panel: rank with ID ${context.rankId} not found.`);
                return null;
            }
            // const isSpecialRank = rank.conditions.some((c: any) => c.type === 'isOwner' || c.type === 'default');

            const form = new ModalFormData().title(`§l§3Edit Rank: ${rank?.name}`);
            form.textField('Rank Name', 'e.g., VIP', { defaultValue: rank.name });
            // Note: 'disabled' is removed as it's not supported in the types
            form.textField('Rank ID (tag)', 'e.g., vip', { defaultValue: rank.id });
            form.textField('Permission Level', '0-1024', { defaultValue: String(rank.permissionLevel) });
            form.textField('Name Color', 'e.g., §6', { defaultValue: rank.chatFormatting?.nameColor ?? '' });
            form.textField('Chat Color', 'e.g., §6', { defaultValue: rank.chatFormatting?.messageColor ?? '' });
            form.textField('Chat Prefix', 'e.g., §8[§6VIP§8]', {
                defaultValue: rank.chatFormatting?.prefixText ?? ''
            });
            form.textField('Nametag Prefix', 'e.g., §6VIP', { defaultValue: rank.nametagPrefix ?? '' });
            return form;
        }

        if (panelId === 'xrayOresPanel') {
            const xrayConfig = getXrayConfig();
            const form = new ActionFormData().title(panelDefinitions[panelId].title);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add New Ore§r', 'textures/ui/color_plus');
            // Use monitoredOreTypes if monitoredOres doesn't exist or as needed.
            // Assuming config migration logic or legacy support:
            const ores = Object.values(xrayConfig.monitoredOreTypes || {}).sort((a, b) =>
                a.oreName.localeCompare(b.oreName)
            );
            if (ores.length === 0) {
                form.body('No ores are being monitored.');
            } else {
                for (const ore of ores) {
                    const blockId = ore.blocks?.[0]?.blockId ?? 'Unknown';
                    form.button(`§6${ore.oreName}§r\n§8${blockId}`);
                }
            }
            return form;
        }

        if (panelId === 'addXrayOrePanel') {
            const form = new ModalFormData().title('§l§4Add Monitored Ore');
            form.textField('Block ID', 'e.g., minecraft:diamond_ore');
            form.textField('Dimension ID', 'e.g., minecraft:overworld');
            form.textField('Min Y', 'e.g., -64');
            form.textField('Max Y', 'e.g., 16');
            form.textField('Ore Name', 'e.g., Diamond Ore');
            return form;
        }

        if (panelId === 'editXrayOrePanel') {
            const xrayConfig = getXrayConfig();
            const ores = Object.values(xrayConfig.monitoredOreTypes || {}).sort((a, b) =>
                a.oreName.localeCompare(b.oreName)
            );
            const ore = ores[context.oreIndex ?? 0];
            const form = new ModalFormData().title('§l§4Edit Monitored Ore');
            const blockId = ore.blocks?.[0]?.blockId ?? '';
            const dimensionId = ore.blocks?.[0]?.dimensionId ?? '';
            const minY = ore.blocks?.[0]?.minY ?? -64;
            const maxY = ore.blocks?.[0]?.maxY ?? 16;

            form.textField('Block ID', 'e.g., minecraft:diamond_ore', { defaultValue: blockId });
            form.textField('Dimension ID', 'e.g., minecraft:overworld', { defaultValue: dimensionId });
            form.textField('Min Y', 'e.g., -64', { defaultValue: String(minY) });
            form.textField('Max Y', 'e.g., 16', { defaultValue: String(maxY) });
            form.textField('Ore Name', 'e.g., Diamond Ore', { defaultValue: ore.oreName });
            return form;
        }

        if (panelId === 'configCategoryPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            const sortedSystems = getVisibleConfigSystems(pData);
            const paginatedSystems = getPaginatedItems(sortedSystems, page);

            for (const system of paginatedSystems) {
                form.button(system.title, system.icon);
            }

            addPaginationButtons(form, page, sortedSystems.length);
            return form;
        }

        if (panelId === 'configResetPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');

            const resettableSystems = [
                ...configPanelSchema
                    .filter((c) => !c.id.startsWith('general_'))
                    .map((c) => ({ id: c.id, title: c.title, icon: c.icon })),
                { id: 'kits', title: '§l§5Kit System§r', icon: 'textures/ui/inventory_icon' },
                { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
                { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
            ];
            resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

            const sortedSystems = resettableSystems;

            const paginatedSystems = getPaginatedItems(sortedSystems, page);

            for (const system of paginatedSystems) {
                form.button(`§4Reset ${system.title}`, system.icon);
            }

            if (page >= Math.ceil(resettableSystems.length / itemsPerPage)) {
                form.button('§l§4Reset All Systems', 'textures/ui/trash');
            }

            addPaginationButtons(form, page, resettableSystems.length);
            return form;
        }

        if (panelId === 'playerActionsPanel') {
            panelDef.parentPanelId = context.fromPanel || 'mainPanel';
            const form = new ActionFormData().title(title);
            await addPanelBody(form, player, panelId, context);

            const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel, player.id);

            for (const item of visibleItems) {
                form.button(item.text, item.icon);
            }
            return form;
        }

        const form = new ActionFormData().title(title);
        await addPanelBody(form, player, panelId, context);
        const menuItems = getMenuItems(panelDef, pData.permissionLevel);
        for (const item of menuItems) {
            form.button(item.text, item.icon);
        }
        debugLog(`[UIManager] Successfully built form for panel '${panelId}' with ${menuItems.length} items.`);
        return form;
    } catch (e) {
        const textConfig =
            panelId === 'floatingTextEditPanel' && context.id
                ? (await import('../floatingTextManager.js')).floatingTextManager.getTextById(context.id)
                : null;
        errorLog(`[UIManager] Critical error while building form '${panelId}'.`, {
            error: e,
            context: context,
            textConfig: textConfig
        });
        return null;
    }
}
