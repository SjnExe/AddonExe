import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';

import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { uiWait } from '@core/utils.js';
import { getAvailableDates, getChatLogs } from '@features/moderation/chatLogManager.js';
import { getFlagLogs, getPunishmentLogs } from '../logManager.js';

const logsCommand: CustomCommand = {
    name: 'logs',
    aliases: ['aclogs', 'history'],
    description: 'View logs (Punishments, Anti-Cheat, Chat).',
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
        .button('Chat Logs', 'textures/ui/chat_icon')
        .button('Settings', 'textures/ui/settings_glyph_color_2x')
        .button('Close');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return;

    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    if (selection === 0) {
        await showPunishmentFilter(player);
    } else if (selection === 1) {
        await showFlagFilter(player);
    } else if (selection === 2) {
        await showChatFilter(player);
    } else if (selection === 3) {
        await showLogSettings(player);
    }
}

// --- Punishments ---

async function showPunishmentFilter(player: mc.Player) {
    const modal = new ModalFormData()
        .title('Filter Punishments')
        .textField('Player Name (Optional)', 'Search...')
        .dropdown('Type', ['All', 'Ban', 'Mute', 'Warn', 'Kick'], 0);

    const res = await uiWait(player, modal);
    if (!res || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;

    const nameQuery = values[0] as string;
    const typeIndex = values[1] as number;
    const types = [null, 'ban', 'mute', 'warn', 'kick'];
    const typeFilter = types[typeIndex];

    await showPunishmentLogs(player, 1, nameQuery, typeFilter);
}

async function showPunishmentLogs(
    player: mc.Player,
    page: number,
    nameQuery?: string,
    typeFilter?: string | null
) {
    let logs = getPunishmentLogs().sort((a, b) => b.timestamp - a.timestamp);

    // Filtering
    if (nameQuery) {
        const q = nameQuery.toLowerCase();
        logs = logs.filter((l) => l.playerName.toLowerCase().includes(q));
    }
    if (typeFilter) {
        logs = logs.filter((l) => l.type.toLowerCase() === typeFilter);
    }

    const perPage = 10;
    const maxPage = Math.ceil(logs.length / perPage) || 1;
    page = Math.max(1, Math.min(page, maxPage));

    const form = new ActionFormData().title(`Punishments (${page}/${maxPage})`);
    const slice = logs.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
        form.body('No logs match your criteria.');
    } else {
        slice.forEach((log) => {
            const date = new Date(log.timestamp).toLocaleString();
            form.button(`${log.playerName} - ${log.type}\n${date}`);
        });
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back to Filter');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return showLogsMenu(player);

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
        await showPunishmentLogs(player, page, nameQuery, typeFilter);
        return;
    }
    index += slice.length;

    if (hasPrev) {
        if (selection === index) {
            await showPunishmentLogs(player, page - 1, nameQuery, typeFilter);
            return;
        }
        index++;
    }

    if (hasNext) {
        if (selection === index) {
            await showPunishmentLogs(player, page + 1, nameQuery, typeFilter);
            return;
        }
        index++;
    }

    await showPunishmentFilter(player);
}

// --- Flags ---

async function showFlagFilter(player: mc.Player) {
    const modal = new ModalFormData()
        .title('Filter Flags')
        .textField('Player Name (Optional)', 'Search...');

    const res = await uiWait(player, modal);
    if (!res || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;
    const nameQuery = values[0] as string;

    await showFlagLogs(player, 1, nameQuery);
}

async function showFlagLogs(player: mc.Player, page: number, nameQuery?: string) {
    let logs = getFlagLogs().sort((a, b) => b.timestamp - a.timestamp);

    if (nameQuery) {
        const q = nameQuery.toLowerCase();
        logs = logs.filter((l) => l.playerName.toLowerCase().includes(q));
    }

    const perPage = 10;
    const maxPage = Math.ceil(logs.length / perPage) || 1;
    page = Math.max(1, Math.min(page, maxPage));

    const form = new ActionFormData().title(`Flag Logs (${page}/${maxPage})`);
    const slice = logs.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
        form.body('No logs match your criteria.');
    } else {
        slice.forEach((log) => {
            const date = new Date(log.timestamp).toLocaleTimeString();
            form.button(`${log.playerName} - ${log.checkName} (VL: ${log.vl})\n${date}`);
        });
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back to Filter');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return showLogsMenu(player);

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
        await showFlagLogs(player, page, nameQuery);
        return;
    }
    index += slice.length;

    if (hasPrev) {
        if (selection === index) {
            await showFlagLogs(player, page - 1, nameQuery);
            return;
        }
        index++;
    }

    if (hasNext) {
        if (selection === index) {
            await showFlagLogs(player, page + 1, nameQuery);
            return;
        }
        index++;
    }

    await showFlagFilter(player);
}

