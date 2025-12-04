import * as mc from '@minecraft/server';

import { getPlayerIdByName, loadPlayerData } from '@core/playerDataManager.js';
import { handleUIAction } from '@core/ui/actions.js';
import { showPanel } from '@core/uiManager.js';

import { CustomCommand, CommandExecutor } from '@modules/commands/commandManager.js';
import * as reportManager from '../reportManager.js';

const reportCommand: CustomCommand = {
    name: 'report',
    description: 'Reports a player. Usage: /report [target] [reason]',
    category: 'Moderation',
    permissionLevel: 1024,
    hasCooldown: true,
    defaultCooldown: 60,
    parameters: [
        { name: 'target', type: 'string', optional: true },
        { name: 'message', type: 'text', optional: true }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const reportedPlayerName = args.target as string | undefined;
        const message = args.message as string | undefined;

        if (!reportedPlayerName) {
            // Show list
            await showPanel(executor, 'playerListPanel', {
                customTitle: 'Select Player to Report',
                action: 'report'
            });
            return;
        }

        const targetId = getPlayerIdByName(reportedPlayerName);
        if (!targetId) {
            executor.sendMessage(`§cPlayer "${reportedPlayerName}" has never joined this server.`);
            return;
        }

        const offlineData = loadPlayerData(targetId);
        const correctTargetName = offlineData ? offlineData.name : reportedPlayerName;

        if (message) {
            reportManager.createReport(executor, targetId, correctTargetName, message);
            executor.sendMessage('§aReport submitted. Thank you for your help.');
        } else {
            await handleUIAction(executor, 'reportPlayer', {
                targetPlayerId: targetId,
                targetPlayerName: correctTargetName,
                returnPanel: null // Close, don't return to list
            });
        }
    }
};

const reportsCommand: CustomCommand = {
    name: 'reports',
    description: 'Views the list of active reports.',
    category: 'Moderation',
    permissionLevel: 2,
    execute: async (executor: CommandExecutor) => {
        if (executor instanceof mc.Player) {
            await showPanel(executor, 'reportListPanel');
        }
    }
};

const clearReportsCommand: CustomCommand = {
    name: 'clearreports',
    description: 'Clears all active reports.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        reportManager.clearAllReports();
        if (executor instanceof mc.Player) {
            executor.sendMessage('§aAll reports have been cleared.');
        } else {
            executor.sendMessage('§aAll reports have been cleared.');
        }
    }
};

export default [reportCommand, reportsCommand, clearReportsCommand];
