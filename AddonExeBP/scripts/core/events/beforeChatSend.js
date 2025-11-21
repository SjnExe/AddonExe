import * as mc from '@minecraft/server';
import { getPunishment } from '../punishmentManager.js';
import { commandManager } from '../../modules/commands/commandManager.js';
import * as playerDataManager from '../playerDataManager.js';
import * as rankManager from '../rankManager.js';
import { getConfig } from '../configManager.js';
import { isTeamChatEnabled, toggleTeamChat } from '../../modules/commands/teamChat.js';
import { getTeamByPlayer } from '../teamManager.js';

export const eventName = 'beforeChatSend';

function handleChatSend(eventData) {
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
    if (wasCommand) { return; }

    // Team Chat Check
    if (isTeamChatEnabled(player.id)) {
        const team = getTeamByPlayer(player.id);
        if (team) {
            eventData.cancel = true;
            const teamMsg = `§a[Team] ${player.name}: §f${eventData.message}`;
            // Broadcast to members
            for (const memberId of team.members) {
                const member = mc.world.getAllPlayers().find(p => p.id === memberId);
                if (member) { member.sendMessage(teamMsg); }
            }
            // Also log if needed?
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
    const formattedMessage = rank
        ? `${rank.chatFormatting.prefixText}${rank.chatFormatting.nameColor}${player.name}§r: ${rank.chatFormatting.messageColor}${eventData.message}`
        : `§7${player.name}§r: ${eventData.message}`;

    // Log to console if enabled
    if (getConfig().chat?.logToConsole) {
        // Using a plain-text version for the console log to avoid clutter from formatting codes
        // eslint-disable-next-line no-console
        console.log(`<${player.name}> ${eventData.message}`);
    }

    mc.world.sendMessage(formattedMessage);
}

export default handleChatSend;