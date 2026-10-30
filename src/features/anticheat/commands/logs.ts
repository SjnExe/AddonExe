import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import { uiWait } from '@core/utils.js';
import { FlagLog, getFlagLogs, getPunishmentLogs, PunishmentLog } from '@features/anticheat/logManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';

interface ChatLog {
    timestamp: number;
    playerName: string;
    message: string;
    rank?: string;
}

interface ChatLogService {
    getAvailableDates: () => string[];
    getChatLogs: (date?: string) => ChatLog[];
}

const logsCommand: CustomCommand = {
    name: 'logs',
    description: 'View punishment, anticheat, and chat logs.',
    category: 'Moderation',
    permissionNode: 'cmd.logs.admin', // Admin only
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
        await showLogsMenu(executor);
    }
};

async function showLogsMenu(player: mc.Player) {
    const form = new ActionFormData()
        .title('Logs Menu')
        .button('Punishment Logs', 'textures/ui/hammer_l')
        .button('Anti-Cheat Flags', 'textures/items/diamond_sword')
        .button('Chat Logs', 'textures/ui/chat_icon')
        .button('Settings', 'textures/ui/settings_glyph');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return;

    const selection = (response as ActionFormResponse).selection;
    if (selection === 0) await showPunishmentFilter(player);
    if (selection === 1) await showFlagFilter(player);
    if (selection === 2) await showChatFilter(player);
    if (selection === 3) await showLogSettings(player);
}

// --- Punishments ---

