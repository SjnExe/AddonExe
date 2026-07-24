import { reloadConfig } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { updateAllPlayerRanks } from '../../../main.js';

import { CustomCommand } from '@commands/commandManager.js';

const command: CustomCommand = {
    name: 'reload',
    slashName: 'xreload',
    aliases: ['xreload'],
    description: 'Reloads the addon configuration from the config file.',
    category: 'Administration',
    permissionNode: 'cmd.reload.admin', // Admins only
    allowConsole: true,
    parameters: [],
    execute: (_executor) => {
        try {
            sendMessage('§eReloading configuration...');

            // This function contains the new priority-merge logic
            reloadConfig();

            sendMessage('§aConfiguration reloaded successfully.');

            // This is required to make nametag changes apply immediately
            updateAllPlayerRanks();

            sendMessage('§aAll online player ranks have been re-evaluated.');
        } catch (error: unknown) {
            sendMessage('§cFailed to reload configuration. Check the console for errors.');
            if (error instanceof Error) {
                errorLog(`[/reload] ${error.stack}`);
            }
        }
    }
};

export default command;
