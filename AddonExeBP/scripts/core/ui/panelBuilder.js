import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { panelDefinitions } from './panelRegistry.js';
import { configPanelSchema } from './configPanelRegistry.js';
import { getPlayer, getOrCreatePlayer, loadPlayerData, getAllPlayerNameIdMap } from '../playerDataManager.js';
import { getConfig } from '../configManager.js';
import { debugLog, errorLog } from '../logger.js';
import * as rankManager from '../rankManager.js';
import * as bountyManager from '../bountyManager.js';
import * as reportManager from '../reportManager.js';
import * as rulesManager from '../rulesManager.js';
import * as helpfulLinksManager from '../helpfulLinksManager.js';
import { getKitsConfig, getShopConfig, getEconomyConfig, getXrayConfig } from '../configurations.js';
import { items as allItems } from '../itemsConfig.js';
import { getAllKits } from '../kitAdminManager.js';
import { getValueFromPath } from '../objectUtils.js';
import { formatCurrency } from '../utils.js';
import { getVisibleConfigSystems, itemsPerPage, configHandlers, getPaginatedItems, addPaginationButtons } from './uiUtils.js';
import { commandManager } from '../../modules/commands/commandManager.js';
import { iconDB } from '../iconDB.js';

export function getMenuItems(panelDef, permissionLevel) {
    const config = getConfig();
    const items = (panelDef.items || [])
        .filter(item => {
            if (item.actionValue === 'shopMainPanel' && !config.shop.enabled) {
                return false;
            }
            return permissionLevel <= item.permissionLevel;
        })
        .sort((a, b) => (a.sortId || 0) - (b.sortId || 0));

    if (panelDef.parentPanelId) {
        items.unshift({ id: '__back__', text: '§l§8< Back', icon: 'textures/gui/controls/left.png', permissionLevel: 1024, actionType: 'openPanel', actionValue: panelDef.parentPanelId });
    }
    return items;
}

function addPanelBody(form, player, panelId, context) {
    const config = getConfig();
    if (panelId === 'myStatsPanel') {
        const pData = getOrCreatePlayer(player);
        const rank = rankManager.getPlayerRank(player, config);
        if (!pData || !rank) {
            form.body('§cCould not retrieve your stats.');
            return;
        }
        const bounty = bountyManager.getBounty(player.id)?.amount ?? 0;
        form.body([
            `§fRank: §r${rank.chatFormatting?.nameColor ?? '§7'}${rank.name}`,
            `§fBalance: §2${formatCurrency(pData.balance)}`,
            `§fBounty on you: §6${formatCurrency(bounty)}`
        ].join('\n'));
    } else if (panelId === 'playerActionsPanel' && context.targetPlayerId) {
        const pData = context.targetData || loadPlayerData(context.targetPlayerId);
        if (!pData) {
            form.body('§cCould not load player data.');
            return;
        }
        const rank = rankManager.getRankById(pData.rankId);
        const bounty = bountyManager.getBounty(context.targetPlayerId)?.amount ?? 0;
        form.body([
            `§fRank: §r${rank?.chatFormatting?.nameColor ?? '§7'}${rank?.name ?? 'Unknown'}`,
            `§fBalance: §2${formatCurrency(pData.balance)}`,
            `§fBounty: §6${formatCurrency(bounty)}`
        ].join('\n'));
    } else if (panelId === 'reportActionsPanel' && context.targetReport) {
        const { targetReport } = context;
        form.body([
            `§fReport ID: §6${targetReport.id}`,
            `§fReported Player: §6${targetReport.reportedPlayerName}`,
            `§fReporter: §6${targetReport.reporterName}`,
            `§fReason: §6${targetReport.reason}`,
            `§fStatus: §6${targetReport.status}`,
            `§fDate: §6${new Date(targetReport.timestamp).toLocaleString()}`
        ].join('\n'));
    }
}

