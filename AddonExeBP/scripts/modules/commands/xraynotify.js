import { getOrCreatePlayer, setPlayerXrayNotifications } from '../../core/playerDataManager.js';
import { commandManager } from './commandManager.js';
import { sendMessage } from '../../core/messaging.js';
import { getXrayConfig, saveXrayConfig } from '../../core/configurations.js';
import { infoLog } from '../../core/logger.js';

commandManager.register({
    name: 'xraynotify',
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself or the console.',
    permissionLevel: 2,
    execute: (player, args) => {
        if (!player) {
            // Command is run from the console
            const xrayConfig = getXrayConfig();
            if (xrayConfig) {
                const newStatus = !xrayConfig.notifications.logToConsole;
                xrayConfig.notifications.logToConsole = newStatus;
                saveXrayConfig(xrayConfig);
                infoLog(`X-ray notifications for console have been ${newStatus ? 'enabled' : 'disabled'}.`);
            }
            return;
        }

        const pData = getOrCreatePlayer(player);
        const newStatus = !pData.xrayNotificationsEnabled;
        setPlayerXrayNotifications(player.id, newStatus);
        sendMessage(player, `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`);
    }
});
