import * as mc from '@minecraft/server';
import { ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getPlayerIdByName, loadPlayerData } from '../../core/playerDataManager.js';
import * as reportManager from '../../core/reportManager.js';
import { showPanel } from '../../core/uiManager.js';
import { uiWait } from '../../core/utils.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const reportCommand: CustomCommand = {
    name: 'report',
    description: 'Reports a player using a UI. The player can be offline.',
    permissionLevel: 1024,
    parameters: [{ name: 'target', type: 'string', optional: true }],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const reportedPlayerName = args.target as string | undefined;

        if (!reportedPlayerName) {
            executor.sendMessage('§cUsage: /report <targetName>');
            return;
        }

        const targetId = getPlayerIdByName(reportedPlayerName);
        if (!targetId) {
            executor.sendMessage(`§cPlayer "${reportedPlayerName}" has never joined this server.`);
            return;
        }

        const offlineData = loadPlayerData(targetId);
        const correctTargetName = offlineData ? offlineData.name : reportedPlayerName;

        const form = new ModalFormData()
            .title(`Report ${correctTargetName}`)
            .textField('Reason for report:', 'Enter the reason here');

        const response = await uiWait(executor, form);

        if (!response || response.canceled) {
            executor.sendMessage('§cReport canceled.');
            return;
        }

        const [reason] = (response as ModalFormResponse).formValues as (string | undefined)[];

        if (!reason || reason.trim().length === 0) {
            executor.sendMessage('§cYou must provide a reason.');
            return;
        }

        reportManager.createReport(executor, targetId, correctTargetName, reason);
        executor.sendMessage('§aReport submitted. Thank you for your help.');
    }
};

const reportsCommand: CustomCommand = {
    name: 'reports',
    description: 'Views the list of active reports.',
    permissionLevel: 2,
    execute: (executor: CommandExecutor) => {
        if (executor instanceof mc.Player) {
            showPanel(executor, 'reportListPanel');
        }
    }
};

const clearReportsCommand: CustomCommand = {
    name: 'clearreports',
    description: 'Clears all active reports.',
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
