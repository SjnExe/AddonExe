import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { panelDefinitions } from './panelLayoutConfig.js';
import { configPanelSchema } from './configPanelSchema.js';
import { getPlayer, getPlayerIdByName, loadPlayerData, getAllPlayerNameIdMap } from './playerDataManager.js';
import { getConfig, updateMultipleConfig } from './configManager.js';
import { debugLog } from './logger.js';
import { errorLog } from './errorLogger.js';
import { getPlayerRank } from './rankManager.js';
import { getPlayerFromCache } from './playerCache.js';
import * as utils from './utils.js';
import { getValueFromPath } from './objectUtils.js';
import * as punishmentManager from './punishmentManager.js';
import * as reportManager from './reportManager.js';
import * as bountyManager from './bountyManager.js';

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

    // First, handle dynamic panel generation that doesn't rely on panelDefinitions
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

    // Then, handle panels that are statically or semi-statically defined
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
    let title = panelDef.title.replace('{playerName}', context.targetPlayer?.name ?? '');

    if (panelId === 'mainPanel') {
        const config = getConfig();
        title = config.serverName || panelDef.title;
    }

    if (panelId === 'bountyListPanel') {
        debugLog(`[UIManager] Building dynamic list form for panel '${panelId}'.`);
        return buildBountyListForm(title);
    }

    if (panelId === 'reportListPanel') {
        debugLog(`[UIManager] Building dynamic list form for panel '${panelId}'.`);
        return buildReportListForm(title);
    }

    if (panelId === 'configCategoryPanel') {
        debugLog('[UIManager] Building config category list form.');
        const form = new ActionFormData().title(title);
        form.button('§l§8< Back', 'textures/gui/controls/left.png');
        for (const category of configPanelSchema) {
            form.button(category.title, category.icon);
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
    if (!pData) {
        debugLog(`[UIManager] Player data not found for ${player.name} during form response. Aborting.`);
        return;
    }


    if (panelId === 'bountyListPanel') {
        // The first button (selection 0) is 'Back'. For now, clicking a bounty
        // also just returns to the main menu as there is no action defined.
        return showPanel(player, 'mainPanel');
    }

    if (panelId === 'reportListPanel') {
        if (response.selection === 0) {return showPanel(player, 'mainPanel');}
        const reports = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
        const selectedReport = reports[response.selection - 1];
        if (selectedReport) {
            debugLog(`[UIManager] Player ${player.name} selected report ${selectedReport.id}.`);
            return showPanel(player, 'reportActionsPanel', { ...context, targetReport: selectedReport });
        }
        return;
    }

    if (panelId === 'configCategoryPanel') {
        if (response.selection === 0) {return showPanel(player, 'mainPanel');}
        const selectedCategory = configPanelSchema[response.selection - 1];
        if (selectedCategory) {
            debugLog(`[UIManager] Player ${player.name} selected config category ${selectedCategory.id}.`);
            // We use a dynamic panelId to represent the specific settings form
            return showPanel(player, `config_${selectedCategory.id}`);
        }
        return;
    }

    if (panelId.startsWith('config_')) {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find(c => c.id === categoryId);
        if (!category) {
            errorLog(`[UIManager] Could not find config category for ID: ${categoryId}`);
            return;
        }

        const newValues = response.formValues;
        const updates = {};
        let validationFailed = false;

        category.settings.forEach((setting, index) => {
            if (validationFailed) { return; }

            let newValue = newValues[index];

            // Parse and validate value from form
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

        if (validationFailed) {
            // Re-show the form with the invalid data so user can correct it
            return showPanel(player, panelId);
        }

        // Apply all grouped changes at once
        updateMultipleConfig(updates);

        player.sendMessage(`§aSuccessfully saved settings for ${category.title}§a.`);
        // Return to category list
        return showPanel(player, 'configCategoryPanel');
    }

    const panelDef = panelDefinitions[panelId];
    const menuItems = getMenuItems(panelDef, pData.permissionLevel);
    const selectedItem = menuItems[response.selection];
    if (!selectedItem) {
        debugLog(`[UIManager] Invalid selection ${response.selection} on panel '${panelId}' by ${player.name}.`);
        return;
    }

    debugLog(`[UIManager] Player ${player.name} selected item '${selectedItem.id}' on panel '${panelId}'. Action: ${selectedItem.actionType}`);
    if (selectedItem.id === '__back__') {
        return showPanel(player, selectedItem.actionValue, context);
    }
    if (selectedItem.actionType === 'openPanel') {
        return showPanel(player, selectedItem.actionValue, context);
    } else if (selectedItem.actionType === 'functionCall') {
        const actionFunction = uiActionFunctions[selectedItem.actionValue];
        if (actionFunction) {
            debugLog(`[UIManager] Calling UI action function: ${selectedItem.actionValue}`);
            const shouldReload = await actionFunction(player, context, panelId);
            if (shouldReload) {
            // If the action function returns true, it signals that the panel should be re-shown.
            // This is to avoid a nested showPanel call which seems to cause issues.
                showPanel(player, panelId, context);
            }
        } else {
            debugLog(`[UIManager] ERROR: UI action function '${selectedItem.actionValue}' not found.`);
        }
    }
}

// --- Helper & Builder Functions ---
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
        const rank = getPlayerRank(player, config);
        if (!pData || !rank) {
            form.body('§cCould not retrieve your stats.');
        } else {
            const bounty = bountyManager.getBounty(player.id)?.amount ?? 0;
            const statsBody = [
                `§fRank: §r${rank.chatFormatting?.nameColor ?? '§7'}${rank.name}`,
                `§fBalance: §a$${pData.balance.toFixed(2)}`,
                `§fBounty on you: §e$${bounty.toFixed(2)}`
            ].join('\n');
            form.body(statsBody);
        }
    } else if (panelId === 'helpfulLinksPanel') {
        const linksBody = [
            '§fHere are some helpful links:',
            `§9Discord: §r${config.serverInfo.discordLink}`,
            `§1Website: §r${config.serverInfo.websiteLink}`
        ].join('\n\n');
        form.body(linksBody);
    } else if (panelId === 'reportActionsPanel' && context.targetReport) {
        const { targetReport } = context;
        const reportDate = new Date(targetReport.timestamp).toLocaleString();
        const body = [
            `§fReport ID: §e${targetReport.id}`,
            `§fReported Player: §e${targetReport.reportedPlayerName}`,
            `§fReporter: §e${targetReport.reporterName}`,
            `§fReason: §e${targetReport.reason}`,
            `§fStatus: §e${targetReport.status}`,
            `§fDate: §e${reportDate}`
        ].join('\n');
        form.body(body);
    }
}

async function buildBountyListForm(title) {
    const form = new ActionFormData().title(title);
    form.button('§l§8< Back', 'textures/gui/controls/left.png');

    const allBounties = Array.from(bountyManager.getAllBounties().values());

    if (allBounties.length === 0) {
        form.body('§aThere are currently no active bounties.');
    } else {
        allBounties.sort((a, b) => b.amount - a.amount); // Sort descending by bounty amount
        for (const bounty of allBounties) {
            form.button(`${bounty.name}\n§e$${bounty.amount.toFixed(2)}`);
        }
    }
    return form;
}

function buildReportListForm(title) {
    const form = new ActionFormData().title(title);
    const reports = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned');
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    if (reports.length === 0) {
        form.body('§aThere are no active reports.');
    } else {
        reports.sort((a, b) => a.timestamp - b.timestamp);
        for (const report of reports) {
            const statusColor = report.status === 'assigned' ? '§6' : '§c';
            form.button(`[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`);
        }
    }
    return form;
}

// --- UI Action Functions ---

uiActionFunctions['showRules'] = async (player, context) => {
    debugLog(`[UIManager] Action 'showRules' called by ${player.name}.`);
    const config = getConfig();
    const rulesForm = new ActionFormData()
        .title('§l§eServer Rules')
        .body(config.serverInfo.rules.join('\n'))
        .button('§l§8Close');
    await utils.uiWait(player, rulesForm);
};


uiActionFunctions['assignReport'] = (player, context, panelId) => {
    const { targetReport } = context;
    if (!targetReport) {return;}
    debugLog(`[UIManager] Action 'assignReport' called by ${player.name} for report ${targetReport.id}.`);
    reportManager.assignReport(targetReport.id, player.id);
    player.sendMessage(`§aReport ${targetReport.id} has been assigned to you.`);
    showPanel(player, panelId, context);
};

uiActionFunctions['resolveReport'] = (player, context, panelId) => {
    const { targetReport } = context;
    if (!targetReport) {return;}
    debugLog(`[UIManager] Action 'resolveReport' called by ${player.name} for report ${targetReport.id}.`);
    reportManager.resolveReport(targetReport.id);
    player.sendMessage(`§aReport ${targetReport.id} has been marked as resolved.`);
    showPanel(player, 'reportListPanel'); // This one should probably stay hardcoded, as it navigates to a different panel
};

uiActionFunctions['clearReport'] = (player, context, panelId) => {
    const { targetReport } = context;
    if (!targetReport) {return;}
    debugLog(`[UIManager] Action 'clearReport' called by ${player.name} for report ${targetReport.id}.`);
    reportManager.clearReport(targetReport.id);
    player.sendMessage(`§aReport ${targetReport.id} has been cleared.`);
    showPanel(player, 'reportListPanel'); // This one should also stay hardcoded
};

uiActionFunctions['showUnbanForm'] = async (player, context, panelId) => {
    debugLog(`[UIManager] Action 'showUnbanForm' called by ${player.name}.`);
    const form = new ModalFormData().title('Unban Player').textField('Player Name', 'Enter the name of the player to unban');
    const response = await utils.uiWait(player, form);
    if (response && !response.canceled) {
        const [targetName] = response.formValues;
        if (!targetName) {
            player.sendMessage('§cYou must enter a player name.');
        } else {
            const targetId = getPlayerIdByName(targetName);

            if (!targetId) {
                player.sendMessage(`§cPlayer "${targetName}" has never joined the server or name is misspelled.`);
            } else if (targetId === player.id) {
                player.sendMessage('§cYou cannot unban yourself.');
            } else {
                const executorData = getPlayer(player.id);
                const targetData = loadPlayerData(targetId); // Load offline player's data for the check

                if (executorData && targetData && executorData.permissionLevel >= targetData.permissionLevel) {
                    player.sendMessage('§cYou cannot unban a player with the same or higher rank than you.');
                } else {
                    punishmentManager.removePunishment(targetId);
                    player.sendMessage(`§aSuccessfully unbanned ${targetName}. They can now rejoin the server.`);
                }
            }
        }
    }
    return true;
};
