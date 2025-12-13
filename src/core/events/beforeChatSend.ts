import * as mc from '@minecraft/server';

import { commandManager } from '@commands/commandManager.js';

import { addChatLog } from '@features/moderation/chatLogManager.js';
import { getPunishment } from '@features/moderation/punishmentManager.js';
import { isTeamChatEnabled, toggleTeamChat } from '@features/teams/commands/team.js';
import { getTeamByPlayer } from '@features/teams/teamManager.js';
import { getConfig } from '../configManager.js';
import { rawLog } from '../logger.js';
import * as playerDataManager from '../playerDataManager.js';
import * as rankManager from '../rankManager.js';

export const eventName = 'beforeChatSend';

function handleChatSend(eventData: mc.ChatSendBeforeEvent) {
    const player = eventData.sender;

    const punishment = getPunishment(player.id);
    if (punishment?.type === 'mute') {
        eventData.cancel = true;
        const remainingTime = Math.round((punishment.expires - Date.now()) / 1000);
        const durationText = punishment.expires === Infinity ? 'permanently' : `for another ${remainingTime} seconds`;
        player.sendMessage(`§cYou are muted ${durationText}. Reason: ${punishment.reason}`);
        return;
    }

    const wasCommand = commandManager.handleChatCommand(eventData);
    if (wasCommand) {
        return;
    }

    // Team Chat Check
    if (isTeamChatEnabled(player.id)) {
        const team = getTeamByPlayer(player.id);
        if (team) {
            eventData.cancel = true;
            const pData = playerDataManager.getOrCreatePlayer(player);
            let rankPrefix = '';
            if (pData) {
                const rank = rankManager.getRankById(pData.rankId);
                if (rank && rank.chatFormatting?.prefixText) {
                    rankPrefix = `§e[§r${rank.chatFormatting.prefixText}§e]§r `;
                }
            }

            const teamMsg = `§a[Team] ${rankPrefix}${player.name}: §f${eventData.message}`;
            // Broadcast to members
            const onlinePlayers = mc.world.getAllPlayers();
            for (const memberId of team.members) {
                const member = onlinePlayers.find((p) => p.id === memberId);
                if (member) {
                    member.sendMessage(teamMsg);
                }
            }
            return;
        } else {
            // Player left team but has chat on? Disable it.
            toggleTeamChat(player.id); // Disable
            player.sendMessage('§cYou are no longer in a team. Team chat disabled.');
            // Fall through to normal chat
        }
    }

    eventData.cancel = true;
    const pData = playerDataManager.getOrCreatePlayer(player);
    if (!pData) {
        mc.world.sendMessage(`§7${player.name}§r: ${eventData.message}`);
        return;
    }
    const rank = rankManager.getRankById(pData.rankId);
    const team = getTeamByPlayer(player.id);
    const teamSuffix = team ? `§e[§r${team.name}§e]§r` : '';

    // Hardcode brackets for rank prefix if it exists
    const rankPrefix = rank && rank.chatFormatting?.prefixText ? `§e[§r${rank.chatFormatting.prefixText}§e]§r` : '';

    const formattedMessage =
        rank && rank.chatFormatting
            ? `${rankPrefix}${rank.chatFormatting.nameColor}${player.name}${teamSuffix}§r: ${rank.chatFormatting.messageColor}${eventData.message}`
            : `§7${player.name}${teamSuffix}§r: ${eventData.message}`;

    // Log to console if enabled
    if (getConfig().chat?.logToConsole) {
        // Using a plain-text version for the console log to avoid clutter from formatting codes
        rawLog(`<${player.name}> ${eventData.message}`);
    }

    addChatLog(player.name, eventData.message, rank?.name);

    mc.world.sendMessage(formattedMessage);
}

export default handleChatSend;
