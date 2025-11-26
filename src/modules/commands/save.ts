import * as mc from '@minecraft/server';

import { saveAllData } from '../../core/dataManager.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';
import { playSoundFromConfig } from '../../core/utils.js';

import { CustomCommand } from './commandManager.js';

const command: CustomCommand = {
    name: 'save',
    aliases: ['xsave'],
    description: 'Manually saves all server data to disk.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [],
    execute: (executor) => {
        sendMessage('§aStarting manual data save...');
        try {
            saveAllData({ log: true });
            sendMessage('§aAll server data has been successfully saved.');
            if (executor instanceof mc.Player) {
                playSoundFromConfig(executor, 'adminNotificationReceived');
            }
        } catch (e: any) {
            sendMessage(`§cAn error occurred during save: ${e.message}`);
            errorLog(`[/save] Manual save failed: ${e.stack}`);
        }
    }
};

export default command;
