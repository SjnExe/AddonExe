import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { rawLog } from '@core/logger.js';
import { hasPermission } from '@core/permissionEngine.js';
import { findPlayerByName, getPlayerFromCache } from '@core/playerCache.js';
import { getPlayerRank } from '@core/rankManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { isStaffChatEnabled, sendStaffChatMessage, setStaffChatState } from '@features/moderation/commands/staffchat.js';
import { getPunishment } from '@features/moderation/punishmentManager.js';
import { isTeamChatEnabled, sendTeamChatMessage } from '@features/team/commands/team.js';
import { isDefined } from '@lib/guards.js';

/**
 * Handles chat messages before they are sent.
 * Manages chat formatting, muting, staff chat, team chat, logging, and mentions.
 */
export default function handleBeforeChatSend(event: mc.ChatSendBeforeEvent) {
    const config = getConfig();
    if (config.chat.enabled !== true) {
        return;
    }

    const player = event.sender;

    // Staff Chat Routing (Staff can use staff chat even if global chat has restrictions)
    if (isStaffChatEnabled(player.id)) {
        if (hasPermission(player, 'cmd.staffchat.mod') || hasPermission(player, 'group.mod')) {
            event.cancel = true;
            sendStaffChatMessage(player, event.message);
            return;
        }
        setStaffChatState(player.id, false);
    }

    // Mute Check
    const mute = getPunishment(player.id, 'mute');
    if (isDefined(mute)) {
        event.cancel = true;
        const reason = mute.reason ? ` Reason: ${mute.reason}` : '';
        const durationStr = mute.expires === Infinity ? 'Permanently' : `Until: ${new Date(mute.expires).toLocaleString()}`;
        player.sendMessage(`§cYou are muted. ${durationStr}${reason}`);
        return;
    }

    const rank = getPlayerRank(player, config);

    // Team Chat Routing
    if (isTeamChatEnabled(player.id)) {
        if (sendTeamChatMessage(player, event.message)) {
            event.cancel = true;
            addChatLog(player.name, `[TeamChat] ${event.message}`, rank.name);
            if (config.chat.logToConsole === true) {
                rawLog(`[TeamChat] ${player.name}: ${stripColorCodes(event.message)}`);
            }
            return;
        }
    }

    addChatLog(player.name, event.message, rank.name);

    // Apply Rank Formatting
    const chatFormatting = rank.chatFormatting;
    if (chatFormatting) {
        event.cancel = true;
        const prefix = chatFormatting.prefixText ? `§e[§r${chatFormatting.prefixText}§e]§r ` : '';
        const nameColor = chatFormatting.nameColor || '§7';
        const msgColor = chatFormatting.messageColor || '§f';
        const formattedMessage = `${prefix}${nameColor}${player.name}§r: ${msgColor}${event.message}§r`;

        mc.world.sendMessage(formattedMessage);

        if (config.chat.logToConsole === true) {
            rawLog(stripColorCodes(formattedMessage));
        }
    } else if (config.chat.logToConsole === true) {
        rawLog(`[CHAT] ${player.name}: ${event.message}`);
    }

    // Mentions
    if (config.chat.allowMentions === true && event.message.includes('@')) {
        const words = event.message.split(' ');
        for (const word of words) {
            if (word.startsWith('@') && word.length > 1) {
                const cleanName = word.slice(1).replaceAll(/[^a-zA-Z0-9_ -]/g, '');
                const target = findPlayerByName(cleanName) ?? getPlayerFromCache(cleanName);
                if (isDefined(target)) {
                    target.playSound('random.orb');
                    target.sendMessage(`§e${player.name} mentioned you!`);
                }
            }
        }
    }
}
