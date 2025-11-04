import { getOrCreatePlayer, setPlayerXrayNotifications } from '../../core/playerDataManager.js';
import { commandManager } from './commandManager.js';
import { sendMessage } from '../../core/messaging.js';
import { getXrayConfig, saveXrayConfig } from '../../core/configurations.js';
import { infoLog } from '../../core/logger.js';
import { getPlayerFromCache } from '../../core/playerCache.js';

commandManager.register({
    name: 'xraynotify',
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself or the console.',
    permissionLevel: 2,
    execute: (player, args) => {
        // If the command is run from the console (player is null)
        if (!player) {
            const xrayConfig = getXrayConfig();
            if (!xrayConfig) {
                infoLog('X-ray config not found.');
                return;
            }
            const newStatus = !xrayConfig.notifications.logToConsole;
            xrayConfig.notifications.logToConsole = newStatus;
            saveXrayConfig(xrayConfig); // This should be asynchronous, but the current implementation is synchronous.
            infoLog(`X-ray console notifications have been ${newStatus ? 'enabled' : 'disabled'}.`);
            return;
        }

        // If the command is run by a player
        const pData = getOrCreatePlayer(player);
        if (!pData) {
            sendMessage('Could not retrieve your player data.', player);
            return;
        }

        const newStatus = !pData.xrayNotificationsEnabled;
        setPlayerXrayNotifications(player.id, newStatus);

        // Re-fetch the player from the cache to ensure the object is valid for sending a message.
        const freshPlayer = getPlayerFromCache(player.id);
        if (freshPlayer) {
            const statusMessage = `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`;
            sendMessage(statusMessage, freshPlayer, { raw: true }); // Send raw to avoid server name prefix.
        }
    }
});
