import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { rawLog } from '@core/logger.js';
import { hasPermission } from '@core/permissionEngine.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { getPlayerRank } from '@core/rankManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { setTeamChatState } from '@features/team/commands/team.js';
import { isNonEmptyString } from '@lib/guards.js';

const staffChatActive = new Map<string, boolean>();

export function setStaffChatState(playerId: string, enabled: boolean): void {
    if (enabled) {
        staffChatActive.set(playerId, true);
    } else {
        staffChatActive.delete(playerId);
    }
}

export function toggleStaffChat(playerId: string): boolean {
    const next = !(staffChatActive.get(playerId) ?? false);
    setStaffChatState(playerId, next);
    if (next) {
        setTeamChatState(playerId, false);
    }
    return next;
}

export function isStaffChatEnabled(playerId: string): boolean {
    return staffChatActive.get(playerId) ?? false;
}

export function sendStaffChatMessage(executor: CommandExecutor, message: string): void {
    const config = getConfig();
    let senderName = 'Console';
    let rankBadge = '§4Console';
    let rankName = 'Console';

    if (executor instanceof mc.Player) {
        senderName = executor.name;
        const rank = getPlayerRank(executor, config);
        rankBadge = rank.chatFormatting?.prefixText ?? rank.nametagPrefix ?? rank.name;
        rankName = rank.name;
    }

    const formatted = `§c[Staff] §8[${rankBadge}§8] §e${senderName}§r: §f${message}`;

    for (const player of getAllPlayersFromCache()) {
        if (player.isValid && (hasPermission(player, 'cmd.staffchat.mod') || hasPermission(player, 'group.mod'))) {
            player.sendMessage(formatted);
        }
    }

    addChatLog(senderName, `[StaffChat] ${message}`, rankName);

    if (config.chat.logToConsole === true || !(executor instanceof mc.Player)) {
        rawLog(stripColorCodes(formatted));
    }
}

const staffChatCommand: CustomCommand = {
    name: 'staffchat',
    description: 'Send a message to staff chat or toggle staff chat mode.',
    category: 'Moderation',
    permissionNode: 'cmd.staffchat.mod',
    aliases: ['sc'],
    allowConsole: true,
    parameters: [{ name: 'message', type: 'text', optional: true }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const msg = args.message as string | undefined;

        if (isNonEmptyString(msg)) {
            sendStaffChatMessage(executor, msg);
            return;
        }

        if (!(executor instanceof mc.Player)) {
            executor.sendMessage('Usage from console: /staffchat <message>');
            return;
        }

        const isEnabled = toggleStaffChat(executor.id);
        executor.sendMessage(isEnabled ? '§aStaff Chat Enabled. §7(All regular chat messages will go to staff)' : '§cStaff Chat Disabled.');
    }
};

export default [staffChatCommand];