export function getVisiblePlayerActionItems(context, permissionLevel) {
    const panelDef = panelDefinitions.playerActionsPanel;
    const config = getConfig();
    const allItems = getMenuItems(panelDef, permissionLevel);
    let visibleItems = [];
    for (const item of allItems) {
        if (item.id === '__back__') {
            visibleItems.push(item);
            continue;
        }
        const commandName = item.id;
        if (config.commandSettings[commandName]?.enabled === false) {continue;}
        if (context.fromPanel === 'playerManagementPanel' && item.permissionLevel < 1024) {
            visibleItems.push(item);
        } else if (context.fromPanel === 'playerListPanel' && item.permissionLevel >= 1024) {
            visibleItems.push(item);
        }
    }
    return visibleItems;
}

function buildShopMainPanel(form, context) {
    const shopConfig = getShopConfig();

    const validCategories = Object.keys(shopConfig.categories).filter(categoryName => {
        const category = shopConfig.categories[categoryName];
        const hasItems = Object.keys(category.items).length > 0;
        const hasSubCategories = Object.keys(category.subCategories).length > 0;
        return hasItems || hasSubCategories;
    }).sort();

    if (validCategories.length === 0) {
        form.body('§cThe shop is currently empty.');
        return;
    }

    for (const categoryName of validCategories) {
        const category = shopConfig.categories[categoryName];
        form.button(categoryName, category.icon);
    }
}

function buildShopCategoryPanel(form, context) {
    const { categoryName, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];

    if (!category) {
        form.body('§cCategory not found.');
        return;
    }

    const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));
    const items = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));

    const allEntries = [...subCategories, ...items];
    const paginatedEntries = getPaginatedItems(allEntries, page);

    for (const entry of paginatedEntries) {
        if (entry.type === 'subCategory') {
            form.button(`§e${entry.name}`, entry.icon);
        } else {
            const masterItem = allItems[entry.id] || {};
            const displayName = entry.displayName || masterItem.displayName || entry.id;
            const icon = entry.icon || masterItem.icon;
            let priceString = '';
            if (view === 'buy' && entry.buyPrice > 0) {
                priceString = `§2Buy: ${formatCurrency(entry.buyPrice)}`;
            } else if (view === 'sell' && entry.sellPrice > 0) {
                priceString = `§cSell: ${formatCurrency(entry.sellPrice)}`;
            } else {
                const buy = entry.buyPrice > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                const sell = entry.sellPrice > 0 ? `§cS: ${formatCurrency(entry.sellPrice)}` : '';
                priceString = [buy, sell].filter(Boolean).join(' ');
            }
            form.button(`${displayName}\n${priceString}`, icon);
        }
    }
    addPaginationButtons(form, page, allEntries.length);
}

function buildShopItemListPanel(form, context) {
    const { categoryName, subCategoryName, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        form.body('§cCategory not found.');
        return;
    }
    const subCategory = category.subCategories[subCategoryName];
    if (!subCategory) {
        form.body('§cSubcategory not found.');
        return;
    }

    const items = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
    const paginatedItems = getPaginatedItems(items, page);

    for (const item of paginatedItems) {
        const masterItem = allItems[item.id] || {};
        const displayName = item.displayName || masterItem.displayName || item.id;
        const icon = item.icon || masterItem.icon;
        let priceString = '';
        if (view === 'buy' && item.buyPrice > 0) {
            priceString = `§2Buy: ${formatCurrency(item.buyPrice)}`;
        } else if (view === 'sell' && item.sellPrice > 0) {
            priceString = `§cSell: ${formatCurrency(item.sellPrice)}`;
        } else {
            const buy = item.buyPrice > 0 ? `§2B: ${formatCurrency(item.buyPrice)}` : '';
            const sell = item.sellPrice > 0 ? `§cS: ${formatCurrency(item.sellPrice)}` : '';
            priceString = [buy, sell].filter(Boolean).join(' ');
        }
        form.button(`${displayName}\n${priceString}`, icon);
    }
    addPaginationButtons(form, page, items.length);
}

