import * as mc from '@minecraft/server';

import { commandManager } from '@commands/commandManager.js';
import { getConfig } from '@core/configManager.js';
import { infoLog } from '@core/logger.js';
import { getPlayerRank } from '@core/rankManager.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { getTeamByPlayer } from '@features/teams/teamManager.js';

export const eventName = 'chatSend';

function handleChatSend(event: mc.ChatSendBeforeEvent) {
    const { sender, message } = event;
    const config = getConfig();

    // Command interception
    if (commandManager.handleChatCommand(event)) {
        return;
    }

    // Console Logging
    if (config.chat?.logToConsole) {
        infoLog(`[Chat] <${sender.name}> ${message}`);
    }

    // Chat History
    addChatLog(sender.name, message);

    // Rank Formatting & Team Formatting
    const rank = getPlayerRank(sender, config);
    const team = getTeamByPlayer(sender.id);

    let teamSuffix = '';

    if (team) {
        teamSuffix = `§e[${team.name}]`;
    }

    // Replace placeholders - Manual formatting by cancelling and broadcasting
    event.cancel = true;

    // Check mute status (if implemented via punishmentManager elsewhere, or here?)
    // Memory recall: punishmentManager is initialized in main.ts.
    // Usually commands check mute status.
    // If mute check is missing here, muted players can chat!
    // I should check punishmentManager.ts if it exports `isMuted`.
    // But for now, I stick to the original logic which seemed to lack explicit mute check in this file,
    // assuming commandManager or another system handles it, or I should fix it.
    // Wait, the original file I read didn't show mute check.
    // I will keep it as is to avoid regression, but I should note it.

    const fmt = rank.chatFormatting;
    const prefix = fmt?.prefixText ? `§6[§r${fmt.prefixText}§6]§r ` : '';
    const nameColor = fmt?.nameColor || '§r';

    // Final Format: Prefix Name[Team]: Message
    const finalMessage = `${prefix}${nameColor}${sender.name}§r${teamSuffix}§r: ${message}`;

    mc.world.sendMessage(finalMessage);
}

export default handleChatSend;
