import { world } from '@minecraft/server';
import { getPunishment } from '../core/punishmentManager.js';
import { commandManager } from '../modules/commands/commandManager.js';
import * as playerDataManager from '../core/playerDataManager.js';
import * as rankManager from '../core/rankManager.js';
import { getConfig } from '../core/configManager.js';

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

    eventData.cancel = true;
    const pData = playerDataManager.getPlayer(player.id);
    if (!pData) {
        world.sendMessage(`§7${player.name}§r: ${eventData.message}`);
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

    world.sendMessage(formattedMessage);
}

export default handleChatSend;