async function showPunishmentFilter(player: mc.Player) {
    const modal = new ModalFormData().title('Filter Punishments').textField('Player Name (Optional)', 'Search...').dropdown('Type', ['All', 'Ban', 'Mute', 'Kick', 'Warn'], { defaultValueIndex: 0 });

    const res = await uiWait(player, modal);
    if (!isDefined(res) || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;

    const nameVal = values[0];
    const nameQuery = (typeof nameVal === 'string' ? nameVal : undefined) ?? '';
    const typeIndex = values[1];

    if (typeof typeIndex !== 'number') return;

    const types = ['All', 'Ban', 'Mute', 'Kick', 'Warn'];
    const selectedType = types[typeIndex];
    const typeFilter = selectedType === 'All' || selectedType === undefined ? undefined : selectedType.toLowerCase();

    await showPunishmentLogs(player, 1, nameQuery, typeFilter);
}

async function showPunishmentLogs(player: mc.Player, page: number, nameQuery?: string, typeFilter?: string) {
    let logs = getPunishmentLogs().toSorted((a: PunishmentLog, b: PunishmentLog) => b.timestamp - a.timestamp);

    // Filtering
    if (isNonEmptyString(nameQuery)) {
        const q = nameQuery.toLowerCase();
        logs = logs.filter((l) => l.playerName.toLowerCase().includes(q));
    }
    if (isNonEmptyString(typeFilter)) {
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
        for (const log of slice) {
            const date = new Date(log.timestamp).toLocaleString();
            form.button(`${log.playerName} - ${log.type}\n${date}`);
        }
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back to Filter');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return showLogsMenu(player);

    const selection = (response as ActionFormResponse).selection;
    if (!isDefined(selection)) return;

    const hasPrev = page > 1;
    const hasNext = page < maxPage;
    let index = 0;

    if (selection < slice.length) {
        const log = slice[selection];

        if (!isDefined(log)) return;
        const detail = `Player: ${log.playerName}\nType: ${log.type}\nReason: ${log.reason}\nAdmin: ${log.adminName}\nDate: ${new Date(log.timestamp).toLocaleString()}\nDuration: ${(isNonEmptyString(log.duration) ? log.duration : undefined) ?? 'N/A'}`;
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
    }

    await showPunishmentFilter(player);
}

// --- Flags ---

async function showFlagFilter(player: mc.Player) {
    const modal = new ModalFormData().title('Filter Flags').textField('Player Name (Optional)', 'Search...');

    const res = await uiWait(player, modal);
    if (!isDefined(res) || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;

    const nameVal = values[0];
    const nameQuery = (typeof nameVal === 'string' ? nameVal : undefined) ?? '';

    await showFlagLogs(player, 1, nameQuery);
}

async function showFlagLogs(player: mc.Player, page: number, nameQuery?: string) {
    let logs = getFlagLogs().toSorted((a: FlagLog, b: FlagLog) => b.timestamp - a.timestamp);

    if (isNonEmptyString(nameQuery)) {
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
        for (const log of slice) {
            const date = new Date(log.timestamp).toLocaleTimeString();
            form.button(`${log.playerName} - ${log.checkName} (VL: ${log.vl})\n${date}`);
        }
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back to Filter');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return showLogsMenu(player);

    const selection = (response as ActionFormResponse).selection;
    if (!isDefined(selection)) return;

    const hasPrev = page > 1;
    const hasNext = page < maxPage;
    let index = 0;

    if (selection < slice.length) {
        const log = slice[selection];

        if (!isDefined(log)) return;
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
    }

    await showFlagFilter(player);
}

// --- Chat ---

export async function showChatFilter(player: mc.Player) {
    const chatLogService = serviceLocator.getService<ChatLogService>('moderation.chatLogs');
    if (!chatLogService) {
        player.sendMessage('§cChat logging service is not available.');
        return showLogsMenu(player);
    }

    const dates = chatLogService.getAvailableDates();
    if (dates.length === 0) {
        player.sendMessage('§cNo chat logs available.');
        return showLogsMenu(player);
    }

    const modal = new ModalFormData()
        .title('Filter Chat')
        .dropdown('Date', dates, { defaultValueIndex: 0 })
        .textField('Player Name (Optional)', 'Search...')
        .textField('Keyword (Optional)', 'Search message...');

    const res = await uiWait(player, modal);
    if (!isDefined(res) || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;

    const dateIndex = values[0];
    const nameVal = values[1];
    const keywordVal = values[2];

    if (typeof dateIndex !== 'number') return;

    const nameQuery = (typeof nameVal === 'string' ? nameVal : undefined) ?? '';
    const keywordQuery = (typeof keywordVal === 'string' ? keywordVal : undefined) ?? '';

    const date = dates[dateIndex];
    if (!isNonEmptyString(date)) return;

    await showChatLogs(player, 1, date, nameQuery, keywordQuery);
}

async function showChatLogs(player: mc.Player, page: number, date: string, nameQuery?: string, keyword?: string) {
    const chatLogService = serviceLocator.getService<ChatLogService>('moderation.chatLogs');
    if (!chatLogService) return showLogsMenu(player);

    let logs = chatLogService.getChatLogs(date).toSorted((a: ChatLog, b: ChatLog) => b.timestamp - a.timestamp);

    if (isNonEmptyString(nameQuery)) {
        const q = nameQuery.toLowerCase();
        logs = logs.filter((l) => l.playerName.toLowerCase().includes(q));
    }
    if (isNonEmptyString(keyword)) {
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
        for (const log of slice) {
            const dateStr = new Date(log.timestamp).toLocaleTimeString();
            const msg = log.message.length > 20 ? log.message.slice(0, 20) + '...' : log.message;
            form.button(`${log.playerName}: ${msg}\n${dateStr}`);
        }
    }

    if (page > 1) form.button('Previous');
    if (page < maxPage) form.button('Next');
    form.button('Back to Filter');

    const response = await uiWait(player, form);
    if (!isDefined(response) || response.canceled) return showLogsMenu(player);

    const selection = (response as ActionFormResponse).selection;
    if (!isDefined(selection)) return;

    const hasPrev = page > 1;
    const hasNext = page < maxPage;
    let index = 0;

    if (selection < slice.length) {
        const log = slice[selection];

        if (!isDefined(log)) return;
        const detail = `Player: ${log.playerName}\nRank: ${(isNonEmptyString(log.rank) ? log.rank : undefined) ?? 'Default'}\nTime: ${new Date(log.timestamp).toLocaleString()}\n\nMessage:\n${log.message}`;
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
    }

    await showChatFilter(player);
}

async function showLogSettings(player: mc.Player) {
    const config = getConfig();
    const chatConfig = config.chat;

    const modal = new ModalFormData()
        .title('Log Settings')

        .toggle('Enable Chat Logging', { defaultValue: chatConfig.loggingEnabled })

        .textField('Chat Log Expiration (Days)', '7', { defaultValue: String(chatConfig.logExpirationDays) });

    const res = await uiWait(player, modal);
    if (!isDefined(res) || res.canceled) return showLogsMenu(player);

    const values = (res as ModalFormResponse).formValues;
    if (!values) return;

    const enabled = values[0];
    const daysStr = values[1];

    if (typeof enabled !== 'boolean' || typeof daysStr !== 'string') return;
    let days = Number.parseInt(daysStr, 10);
    if (Number.isNaN(days) || days < 1) days = 1;

    updateMultipleConfig({
        'chat.loggingEnabled': enabled,
        'chat.logExpirationDays': days
    });

    player.sendMessage('§aLog settings updated.');
    return showLogsMenu(player);
}

export default logsCommand;
