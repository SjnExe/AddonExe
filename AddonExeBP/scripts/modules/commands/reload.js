import { commandManager } from './commandManager.js';
import { reloadConfig } from '../../core/configManager.js';
import { updateAllPlayerRanks } from '../../core/main.js';
import { errorLog } from '../../core/errorLogger.js';

commandManager.register({
    name: 'reload',
    slashName: 'xreload',
    description: 'Reloads the addon configuration from the config file.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [],
    execute: (player, args) => {
        try {
            reloadConfig();
            player.sendMessage('§aConfiguration reloaded successfully.');

            updateAllPlayerRanks();
            player.sendMessage('§aAll online player ranks have been re-evaluated.');

        } catch (error) {
            player.sendMessage('§cFailed to reload configuration.');
            errorLog(`[/x:reload] ${error.stack}`);
        }
    }
});