// --- Chat ---

async function showChatFilter(player: mc.Player) {
    const dates = getAvailableDates();
    if (dates.length === 0) {
        player.sendMessage('§cNo chat logs available.');
        return showLogsMenu(player);
    }

    const modal = new ModalFormData()
        .title('Filter Chat')
        .dropdown('Date', dates, 0)
        .textField('Player Name (Optional)', 'Search...')
        .textField('Keyword (Optional)', 'Search message...');

    const res = await uiWait(player, modal);
    if (!res || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;
    const dateIndex = values[0] as number;
    const nameQuery = values[1] as string;
    const keywordQuery = values[2] as string;
    const date = dates[dateIndex];

    await showChatLogs(player, 1, date, nameQuery, keywordQuery);
}

async function showChatLogs(
    player: mc.Player,
    page: number,
    date: string,
    nameQuery?: string,
    keyword?: string
) {
    let logs = getChatLogs(date).sort((a, b) => b.timestamp - a.timestamp);

    if (nameQuery) {
        const q = nameQuery.toLowerCase();
        logs = logs.filter((l) => l.playerName.toLowerCase().includes(q));
    }
    if (keyword) {
        const k = keyword.toLowerCase();
        logs = logs.filter((l) => l.message.toLowerCase().includes(k));
    }

    const perPage = 10;
    const maxPage = Math.ceil(logs.length / perPage) || 1;
    page = Math.max(1, Math.min(page, maxPage));

    const form = new ActionFormData().title(`Chat: ${date} (${page}/${maxPage})`);
    const slice = logs.slice((page - 1) * perPage, page * perPage);

    if (slice.length === 0) {
        form.body('No chat logs match your criteria.');
    } else {
        slice.forEach((log) => {
            const dateStr = new Date(log.timestamp).toLocaleTimeString();
            const msg = log.message.length > 20 ? log.message.substring(0, 20) + '...' : log.message;
            form.button(`${log.playerName}: ${msg}\n${dateStr}`);
        });
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back to Filter');

    const response = await uiWait(player, form);
    if (!response || response.canceled) return showLogsMenu(player);

    const selection = (response as ActionFormResponse).selection;
    if (selection === undefined) return;

    const hasPrev = page > 1;
    const hasNext = page < maxPage;
    let index = 0;

    if (selection < slice.length) {
        const log = slice[selection];
        const detail = `Player: ${log.playerName}\nRank: ${log.rank || 'Default'}\nTime: ${new Date(log.timestamp).toLocaleString()}\n\nMessage:\n${log.message}`;
        const detailForm = new ActionFormData().title('Chat Detail').body(detail).button('Back');
        await uiWait(player, detailForm);
        await showChatLogs(player, page, date, nameQuery, keyword);
        return;
    }
    index += slice.length;

    if (hasPrev) {
        if (selection === index) {
            await showChatLogs(player, page - 1, date, nameQuery, keyword);
            return;
        }
        index++;
    }

    if (hasNext) {
        if (selection === index) {
            await showChatLogs(player, page + 1, date, nameQuery, keyword);
            return;
        }
        index++;
    }

    await showChatFilter(player);
}

async function showLogSettings(player: mc.Player) {
    const config = getConfig();
    const chatConfig = config.chat || {};

    const modal = new ModalFormData()
        .title('Log Settings')
        .toggle('Enable Chat Logging', { defaultValue: chatConfig.loggingEnabled ?? true })
        .textField('Chat Log Expiration (Days)', '7', { defaultValue: String(chatConfig.logExpirationDays ?? 7) });

    const res = await uiWait(player, modal);
    if (!res || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;

    const enabled = values[0] as boolean;
    const daysStr = values[1] as string;
    let days = parseInt(daysStr, 10);
    if (isNaN(days) || days < 1) days = 1;

    updateMultipleConfig({
        'chat.loggingEnabled': enabled,
        'chat.logExpirationDays': days
    });

    player.sendMessage('§aLog settings updated.');
    return showLogsMenu(player);
}

export default logsCommand;
