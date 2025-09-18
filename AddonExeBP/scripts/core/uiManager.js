import { world } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { panelDefinitions } from './panelLayoutConfig.js';
import { configPanelSchema } from './configPanelSchema.js';
import { getPlayer, loadPlayerData, getAllPlayerNameIdMap } from './playerDataManager.js';
import { getConfig, updateMultipleConfig } from './configManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
import * as rankManager from './rankManager.js';
import * as playerCache from './playerCache.js';
import * as utils from './utils.js';
import { getValueFromPath } from './objectUtils.js';
import * as reportManager from './reportManager.js';
import * as bountyManager from './bountyManager.js';
import * as economyManager from './economyManager.js';
import * as tpaManager from './tpaManager.js';
import { kickPlayer } from '../modules/commands/kick.js';
import { mutePlayer, unmutePlayer } from '../modules/commands/mute.js';
import { banPlayer, offlineBanPlayer, unbanPlayer } from '../modules/commands/ban.js';
import { freezePlayer, unfreezePlayer } from '../modules/commands/freeze.js';
import * as shopManager from './shopManager.js';
import { getShopConfig, saveShopConfig } from './shopConfigManager.js';
import { items as allItems } from './itemsConfig.js';
import { shopCategoryIcons, shopSubCategoryIcons } from './shopCategoryConfig.js';


export const uiActionFunctions = {};

// Main entry point for showing a panel.
export async function showPanel(player, panelId, context = {}) {
    try {
        debugLog(`[UIManager] Showing panel '${panelId}' to ${player.name} with context: ${JSON.stringify(context)}`);
        const form = await buildPanelForm(player, panelId, context);
        if (!form) {
            debugLog(`[UIManager] buildPanelForm returned null for panel '${panelId}'. Aborting.`);
            return;
        }

        const response = await utils.uiWait(player, form);
        if (!response || response.canceled) {
            debugLog(`[UIManager] Panel '${panelId}' was canceled by ${player.name}.`);
            return;
        }

        await handleFormResponse(player, panelId, response, context);
    } catch (e) {
        errorLog(`[UIManager] showPanel failed for panel '${panelId}': ${e.stack}`);
        debugLog(`[UIManager] ERROR: showPanel failed for panel '${panelId}': ${e.message}`);
    }
}

