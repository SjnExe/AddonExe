import { commandManager } from './commandManager.js';
import { reloadConfig } from '../../core/configManager.js';
import { updateAllPlayerRanks } from '../../core/main.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'reload',
    slashName: 'xreload',
    description: 'Reloads the addon configuration from the config file.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [],
    /**
     * Executes the /reload command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     */
    execute: async (player) => {
        try {
            sendMessage('§eReloading configuration...', player);
            await reloadConfig();
            sendMessage('§aConfiguration reloaded successfully.', player);

            updateAllPlayerRanks();
            sendMessage('§aAll online player ranks have been re-evaluated.', player);

        } catch (error) {
            sendMessage('§cFailed to reload configuration. Check the console for errors.', player);
            errorLog(`[/reload] ${error.stack}`);
        }
    }
});
