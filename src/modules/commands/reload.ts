import { reloadConfig } from '../../core/configManager.js';
import { errorLog } from '../../core/logger.js';
import { updateAllPlayerRanks } from '../../core/main.js';
import { sendMessage } from '../../core/messaging.js';

import { CustomCommand } from './commandManager.js';

const command: CustomCommand = {
    name: 'reload',
    aliases: ['xreload'],
    description: 'Reloads the addon configuration from the config file.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [],
    execute: async (executor) => {
        try {
            sendMessage('§eReloading configuration...');

            // This function contains the new priority-merge logic
            await reloadConfig();

            sendMessage('§aConfiguration reloaded successfully.');

            // This is required to make nametag changes apply immediately
            updateAllPlayerRanks();

            sendMessage('§aAll online player ranks have been re-evaluated.');
        } catch (error: any) {
            sendMessage('§cFailed to reload configuration. Check the console for errors.');
            errorLog(`[/reload] ${error.stack}`);
        }
    }
};

export default command;