// Builds and returns a form object based on a panel definition.
async function buildPanelForm(player, panelId, context) {
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
        const config = getConfig();

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
                    const index = setting.options.indexOf(currentValue);
                    form.dropdown(setting.label, setting.options, { defaultValueIndex: index === -1 ? 0 : index });
                    break;
                }
            }
        }
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
    if (panelId.startsWith('editShopCategoryPanel_')) {
        const category = panelId.replace('editShopCategoryPanel_', '');
        const form = new ActionFormData().title(`§l§eEdit - ${category}`);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');
        buildEditShopCategoryPanel(form, { ...context, category, page: context.page || 1 });
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

    if (panelId === 'shopMainPanel') {
        const form = new ActionFormData().title(title);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');
        buildShopMainPanel(form, context);
        return form;
    }
    // --- Admin Edit Shop Panels ---
    if (panelId === 'editShopMainPanel') {
        const form = new ActionFormData().title(title);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');
        buildEditShopMainPanel(form);
        return form;
    }

    if (panelId === 'configCategoryPanel') {
        const form = new ActionFormData().title(title);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');
        for (const category of configPanelSchema) {
            form.button(category.title, category.icon);
        }
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
}

// Processes the response from a submitted form.
async function handleFormResponse(player, panelId, response, context) {
    debugLog(`[UIManager] Handling form response for panel '${panelId}' from ${player.name}. Selection: ${response.selection}`);
    const pData = getPlayer(player.id);
    if (!pData) {return;}

    // --- Shop Panel Handlers ---
    if (panelId === 'shopMainPanel') {
        if (response.selection === 0) { return showPanel(player, 'mainPanel'); }
        const shopConfig = getShopConfig();
        const view = context.view || 'shop';
        const categories = [...new Set(Object.keys(shopConfig.items).map(id => allItems[id]?.category).filter(Boolean))];
        const validCategories = categories.filter(category => {
            return Object.keys(shopConfig.items).some(id => {
                const masterItem = allItems[id];
                if (masterItem?.category !== category) {return false;}
                const shopItem = shopConfig.items[id];
                if (view === 'buy') {return shopItem.buyPrice > 0;}
                if (view === 'sell') {return shopItem.sellPrice > 0;}
                return true;
            });
        });
        const selectedCategory = validCategories[response.selection - 1];
        if (selectedCategory) {
            return showPanel(player, `shopCategoryPanel_${selectedCategory}`, context);
        }
        return;
    }

    if (panelId.startsWith('shopCategoryPanel_') || panelId.startsWith('shopItemListPanel_')) {
        const isItemList = panelId.startsWith('shopItemListPanel_');
        const prefix = isItemList ? 'shopItemListPanel_' : 'shopCategoryPanel_';
        const rawId = panelId.replace(prefix, '');
        const parts = rawId.split('_');
        const category = parts[0];
        const subCategory = isItemList ? parts.slice(1).join('_') : undefined;
        const page = context.page || 1;
        const view = context.view || 'shop';

        if (response.selection === 0) { // Back button
            const parentPanel = isItemList ? `shopCategoryPanel_${category}` : 'shopMainPanel';
            return showPanel(player, parentPanel, { ...context, page: 1 });
        }

        // Reconstruct the list of entries that was shown to the player
        const shopConfig = getShopConfig();
        let allEntries = [];
        if (isItemList) {
            const itemsInSubCategory = Object.keys(shopConfig.items).filter(id => {
                const masterItem = allItems[id];
                if (masterItem?.category !== category || masterItem?.subCategory !== subCategory) {return false;}
                const shopItem = shopConfig.items[id];
                if (view === 'buy') {return shopItem.buyPrice > 0;}
                if (view === 'sell') {return shopItem.sellPrice > 0;}
                return true;
            });
            allEntries = itemsInSubCategory.map(i => ({ id: i, type: 'item' }));
        } else { // shopCategoryPanel
            const itemsInCategory = Object.keys(shopConfig.items).filter(id => {
                const masterItem = allItems[id];
                if (masterItem?.category !== category) {return false;}
                const shopItem = shopConfig.items[id];
                if (view === 'buy') {return shopItem.buyPrice > 0;}
                if (view === 'sell') {return shopItem.sellPrice > 0;}
                return true;
            });
            const subCategories = [...new Set(itemsInCategory.map(id => allItems[id].subCategory).filter(Boolean))];
            const rootItems = itemsInCategory.filter(id => !allItems[id].subCategory);
            allEntries = [
                ...subCategories.map(sc => ({ id: sc, type: 'subCategory' })),
                ...rootItems.map(i => ({ id: i, type: 'item' }))
            ];
        }

        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectionIndex = response.selection - 1;

        // Handle pagination
        if (selectionIndex >= paginatedEntries.length) {
            let newPage = page;
            const totalPages = Math.ceil(allEntries.length / ITEMS_PER_PAGE);
            const hasPrev = page > 1;
            const hasNext = page < totalPages;
            let buttonIndex = selectionIndex - paginatedEntries.length;

            if (hasPrev && buttonIndex === 0) {
                newPage--;
            } else if (hasNext) {
                newPage++;
            }
            return showPanel(player, panelId, { ...context, page: newPage });
        }

        const selectedEntry = paginatedEntries[selectionIndex];

        if (selectedEntry.type === 'subCategory') {
            return showPanel(player, `shopItemListPanel_${category}_${selectedEntry.id}`, { ...context, page: 1 });
        }

        // It's an item
        const itemId = selectedEntry.id;
        const masterItem = allItems[itemId];
        const shopItem = shopConfig.items[itemId];

        const canBuy = view !== 'sell' && shopItem.buyPrice > 0;
        const canSell = view !== 'buy' && shopItem.sellPrice > 0;

        if (!canBuy && !canSell) {
            player.sendMessage('§cThis item cannot be bought or sold currently.');
            return showPanel(player, panelId, context);
        }

        const modal = new ModalFormData().title(masterItem.displayName ?? itemId);
        let action;
        let hasDropdown = false;

        if (canBuy && canSell) {
            modal.textField('Amount', 'Enter the amount', { defaultValue: '1' });
            const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
            modal.dropdown('Action', options, { defaultValueIndex: 0 });
            hasDropdown = true;
        } else if (canBuy) {
            modal.textField(`Amount to Buy (Price: $${shopItem.buyPrice})`, 'Enter a numeric value', { defaultValue: '1' });
            action = 'buy';
        } else { // canSell
            modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', { defaultValue: '1' });
            action = 'sell';
        }

        const modalResponse = await utils.uiWait(player, modal);

        if (modalResponse.canceled) {
            return showPanel(player, panelId, context);
        }

        let amount;
        if (hasDropdown) {
            const [amountStr, actionIndex] = modalResponse.formValues;
            amount = parseInt(amountStr, 10);
            const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
            const selectedActionString = options[actionIndex];
            action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
        } else {
            const [amountStr] = modalResponse.formValues;
            amount = parseInt(amountStr, 10);
        }

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount.');
            return showPanel(player, panelId, context);
        }

        let result;
        if (action === 'buy') {
            result = shopManager.buyItem(player, itemId, amount);
        } else { // action === 'sell'
            result = shopManager.sellItem(player, itemId, amount);
        }
        player.sendMessage(result.message);

        return showPanel(player, panelId, context); // Refresh the panel
    }

    // --- Admin Edit Shop Panel Handlers ---
    if (panelId === 'editShopMainPanel') {
        if (response.selection === 0) { return showPanel(player, 'mainPanel'); }
        const categories = [...new Set(Object.values(allItems).map(item => item.category))].sort();
        const selectedCategory = categories[response.selection - 1];
        if (selectedCategory) {
            return showPanel(player, `editShopCategoryPanel_${selectedCategory}`, context);
        }
        return;
    }

    if (panelId.startsWith('editShopCategoryPanel_')) {
        if (response.selection === 0) { return showPanel(player, 'editShopMainPanel'); }
        const category = panelId.replace('editShopCategoryPanel_', '');
        const page = context.page || 1;
        const itemsInCategory = Object.keys(allItems).filter(id => allItems[id].category === category);
        const paginatedItems = getPaginatedItems(itemsInCategory, page);

        const selectionIndex = response.selection - 1;

        // Handle pagination
        if (selectionIndex >= paginatedItems.length) {
            let newPage = page;
            const totalPages = Math.ceil(itemsInCategory.length / ITEMS_PER_PAGE);
            const hasPrev = page > 1;
            const hasNext = page < totalPages;
            let buttonIndex = selectionIndex - paginatedItems.length;

            if (hasPrev && buttonIndex === 0) {
                newPage--;
            } else if (hasNext) {
                newPage++;
            }
            return showPanel(player, panelId, { ...context, page: newPage });
        }

        const selection = paginatedItems[selectionIndex];
        if (selection) {
            const masterItem = allItems[selection];
            const shopConfig = getShopConfig();
            const shopItem = shopConfig.items[selection];

            const editForm = new ModalFormData().title(masterItem.displayName ?? selection);
            editForm.toggle('Enable in Shop', { defaultValue: !!shopItem });
            editForm.textField('Buy Price (-1 to disable)', 'Buy Price', { defaultValue: `${shopItem?.buyPrice ?? masterItem.buyPrice}` });
            editForm.textField('Sell Price (-1 to disable)', 'Sell Price', { defaultValue: `${shopItem?.sellPrice ?? masterItem.sellPrice}` });

            const editResponse = await utils.uiWait(player, editForm);
            if (editResponse.canceled) { return showPanel(player, panelId, context); }

            const [enabled, buyPriceStr, sellPriceStr] = editResponse.formValues;
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);

            if (isNaN(buyPrice) || isNaN(sellPrice)) {
                player.sendMessage('§cInvalid price. Please enter a number.');
                return showPanel(player, panelId, context);
            }

            if (enabled) {
                shopConfig.items[selection] = { buyPrice, sellPrice };
            } else {
                delete shopConfig.items[selection];
            }
            saveShopConfig();
            player.sendMessage(`§aSaved settings for ${masterItem.displayName ?? selection}.`);
        }
        return showPanel(player, panelId, context);
    }


    if (panelId === 'bountyListPanel' || panelId === 'reportListPanel' || panelId === 'playerManagementPanel' || panelId === 'playerListPanel') {
        const page = context.page || 1;
        const selection = response.selection;

        // Go back to main menu
        if (selection === 0) {
            return showPanel(player, 'mainPanel');
        }

        let allItems = [];
        if (panelId === 'bountyListPanel') {
            allItems = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);
        } else if (panelId === 'reportListPanel') {
            allItems = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
        } else if (panelId === 'playerManagementPanel') {
            allItems = Array.from(getAllPlayerNameIdMap().entries()).sort((a, b) => a[0].localeCompare(b[0]));
        } else if (panelId === 'playerListPanel') {
            allItems = playerCache.getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
        }

        const paginatedItems = getPaginatedItems(allItems, page);
        const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
        const hasPrevButton = page > 1;
        const hasNextButton = page < totalPages;

        // Handle Previous button click
        if (hasPrevButton && selection === 1) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }

        // Handle Next button click
        const nextButtonIndex = 1 + (hasPrevButton ? 1 : 0) + paginatedItems.length;
        if (hasNextButton && selection === nextButtonIndex) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }

        // Handle item selection
        let itemIndex = selection - 1; // Adjust for Back button
        if (hasPrevButton) {
            itemIndex--; // Adjust for Previous button
        }

        if (itemIndex >= 0 && itemIndex < paginatedItems.length) {
            const selectedItem = paginatedItems[itemIndex];

            if (panelId === 'bountyListPanel') {
                // No action defined for bounty selection yet.
                // For now, just re-show the same panel.
                return showPanel(player, panelId, context);
            } else if (panelId === 'reportListPanel') {
                return showPanel(player, 'reportActionsPanel', { ...context, targetReport: selectedItem });
            } else if (panelId === 'playerManagementPanel') {
                const [selectedName, selectedId] = selectedItem;
                const targetData = loadPlayerData(selectedId);
                const contextName = targetData ? targetData.name : selectedName;
                return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: contextName, targetPlayerId: selectedId, fromPanel: panelId, targetData });
            } else if (panelId === 'playerListPanel') {
                const targetData = getPlayer(selectedItem.id);
                return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: selectedItem.name, targetPlayerId: selectedItem.id, fromPanel: panelId, targetData });
            }
        }
        // If we fall through, just show the panel again
        return showPanel(player, panelId, context);
    }

    if (panelId === 'configCategoryPanel') {
        if (response.selection === 0) {return showPanel(player, 'mainPanel');}
        const selectedCategory = configPanelSchema[response.selection - 1];
        if (selectedCategory) {return showPanel(player, `config_${selectedCategory.id}`);}
        return;
    }

    if (panelId.startsWith('config_')) {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find(c => c.id === categoryId);
        if (!category) {return;}
        const newValues = response.formValues;
        const updates = {};
        let validationFailed = false;
        category.settings.forEach((setting, index) => {
            if (validationFailed) {return;}
            let newValue = newValues[index];
            if (setting.type === 'dropdown') {
                newValue = setting.options[newValue];
            } else if (setting.type === 'textField' && (setting.key.includes('Seconds') || setting.key.includes('Balance') || setting.key.includes('maxHomes') || setting.key.includes('Interval'))) {
                const numValue = Number(newValue);
                if (isNaN(numValue)) {
                    player.sendMessage(`§cInvalid number provided for ${setting.label}. Changes not saved.`);
                    validationFailed = true;
                    return;
                }
                newValue = numValue;
            }
            updates[setting.key] = newValue;
        });
        if (validationFailed) {return showPanel(player, panelId);}
        updateMultipleConfig(updates);
        player.sendMessage(`§aSuccessfully saved settings for ${category.title}§a.`);
        return showPanel(player, 'configCategoryPanel');
    }

    if (panelId === 'playerActionsPanel') {
        const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel);
        const selectedItem = visibleItems[response.selection];
        if (!selectedItem) {
            return;
        }

        if (selectedItem.id === '__back__') {
            return showPanel(player, context.fromPanel || 'mainPanel', context);
        }

        if (selectedItem.actionType === 'openPanel') {
            return showPanel(player, selectedItem.actionValue, context);
        }

        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {
                showPanel(player, panelId, context);
            }
        }
        return;
    }

    const panelDef = panelDefinitions[panelId];
    const menuItems = getMenuItems(panelDef, pData.permissionLevel);
    const selectedItem = menuItems[response.selection];
    if (!selectedItem) {return;}

    if (selectedItem.id === '__back__') {return showPanel(player, selectedItem.actionValue, context);}
    if (selectedItem.actionType === 'openPanel') {return showPanel(player, selectedItem.actionValue, context);}
    if (selectedItem.actionType === 'functionCall') {
        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {showPanel(player, panelId, context);}
        }
    }
}

