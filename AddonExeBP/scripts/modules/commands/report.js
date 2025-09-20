import { commandManager } from './commandManager.js';
import * as reportManager from '../../core/reportManager.js';
import { getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import { ModalFormData } from '@minecraft/server-ui';
import { uiWait } from '../../core/utils.js';
import { showPanel } from '../../core/uiManager.js';
import { clearAllReports } from '../../core/reportManager.js';

commandManager.register({
    name: 'report',
    description: 'Reports a player using a UI. The player can be offline.',
    category: 'General',
    permissionLevel: 2024, // Everyone
    parameters: [
        { name: 'target', type: 'string', description: 'The name of the player to report.', optional: true }
    ],
    execute: async (player, args) => {
        const { target: reportedPlayerName } = args;

        if (!reportedPlayerName) {
            player.sendMessage('§cUsage: /report <targetName>');
            return;
        }

        const targetId = getPlayerIdByName(reportedPlayerName);
        if (!targetId) {
            player.sendMessage(`§cPlayer "${reportedPlayerName}" has never joined this server.`);
            return;
        }

        // Get the correct name for the player, whether they are online or offline.
        const offlineData = loadPlayerData(targetId);
        const correctTargetName = offlineData ? offlineData.name : reportedPlayerName;

        const form = new ModalFormData()
            .title(`Report ${correctTargetName}`)
            .textField('Reason for report:', 'Enter the reason here');

        const response = await uiWait(player, form);

        if (response.canceled) {
            player.sendMessage('§cReport canceled.');
            return;
        }

        const [reason] = response.formValues;

        if (!reason || reason.trim().length === 0) {
            player.sendMessage('§cYou must provide a reason.');
            return;
        }

        reportManager.createReport(player, targetId, correctTargetName, reason);
        player.sendMessage('§aReport submitted. Thank you for your help.');
    }
});

commandManager.register({
    name: 'reports',
    description: 'Views the list of active reports.',
    category: 'Moderation',
    permissionLevel: 2, // Admin and above
    parameters: [],
    execute: (player, args) => {
        showPanel(player, 'reportListPanel');
    }
});

commandManager.register({
    name: 'clearreports',
    description: 'Clears all active reports.',
    category: 'Moderation',
    permissionLevel: 2, // Admin and above
    allowConsole: true,
    parameters: [],
    execute: (player, args) => {
        clearAllReports();
        player.sendMessage('§aAll reports have been cleared.');
    }
});
