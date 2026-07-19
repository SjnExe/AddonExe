import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerIdByName, loadPlayerData } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { playSound, sanitizeString, uiWait } from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import * as reportManager from '@features/moderation/reportManager.js';

const reportCommand: CustomCommand = {
    name: 'report',
    description: 'Reports a player. Usage: /report [target] [reason]',
    category: 'Moderation',
    permissionNode: 'cmd.report.member',
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

        if (!isNonEmptyString(reportedPlayerName)) {
            // Show list
            await showPanel(executor, 'playerListPanel', {
                customTitle: 'Select Player to Report',
                action: 'report'
            });
            return;
        }

        const targetId = getPlayerIdByName(reportedPlayerName);
        if (!isNonEmptyString(targetId)) {
            executor.sendMessage(`§cPlayer "${reportedPlayerName}" has never joined this server.`);
            return;
        }

        const offlineData = loadPlayerData(targetId);
        const correctTargetName = isDefined(offlineData) ? offlineData.name : reportedPlayerName;

        if (isNonEmptyString(message)) {
            reportManager.createReport(executor, targetId, correctTargetName, message);
            executor.sendMessage('§aReport submitted. Thank you for your help.');
            playSound(executor, 'random.orb');
        } else {
            const form = new ModalFormData().title(`Report ${correctTargetName}`).textField('Reason', 'Why are you reporting this player?');

            const res = await uiWait(executor, form);
            if (isDefined(res) && !res.canceled) {
                const values = (res as ModalFormResponse).formValues;
                if (isDefined(values)) {
                    const [reasonRaw] = values as [string];
                    if (isNonEmptyString(reasonRaw)) {
                        const reason = sanitizeString(reasonRaw, true);
                        reportManager.createReport(executor, targetId, correctTargetName, reason);
                        executor.sendMessage('§2Report sent successfully. Admins have been notified.');
                        return;
                    }
                }
            }
            executor.sendMessage('§4Reason is required to submit a report.');
        }
    }
};

const reportsCommand: CustomCommand = {
    name: 'reports',
    description: 'Views the list of active reports.',
    category: 'Moderation',
    permissionNode: 'cmd.reports.admin',
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
    permissionNode: 'cmd.clearreports.admin',
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        reportManager.clearAllReports();
        executor.sendMessage('§aAll reports have been cleared.');
    }
};

export default [reportCommand, reportsCommand, clearReportsCommand];
