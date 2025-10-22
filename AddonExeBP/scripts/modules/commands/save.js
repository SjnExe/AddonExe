import { commandManager } from './commandManager.js';
import { saveAllData } from '../../core/dataManager.js';
import { playSoundFromConfig } from '../../core/utils.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'save',
    slashName: 'xsave',
    description: 'Manually saves all server data to disk.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [],
    /**
     * Executes the /save command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     */
    execute: (player) => {
        sendMessage('§aStarting manual data save...', player);
        try {
            saveAllData({ log: true });
            sendMessage('§aAll server data has been successfully saved.', player);
            if (!player.isConsole) {
                playSoundFromConfig(player, 'adminNotificationReceived');
            }
        } catch (e) {
            sendMessage(`§cAn error occurred during save: ${e.message}`, player);
            errorLog(`[/save] Manual save failed: ${e.stack}`);
        }
    }
});
