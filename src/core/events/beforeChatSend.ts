import * as mc from '@minecraft/server';

import { commandManager } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { infoLog } from '@core/logger.js';
import { getPlayerRank } from '@core/rankManager.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { getPunishment } from '@features/moderation/punishmentManager.js';
import { isTeamChatEnabled } from '@features/teams/commands/team.js';
import { getTeamByPlayer } from '@features/teams/teamManager.js';

export const eventName = 'chatSend';

function handleChatSend(event: mc.ChatSendBeforeEvent) {
    const { sender, message } = event;
    const config = getConfig();

    // Command interception
    if (commandManager.handleChatCommand(event)) {
        return;
    }

    // Mute Check
    if (getPunishment(sender.id, 'mute')) {
        sender.sendMessage('§cYou are muted and cannot chat.');
        event.cancel = true;
        return;
    }

    // Sanitize message to prevent impersonation
    const sanitizedMessage = message.replaceAll('\n', ' ');

    // Team Chat Handling
    if (isTeamChatEnabled(sender.id)) {
        event.cancel = true;
        const team = getTeamByPlayer(sender.id);
        if (team) {
            const teamMsg = `§a[Team] §f<${sender.name}> ${sanitizedMessage}`;
            // Broadcast to online members
            for (const memberId of team.members) {
                const member = mc.world.getAllPlayers().find((p) => p.id === memberId);
                if (member) member.sendMessage(teamMsg);
            }
            if (config.chat?.logToConsole) {
                infoLog(`[TeamChat] [${team.name}] <${sender.name}> ${sanitizedMessage}`);
            }
        } else {
            sender.sendMessage('§cYou are not in a team. Team chat disabled.');
        }
        return;
    }

    // Console Logging
    if (config.chat?.logToConsole) {
        infoLog(`[Chat] <${sender.name}> ${sanitizedMessage}`);
    }

    // Chat History
    addChatLog(sender.name, sanitizedMessage);

    // Rank Formatting & Team Formatting
    const rank = getPlayerRank(sender, config);
    const team = getTeamByPlayer(sender.id);

    let teamSuffix = '';

    if (team) {
        teamSuffix = `§e[${team.name}]`;
    }

    // Replace placeholders - Manual formatting by cancelling and broadcasting
    event.cancel = true;

    const fmt = rank.chatFormatting;
    const prefix = fmt?.prefixText ? `§6[§r${fmt.prefixText}§6]§r ` : '';
    const nameColor = fmt?.nameColor || '§r';

    // Final Format: Prefix Name[Team]: Message
    const finalMessage = `${prefix}${nameColor}${sender.name}§r${teamSuffix}§r: ${sanitizedMessage}`;

    mc.world.sendMessage(finalMessage);
}

export default handleChatSend;