function buildShopAdminMainPanel(form, context) {
    const { page = 1 } = context;
    const mainConfig = getConfig();

    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const isEnabled = mainConfig.shop.enabled;
    const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§cShop System: DISABLED';
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

function buildShopAdminCategoryPanel(form, context) {
    const { categoryName, page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Item', 'textures/ui/color_plus');
    form.button('§l§2+ Add Subcategory', 'textures/ui/color_plus');
    form.button('§l§9* Edit Category', 'textures/ui/icon_setting');

    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];

    if (!category) {
        form.body('§cCategory not found.');
        return;
    }

    const items = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));
    const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));

    const allEntries = [...subCategories, ...items];
    const paginatedEntries = getPaginatedItems(allEntries, page);

    for (const entry of paginatedEntries) {
        if (entry.type === 'item') {
            const masterItem = allItems[entry.id] || {};
            const displayName = entry.displayName || masterItem.displayName || entry.id;
            const icon = entry.icon || masterItem.icon;
            form.button(displayName, icon);
        } else { // subCategory
            form.button(`§e${entry.name}`, entry.icon);
        }
    }

    addPaginationButtons(form, page, allEntries.length);
}

function buildShopAdminSubCategoryItemPanel(form, context) {
    const { categoryName, subCategoryName, page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    form.button('§l§2+ Add Item', 'textures/ui/color_plus');
    form.button('§l§9* Edit Subcategory', 'textures/ui/icon_setting');

    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        form.body('§cCategory not found.');
        return;
    }
    const subCategory = category.subCategories[subCategoryName];
    if (!subCategory) {
        form.body('§cSubcategory not found.');
        return;
    }

    const items = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
    const paginatedItems = getPaginatedItems(items, page);

    for (const item of paginatedItems) {
        const masterItem = allItems[item.id] || {};
        const displayName = item.displayName || masterItem.displayName || item.id;
        const icon = item.icon || masterItem.icon;
        form.button(displayName, icon);
    }

    addPaginationButtons(form, page, items.length);
}

