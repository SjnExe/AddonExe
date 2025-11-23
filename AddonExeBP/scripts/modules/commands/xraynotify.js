import { getOrCreatePlayer, setPlayerXrayNotifications } from '../../core/playerDataManager.js';
import { commandManager } from './commandManager.js';
import { sendMessage } from '../../core/messaging.js';
import { getXrayConfig, saveXrayConfig } from '../../core/configurations.js';
import { infoLog } from '../../core/logger.js';

commandManager.register({
    name: 'xraynotify',
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself or the console.',
    permissionLevel: 1, // Lowered from 2 to 1 (Admin) to match standard "staff" level
    execute: (player, args) => {
        // If the command is run from the console (player is null or isConsole is true)
        if (!player || player.isConsole) {
            const xrayConfig = getXrayConfig();
            if (!xrayConfig) {
                infoLog('X-ray config not found.');
                return;
            }
            const newStatus = !xrayConfig.notifications.logToConsole;
            xrayConfig.notifications.logToConsole = newStatus;
            saveXrayConfig(xrayConfig);
            infoLog(`X-ray console notifications have been ${newStatus ? 'enabled' : 'disabled'}.`);
            return;
        }

        // If the command is run by a player
        // We fetch pData to update the property, but we use the 'player' object directly for messaging
        const pData = getOrCreatePlayer(player);
        if (!pData) {
            sendMessage('Could not retrieve your player data.', player);
            return;
        }

        const newStatus = !pData.xrayNotificationsEnabled;
        setPlayerXrayNotifications(player.id, newStatus);

        const statusMessage = `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`;
        sendMessage(statusMessage, player, { raw: true });
    }
});
