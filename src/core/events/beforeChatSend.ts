import { developerBadge, isDeveloperPlayer } from '@core/utils/constants.js';
import * as mc from '@minecraft/server';

import { getConfig } from '@core/config/configManager.js';
import { findPlayerByName, getPlayerFromCache } from '@core/data/playerCache.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { getPlayerRank } from '@core/permissions/rankManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';
import { rawLog } from '@core/utils/logger.js';
import { addChatLog } from '@features/moderation/chatLogManager.js';
import { isStaffChatEnabled, sendStaffChatMessage, setStaffChatState } from '@features/moderation/commands/staffchat.js';
import { getPunishment } from '@features/moderation/punishmentManager.js';
import { isTeamChatEnabled, sendTeamChatMessage } from '@features/social/team/commands/team.js';
import { isDefined } from '@lib/guards.js';

/**
 * Handles chat messages before they are sent.
 * Manages chat formatting, muting, staff chat, team chat, logging, and mentions.
 */
export default function handleBeforeChatSend(event: mc.ChatSendBeforeEvent) {
    const config = getConfig();
    const player = event.sender;

    // Staff Chat Routing (Always intercept before general chat)
    if (isStaffChatEnabled(player.id)) {
        event.cancel = true;
        if (hasPermission(player, 'cmd.staffchat.mod') || hasPermission(player, 'group.mod')) {
            sendStaffChatMessage(player, event.message);
            return;
        }
        setStaffChatState(player.id, false);
        player.sendMessage('§cYou no longer have permission for Staff Chat. Switched back to General Chat.');
        return;
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

    // Team Chat Routing (Always intercept before general chat)
    if (isTeamChatEnabled(player.id)) {
        event.cancel = true;
        if (sendTeamChatMessage(player, event.message)) {
            addChatLog(player.name, `[TeamChat] ${event.message}`, rank.name);
            if (config.chat.logToConsole === true) {
                rawLog(`[TeamChat] ${player.name}: ${stripColorCodes(event.message)}`);
            }
            return;
        }
        player.sendMessage('§cYou are no longer in a team. Switched back to General Chat.');
        return;
    }

    if (config.chat.enabled !== true) {
        return;
    }

    addChatLog(player.name, event.message, rank.name);

    // Apply Rank Formatting
    const chatFormatting = rank.chatFormatting;
    if (chatFormatting) {
        event.cancel = true;
        const devTag = isDeveloperPlayer(player.name) ? `${developerBadge} ` : '';
        const prefix = `${devTag}${chatFormatting.prefixText ? `§e[§r${chatFormatting.prefixText}§e]§r ` : ''}`;
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
