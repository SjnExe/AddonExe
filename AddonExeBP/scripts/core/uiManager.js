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

    if (panelId === 'bountyListPanel') {return buildBountyListForm(title);}
    if (panelId === 'reportListPanel') {return buildReportListForm(title);}
    if (panelId === 'playerManagementPanel') {return buildPlayerManagementForm(title);}
    if (panelId === 'playerListPanel') {return buildPlayerListForm(title);}

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

    if (panelId === 'bountyListPanel') {
        return showPanel(player, 'mainPanel');
    }

    if (panelId === 'reportListPanel') {
        if (response.selection === 0) {return showPanel(player, 'mainPanel');}
        const reports = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
        const selectedReport = reports[response.selection - 1];
        if (selectedReport) {return showPanel(player, 'reportActionsPanel', { ...context, targetReport: selectedReport });}
        return;
    }

    if (panelId === 'playerManagementPanel') {
        if (response.selection === 0) {return showPanel(player, 'mainPanel');}
        const playerEntries = Array.from(getAllPlayerNameIdMap().entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const selectedEntry = playerEntries[response.selection - 1];
        if (selectedEntry) {
            const [selectedName, selectedId] = selectedEntry;
            const targetData = loadPlayerData(selectedId);
            const contextName = targetData ? targetData.name : selectedName;
            return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: contextName, targetPlayerId: selectedId, fromPanel: panelId });
        }
        return;
    }

    if (panelId === 'playerListPanel') {
        if (response.selection === 0) {return showPanel(player, 'mainPanel');}
        const onlinePlayers = playerCache.getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
        const selectedPlayer = onlinePlayers[response.selection - 1];
        if (selectedPlayer) {
            return showPanel(player, 'playerActionsPanel', { ...context, targetPlayerName: selectedPlayer.name, targetPlayerId: selectedPlayer.id, fromPanel: panelId });
        }
        return;
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
        const pData = loadPlayerData(context.targetPlayerId);
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

async function buildPlayerManagementForm(title) {
    const form = new ActionFormData().title(title);
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    const allPlayersMap = getAllPlayerNameIdMap();
    if (allPlayersMap.size === 0) {
        form.body('§cNo player data found.');
    } else {
        const playerEntries = Array.from(allPlayersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [name, id] of playerEntries) {
            const pData = loadPlayerData(id);
            const rank = pData ? rankManager.getRankById(pData.rankId) : null;
            const prefix = rank?.chatFormatting?.prefixText ?? '';
            form.button(`${prefix}${pData ? pData.name : name}`);
        }
    }
    return form;
}

async function buildPlayerListForm(title) {
    const form = new ActionFormData().title(title);
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    const onlinePlayers = playerCache.getAllPlayersFromCache().sort((a, b) => a.name.localeCompare(b.name));
    if (onlinePlayers.length === 0) {
        form.body('§cNo players are currently online.');
    } else {
        const config = getConfig();
        for (const player of onlinePlayers) {
            const rank = rankManager.getPlayerRank(player, config);
            const prefix = rank.chatFormatting?.prefixText ?? '';
            form.button(`${prefix}${player.name}`);
        }
    }
    return form;
}

async function buildBountyListForm(title) {
    const form = new ActionFormData().title(title);
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    const allBounties = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);
    if (allBounties.length === 0) {
        form.body('§aThere are currently no active bounties.');
    } else {
        for (const bounty of allBounties) {
            form.button(`${bounty.name}\n§e$${bounty.amount.toFixed(2)}`);
        }
    }
    return form;
}

function buildReportListForm(title) {
    const form = new ActionFormData().title(title);
    form.button('§l§8< Back', 'textures/gui/controls/left.png');
    const reports = reportManager.getAllReports().filter(r => r.status === 'open' || r.status === 'assigned').sort((a, b) => a.timestamp - b.timestamp);
    if (reports.length === 0) {
        form.body('§aThere are no active reports.');
    } else {
        for (const report of reports) {
            const statusColor = report.status === 'assigned' ? '§6' : '§c';
            form.button(`[${statusColor}${report.status.toUpperCase()}§r] ${report.reportedPlayerName}\n§8Reported by: ${report.reporterName}`);
        }
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
