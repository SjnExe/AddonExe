import * as mc from '@minecraft/server';

import { getXrayConfig, saveXrayConfig } from '@core/configurations.js';
import { infoLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { getOrCreatePlayer, setPlayerXrayNotifications } from '@core/playerDataManager.js';
import { playSound } from '@core/utils.js';
import { isDefined } from '@lib/guards.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'xraynotify',
    aliases: ['xray'],
    description: 'Toggles X-ray notifications for yourself or the console.',
    category: 'Administration',
    permissionLevel: 2, // Moderator
    allowConsole: true,
    parameters: [],
    execute: (executor) => {
        if (executor instanceof mc.Player) {
            const pData = getOrCreatePlayer(executor);
            if (!isDefined(pData)) {
                sendMessage('Could not retrieve your player data.', executor);
                return;
            }

            const newStatus = pData.xrayNotificationsEnabled !== true;
            setPlayerXrayNotifications(executor.id, newStatus);

            const statusMessage = `§aX-ray notifications have been ${newStatus ? '§2enabled' : '§cdisabled'}§a.`;
            sendMessage(statusMessage, executor);

            if (newStatus) {
                playSound(executor, 'random.orb', { volume: 0.5, pitch: 1 });
            } else {
                playSound(executor, 'note.bass', { volume: 0.5, pitch: 0.8 });
            }
        } else {
            // Console execution
            const xrayConfig = getXrayConfig();
            if (!isDefined(xrayConfig)) {
                infoLog('X-ray config not found, cannot toggle console notifications.');
                return;
            }
            const newStatus = xrayConfig.notifications.logToConsole !== true;
            xrayConfig.notifications.logToConsole = newStatus;
            saveXrayConfig(xrayConfig); // This saves the entire xrayConfig object
            infoLog(`X-ray console notifications have been ${newStatus ? 'enabled' : 'disabled'}.`);
        }
    }
};

export default command;