// --- Shop Builder Functions ---

const ITEMS_PER_PAGE = 8; // Number of items to show per page in the shop

function getPaginatedItems(items, page) {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return items.slice(startIndex, endIndex);
}

function addPaginationButtons(form, page, totalItems) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (page > 1) {
        form.button('§e< Previous');
    }
    if (page < totalPages) {
        form.button('§eNext >');
    }
}

function buildShopMainPanel(form, context) {
    const shopConfig = getShopConfig();
    const view = context.view || 'shop'; // 'shop', 'buy', or 'sell'

    const categories = [...new Set(Object.keys(shopConfig.items).map(id => allItems[id]?.category).filter(Boolean))];

    const validCategories = categories.filter(category => {
        return Object.keys(shopConfig.items).some(id => {
            const masterItem = allItems[id];
            if (masterItem?.category !== category) {return false;}
            const shopItem = shopConfig.items[id];
            if (view === 'buy') {return shopItem.buyPrice > 0;}
            if (view === 'sell') {return shopItem.sellPrice > 0;}
            return true;
        });
    });

    if (validCategories.length === 0) {
        form.body('§cThe shop is currently empty.');
        return;
    }

    for (const category of validCategories) {
        form.button(category, shopCategoryIcons[category]);
    }
}

function buildShopCategoryPanel(form, context) {
    const { category, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();

    const itemsInCategory = Object.keys(shopConfig.items).filter(id => {
        const masterItem = allItems[id];
        if (masterItem?.category !== category) {return false;}
        const shopItem = shopConfig.items[id];
        if (view === 'buy') {return shopItem.buyPrice > 0;}
        if (view === 'sell') {return shopItem.sellPrice > 0;}
        return true;
    });

    const subCategories = [...new Set(itemsInCategory.map(id => allItems[id].subCategory).filter(Boolean))];
    const rootItems = itemsInCategory.filter(id => !allItems[id].subCategory);

    const allEntries = [
        ...subCategories.map(sc => ({ id: sc, type: 'subCategory' })),
        ...rootItems.map(i => ({ id: i, type: 'item' }))
    ];

    const paginatedEntries = getPaginatedItems(allEntries, page);

    for (const entry of paginatedEntries) {
        if (entry.type === 'subCategory') {
            const icon = shopSubCategoryIcons[entry.id] || 'textures/gui/folder_glyph';
            form.button(`§e${entry.id}`, icon);
        } else {
            const masterItem = allItems[entry.id];
            const shopItem = shopConfig.items[entry.id];
            let priceString = '';
            if (view === 'buy' && shopItem.buyPrice > 0) {
                priceString = `§2Buy: $${shopItem.buyPrice}`;
            } else if (view === 'sell' && shopItem.sellPrice > 0) {
                priceString = `§cSell: $${shopItem.sellPrice}`;
            } else {
                const buy = shopItem.buyPrice > 0 ? `§2B: $${shopItem.buyPrice}` : '';
                const sell = shopItem.sellPrice > 0 ? `§cS: $${shopItem.sellPrice}` : '';
                priceString = [buy, sell].filter(Boolean).join(' ');
            }
            form.button(`${masterItem.displayName ?? entry.id}\n${priceString}`, masterItem.icon);
        }
    }
    addPaginationButtons(form, page, allEntries.length);
}

function buildShopItemListPanel(form, context) {
    const { category, subCategory, page = 1, view = 'shop' } = context;
    const shopConfig = getShopConfig();

    const itemsInSubCategory = Object.keys(shopConfig.items).filter(id => {
        const masterItem = allItems[id];
        if (masterItem?.category !== category || masterItem?.subCategory !== subCategory) {return false;}
        const shopItem = shopConfig.items[id];
        if (view === 'buy') {return shopItem.buyPrice > 0;}
        if (view === 'sell') {return shopItem.sellPrice > 0;}
        return true;
    });

    const paginatedItems = getPaginatedItems(itemsInSubCategory, page);

    for (const itemId of paginatedItems) {
        const masterItem = allItems[itemId];
        const shopItem = shopConfig.items[itemId];
        let priceString = '';
        if (view === 'buy' && shopItem.buyPrice > 0) {
            priceString = `§2Buy: $${shopItem.buyPrice}`;
        } else if (view === 'sell' && shopItem.sellPrice > 0) {
            priceString = `§cSell: $${shopItem.sellPrice}`;
        } else {
            const buy = shopItem.buyPrice > 0 ? `§2B: $${shopItem.buyPrice}` : '';
            const sell = shopItem.sellPrice > 0 ? `§cS: $${shopItem.sellPrice}` : '';
            priceString = [buy, sell].filter(Boolean).join(' ');
        }
        form.button(`${masterItem.displayName ?? itemId}\n${priceString}`, masterItem.icon);
    }
    addPaginationButtons(form, page, itemsInSubCategory.length);
}

// --- Admin Edit Shop Builder Functions ---
function buildEditShopMainPanel(form) {
    const categories = [...new Set(Object.values(allItems).map(item => item.category))];
    for (const category of categories.sort()) {
        const icon = shopCategoryIcons[category] || 'textures/gui/folder_glyph';
        form.button(category, icon);
    }
}

function buildEditShopCategoryPanel(form, context) {
    const { category, page = 1 } = context;
    const shopConfig = getShopConfig();

    const itemsInCategory = Object.keys(allItems).filter(id => allItems[id].category === category);

    if (itemsInCategory.length === 0) {
        form.body('§cNo items found in this category.');
        return;
    }

    const paginatedItems = getPaginatedItems(itemsInCategory, page);

    for (const itemId of paginatedItems) {
        const masterItem = allItems[itemId];
        const shopItem = shopConfig.items[itemId];
        const status = shopItem ? '§2[Enabled]' : '§c[Disabled]';
        form.button(`${masterItem.displayName ?? itemId}\n${status}`, masterItem.icon);
    }

    addPaginationButtons(form, page, itemsInCategory.length);
}


// --- Helper & Builder Functions ---

function getVisiblePlayerActionItems(context, permissionLevel) {
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

function getMenuItems(panelDef, permissionLevel) {
    const items = (panelDef.items || []).filter(item => permissionLevel <= item.permissionLevel).sort((a, b) => (a.sortId || 0) - (b.sortId || 0));
    if (panelDef.parentPanelId) {
        items.unshift({ id: '__back__', text: '§l§8< Back', icon: 'textures/gui/controls/left.png', permissionLevel: 1024, actionType: 'openPanel', actionValue: panelDef.parentPanelId });
    }
    return items;
}

function addPanelBody(form, player, panelId, context) {
    const config = getConfig();
    if (panelId === 'myStatsPanel') {
        const pData = getPlayer(player.id);
        const rank = rankManager.getPlayerRank(player, config);
        if (!pData || !rank) {
            form.body('§cCould not retrieve your stats.');
            return;
        }
        const bounty = bountyManager.getBounty(player.id)?.amount ?? 0;
        form.body([
            `§fRank: §r${rank.chatFormatting?.nameColor ?? '§7'}${rank.name}`,
            `§fBalance: §a$${pData.balance.toFixed(2)}`,
            `§fBounty on you: §e$${bounty.toFixed(2)}`
        ].join('\n'));
    } else if (panelId === 'helpfulLinksPanel') {
        form.body([
            '§fHere are some helpful links:',
            `§9Discord: §r${config.serverInfo.discordLink}`,
            `§1Website: §r${config.serverInfo.websiteLink}`
        ].join('\n\n'));
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
            `§fBalance: §a$${pData.balance.toFixed(2)}`,
            `§fBounty: §e$${bounty.toFixed(2)}`
        ].join('\n'));
    } else if (panelId === 'reportActionsPanel' && context.targetReport) {
        const { targetReport } = context;
        form.body([
            `§fReport ID: §e${targetReport.id}`,
            `§fReported Player: §e${targetReport.reportedPlayerName}`,
            `§fReporter: §e${targetReport.reporterName}`,
            `§fReason: §e${targetReport.reason}`,
            `§fStatus: §e${targetReport.status}`,
            `§fDate: §e${new Date(targetReport.timestamp).toLocaleString()}`
        ].join('\n'));
    }
}

