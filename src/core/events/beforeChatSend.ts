import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { getPlayerFromCache } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';

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

    // Rank Formatting handled by rankManager/main config usually
    // ...

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
