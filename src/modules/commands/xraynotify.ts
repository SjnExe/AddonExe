import {
    getOrCreatePlayer,
    setPlayerXrayNotifications
} from '../../core/playerDataManager.js';
import {
    CustomCommand
} from './commandManager.js';
import {
    sendMessage
} from '../../core/messaging.js';
import {
    getXrayConfig,
    saveXrayConfig
} from '../../core/configurations.js';
import {
    infoLog
} from '../../core/logger.js';
import {
    playSound
} from '../../core/utils.js';
import * as mc from '@minecraft/server';
const xrayNotifyCommand: CustomCommand = {
    name: 'xraynotify',
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself or the console.',
    permissionLevel: 1,
    execute: (player, args) => {
        if (!(player instanceof mc.Player)) {
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
        const pData = getOrCreatePlayer(player);
        if (!pData) {
            sendMessage('Could not retrieve your player data.', player);
            return;
        }
        const newStatus = !pData.xrayNotificationsEnabled;
        setPlayerXrayNotifications(player.id, newStatus);
        const statusMessage = `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`;
        sendMessage(statusMessage, player);
        if (newStatus) {
            playSound(player, 'random.orb', {
                volume: 0.5,
                pitch: 1.0
            });
        } else {
            playSound(player, 'note.bass', {
                volume: 0.5,
                pitch: 0.8
            });
        }
    }
};
export default xrayNotifyCommand;