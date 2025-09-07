import { commandManager } from './commandManager.js';
import { saveAllData } from '../../core/dataManager.js';
import { playSoundFromConfig } from '../../core/utils.js';
import { errorLog } from '../../core/errorLogger.js';

commandManager.register({
    name: 'save',
    slashName: 'xsave',
    description: 'Manually saves all server data to disk.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    parameters: [],
    execute: (player, args) => {
        player.sendMessage('§aStarting manual data save...');
        try {
            saveAllData({ log: true });
            player.sendMessage('§aAll server data has been successfully saved.');
            if (!player.isConsole) {
                playSoundFromConfig(player, 'adminNotificationReceived');
            }
        } catch (e) {
            player.sendMessage(`§cAn error occurred during save: ${e.message}`);
            errorLog(`[/save] Manual save failed: ${e.stack}`);
        }
    }
});