async function buildPlayerManagementForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allPlayersMap = getAllPlayerNameIdMap();
    const playerEntries = Array.from(allPlayersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const totalPages = Math.ceil(playerEntries.length / ITEMS_PER_PAGE);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§e< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (allPlayersMap.size === 0) {
        form.body('§cNo player data found.');
    } else {
        const paginatedEntries = getPaginatedItems(playerEntries, page);
        for (const [name] of paginatedEntries) {
            // Do NOT load player data here. Just display the name.
            // Rank prefixes are omitted to avoid loading every player's data.
            form.button(name);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§eNext Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildPlayerListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const onlinePlayers = playerCache.getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
    const totalPages = Math.ceil(onlinePlayers.length / ITEMS_PER_PAGE);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§e< Previous Page', 'textures/ui/arrow_left.png');
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
        form.button('§eNext Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

async function buildBountyListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allBounties = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);
    const totalPages = Math.ceil(allBounties.length / ITEMS_PER_PAGE);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§e< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (allBounties.length === 0) {
        form.body('§aThere are currently no active bounties.');
    } else {
        const paginatedBounties = getPaginatedItems(allBounties, page);
        for (const bounty of paginatedBounties) {
            form.button(`${bounty.name}\n§e$${bounty.amount.toFixed(2)}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§eNext Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

function buildReportListForm(title, context) {
    const page = context.page || 1;
    const form = new ActionFormData().title(`${title} (Page ${page})`);

    // Add Back button
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const reports = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
    const totalPages = Math.ceil(reports.length / ITEMS_PER_PAGE);

    // Add Previous button if not on the first page
    if (page > 1) {
        form.button('§e< Previous Page', 'textures/ui/arrow_left.png');
    }

    if (reports.length === 0) {
        form.body('§aThere are no active reports.');
    } else {
        const paginatedReports = getPaginatedItems(reports, page);
        for (const report of paginatedReports) {
            const statusColor = report.status === 'assigned' ? '§6' : '§c';
            form.button(`[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`);
        }
    }

    // Add Next button if not on the last page
    if (page < totalPages) {
        form.button('§eNext Page >', 'textures/ui/arrow_right.png');
    }

    return form;
}

// --- UI Action Functions ---

uiActionFunctions['showRules'] = async (player) => {
    const config = getConfig();
    const rulesForm = new ActionFormData().title('§l§eServer Rules').body(config.serverInfo.rules.join('\n')).button('§l§8Close');
    await utils.uiWait(player, rulesForm);
};

uiActionFunctions['assignReport'] = (player, context, panelId) => {
    reportManager.assignReport(context.targetReport.id, player.id);
    player.sendMessage(`§aReport ${context.targetReport.id} has been assigned to you.`);
    showPanel(player, panelId, context);
};

uiActionFunctions['resolveReport'] = (player, context) => {
    reportManager.resolveReport(context.targetReport.id);
    player.sendMessage(`§aReport ${context.targetReport.id} has been marked as resolved.`);
    showPanel(player, 'reportListPanel');
};

uiActionFunctions['clearReport'] = (player, context) => {
    reportManager.clearReport(context.targetReport.id);
    player.sendMessage(`§aReport ${context.targetReport.id} has been cleared.`);
    showPanel(player, 'reportListPanel');
};

uiActionFunctions['showUnbanForm'] = async (player) => {
    const form = new ModalFormData().title('Unban Player').textField('Player Name', 'Enter the name of the player to unban', { placeholderText: 'Enter player name' });
    const response = await utils.uiWait(player, form);
    if (!response || response.canceled) {return true;}
    const [targetName] = response.formValues;
    if (!targetName) {
        player.sendMessage('§cYou must enter a player name.');
        return true;
    }
    unbanPlayer(player, targetName);
    return true;
};

uiActionFunctions['showUnmuteForm'] = async (player) => {
    const form = new ModalFormData().title('Unmute Player').textField('Player Name', 'Enter the name of the player to unmute', { placeholderText: 'Enter player name' });
    const response = await utils.uiWait(player, form);
    if (!response || response.canceled) {return true;}
    const [targetName] = response.formValues;
    if (!targetName) {
        player.sendMessage('§cYou must enter a player name.');
        return true;
    }
    unmutePlayer(player, targetName);
    return true;
};


// --- Player Action Functions ---

uiActionFunctions['removeBounty'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const existingBounty = bountyManager.getBounty(targetPlayerId);

    if (!existingBounty) {
        player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
        return true; // Reload the panel
    }

    bountyManager.removeBounty(targetPlayerId);
    player.sendMessage(`§aSuccessfully removed the bounty from ${targetPlayerName}.`);
    world.sendMessage(`§aThe bounty on ${targetPlayerName} has been removed!`);

    return true; // Reload the panel to reflect the change
};

uiActionFunctions['kickPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
    if (!targetPlayer) {
        player.sendMessage(`§c${targetPlayerName} is not online.`);
        return true;
    }
    const form = new ModalFormData().title(`Kick ${targetPlayerName}`).textField('Reason', 'Enter reason for kicking', { defaultValue: 'No reason provided.' });
    const response = await utils.uiWait(player, form);
    if (response && !response.canceled) {
        const [reason] = response.formValues;
        kickPlayer(player, targetPlayer, reason);
    }
    return true;
};

uiActionFunctions['freezePlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
    if (!targetPlayer) {
        player.sendMessage(`§c${targetPlayerName} is not online.`);
        return true;
    }
    freezePlayer(player, targetPlayer);
    return true;
};

uiActionFunctions['unfreezePlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
    if (!targetPlayer) {
        player.sendMessage(`§c${targetPlayerName} is not online.`);
        return true;
    }
    unfreezePlayer(player, targetPlayer);
    return true;
};

uiActionFunctions['unmutePlayer'] = async (player, context) => {
    const { targetPlayerName } = context;
    unmutePlayer(player, targetPlayerName);
    return true;
};

uiActionFunctions['mutePlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
    if (!targetPlayer) {
        player.sendMessage(`§c${targetPlayerName} is not online. Use /offlinemute instead.`);
        return true;
    }
    const form = new ModalFormData().title(`Mute ${targetPlayerName}`).textField('Duration', 'e.g., 30m, 2h, 7d. Default: perm', { defaultValue: 'perm' }).textField('Reason', 'Enter reason for muting', { defaultValue: 'No reason provided.' });
    const response = await utils.uiWait(player, form);
    if (response && !response.canceled) {
        const [duration, reason] = response.formValues;
        mutePlayer(player, targetPlayer, duration, reason);
    }
    return true;
};

uiActionFunctions['banPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const form = new ModalFormData().title(`Ban ${targetPlayerName}`).textField('Duration', 'e.g., 30m, 2h, 7d. Default: perm', { defaultValue: 'perm' }).textField('Reason', 'Enter reason for banning', { defaultValue: 'No reason provided.' });
    const response = await utils.uiWait(player, form);
    if (response && !response.canceled) {
        const [duration, reason] = response.formValues;
        const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
        if (targetPlayer) {
            // Player is online
            banPlayer(player, targetPlayer, duration, reason);
        } else {
            // Player is offline
            offlineBanPlayer(player, targetPlayerId, targetPlayerName, duration, reason);
        }
    }
    return true;
};

uiActionFunctions['tpaPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
    if (!targetPlayer) {
        player.sendMessage(`§c${targetPlayerName} is not online.`);
        return true;
    }
    if (player.id === targetPlayer.id) {
        player.sendMessage('§cYou cannot send a TPA request to yourself.');
        return true;
    }
    const result = tpaManager.createRequest(player, targetPlayer, 'tpa');
    if (result.success) {
        player.sendMessage(`§aTPA request sent to ${targetPlayerName}.`);
        targetPlayer.sendMessage(`§a${player.name} has requested to teleport to you. Use !tpaccept or !tpadeny.`);
    } else {
        player.sendMessage(`§cError: ${result.message}`);
    }
    return true;
};

uiActionFunctions['tpaherePlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetPlayer = playerCache.getPlayerFromCache(targetPlayerId);
    if (!targetPlayer) {
        player.sendMessage(`§c${targetPlayerName} is not online.`);
        return true;
    }
    if (player.id === targetPlayer.id) {
        player.sendMessage('§cYou cannot send a TPAHere request to yourself.');
        return true;
    }
    const result = tpaManager.createRequest(player, targetPlayer, 'tpahere');
    if (result.success) {
        player.sendMessage(`§aTPAHere request sent to ${targetPlayerName}.`);
        targetPlayer.sendMessage(`§a${player.name} has requested for you to teleport to them. Use !tpaccept or !tpadeny.`);
    } else {
        player.sendMessage(`§cError: ${result.message}`);
    }
    return true;
};

uiActionFunctions['bountyPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const form = new ModalFormData().title(`Set Bounty on ${targetPlayerName}`).textField('Amount', 'Enter the bounty amount', { placeholderText: 'Enter amount' });
    const response = await utils.uiWait(player, form);
    if (response && !response.canceled) {
        const [amountStr] = response.formValues;
        const amount = Number(amountStr);
        const config = getConfig();
        if (isNaN(amount) || amount < config.economy.minimumBounty) {
            player.sendMessage(`§cInvalid amount. The minimum bounty is $${config.economy.minimumBounty}.`);
            return true;
        }
        if (economyManager.getBalance(player.id) < amount) {
            player.sendMessage('§cYou do not have enough money for this bounty.');
            return true;
        }
        const targetData = loadPlayerData(targetPlayerId);
        if (!targetData) {
            player.sendMessage('§cCould not find the target player\'s data.');
            return true;
        }
        const result = economyManager.removeBalance(player.id, amount);
        if (result) {
            bountyManager.incrementBounty(targetPlayerId, amount);
            player.sendMessage(`§aYou have placed a bounty of §e$${amount}§a on ${targetPlayerName}.`);
            world.sendMessage(`§cSomeone has placed a bounty of §e$${amount}§c on ${targetPlayerName}!`);
        } else {
            player.sendMessage('§cFailed to place bounty.');
        }
    }
    return true;
};

uiActionFunctions['reportPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const form = new ModalFormData().title(`Report ${targetPlayerName}`).textField('Reason for report:', 'Enter the reason here', { placeholderText: 'Enter the reason here' });
    const response = await utils.uiWait(player, form);
    if (response.canceled) {
        player.sendMessage('§cReport canceled.');
        return true;
    }
    const [reason] = response.formValues;
    if (!reason || reason.trim().length === 0) {
        player.sendMessage('§cYou must provide a reason.');
        return true;
    }
    reportManager.createReport(player, targetPlayerId, targetPlayerName, reason);
    player.sendMessage('§aReport submitted. Thank you for your help.');
    return true;
};

uiActionFunctions['removePlayerBounty'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetBounty = bountyManager.getBounty(targetPlayerId);

    if (!targetBounty) {
        player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
        return true;
    }

    const form = new ModalFormData()
        .title(`Remove Bounty from ${targetPlayerName}`)
        .textField(`Bounty Amount: $${targetBounty.amount.toFixed(2)}\nEnter amount to remove:`, 'Enter amount');

    const response = await utils.uiWait(player, form);

    if (response && !response.canceled) {
        const [amountStr] = response.formValues;
        const amount = Number(amountStr);

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage('§cInvalid amount. Please enter a positive number.');
            return true;
        }

        if (amount > targetBounty.amount) {
            player.sendMessage(`§cYou cannot remove more than the bounty amount ($${targetBounty.amount.toFixed(2)}).`);
            return true;
        }

        if (economyManager.getBalance(player.id) < amount) {
            player.sendMessage('§cYou dont have enough money for this!');
            return true;
        }

        const result = economyManager.removeBalance(player.id, amount);
        if (result) {
            bountyManager.incrementBounty(targetPlayerId, -amount);
            player.sendMessage(`§aYou have removed $${amount.toFixed(2)} from ${targetPlayerName}'s bounty.`);
            world.sendMessage(`§a${player.name} has removed $${amount.toFixed(2)} from ${targetPlayerName}'s bounty!`);
        } else {
            player.sendMessage('§cFailed to remove bounty.');
        }
    }

    return true; // Reload the panel
};
