import * as mc from '@minecraft/server';

import { saveAllData } from '@core/dataManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { playSoundFromConfig } from '@core/utils.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'save',
    slashName: 'xsave',
    aliases: ['xsave'],
    description: 'Manually saves all server data to disk.',
    category: 'Administration',
    permissionNode: 'cmd.save.admin', // Admins only
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
        } catch (error: unknown) {
            if (error instanceof Error) {
                sendMessage(`§cAn error occurred during save: ${error.message}`);
                errorLog(`[/save] Manual save failed: ${error.stack}`);
            }
        }
    }
};

export default command;
