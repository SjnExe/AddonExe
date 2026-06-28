import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { rawLog } from '@core/logger.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { stripColorCodes } from '@core/utils/formatting.js';

/**
 * Handles chat messages before they are sent.
 * Manages chat formatting, muting, and ranks.
 */
export default function handleBeforeChatSend(event: mc.ChatSendBeforeEvent) {
    const config = getConfig();
    if (config.chat.enabled !== true) return; // Vanilla chat if disabled

    const player = event.sender;
    const pData = getPlayer(player.id);

    // Mute Check
    if (pData?.announcementsMuted === true) {
        event.cancel = true;
        player.sendMessage('§cYou are muted.');
        return;
    }

    // Apply Rank Formatting
    const rank = getPlayerRank(player, config);
    const chatFormatting = rank.chatFormatting;
    if (chatFormatting) {
        event.cancel = true; // Cancel default broadcast
        const prefix = chatFormatting.prefixText ? `§e[§r${chatFormatting.prefixText}§e]§r ` : '';
        const nameColor = chatFormatting.nameColor || '§7';
        const msgColor = chatFormatting.messageColor || '§f';
        const formattedMessage = `${prefix}${nameColor}${player.name}§r: ${msgColor}${event.message}§r`;

        mc.world.sendMessage(formattedMessage);

        // Chat to Console
        if (config.chat.logToConsole === true) {
            rawLog(stripColorCodes(formattedMessage));
        }
    } else {
        // Fallback Chat to Console if no custom formatting
        if (config.chat.logToConsole === true) {
            rawLog(`[CHAT] ${player.name}: ${event.message}`);
        }
    }

    // Mentions
    if (config.chat.allowMentions === true && event.message.includes('@')) {
        const words = event.message.split(' ');
        for (const word of words) {
            if (word.startsWith('@') && word.length > 1) {
                const name = word.slice(1);
                // Optimization: Use cached lookup
                // Try exact match first
                const target = getPlayerFromCache(name); // ID unlikely
                if (target) {
                    target.playSound('random.orb');
                    target.sendMessage(`§e${player.name} mentioned you!`);
                }
            }
        }
    }
}