function buildShopAddItemPanel(form, context) {
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

async function buildPlayerManagementForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allPlayersMap = getAllPlayerNameIdMap();
    const playerEntries = Array.from(allPlayersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const totalPages = Math.ceil(playerEntries.length / itemsPerPage);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (playerEntries.length === 0) {
        form.body('§cNo player data found.');
    } else {
        const paginatedEntries = getPaginatedItems(playerEntries, page);
        for (const [lowerCaseName, id] of paginatedEntries) {
            const pData = loadPlayerData(id); // Load data for the player on the current page
            const rank = pData ? rankManager.getRankById(pData.rankId) : null;
            const prefix = rank?.chatFormatting?.prefixText ?? '';
            const properName = pData ? pData.name : lowerCaseName; // Fallback to lowercase name if data fails to load
            form.button(`${prefix}${properName}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildPlayerListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const onlinePlayers = Array.from(mc.world.getAllPlayers()).sort((a, b) => a.name.localeCompare(b.name));
    const totalPages = Math.ceil(onlinePlayers.length / itemsPerPage);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§6< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (onlinePlayers.length === 0) {
        form.body('§cNo players are currently online.');
    } else {
        const paginatedPlayers = getPaginatedItems(onlinePlayers, page);
        const config = getConfig();
        for (const player of paginatedPlayers) {
            const rank = rankManager.getPlayerRank(player, config);
            const prefix = rank.chatFormatting?.prefixText ?? '';
            form.button(`${prefix}${player.name}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildBountyListForm(title, context) {
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

function buildReportListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const reports = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
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
            const statusColor = report.status === 'assigned' ? '§6' : '§c';
            form.button(`[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§6Next Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

function buildRankManagementPanel(form, context) {
    const { page = 1 } = context;
    const pData = getPlayer(context.player.id);
    const panelDef = panelDefinitions.rankManagementPanel;
    const settingsItem = panelDef.items.find(item => item.id === 'rankSettings');

    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    if (settingsItem && pData.permissionLevel <= settingsItem.permissionLevel) {
        form.button(settingsItem.text, settingsItem.icon);
    }
    form.button('§l§2+ Add New Rank', 'textures/ui/color_plus');

    const allRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);

    if (allRanks.length === 0) {
        form.body('§cNo ranks have been defined.');
        return;
    }

    const paginatedRanks = getPaginatedItems(allRanks, page);

    for (const rank of paginatedRanks) {
        const prefix = rank.chatFormatting?.prefixText ?? '';
        const name = rank.name;
        const permLevel = rank.permissionLevel;
        form.button(`${prefix}${name}\n§8(ID: ${rank.id}, Level: ${permLevel})`);
    }

    addPaginationButtons(form, page, allRanks.length);
}

function buildKitManagementPanel(form, context) {
    const { page = 1 } = context;
    const mainConfig = getConfig();

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    // Add the global toggle button
    const isEnabled = mainConfig.kits.enabled;
    const toggleText = isEnabled ? '§2Kit System: ENABLED' : '§cKit System: DISABLED';
    form.button(toggleText, isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel');

    // Add Create New Kit button
    form.button('§l§2+ Create New Kit', 'textures/ui/color_plus');

    // Get all kit names and paginate them
    const allKits = getAllKits();
    const kitNames = Object.keys(allKits);

    if (kitNames.length === 0) {
        form.body('§cNo kits have been defined.');
        return;
    }

    const paginatedKits = getPaginatedItems(kitNames, page);

    for (const kitName of paginatedKits) {
        const kit = allKits[kitName];
        const status = kit.enabled ? '§2[Enabled]' : '§c[Disabled]';
        form.button(`${kitName}\n${status}`, 'textures/ui/inventory_icon');
    }

    addPaginationButtons(form, page, kitNames.length);
}

function buildCommandSystemPanel(form, context) {
    const { page = 1 } = context;
    const config = getConfig();
    const commandSettings = config.commandSettings || {};

    // Get all command names, filter out hidden ones, and sort alphabetically
    const allCommands = Object.keys(commandSettings)
        .filter(cmd => !cmd.startsWith('_')) // Assuming internal/hidden commands start with an underscore
        .sort();

    if (allCommands.length === 0) {
        form.body('§cNo commands are available for configuration.');
        return;
    }

    const paginatedCommands = getPaginatedItems(allCommands, page);

    form.body('Toggle commands on or off.\n§2[Enabled]§r / §c[Disabled]§r');

    for (const commandName of paginatedCommands) {
        const isEnabled = commandSettings[commandName]?.enabled ?? false;
        const statusText = isEnabled ? '§2[Enabled]' : '§c[Disabled]';
        form.button(`${commandName}\n${statusText}`);
    }

    addPaginationButtons(form, page, allCommands.length);
}

export async function buildPanelForm(player, panelId, context) {
    try {
        debugLog(`[UIManager] Building form for panel '${panelId}' for player ${player.name}.`);

        if (panelId.startsWith('config_')) {
            const categoryId = panelId.replace('config_', '');
            const category = configPanelSchema.find(c => c.id === categoryId);
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
                        form.textField(setting.label, setting.description || '', { defaultValue: String(currentValue ?? '') });
                        break;
                    case 'dropdown':
                    {
                        let index = -1;
                        // Special handling for logLevel, where the value is the index.
                        if (setting.key === 'logLevel' && typeof currentValue === 'number') {
                            index = currentValue;
                        } else {
                            index = setting.options.indexOf(currentValue);
                        }
                        form.dropdown(setting.label, setting.options, { defaultValueIndex: index >= 0 && index < setting.options.length ? index : 0 });
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
                .button('§cDelete', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        // Handle dynamic shop panels before falling back to static definitions
        if (panelId.startsWith('shopCategoryPanel_')) {
            const category = panelId.replace('shopCategoryPanel_', '');
            const form = new ActionFormData().title(`§l§2Shop - ${category}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopCategoryPanel(form, { ...context, category, page: context.page || 1 });
            return form;
        }
        if (panelId.startsWith('shopItemListPanel_')) {
            const parts = panelId.replace('shopItemListPanel_', '').split('_');
            const category = parts[0];
            const subCategory = parts.slice(1).join('_');
            const form = new ActionFormData().title(`§l§2Shop - ${subCategory}`);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            buildShopItemListPanel(form, { ...context, category, subCategory, page: context.page || 1 });
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
                .button('§cDelete', 'textures/ui/trash')
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
                .button('§cDelete', 'textures/ui/trash')
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
                const itemIndex = ((page - 1) * itemsPerPage) + i;
                form.button(`${itemIndex + 1}. ${item.typeId.replace('minecraft:', '')} x${item.amount}`, 'textures/items/item_frame');
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
                .textField('Icon', 'Texture path for the icon (e.g., textures/items/diamond_sword).', { defaultValue: kit.icon || '' })
                .textField('Cooldown (seconds)', 'Time between uses.', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission Level', '0=Admin, 1024=Member.', { defaultValue: String(kit.permissionLevel) })
                .textField('Price', 'Cost to claim the kit.', { defaultValue: String(kit.price || 0) });

            form.submitButton('§l§2Save Settings');
            return form;
        }

        if (panelId.startsWith('rankActionMenu_')) {
            const rankId = panelId.replace('rankActionMenu_', '');
            const rank = rankManager.getRankById(rankId);
            const form = new ActionFormData()
                .title(`Manage Rank: ${rank.name}`)
                .button('Edit Rank', 'textures/ui/icon_setting')
                .button('§cDelete Rank', 'textures/ui/trash')
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
                const itemIndex = ((page - 1) * itemsPerPage) + index;
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
                .textField('X Coordinate', 'Enter the X coordinate', { defaultValue: String(+(text.location?.x ?? 0).toFixed(2)) })
                .textField('Y Coordinate', 'Enter the Y coordinate', { defaultValue: String(+(text.location?.y ?? 0).toFixed(2)) })
                .textField('Z Coordinate', 'Enter the Z coordinate', { defaultValue: String(+(text.location?.z ?? 0).toFixed(2)) })
                .dropdown('Dimension', dimensionOptions, { defaultValueIndex: defaultDimensionIndex })
                .toggle('Enable Expiration Timer', { defaultValue: !!expiresAt })
                .textField('Expiration (minutes from now)', 'e.g., 60 for 1 hour', { defaultValue: expiresAt ? String(Math.round((expiresAt - Date.now()) / 60000)) : '0' });
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
            const link = links[linkIndex];

            if (!link) {
                errorLog(`[UIManager] Invalid link index for helpfulLinkActionPanel: ${linkIndex}`);
                import('../uiManager.js').then(({ showPanel }) => showPanel(player, 'helpfulLinksManagementPanel', context));
                return null;
            }


            const form = new ActionFormData()
                .title(panelDef.title)
                .body(`Selected Link:\nTitle: ${link.title}\nURL: ${link.url}`)
                .button('Edit', 'textures/ui/editIcon')
                .button('Move Up', 'textures/gui/controls/up')
                .button('Move Down', 'textures/gui/controls/down')
                .button('§cDelete Link', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

        if (panelId.startsWith('kitActionMenu_')) {
            const kitName = panelId.replace('kitActionMenu_', '');
            const form = new ActionFormData()
                .title(`Manage Kit: ${kitName}`)
                .button('Edit Settings', 'textures/ui/icon_setting')
                .button('Edit Items', 'textures/ui/inventory_icon')
                .button('§cDelete Kit', 'textures/ui/cancel')
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
                .textField('Cooldown (seconds)', 'The time a player must wait between claiming this kit.', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission Level', '0=Owner, 1=Admin, 2=Mod, 1024=Member. Lower is higher rank.', { defaultValue: String(kit.permissionLevel ?? 1024) });

            form.submitButton('§l§2Save and Close');

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
            player.sendMessage('§cCould not find your player data. Please rejoin and try again.');
            return null;
        }
        let title = panelDef.title.replace('{playerName}', context.targetPlayerName ?? '');

        if (panelId === 'mainPanel') {
            const config = getConfig();
            title = config.serverName || panelDef.title;
        }

        if (panelId === 'bountyListPanel') {return buildBountyListForm(title, context);}
        if (panelId === 'reportListPanel') {return buildReportListForm(title, context);}
        if (panelId === 'playerManagementPanel') {return buildPlayerManagementForm(title, context);}
        if (panelId === 'playerListPanel') {return buildPlayerListForm(title, context);}

        if (panelId === 'rulesManagementPanel') {
            const page = context.page || 1;
            const form = new ActionFormData().title(`${title} (Page ${page})`);
            const rules = rulesManager.getRules();
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add Rule', 'textures/ui/color_plus');

            const paginatedRules = getPaginatedItems(rules, page);

            paginatedRules.forEach((rule, index) => {
                const itemIndex = ((page - 1) * itemsPerPage) + index;
                form.button(`${itemIndex + 1}. ${rule}`);
            });

            if (rules.length > itemsPerPage) {
                addPaginationButtons(form, page, rules.length);
            }

            return form;
        }

        if (panelId === 'addRulePanel') {
            const form = new ModalFormData()
                .title(panelDef.title)
                .textField('New rule text', 'Enter the new rule');
            return form;
        }

        if (panelId === 'ruleActionPanel') {
            const { ruleIndex } = context;
            const rules = rulesManager.getRules();
            const ruleText = rules[ruleIndex] || 'Invalid Rule';

            const form = new ActionFormData()
                .title(panelDef.title)
                .body(`Selected Rule: ${ruleText}`)
                .button('Edit Text', 'textures/ui/editIcon')
                .button('Move Up', 'textures/gui/controls/up')
                .button('Move Down', 'textures/gui/controls/down')
                .button('§cDelete Rule', 'textures/ui/trash')
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
            const panelDef = panelDefinitions[panelId];
            const title = panelDef.title;
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
            const commandSettings = config.commandSettings[commandName] || {};
            const command = commandManager.commands.get(commandName);

            const isEnabled = commandSettings.enabled ?? false;
            const permissionLevel = commandSettings.permissionLevel ?? command?.permissionLevel ?? 1024;

            const form = new ModalFormData()
                .title(`${commandName} Settings`)
                .toggle('Enable Command', { defaultValue: isEnabled })
                .textField('Permission Level', 'Enter a number (e.g., 0 for admin, 1024 for member)', { defaultValue: String(permissionLevel) });

            form.submitButton('§l§2Save Settings');
            return form;
        }

        if (panelId === 'rankManagementPanel') {
            const panelDef = panelDefinitions[panelId];
            const title = panelDef.title;
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
            const currentAmount = economyConfig.mobMoney[mobId] ?? 0;
            const form = new ActionFormData()
                .title(`Edit: ${mobId}`)
                .body(`Current amount: §2${formatCurrency(currentAmount)}`)
                .button('§l§eEdit Amount§r', 'textures/ui/icon_setting')
                .button('§l§cDelete Mob Drop§r', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
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
            const currentAmount = economyConfig.mobMoney[mobId] ?? 0;
            const form = new ActionFormData()
                .title(`Edit: ${mobId}`)
                .body(`Current amount: §2${formatCurrency(currentAmount)}`)
                .button('§l§eEdit Amount§r', 'textures/ui/icon_setting')
                .button('§l§cDelete Mob Drop§r', 'textures/ui/trash')
                .button('§l§8< Back', 'textures/gui/controls/left.png');
            return form;
        }

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
                form.body('§cNo mob drops have been configured.');
                return form;
            }

            const paginatedMobIds = getPaginatedItems(mobIds, page);

            for (const mobId of paginatedMobIds) {
                const amount = mobDrops[mobId];
                // Check if we have a specific spawn egg icon for this mob
                const spawnEggId = `${mobId}_spawn_egg`;
                const icon = iconDB[spawnEggId]?.icon || 'textures/ui/help_question_mark';

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

            form.dropdown('Nametag Style', nameTagStyles, { defaultValueIndex: defaultIndex > -1 ? defaultIndex : 0 });
            form.textField('Nametag Prefix', 'e.g., §0[§r', { defaultValue: config.ranks?.nameTagPrefix ?? '§0[§r' });
            form.textField('Nametag Suffix', 'e.g., §0]§r', { defaultValue: config.ranks?.nameTagSuffix ?? '§0]§r' });
            return form;
        }

        if (panelId === 'editRankPanel') {
            const rank = rankManager.getRankById(context.rankId);
            if (!rank) {
                errorLog(`[UIManager] Edit rank panel: rank with ID ${context.rankId} not found.`);
                return null;
            }
            const isSpecialRank = rank.conditions.some(c => c.type === 'isOwner' || c.type === 'default');

            const form = new ModalFormData().title(`§l§3Edit Rank: ${rank.name}`);
            form.textField('Rank Name', 'e.g., VIP', { defaultValue: rank.name });
            form.textField('Rank ID (tag)', 'e.g., vip', { defaultValue: rank.id, disabled: isSpecialRank });
            form.textField('Permission Level', '0-1024', { defaultValue: String(rank.permissionLevel), disabled: isSpecialRank });
            form.textField('Name Color', 'e.g., §6', { defaultValue: rank.chatFormatting?.nameColor ?? '' });
            form.textField('Chat Color', 'e.g., §6', { defaultValue: rank.chatFormatting?.messageColor ?? '' });
            form.textField('Chat Prefix', 'e.g., §8[§6VIP§8]', { defaultValue: rank.chatFormatting?.prefixText ?? '' });
            form.textField('Nametag Prefix', 'e.g., §6VIP', { defaultValue: rank.nametagPrefix ?? '' });
            return form;
        }

        if (panelId === 'xrayOresPanel') {
            const xrayConfig = getXrayConfig();
            const form = new ActionFormData().title(panelDefinitions[panelId].title);
            form.button('§l§8< Back', 'textures/gui/controls/left.png');
            form.button('§l§2+ Add New Ore§r', 'textures/ui/color_plus');
            if (xrayConfig.monitoredOres.length === 0) {
                form.body('No ores are being monitored.');
            } else {
                for (const ore of xrayConfig.monitoredOres) {
                    form.button(`§e${ore.oreName}§r\n§7${ore.blockId}`);
                }
            }
            return form;
        }

        if (panelId === 'addXrayOrePanel') {
            const form = new ModalFormData().title('§l§cAdd Monitored Ore');
            form.textField('Block ID', 'e.g., minecraft:diamond_ore');
            form.textField('Dimension ID', 'e.g., minecraft:overworld');
            form.textField('Min Y', 'e.g., -64');
            form.textField('Max Y', 'e.g., 16');
            form.textField('Ore Name', 'e.g., Diamond Ore');
            return form;
        }

        if (panelId === 'editXrayOrePanel') {
            const xrayConfig = getXrayConfig();
            const ore = xrayConfig.monitoredOres[context.oreIndex];
            const form = new ModalFormData().title('§l§cEdit Monitored Ore');
            form.textField('Block ID', 'e.g., minecraft:diamond_ore', { defaultValue: ore.blockId });
            form.textField('Dimension ID', 'e.g., minecraft:overworld', { defaultValue: ore.dimensionId });
            form.textField('Min Y', 'e.g., -64', { defaultValue: String(ore.minY) });
            form.textField('Max Y', 'e.g., 16', { defaultValue: String(ore.maxY) });
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
                    .filter(c => !c.id.startsWith('general_'))
                    .map(c => ({ id: c.id, title: c.title, icon: c.icon })),
                { id: 'kits', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' },
                { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
                { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
            ];
            resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

            const sortedSystems = resettableSystems;

            const paginatedSystems = getPaginatedItems(sortedSystems, page);

            for (const system of paginatedSystems) {
                form.button(`§cReset ${system.title}`, system.icon);
            }

            if (page >= Math.ceil(resettableSystems.length / itemsPerPage)) {
                form.button('§l§cReset All Systems', 'textures/ui/trash');
            }

            addPaginationButtons(form, page, resettableSystems.length);
            return form;
        }

        if (panelId === 'playerActionsPanel') {
            panelDef.parentPanelId = context.fromPanel || 'mainPanel';
            const form = new ActionFormData().title(title);
            addPanelBody(form, player, panelId, context);

            const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel);
            for (const item of visibleItems) {
                form.button(item.text, item.icon);
            }
            return form;
        }

        const form = new ActionFormData().title(title);
        addPanelBody(form, player, panelId, context);
        const menuItems = getMenuItems(panelDef, pData.permissionLevel);
        for (const item of menuItems) {
            form.button(item.text, item.icon);
        }
        debugLog(`[UIManager] Successfully built form for panel '${panelId}' with ${menuItems.length} items.`);
        return form;
    } catch (e) {
        const textConfig = panelId === 'floatingTextEditPanel' && context.id ? (await import('../floatingTextManager.js')).floatingTextManager.getTextById(context.id) : null;
        errorLog(`[UIManager] Critical error while building form '${panelId}'.`, {
            error: e,
            context: context,
            textConfig: textConfig
        });
        return null;
    }
}