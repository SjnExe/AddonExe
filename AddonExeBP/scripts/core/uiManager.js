import { world } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { panelDefinitions } from './panelLayoutConfig.js';
import { configPanelSchema } from './configPanelSchema.js';
import { getPlayer, loadPlayerData, getAllPlayerNameIdMap } from './playerDataManager.js';
import { getConfig, updateMultipleConfig, resetConfigSection } from './configManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
import * as rankManager from './rankManager.js';
import * as rankDb from './rankDb.js';
import * as playerCache from './playerCache.js';
import * as utils from './utils.js';
import { getValueFromPath, setValueByPath } from './objectUtils.js';
import * as reportManager from './reportManager.js';
import * as bountyManager from './bountyManager.js';
import * as economyManager from './economyManager.js';
import * as tpaManager from './tpaManager.js';
import { kickPlayer } from '../modules/commands/kick.js';
import { mutePlayer, unmutePlayer } from '../modules/commands/mute.js';
import { banPlayer, offlineBanPlayer, unbanPlayer } from '../modules/commands/ban.js';
import { freezePlayer, unfreezePlayer } from '../modules/commands/freeze.js';
import * as rulesManager from './rulesManager.js';
import * as helpfulLinksManager from './helpfulLinksManager.js';
import * as shopManager from './shopManager.js';
import { getKitsConfig, saveKitsConfig, getShopConfig, saveShopConfig, getSpawnConfig, saveSpawnConfig } from './configurations.js';
import { items as allItems } from './itemsConfig.js';
import { createKit, deleteKit, getAllKits, updateKitSettings, renameKit } from './kitAdminManager.js';
import { addItemToKit, updateItemInKit } from './kitItemsManager.js';
import * as shopAdminManager from './shopAdminManager.js';
import { initializeSpawnProtection } from '../modules/detections/spawnProtection.js';


const itemsPerPage = 8; // Number of items to show per page in the shop

