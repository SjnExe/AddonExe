import { commandManager } from './commandManager.js';
import { reloadAllConfigs } from '../../core/configManager.js';
import { updateAllPlayerRanks } from '../../core/main.js';
import { errorLog } from '../../core/errorLogger.js';

commandManager.register({
    name: 'reload',
    slashName: 'xreload',
    description: 'Reloads all addon configurations from their files.',
    category: 'Administration',
    permissionLevel: 1, // Admins only
    allowConsole: true,
    disableSlashCommand: false,
    parameters: [],
    execute: async (player, args) => {
        try {
            player.sendMessage('§eReloading all configurations...');
            await reloadAllConfigs();
            player.sendMessage('§aAll configurations reloaded successfully.');

            // This is still needed to apply any potential rank changes to online players
            updateAllPlayerRanks();
            player.sendMessage('§aAll online player ranks have been re-evaluated.');

        } catch (error) {
            player.sendMessage('§cFailed to reload configurations.');
            errorLog(`[/x:reload] ${error.stack}`);
        }
    }
});
