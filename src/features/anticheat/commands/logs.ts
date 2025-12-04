import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse } from '@minecraft/server-ui';

import { CustomCommand, CommandExecutor } from '@modules/commands/commandManager.js';

import { uiWait } from '../../../core/utils.js';
import { getFlagLogs, getPunishmentLogs } from '../logManager.js';

const logsCommand: CustomCommand = {
    name: 'logs',
    aliases: ['aclogs', 'history'],
    description: 'View Anti-Cheat and Punishment logs.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
        await showLogsMenu(executor);
    }
};

async function showLogsMenu(player: mc.Player) {
    const form = new ActionFormData()
        .title('Logs Menu')
        .button('Punishment Logs', 'textures/ui/icon_book_writable')
        .button('Flag Logs', 'textures/ui/icon_book_writable')
        .button('Close');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return;

    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    if (selection === 0) {
        await showPunishmentLogs(player, 1);
    } else if (selection === 1) {
        await showFlagLogs(player, 1);
    }
}

async function showPunishmentLogs(player: mc.Player, page: number) {
    const logs = getPunishmentLogs().sort((a, b) => b.timestamp - a.timestamp);
    const perPage = 10;
    const maxPage = Math.ceil(logs.length / perPage) || 1;
    page = Math.max(1, Math.min(page, maxPage));

    const form = new ActionFormData().title(`Punishment Logs (${page}/${maxPage})`);

    const slice = logs.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
        form.body('No logs found.');
    } else {
        slice.forEach(log => {
            const date = new Date(log.timestamp).toLocaleString();
            form.button(`${log.playerName} - ${log.type}\n${date}`);
        });
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return;

    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    const hasPrev = page > 1;
    const hasNext = page < maxPage;
    let index = 0;

    if (selection < slice.length) {
        const log = slice[selection];
        const detail = `Player: ${log.playerName}\nType: ${log.type}\nReason: ${log.reason}\nAdmin: ${log.adminName}\nDate: ${new Date(log.timestamp).toLocaleString()}\nDuration: ${log.duration || 'N/A'}`;
        const detailForm = new ActionFormData().title('Log Detail').body(detail).button('Back');
        await uiWait(player, detailForm);
        await showPunishmentLogs(player, page);
        return;
    }
    index += slice.length;

    if (hasPrev) {
        if (selection === index) {
            await showPunishmentLogs(player, page - 1);
            return;
        }
        index++;
    }

    if (hasNext) {
        if (selection === index) {
            await showPunishmentLogs(player, page + 1);
            return;
        }
        index++;
    }

    await showLogsMenu(player);
}

async function showFlagLogs(player: mc.Player, page: number) {
    const logs = getFlagLogs().sort((a, b) => b.timestamp - a.timestamp);
    const perPage = 10;
    const maxPage = Math.ceil(logs.length / perPage) || 1;
    page = Math.max(1, Math.min(page, maxPage));

    const form = new ActionFormData().title(`Flag Logs (${page}/${maxPage})`);

    const slice = logs.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
        form.body('No logs found.');
    } else {
        slice.forEach(log => {
            const date = new Date(log.timestamp).toLocaleTimeString();
            form.button(`${log.playerName} - ${log.checkName} (VL: ${log.vl})\n${date}`);
        });
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return;

    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    const hasPrev = page > 1;
    const hasNext = page < maxPage;
    let index = 0;

    if (selection < slice.length) {
        const log = slice[selection];
        const detail = `Player: ${log.playerName}\nCheck: ${log.checkName}\nVL: ${log.vl}\nDetails: ${log.details}\nTime: ${new Date(log.timestamp).toLocaleString()}`;
        const detailForm = new ActionFormData().title('Flag Detail').body(detail).button('Back');
        await uiWait(player, detailForm);
        await showFlagLogs(player, page);
        return;
    }
    index += slice.length;

    if (hasPrev) {
        if (selection === index) {
            await showFlagLogs(player, page - 1);
            return;
        }
        index++;
    }

    if (hasNext) {
        if (selection === index) {
            await showFlagLogs(player, page + 1);
            return;
        }
        index++;
    }

    await showLogsMenu(player);
}

export default logsCommand;