const configHandlers = {
    'main': {
        get: getConfig,
        save: (updates) => updateMultipleConfig(updates)
    },
    'spawn': {
        get: getSpawnConfig,
        save: (config) => saveSpawnConfig(config)
    }
};

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
            showPanel(player, 'helpfulLinksManagementPanel', context);
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

    if (panelId === 'rankManagementPanel') {
        const panelDef = panelDefinitions[panelId];
        const title = panelDef.title;
        const form = new ActionFormData().title(title);
        buildRankManagementPanel(form, context);
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

    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        const form = new ActionFormData().title(`${title} (Page ${page})`);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');

        let allSystems = [
            ...configPanelSchema.map(c => ({ id: `config_${c.id}`, title: c.title, icon: c.icon }))
        ];

        if (pData.permissionLevel <= 1) {
            allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
            allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
            allSystems.push({ id: 'rankManagementPanel', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' });
        }
        if (pData.permissionLevel === 0) {
            allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
        }

        // Custom sorting: General first, Reset last, rest alphabetical
        const generalSystem = allSystems.find(s => s.id === 'config_general');
        const resetSystem = allSystems.find(s => s.id === 'configResetPanel');
        let otherSystems = allSystems.filter(s => s.id !== 'config_general' && s.id !== 'configResetPanel');
        otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        const sortedSystems = [];
        if (generalSystem) {sortedSystems.push(generalSystem);}
        sortedSystems.push(...otherSystems);
        if (resetSystem) {sortedSystems.push(resetSystem);}

        const paginatedSystems = getPaginatedItems(sortedSystems, page);

        for (const system of paginatedSystems) {
            form.button(system.title, system.icon);
        }

        addPaginationButtons(form, page, allSystems.length);
        return form;
    }

    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const form = new ActionFormData().title(`${title} (Page ${page})`);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');

        const resettableSystems = [
            ...configPanelSchema.map(c => ({ id: c.id, title: c.title, icon: c.icon })),
            { id: 'kits', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' },
            { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
            { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
        ];
        resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        const generalSystem = resettableSystems.find(s => s.id === 'general');
        let otherSystems = resettableSystems.filter(s => s.id !== 'general');

        const sortedSystems = [];
        if (generalSystem) {sortedSystems.push(generalSystem);}
        sortedSystems.push(...otherSystems);

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
}

// Processes the response from a submitted form.
async function handleFormResponse(player, panelId, response, context) {
    const { selection, canceled, formValues } = response;
    debugLog(`[UIManager] Handling form response for panel '${panelId}' from ${player.name}. Selection: ${selection}`);
    const pData = getPlayer(player.id);
    if (!pData) {return;}

    if (panelId === 'rulesManagementPanel') {
        const page = context.page || 1;
        const rules = rulesManager.getRules();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }
        // "Add Rule" button
        if (selection === 1) {
            return showPanel(player, 'addRulePanel', context);
        }

        const paginatedRules = getPaginatedItems(rules, page);
        const selectionIndex = selection - 2;

        // Handle rule selection
        if (selectionIndex < paginatedRules.length) {
            const ruleIndex = ((page - 1) * itemsPerPage) + selectionIndex;
            return showPanel(player, 'ruleActionPanel', { ...context, ruleIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedRules.length;
        const totalPages = Math.ceil(rules.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (rules.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) buttonIndex--;

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) buttonIndex--;
        }
        return;
    }

    if (panelId === 'addRulePanel') {
        if (canceled) {
            return showPanel(player, 'rulesManagementPanel', context);
        }
        const [newRuleText] = formValues;
        if (newRuleText) {
            rulesManager.addRule(newRuleText);
            player.sendMessage('§2Rule added successfully.');
        }
        return showPanel(player, 'rulesManagementPanel', context);
    }

    if (panelId === 'helpfulLinksManagementPanel') {
        const page = context.page || 1;
        const links = helpfulLinksManager.getHelpfulLinks();

        // Back button
        if (selection === 0) {
            return showPanel(player, 'mainPanel', context);
        }
        // Add Link button
        if (selection === 1) {
            return showPanel(player, 'addHelpfulLinkPanel', context);
        }

        const paginatedLinks = getPaginatedItems(links, page);
        const selectionIndex = selection - 2;

        // Handle link selection
        if (selectionIndex < paginatedLinks.length) {
            const linkIndex = ((page - 1) * itemsPerPage) + selectionIndex;
            return showPanel(player, 'helpfulLinkActionPanel', { ...context, linkIndex });
        }

        // Handle pagination
        let buttonIndex = selectionIndex - paginatedLinks.length;
        const totalPages = Math.ceil(links.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (links.length > itemsPerPage) {
            if (hasPrev && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            if (hasPrev) buttonIndex--;

            if (hasNext && buttonIndex === 0) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            if (hasNext) buttonIndex--;
        }
        return;
    }

    if (panelId === 'addHelpfulLinkPanel') {
        if (canceled) {
            return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        const [title, url] = formValues;
        if (title && url) {
            helpfulLinksManager.addHelpfulLink(title, url);
            player.sendMessage('§2Link added successfully.');
        }
        return showPanel(player, 'helpfulLinksManagementPanel', context);
    }

    if (panelId === 'helpfulLinkActionPanel') {
        const { linkIndex } = context;
        switch (selection) {
            case 0: { // Edit
                const links = helpfulLinksManager.getHelpfulLinks();
                const currentLink = links[linkIndex];
                const editForm = new ModalFormData()
                    .title('Edit Link')
                    .textField('Link Title', 'Enter the new title', { defaultValue: currentLink.title })
                    .textField('Link URL', 'Enter the new URL', { defaultValue: currentLink.url });
                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'helpfulLinkActionPanel', context);
                }
                const [newTitle, newUrl] = editResponse.formValues;
                if (newTitle && newUrl) {
                    helpfulLinksManager.editHelpfulLink(linkIndex, newTitle, newUrl);
                    player.sendMessage('§2Link updated successfully.');
                }
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            }
            case 1: // Move Up
                helpfulLinksManager.moveHelpfulLink(linkIndex, 'up');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 2: // Move Down
                helpfulLinksManager.moveHelpfulLink(linkIndex, 'down');
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            case 3: { // Delete Link
                const confirmForm = new ActionFormData()
                    .title('§cConfirm Deletion')
                    .body('Are you sure you want to delete this link?')
                    .button('§cYes, Delete', 'textures/ui/trash')
                    .button('§2No, Cancel', 'textures/ui/cancel');
                const confirmResponse = await utils.uiWait(player, confirmForm);
                if (confirmResponse.selection === 0) {
                    helpfulLinksManager.deleteHelpfulLink(linkIndex);
                    player.sendMessage('§2Link deleted successfully.');
                }
                return showPanel(player, 'helpfulLinksManagementPanel', context);
            }
            case 4: // Back
                return showPanel(player, 'helpfulLinksManagementPanel', context);
        }
        return;
    }

    if (panelId === 'ruleActionPanel') {
        const { ruleIndex } = context;

        switch (selection) {
            case 0: { // Edit Text
                const rules = rulesManager.getRules();
                const currentText = rules[ruleIndex];
                const editForm = new ModalFormData()
                    .title('Edit Rule Text')
                    .textField('Rule text', 'Enter the new text', { defaultValue: currentText });

                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) {
                    return showPanel(player, 'ruleActionPanel', context);
                }

                const [newText] = editResponse.formValues;
                if (newText) {
                    rulesManager.editRule(ruleIndex, newText);
                    player.sendMessage('§2Rule updated successfully.');
                }
                return showPanel(player, 'rulesManagementPanel', context);
            }
            case 1: // Move Up
                rulesManager.moveRule(ruleIndex, 'up');
                return showPanel(player, 'rulesManagementPanel', context);
            case 2: // Move Down
                rulesManager.moveRule(ruleIndex, 'down');
                return showPanel(player, 'rulesManagementPanel', context);
            case 3: { // Delete Rule
                const confirmForm = new ActionFormData()
                    .title('§cConfirm Deletion')
                    .body('Are you sure you want to delete this rule?')
                    .button('§cYes, Delete', 'textures/ui/trash')
                    .button('§2No, Cancel', 'textures/ui/cancel');

                const confirmResponse = await utils.uiWait(player, confirmForm);
                if (confirmResponse.selection === 0) {
                    rulesManager.deleteRule(ruleIndex);
                    player.sendMessage('§2Rule deleted successfully.');
                }
                return showPanel(player, 'rulesManagementPanel', context);
            }
            case 4: // Back
                return showPanel(player, 'rulesManagementPanel', context);
        }
        return;
    }

    // --- Shop Panel Handlers ---
    if (panelId === 'shopMainPanel') {
        if (selection === 0) { return showPanel(player, 'mainPanel'); }
        const shopConfig = getShopConfig();
        const validCategories = Object.keys(shopConfig.categories).filter(categoryName => {
            const category = shopConfig.categories[categoryName];
            const hasItems = Object.keys(category.items).length > 0;
            const hasSubCategories = Object.keys(category.subCategories).length > 0;
            return hasItems || hasSubCategories;
        }).sort();
        const selectedCategoryName = validCategories[selection - 1];
        if (selectedCategoryName) {
            return showPanel(player, `shopCategoryPanel_${selectedCategoryName}`, { ...context, categoryName: selectedCategoryName });
        }
        return;
    }

    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const resettableSystems = [
            ...configPanelSchema.map(c => ({ id: c.id, title: c.title, icon: c.icon })),
            { id: 'kits', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' },
            { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
            { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
        ];
        resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        const generalSystem = resettableSystems.find(s => s.id === 'general');
        let otherSystems = resettableSystems.filter(s => s.id !== 'general');

        const sortedSystems = [];
        if (generalSystem) {sortedSystems.push(generalSystem);}
        sortedSystems.push(...otherSystems);

        if (selection === 0) { // Back button
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            const confirmForm = new ActionFormData()
                .title(`Confirm Reset: ${selectedSystem.title}`)
                .body(`This action cannot be undone. Are you sure you want to reset the ${selectedSystem.title} configuration to its default values?`)
                .button('§cYes, Reset', 'textures/ui/check')
                .button('§2No, Cancel', 'textures/ui/cancel');

            const confirmResponse = await utils.uiWait(player, confirmForm);
            if (confirmResponse.canceled || confirmResponse.selection === 1) {
                player.sendMessage('§2Reset canceled.');
                return showPanel(player, 'configResetPanel', { ...context, page });
            }

            const finalConfirmForm = new ModalFormData()
                .title('Final Confirmation')
                .textField(`Type "confirm" to reset ${selectedSystem.title}.`, 'Case-insensitive');

            const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);

            if (finalConfirmResponse.canceled || finalConfirmResponse.formValues[0].toLowerCase() !== 'confirm') {
                player.sendMessage('§cFinal confirmation failed. Reset canceled.');
                return showPanel(player, 'configResetPanel', { ...context, page });
            }

            const result = resetConfigSection(selectedSystem.id);
            player.sendMessage(`§2${result.message}`);
            return showPanel(player, 'configResetPanel', { ...context, page: 1 });
        }

        let buttonIndex = selectionIndex - paginatedSystems.length;

        const totalPages = Math.ceil(resettableSystems.length / itemsPerPage);

        if (page >= totalPages) {
            if (buttonIndex === 0) {
                const confirmForm = new ActionFormData()
                    .title('Confirm Reset All')
                    .body('This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?')
                    .button('§cYes, Reset All', 'textures/ui/trash')
                    .button('§2No, Cancel', 'textures/ui/cancel');

                const confirmResponse = await utils.uiWait(player, confirmForm);
                if (confirmResponse.canceled || confirmResponse.selection === 1) {
                    player.sendMessage('§2Reset canceled.');
                    return showPanel(player, 'configResetPanel', { ...context, page });
                }

                const finalConfirmForm = new ModalFormData()
                    .title('Final Confirmation')
                    .textField('Type "confirm" to reset ALL systems.', 'Case-insensitive');

                const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);

                if (finalConfirmResponse.canceled || finalConfirmResponse.formValues[0].toLowerCase() !== 'confirm') {
                    player.sendMessage('§cFinal confirmation failed. Reset canceled.');
                    return showPanel(player, 'configResetPanel', { ...context, page });
                }

                const result = resetConfigSection('all');
                player.sendMessage(`§2${result.message}`);
                return showPanel(player, 'configResetPanel', { ...context, page: 1 });
            }
            buttonIndex--;
        }

        // Handle pagination
        const hasPrev = page > 1;

        if (hasPrev && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }
        if (buttonIndex >= 0) { // Should be next page
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }

        return;
    }

    if (panelId.startsWith('shopCategoryPanel_') || panelId.startsWith('shopItemListPanel_')) {
        const isItemList = panelId.startsWith('shopItemListPanel_');
        const prefix = isItemList ? 'shopItemListPanel_' : 'shopCategoryPanel_';
        const rawId = panelId.replace(prefix, '');
        const parts = rawId.split('_');
        const categoryName = parts[0];
        const subCategoryName = isItemList ? parts.slice(1).join('_') : undefined;
        const page = context.page || 1;
        const view = context.view || 'shop';

        if (selection === 0) { // Back button
            const parentPanel = isItemList ? `shopCategoryPanel_${categoryName}` : 'shopMainPanel';
            return showPanel(player, parentPanel, { ...context, page: 1 });
        }

        // Reconstruct the list of entries that was shown to the player
        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        let allEntries = [];
        if (isItemList) {
            const subCategory = category.subCategories[subCategoryName];
            allEntries = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
        } else { // shopCategoryPanel
            const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));
            const items = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));
            allEntries = [...subCategories, ...items];
        }

        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectionIndex = selection - 1;

        // Handle pagination
        if (selectionIndex >= paginatedEntries.length) {
            let newPage = page;
            const totalPages = Math.ceil(allEntries.length / itemsPerPage);
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
            return showPanel(player, `shopItemListPanel_${categoryName}_${selectedEntry.name}`, { ...context, categoryName, subCategoryName: selectedEntry.name, page: 1 });
        }

        // It's an item
        const itemId = selectedEntry.id;
        const masterItem = allItems[itemId];
        const shopItem = selectedEntry;

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
    if (panelId.startsWith('shopAddItemPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) { return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context); }

        if (selection === 1) { // Add Custom Item
            const form = new ModalFormData().title('Add Custom Item')
                .textField('Item ID (unique key)', 'e.g., custom_sword')
                .textField('Display Name', 'e.g., Sword of Awesome')
                .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [customId, displayName, mcId, icon, buyPriceStr, sellPriceStr, permLevelStr] = response.formValues;
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);

            if (customId && displayName && mcId && icon && !isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                shopAdminManager.addCustomItemToConfig(customId, { itemId: mcId, icon, buyPrice, sellPrice, displayName });
                shopAdminManager.setItem(categoryName, null, customId, { buyPrice, sellPrice, permissionLevel, icon, displayName });
                player.sendMessage(`§2Successfully added custom item '${displayName}'.`);
            } else {
                player.sendMessage('§cInvalid custom item data.');
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        const allPossibleItems = Object.keys(allItems);
        const paginatedItems = getPaginatedItems(allPossibleItems, page);
        const selectedItemId = paginatedItems[selection - 2];

        if (selectedItemId) {
            const masterItem = allItems[selectedItemId];
            const form = new ModalFormData().title(`Add ${masterItem.displayName}`)
                .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: masterItem.icon })
                .textField('Buy Price', '-1 to disable', { defaultValue: `${masterItem.buyPrice}` })
                .textField('Sell Price', '-1 to disable', { defaultValue: `${masterItem.sellPrice}` })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [icon, buyPriceStr, sellPriceStr, permLevelStr] = response.formValues;
            const buyPrice = parseInt(buyPriceStr, 10);
            const sellPrice = parseInt(sellPriceStr, 10);
            const permissionLevel = parseInt(permLevelStr, 10);
            if (!isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                const result = shopAdminManager.setItem(categoryName, null, selectedItemId, { buyPrice, sellPrice, permissionLevel, icon });
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allPossibleItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 2 - paginatedItems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId === 'shopManagementPanel') {
        const page = context.page || 1;
        if (selection === 0) { return showPanel(player, 'configCategoryPanel'); }

        if (selection === 1) {
            const mainConfig = getConfig();
            const newStatus = !mainConfig.shop.enabled;
            updateMultipleConfig({ 'shop.enabled': newStatus });
            player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (selection === 2) { // Add Category
            const form = new ModalFormData().title('Add Category').textField('Category Name', 'Enter category name').textField('Icon', 'Enter icon texture path');
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [name, icon] = response.formValues;
            if (name) {
                const result = shopAdminManager.addCategory(name, icon);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const shopConfig = getShopConfig();
        const categories = Object.keys(shopConfig.categories).sort();
        const paginatedCategories = getPaginatedItems(categories, page);
        const selectedCategoryName = paginatedCategories[selection - 3];

        if (selectedCategoryName) {
            return showPanel(player, `shopAdminCategoryPanel_${selectedCategoryName}`, { categoryName: selectedCategoryName });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(categories.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 3 - paginatedCategories.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryPanel_')) {
        const { categoryName, page = 1 } = context;
        if (selection === 0) { return showPanel(player, 'shopManagementPanel'); }
        if (selection === 1) { // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
        }
        if (selection === 2) { // Add Subcategory
            const form = new ModalFormData().title('Add Subcategory').textField('Subcategory Name', 'Enter subcategory name').textField('Icon', 'Enter icon texture path');
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            const [name, icon] = response.formValues;
            if (name) {
                const result = shopAdminManager.addSubCategory(categoryName, name, icon);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        if (selection === 3) { // Edit Category
            return showPanel(player, `shopAdminCategoryActionPanel_${categoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const category = shopConfig.categories[categoryName];
        const subCategories = Object.keys(category.subCategories).sort().map(name => ({ name, ...category.subCategories[name], type: 'subCategory' }));
        const items = Object.keys(category.items).map(id => ({ id, ...category.items[id], type: 'item' }));
        const allEntries = [...subCategories, ...items];
        const paginatedEntries = getPaginatedItems(allEntries, page);
        const selectedEntry = paginatedEntries[selection - 4];

        if (selectedEntry) {
            if (selectedEntry.type === 'item') {
                const form = new ActionFormData().title('Edit Item')
                    .button('Edit', 'textures/ui/icon_setting')
                    .button('Delete', 'textures/ui/trash');
                const response = await utils.uiWait(player, form);
                if (response.canceled) { return showPanel(player, panelId, context); }
                if (response.selection === 0) { // Edit
                    const masterItem = allItems[selectedEntry.id] || {};
                    const editForm = new ModalFormData().title(`Edit Item: ${selectedEntry.id}`)
                        .textField('Display Name', 'e.g., Magical Sword', { defaultValue: selectedEntry.displayName || masterItem.displayName })
                        .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', { defaultValue: masterItem.itemId })
                        .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: selectedEntry.icon || masterItem.icon })
                        .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedEntry.buyPrice) })
                        .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedEntry.sellPrice) })
                        .textField('Permission Level', 'e.g., 1024', { defaultValue: String(selectedEntry.permissionLevel) });

                    const editResponse = await utils.uiWait(player, editForm);
                    if (editResponse.canceled) { return showPanel(player, panelId, context); }

                    const [displayName, minecraftId, icon, buyPriceStr, sellPriceStr, permLevelStr] = editResponse.formValues;
                    const buyPrice = Number(buyPriceStr);
                    const sellPrice = Number(sellPriceStr);
                    const permissionLevel = Number(permLevelStr);

                    if (displayName && minecraftId && icon && !isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                        const result = shopAdminManager.updateShopItem(categoryName, null, selectedEntry.id, {
                            buyPrice, sellPrice, permissionLevel, icon, minecraftId, displayName
                        });
                        player.sendMessage(result.message);
                    } else {
                        player.sendMessage('§cInvalid data. Please check all fields.');
                    }
                } else { // Delete
                    const result = shopAdminManager.removeItem(categoryName, null, selectedEntry.id);
                    player.sendMessage(result.message);
                }
            } else { // subCategory
                return showPanel(player, `shopAdminSubCategoryItemPanel_${selectedEntry.name}`, { ...context, subCategoryName: selectedEntry.name });
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }
        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allEntries.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 4 - paginatedEntries.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
        const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
        const { page = 1 } = context;

        if (selection === 0) { // Edit
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            const form = new ModalFormData().title('Edit Category')
                .textField('Category Name', 'Enter new name', { defaultValue: categoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context); }
            const [newName, newIcon] = response.formValues;
            if (newName) {
                const result = shopAdminManager.editCategory(categoryName, newName, newIcon);
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }
        if (selection === 1) { // Delete
            const confirmForm = new ActionFormData().title('Confirm Deletion').body('Are you sure?').button('§cYes, Delete').button('§2No, Cancel');
            const response = await utils.uiWait(player, confirmForm);
            if (response.selection === 0) {
                const result = shopAdminManager.deleteCategory(categoryName);
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }
        if (selection === 2) { // Back
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
        }
    }

    if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
        const { categoryName, subCategoryName, page = 1 } = context;
        if (selection === 0) { return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context); }
        if (selection === 1) { // Add Item
            return showPanel(player, `shopAddItemPanel_${categoryName}`, { ...context, subCategoryName });
        }
        if (selection === 2) { // Edit Subcategory
            return showPanel(player, `shopAdminSubCategoryActionPanel_${subCategoryName}`, context);
        }

        const shopConfig = getShopConfig();
        const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
        const items = Object.keys(subCategory.items).map(id => ({ id, ...subCategory.items[id], type: 'item' }));
        const paginatedItems = getPaginatedItems(items, page);
        const selectedItem = paginatedItems[selection - 3];

        if (selectedItem) {
            const form = new ActionFormData().title('Edit Item')
                .button('Edit', 'textures/ui/icon_setting')
                .button('Delete', 'textures/ui/trash');
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, panelId, context); }
            if (response.selection === 0) { // Edit
                const masterItem = allItems[selectedItem.id] || {};
                const editForm = new ModalFormData().title(`Edit Item: ${selectedItem.id}`)
                    .textField('Display Name', 'e.g., Magical Sword', { defaultValue: selectedItem.displayName || masterItem.displayName })
                    .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword', { defaultValue: masterItem.itemId })
                    .textField('Icon Path', 'e.g., textures/items/diamond_sword', { defaultValue: selectedItem.icon || masterItem.icon })
                    .textField('Buy Price', '-1 to disable', { defaultValue: String(selectedItem.buyPrice) })
                    .textField('Sell Price', '-1 to disable', { defaultValue: String(selectedItem.sellPrice) })
                    .textField('Permission Level', 'e.g., 1024', { defaultValue: String(selectedItem.permissionLevel) });

                const editResponse = await utils.uiWait(player, editForm);
                if (editResponse.canceled) { return showPanel(player, panelId, context); }

                const [displayName, minecraftId, icon, buyPriceStr, sellPriceStr, permLevelStr] = editResponse.formValues;
                const buyPrice = Number(buyPriceStr);
                const sellPrice = Number(sellPriceStr);
                const permissionLevel = Number(permLevelStr);

                if (displayName && minecraftId && icon && !isNaN(buyPrice) && !isNaN(sellPrice) && !isNaN(permissionLevel)) {
                    const result = shopAdminManager.updateShopItem(categoryName, subCategoryName, selectedItem.id, {
                        buyPrice, sellPrice, permissionLevel, icon, minecraftId, displayName
                    });
                    player.sendMessage(result.message);
                } else {
                    player.sendMessage('§cInvalid data. Please check all fields.');
                }
            } else { // Delete
                const result = shopAdminManager.removeItem(categoryName, subCategoryName, selectedItem.id);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selection - 3 - paginatedItems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }

    if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
        const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
        const { categoryName } = context;
        if (selection === 0) { // Edit
            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName].subCategories[subCategoryName];
            const form = new ModalFormData().title('Edit Subcategory')
                .textField('Subcategory Name', 'Enter new name', { defaultValue: subCategoryName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
            const response = await utils.uiWait(player, form);
            if (response.canceled) { return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context); }
            const [newName, newIcon] = response.formValues;
            if (newName) {
                const result = shopAdminManager.editSubCategory(categoryName, subCategoryName, newName, newIcon);
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        if (selection === 1) { // Delete
            const confirmForm = new ActionFormData().title('Confirm Deletion').body('Are you sure?').button('§cYes, Delete').button('§2No, Cancel');
            const response = await utils.uiWait(player, confirmForm);
            if (response.selection === 0) {
                const result = shopAdminManager.deleteSubCategory(categoryName, subCategoryName);
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }
        if (selection === 2) { // Back
            return showPanel(player, `shopAdminSubCategoryItemPanel_${subCategoryName}`, context);
        }
    }

    if (panelId === 'kitManagementPanel') {
        const mainConfig = getConfig();
        const page = context.page || 1;

        // Handle Back button
        if (selection === 0) { return showPanel(player, 'configCategoryPanel'); }

        // Handle global toggle button
        if (selection === 1) {
            const newStatus = !mainConfig.kits.enabled;
            updateMultipleConfig({ 'kits.enabled': newStatus });
            player.sendMessage(`§2Kit system has been ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, 'kitManagementPanel', { ...context, page: 1 }); // Reload
        }

        // Handle Create New Kit button
        if (selection === 2) {
            const form = new ModalFormData()
                .title('Create New Kit')
                .textField('Kit Name', 'Enter a unique name for the kit')
                .textField('Cooldown (seconds)', 'e.g., 3600', { defaultValue: '3600' })
                .textField('Permission Level', '0=Admin, 1024=Member', { defaultValue: '1024' })
                .textField('Price', 'Cost to claim', { defaultValue: '0' });

            const createResponse = await utils.uiWait(player, form);
            if (createResponse.canceled) {
                return showPanel(player, 'kitManagementPanel', context);
            }

            const [kitName, cooldownStr, permissionLevelStr, priceStr] = createResponse.formValues;
            const cooldown = Number(cooldownStr);
            const permissionLevel = Number(permissionLevelStr);
            const price = Number(priceStr);

            if (!kitName || isNaN(cooldown) || isNaN(permissionLevel) || isNaN(price)) {
                player.sendMessage('§cInvalid input. Please check your values.');
                return showPanel(player, 'kitManagementPanel', context);
            }

            const result = createKit(kitName, { cooldown, permissionLevel, price });
            player.sendMessage(result.message);

            if (result.success) {
                return showPanel(player, `kitActionMenu_${kitName}`, context);
            } else {
                return showPanel(player, 'kitManagementPanel', context);
            }
        }

        const allKits = getAllKits();
        const kitNames = Object.keys(allKits);
        const paginatedKits = getPaginatedItems(kitNames, page);
        const totalPages = Math.ceil(kitNames.length / itemsPerPage);

        const kitStartIndex = 3; // Adjusted for the new buttons
        const kitEndIndex = kitStartIndex + paginatedKits.length - 1;

        if (selection >= kitStartIndex && selection <= kitEndIndex) {
            const selectedKitName = paginatedKits[selection - kitStartIndex];
            return showPanel(player, `kitActionMenu_${selectedKitName}`, {});
        }

        // After kit items, check for pagination buttons
        let currentButtonIndex = kitEndIndex + 1;

        if (page > 1) { // Previous Page button exists
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            currentButtonIndex++;
        }
        if (page < totalPages) { // Next Page button exists
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }

        return; // Should not be reached
    }




    if (panelId.startsWith('kitSettingsPanel_')) {
        const kitName = panelId.replace('kitSettingsPanel_', ''); // This is the original (lowercase) name
        if (canceled) {
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }

        const [isEnabled, newKitName, description, icon, cooldownStr, permissionLevelStr, priceStr] = formValues;

        let finalKitName = kitName;
        // Check if the name has changed (case-insensitive)
        if (newKitName.toLowerCase() !== kitName) {
            const renameResult = renameKit(kitName, newKitName);
            if (!renameResult.success) {
                player.sendMessage(`§c${renameResult.message}`);
                // Re-show the panel with the original name
                return showPanel(player, `kitSettingsPanel_${kitName}`, context);
            }
            player.sendMessage(`§2Kit '${kitName}' has been renamed to '${newKitName}'.`);
            finalKitName = newKitName.toLowerCase();
        }

        const newSettings = {
            enabled: isEnabled,
            description: description,
            icon: icon,
            cooldownSeconds: Number(cooldownStr),
            permissionLevel: Number(permissionLevelStr),
            price: Number(priceStr)
        };

        updateKitSettings(finalKitName, newSettings);

        player.sendMessage(`§2Successfully updated settings for kit '${finalKitName}'.`);
        return showPanel(player, `kitActionMenu_${finalKitName}`, context);
    }

    if (panelId.startsWith('kitActionMenu_')) {
        const kitName = panelId.replace('kitActionMenu_', '');

        switch (selection) {
            case 0: // Edit Settings
                return showPanel(player, `kitSettingsPanel_${kitName}`, context);
            case 1: // Edit Items
                return showPanel(player, `kitItemsPanel_${kitName}`, context);
            case 2: { // Delete Kit
                const confirmForm = new ActionFormData()
                    .title(`Delete Kit: ${kitName}?`)
                    .body('This action cannot be undone.')
                    .button('§cYes, delete this kit')
                    .button('§2No, go back');

                const confirmResponse = await utils.uiWait(player, confirmForm);
                if (confirmResponse.selection === 0) {
                    deleteKit(kitName);
                    player.sendMessage(`§2Kit '${kitName}' has been deleted.`);
                    return showPanel(player, 'kitManagementPanel', {});
                } else {
                    return showPanel(player, `kitActionMenu_${kitName}`, context);
                }
            }
            case 3: // Back
                return showPanel(player, 'kitManagementPanel', {});
        }
        return;
    }

    if (panelId.startsWith('kitItemsPanel_')) {
        const kitName = panelId.replace('kitItemsPanel_', '');
        const allKits = getAllKits();
        const kit = allKits[kitName];
        const page = context.page || 1;

        if (selection === 0) { // Add New Item
            const form = new ModalFormData()
                .title('Add New Item')
                .textField('Item ID', 'e.g., minecraft:diamond')
                .textField('Amount', 'e.g., 16');

            const addResponse = await utils.uiWait(player, form);
            if (addResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            const [typeId, amountStr] = addResponse.formValues;
            const amount = Number(amountStr);

            if (!typeId || isNaN(amount) || amount <= 0) {
                player.sendMessage('§cInvalid item ID or amount.');
                return showPanel(player, panelId, context);
            }

            const result = addItemToKit(kitName, { typeId, amount });
            player.sendMessage(result.message);
            return showPanel(player, panelId, { ...context, page: 1 });
        }

        const paginatedItems = getPaginatedItems(kit.items, page);
        const itemStartIndex = 1;
        const itemEndIndex = itemStartIndex + paginatedItems.length - 1;

        if (selection >= itemStartIndex && selection <= itemEndIndex) {
            const selectedItemIndexInPage = selection - itemStartIndex;
            const selectedItemIndex = ((page - 1) * itemsPerPage) + selectedItemIndexInPage;
            const selectedItem = kit.items[selectedItemIndex];

            const form = new ModalFormData()
                .title('Edit Item')
                .textField('Item ID', 'e.g., minecraft:diamond', { defaultValue: selectedItem.typeId })
                .textField('Amount', 'Set to 0 to delete.', { defaultValue: String(selectedItem.amount) });

            const editResponse = await utils.uiWait(player, form);
            if (editResponse.canceled) {
                return showPanel(player, panelId, context);
            }

            const [typeId, amountStr] = editResponse.formValues;
            const amount = Number(amountStr);

            if (!typeId || isNaN(amount)) {
                player.sendMessage('§cInvalid item ID or amount.');
                return showPanel(player, panelId, context);
            }

            const result = updateItemInKit(kitName, selectedItemIndex, { typeId, amount });
            player.sendMessage(result.message);
            return showPanel(player, panelId, { ...context, page: 1 }); // Go back to first page
        }

        // Handle pagination and back button
        let buttonIndex = itemEndIndex + 1;
        const totalPages = Math.ceil(kit.items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev) {
            if (selection === buttonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            buttonIndex++;
        }
        if (hasNext) {
            if (selection === buttonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
            buttonIndex++;
        }
        if (selection === buttonIndex) { // Back button
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }
        return;
    }

    if (panelId.startsWith('kitDetailPanel_')) {
        const kitName = panelId.replace('kitDetailPanel_', '');
        if (canceled) {
            return showPanel(player, 'kitManagementPanel', context);
        }

        // The last form value is the decorative item display, which we ignore.
        const [isEnabled, cooldownStr, permissionLevelStr] = formValues;
        const cooldown = Number(cooldownStr);
        const permissionLevel = Number(permissionLevelStr);

        if (isNaN(cooldown) || cooldown < 0) {
            player.sendMessage('§cInvalid cooldown. Please enter a non-negative number.');
            return showPanel(player, panelId, context); // Re-show the detail panel
        }
        if (isNaN(permissionLevel) || permissionLevel < 0) {
            player.sendMessage('§cInvalid permission level. Please enter a non-negative number.');
            return showPanel(player, panelId, context);
        }


        const kitsConfig = getKitsConfig();
        if (kitsConfig.kitDefinitions[kitName]) {
            kitsConfig.kitDefinitions[kitName].enabled = isEnabled;
            kitsConfig.kitDefinitions[kitName].cooldownSeconds = cooldown;
            kitsConfig.kitDefinitions[kitName].permissionLevel = permissionLevel;
            saveKitsConfig();
            player.sendMessage(`§2Successfully updated kit '${kitName}'.`);
        }

        return showPanel(player, 'kitManagementPanel', context); // Go back to the list
    }

    if (panelId === 'bountyListPanel' || panelId === 'reportListPanel' || panelId === 'playerManagementPanel' || panelId === 'playerListPanel') {
        const page = context.page || 1;

        if (selection === 0) { return showPanel(player, 'mainPanel'); }

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
        const totalPages = Math.ceil(allItems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        const itemStartIndex = hasPrev ? 2 : 1;
        const itemEndIndex = itemStartIndex + paginatedItems.length - 1;

        // Handle Previous button click
        if (hasPrev && selection === 1) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }

        // Handle Item click
        if (selection >= itemStartIndex && selection <= itemEndIndex) {
            const selectedItemIndex = selection - itemStartIndex;
            const selectedItem = paginatedItems[selectedItemIndex];

            if (panelId === 'bountyListPanel') {
                return showPanel(player, panelId, context); // No action yet
            }
            if (panelId === 'reportListPanel') {
                return showPanel(player, 'reportActionsPanel', { ...context, targetReport: selectedItem });
            }
            if (panelId === 'playerManagementPanel') {
                const [selectedName, selectedId] = selectedItem;
                const targetData = loadPlayerData(selectedId);
                const contextName = targetData ? targetData.name : selectedName;
                return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: contextName, targetPlayerId: selectedId, fromPanel: panelId, targetData });
            }
            if (panelId === 'playerListPanel') {
                const targetData = getPlayer(selectedItem.id);
                return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: selectedItem.name, targetPlayerId: selectedItem.id, fromPanel: panelId, targetData });
            }
        }

        // Handle Next button click
        const nextButtonIndex = itemEndIndex + 1;
        if (hasNext && selection === nextButtonIndex) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return showPanel(player, panelId, context); // Fallback
    }

    if (panelId.startsWith('rankActionMenu_')) {
        const rankId = panelId.replace('rankActionMenu_', '');
        const rank = rankManager.getRankById(rankId);

        switch (selection) {
            case 0: // Edit Rank
                return showPanel(player, 'editRankPanel', { ...context, rankId: rank.id });
            case 1: { // Delete Rank
                const confirmForm = new ActionFormData()
                    .title(`§cDelete ${rank.name}?`)
                    .body('This action cannot be undone.')
                    .button('§cYes, Delete Rank', 'textures/ui/trash')
                    .button('§2No, Keep Rank', 'textures/ui/cancel');
                const confirmResponse = await utils.uiWait(player, confirmForm);

                if (confirmResponse.selection === 0) {
                    const result = rankDb.deleteRank(rank.id);
                    player.sendMessage(result.message);
                    if (result.success) {
                        rankManager.reloadRanks();
                    }
                }
                return showPanel(player, 'rankManagementPanel', { ...context, page: 1 });
            }
            case 2: // Back
                return showPanel(player, 'rankManagementPanel', context);
        }
        return;
    }

    if (panelId === 'rankManagementPanel') {
        const page = context.page || 1;
        // Back button
        if (selection === 0) { return showPanel(player, 'configCategoryPanel'); }
        // Add New Rank button
        if (selection === 1) {
            return showPanel(player, 'addRankPanel', context);
        }

        const allRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);
        const paginatedRanks = getPaginatedItems(allRanks, page);
        const totalPages = Math.ceil(allRanks.length / itemsPerPage);

        const rankStartIndex = 2;
        const rankEndIndex = rankStartIndex + paginatedRanks.length - 1;

        if (selection >= rankStartIndex && selection <= rankEndIndex) {
            const selectedRank = paginatedRanks[selection - rankStartIndex];
            const isSpecialRank = selectedRank.conditions.some(c => c.type === 'isOwner' || c.type === 'default');

            if (isSpecialRank) {
                return showPanel(player, 'editRankPanel', { ...context, rankId: selectedRank.id });
            } else {
                return showPanel(player, `rankActionMenu_${selectedRank.id}`, { ...context, rankId: selectedRank.id });
            }
        }

        // Handle pagination
        let currentButtonIndex = rankEndIndex + 1;
        if (page > 1) { // Previous Page
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page - 1 });
            }
            currentButtonIndex++;
        }
        if (page < totalPages) { // Next Page
            if (selection === currentButtonIndex) {
                return showPanel(player, panelId, { ...context, page: page + 1 });
            }
        }
        return;
    }

    if (panelId === 'addRankPanel') {
        if (canceled) { return showPanel(player, 'rankManagementPanel', context); }

        const [name, id, permLevelStr, nameColor, chatColor, prefix] = formValues;
        const permissionLevel = parseInt(permLevelStr, 10);

        if (!name || !id || isNaN(permissionLevel)) {
            player.sendMessage('§cRank Name, ID, and Permission Level are required.');
            return showPanel(player, panelId, context);
        }
        if (permissionLevel === 0) {
            player.sendMessage('§cPermission level 0 is reserved for the Owner rank.');
            return showPanel(player, panelId, context);
        }
        if (rankManager.getRankById(id)) {
            player.sendMessage(`§cRank ID '${id}' already exists.`);
            return showPanel(player, panelId, context);
        }

        const newRank = {
            id,
            name,
            permissionLevel,
            chatFormatting: {
                prefixText: prefix,
                nameColor: nameColor,
                messageColor: chatColor
            },
            nametagPrefix: prefix, // Assuming prefix is used for nametag as well
            conditions: [{ type: 'hasTag', value: id }]
        };

        const result = rankDb.addRank(newRank);
        player.sendMessage(result.message);

        if (result.success) {
            rankManager.reloadRanks();
            return showPanel(player, 'rankManagementPanel', { ...context, page: 1 });
        } else {
            return showPanel(player, panelId, context);
        }
    }

    if (panelId === 'editRankPanel') {
        const rank = rankManager.getRankById(context.rankId);
        if (!rank) {
            player.sendMessage('§cRank not found.');
            return showPanel(player, 'rankManagementPanel', context);
        }
        const isSpecialRank = rank.conditions.some(c => c.type === 'isOwner' || c.type === 'default');

        if (canceled) {
            const fromPanel = isSpecialRank ? 'rankManagementPanel' : `rankActionMenu_${rank.id}`;
            return showPanel(player, fromPanel, context);
        }

        const [name, id, permLevelStr, nameColor, chatColor, prefix, nametagPrefix] = formValues;
        const permissionLevel = parseInt(permLevelStr, 10);

        if (!name) {
            player.sendMessage('§cRank Name cannot be empty.');
            return showPanel(player, panelId, context);
        }
        if (isSpecialRank && (id !== rank.id || permissionLevel !== rank.permissionLevel)) {
            player.sendMessage('§cCannot change the ID or Permission Level of a special rank.');
            return showPanel(player, panelId, context);
        }
        if (!isSpecialRank && permissionLevel === 0) {
            player.sendMessage('§cPermission level 0 is reserved for the Owner rank.');
            return showPanel(player, panelId, context);
        }

        const updatedData = {
            name,
            id,
            permissionLevel,
            chatFormatting: {
                prefixText: prefix,
                nameColor: nameColor,
                messageColor: chatColor
            },
            nametagPrefix: nametagPrefix
        };

        const result = rankDb.updateRank(rank.id, updatedData);
        player.sendMessage(result.message);

        if (result.success) {
            rankManager.reloadRanks();
            // After editing, the rank ID might have changed. We need to use the new ID.
            const newRankId = isSpecialRank ? rank.id : id;
            const fromPanel = isSpecialRank ? 'rankManagementPanel' : `rankActionMenu_${newRankId}`;
            const newContext = { ...context, rankId: newRankId, page: 1 };
            return showPanel(player, fromPanel, newContext);
        } else {
            return showPanel(player, panelId, context);
        }
    }

    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        if (selection === 0) { return showPanel(player, 'mainPanel'); }

        let allSystems = [
            ...configPanelSchema.map(c => ({ id: `config_${c.id}`, title: c.title, icon: c.icon }))
        ];
        if (pData.permissionLevel <= 1) {
            allSystems.push({ id: 'kitManagementPanel', title: '§l§dKit System§r', icon: 'textures/ui/inventory_icon' });
            allSystems.push({ id: 'shopManagementPanel', title: '§l§2Shop System§r', icon: 'textures/items/emerald' });
            allSystems.push({ id: 'rankManagementPanel', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' });
        }
        if (pData.permissionLevel === 0) {
            allSystems.push({ id: 'configResetPanel', title: '§l§cReset Settings§r', icon: 'textures/ui/wysiwyg_reset' });
        }
        allSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        // Re-apply the same custom sort from the build function
        const generalSystem = allSystems.find(s => s.id === 'config_general');
        const resetSystem = allSystems.find(s => s.id === 'configResetPanel');
        let otherSystems = allSystems.filter(s => s.id !== 'config_general' && s.id !== 'configResetPanel');
        otherSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));
        const sortedSystems = [];
        if (generalSystem) {sortedSystems.push(generalSystem);}
        sortedSystems.push(...otherSystems);
        if (resetSystem) {sortedSystems.push(resetSystem);}

        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection - 1;

        if (selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            // Reset context to ensure pagination starts from 1 on the new panel
            return showPanel(player, selectedSystem.id, {});
        }

        // Handle pagination
        let newPage = page;
        const totalPages = Math.ceil(allSystems.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;
        let buttonIndex = selectionIndex - paginatedSystems.length;

        if (hasPrev && buttonIndex === 0) {
            newPage--;
        } else if (hasNext) {
            newPage++;
        }
        return showPanel(player, panelId, { ...context, page: newPage });
    }


    if (panelId.startsWith('config_')) {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find(c => c.id === categoryId);
        if (!category) { return; }

        const configSource = category.configSource || 'main';
        const handler = configHandlers[configSource];
        if (!handler) {
            errorLog(`[UIManager] No config handler found for source: ${configSource}`);
            return;
        }

        const newValues = formValues;
        let validationFailed = false;

        const processAndValidate = (setting, value) => {
            if (setting.type === 'toggle') {
                return !!value;
            }
            if (setting.type === 'dropdown') {
                return setting.options[value];
            }

            const isNumericField = setting.key.includes('Seconds') ||
                                   setting.key.includes('Balance') ||
                                   setting.key.includes('maxHomes') ||
                                   setting.key.includes('Interval') ||
                                   setting.key.includes('Radius') ||
                                   setting.key.endsWith('.x') ||
                                   setting.key.endsWith('.y') ||
                                   setting.key.endsWith('.z');

            if (setting.type === 'textField' && isNumericField) {
                // For coordinate fields, an empty string should be treated as null (not set).
                if (value.trim() === '' && (setting.key.endsWith('.x') || setting.key.endsWith('.y') || setting.key.endsWith('.z'))) {
                    return null;
                }

                const numValue = Number(value);
                if (isNaN(numValue)) {
                    player.sendMessage(`§cInvalid number provided for ${setting.label}. Changes not saved.`);
                    validationFailed = true;
                    return value; // Return original invalid value to prevent further errors
                }
                return numValue;
            }
            return value;
        };

        if (configSource === 'main') {
            const updates = {};
            category.settings.forEach((setting, index) => {
                if (validationFailed) { return; }
                const newValue = processAndValidate(setting, newValues[index]);
                if (!validationFailed) {
                    updates[setting.key] = newValue;
                }
            });
            if (validationFailed) { return showPanel(player, panelId); }
            handler.save(updates);
        } else {
            const configToSave = handler.get();
            category.settings.forEach((setting, index) => {
                if (validationFailed) { return; }
                const newValue = processAndValidate(setting, newValues[index]);
                if (!validationFailed) {
                    setValueByPath(configToSave, setting.key, newValue);
                }
            });
            if (validationFailed) { return showPanel(player, panelId); }
            handler.save(configToSave);

            // If the spawn config was just updated, re-initialize spawn protection
            // to apply the new settings immediately.
            if (configSource === 'spawn') {
                initializeSpawnProtection();
                player.sendMessage('§aSpawn protection system has been updated based on new settings.');
            }
        }

        player.sendMessage(`§2Successfully saved settings for ${category.title}§2.`);
        return showPanel(player, 'configCategoryPanel');
    }

    if (panelId === 'playerActionsPanel') {
        const visibleItems = getVisiblePlayerActionItems(context, pData.permissionLevel);
        const selectedItem = visibleItems[selection];
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
    const selectedItem = menuItems[selection];
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

function getPaginatedItems(items, page) {
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
}

function addPaginationButtons(form, page, totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > 1) {
        form.button('§l§4< §1Previous');
    }
    if (page < totalPages) {
        form.button('§l§1Next §4>');
    }
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
                priceString = `§2Buy: $${entry.buyPrice}`;
            } else if (view === 'sell' && entry.sellPrice > 0) {
                priceString = `§cSell: $${entry.sellPrice}`;
            } else {
                const buy = entry.buyPrice > 0 ? `§2B: $${entry.buyPrice}` : '';
                const sell = entry.sellPrice > 0 ? `§cS: $${entry.sellPrice}` : '';
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
            priceString = `§2Buy: $${item.buyPrice}`;
        } else if (view === 'sell' && item.sellPrice > 0) {
            priceString = `§cSell: $${item.sellPrice}`;
        } else {
            const buy = item.buyPrice > 0 ? `§2B: $${item.buyPrice}` : '';
            const sell = item.sellPrice > 0 ? `§cS: $${item.sellPrice}` : '';
            priceString = [buy, sell].filter(Boolean).join(' ');
        }
        form.button(`${displayName}\n${priceString}`, icon);
    }
    addPaginationButtons(form, page, items.length);
}

// --- Admin Edit Shop Builder Functions ---
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
        const pData = getPlayer(player.id);
        const rank = rankManager.getPlayerRank(player, config);
        if (!pData || !rank) {
            form.body('§cCould not retrieve your stats.');
            return;
        }
        const bounty = bountyManager.getBounty(player.id)?.amount ?? 0;
        form.body([
            `§fRank: §r${rank.chatFormatting?.nameColor ?? '§7'}${rank.name}`,
            `§fBalance: §2$${pData.balance.toFixed(2)}`,
            `§fBounty on you: §6$${bounty.toFixed(2)}`
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
            `§fBalance: §2$${pData.balance.toFixed(2)}`,
            `§fBounty: §6$${bounty.toFixed(2)}`
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

    const onlinePlayers = playerCache.getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
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
            form.button(`${bounty.name}\n§6$${bounty.amount.toFixed(2)}`);
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

// --- UI Action Functions ---

uiActionFunctions['showRules'] = async (player) => {
    const rules = rulesManager.getRules();
    const pData = getPlayer(player.id);

    const rulesForm = new ActionFormData()
        .title('§l§6Server Rules')
        .body(rules.join('\n'));

    // Add "Edit Rules" button for admins
    if (pData && pData.permissionLevel <= 1) {
        rulesForm.button('§l§4Edit Rules', 'textures/ui/icon_setting');
    }

    rulesForm.button('§l§8Close', 'textures/ui/cancel');

    const response = await utils.uiWait(player, rulesForm);

    if (response.canceled) {return;}

    // If the "Edit Rules" button was shown and clicked
    if (pData && pData.permissionLevel <= 1 && response.selection === 0) {
        return showPanel(player, 'rulesManagementPanel');
    }
};

uiActionFunctions['showHelpfulLinks'] = async (player) => {
    const links = helpfulLinksManager.getHelpfulLinks();
    const pData = getPlayer(player.id);

    const form = new ActionFormData()
        .title('§l§9Helpful Links');

    if (links.length === 0) {
        form.body('§cNo helpful links have been configured by the admin.');
    } else {
        const bodyText = links.map(link => `§f${link.title}: §r${link.url}`).join('\n\n');
        form.body(bodyText);
    }

    if (pData && pData.permissionLevel <= 1) {
        form.button('§l§4Edit Links', 'textures/ui/icon_setting');
    }

    form.button('§l§8Close', 'textures/ui/cancel');

    const response = await utils.uiWait(player, form);

    if (response.canceled) { return; }

    if (pData && pData.permissionLevel <= 1 && response.selection === 0) {
        return showPanel(player, 'helpfulLinksManagementPanel');
    }
};

uiActionFunctions['assignReport'] = (player, context, panelId) => {
    reportManager.assignReport(context.targetReport.id, player.id);
    player.sendMessage(`§2Report ${context.targetReport.id} has been assigned to you.`);
    showPanel(player, panelId, context);
};

uiActionFunctions['resolveReport'] = (player, context) => {
    reportManager.resolveReport(context.targetReport.id);
    player.sendMessage(`§2Report ${context.targetReport.id} has been marked as resolved.`);
    showPanel(player, 'reportListPanel');
};

uiActionFunctions['clearReport'] = (player, context) => {
    reportManager.clearReport(context.targetReport.id);
    player.sendMessage(`§2Report ${context.targetReport.id} has been cleared.`);
    showPanel(player, 'reportListPanel');
};

uiActionFunctions['showUnbanForm'] = async (player) => {
    const form = new ModalFormData().title('Unban Player').textField('Player Name', 'Enter player name');
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
    const form = new ModalFormData().title('Unmute Player').textField('Player Name', 'Enter player name');
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
    player.sendMessage(`§2Successfully removed the bounty from ${targetPlayerName}.`);
    world.sendMessage(`§2The bounty on ${targetPlayerName} has been removed!`);

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
        player.sendMessage(`§2TPA request sent to ${targetPlayerName}.`);
        targetPlayer.sendMessage(`§2${player.name} has requested to teleport to you. Use !tpaccept or !tpadeny.`);
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
        player.sendMessage(`§2TPAHere request sent to ${targetPlayerName}.`);
        targetPlayer.sendMessage(`§2${player.name} has requested for you to teleport to them. Use !tpaccept or !tpadeny.`);
    } else {
        player.sendMessage(`§cError: ${result.message}`);
    }
    return true;
};

uiActionFunctions['bountyPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const form = new ModalFormData().title(`Set Bounty on ${targetPlayerName}`).textField('Amount', 'Enter amount');
    const response = await utils.uiWait(player, form);
    if (response && !response.canceled) {
        const [amountStr] = response.formValues;
        const amount = Number(amountStr);
        const config = getConfig();
        if (isNaN(amount) || amount < config.bounties.minimumBounty) {
            player.sendMessage(`§cInvalid amount. The minimum bounty is $${config.bounties.minimumBounty}.`);
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
            player.sendMessage(`§2You have placed a bounty of §6$${amount}§2 on ${targetPlayerName}.`);
            world.sendMessage(`§cSomeone has placed a bounty of §6$${amount}§c on ${targetPlayerName}!`);
        } else {
            player.sendMessage('§cFailed to place bounty.');
        }
    }
    return true;
};

uiActionFunctions['reportPlayer'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const form = new ModalFormData().title(`Report ${targetPlayerName}`).textField('Reason for report:', 'Enter the reason here');
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
    player.sendMessage('§2Report submitted. Thank you for your help.');
    return true;
};

uiActionFunctions['removePlayerBounty'] = async (player, context) => {
    const { targetPlayerId, targetPlayerName } = context;
    const targetBounty = bountyManager.getBounty(targetPlayerId);

    if (!targetBounty) {
        player.sendMessage(`§c${targetPlayerName} does not have an active bounty.`);
        return true; // Reload the panel
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
            player.sendMessage(`§2You have removed $${amount.toFixed(2)} from ${targetPlayerName}'s bounty.`);
            world.sendMessage(`§2${player.name} has removed $${amount.toFixed(2)} from ${targetPlayerName}'s bounty!`);
        } else {
            player.sendMessage('§cFailed to remove bounty.');
        }
    }

    return true; // Reload the panel
};

function buildRankManagementPanel(form, context) {
    const { page = 1 } = context;
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
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
