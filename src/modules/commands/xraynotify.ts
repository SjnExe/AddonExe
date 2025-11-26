import * as mc from '@minecraft/server';

import { getXrayConfig, saveXrayConfig } from '../../core/configurations.js';
import { infoLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { getOrCreatePlayer, setPlayerXrayNotifications } from '../../core/playerDataManager.js';
import { playSound } from '../../core/utils.js';

import { CustomCommand } from './commandManager.js';

const command: CustomCommand = {
    name: 'xraynotify',
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself or the console.',
    category: 'X-Ray Detection',
    permissionLevel: 2, // Moderator
    allowConsole: true,
    parameters: [],
    execute: (executor) => {
        if (executor instanceof mc.Player) {
            const pData = getOrCreatePlayer(executor);
            if (!pData) {
                sendMessage('Could not retrieve your player data.', executor);
                return;
            }

            const newStatus = !pData.xrayNotificationsEnabled;
            setPlayerXrayNotifications(executor.id, newStatus);

            const statusMessage = `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`;
            sendMessage(statusMessage, executor);

            if (newStatus) {
                playSound(executor, 'random.orb', { volume: 0.5, pitch: 1.0 });
            } else {
                playSound(executor, 'note.bass', { volume: 0.5, pitch: 0.8 });
            }
        } else {
            // Console execution
            const xrayConfig = getXrayConfig();
            if (!xrayConfig) {
                infoLog('X-ray config not found, cannot toggle console notifications.');
                return;
            }
            const newStatus = !xrayConfig.notifications.logToConsole;
            xrayConfig.notifications.logToConsole = newStatus;
            saveXrayConfig(xrayConfig); // This saves the entire xrayConfig object
            infoLog(`X-ray console notifications have been ${newStatus ? 'enabled' : 'disabled'}.`);
        }
    }
};

export default command;
