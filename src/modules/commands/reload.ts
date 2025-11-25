import {
    CustomCommand
} from './commandManager.js';
import {
    reloadConfig
} from '../../core/configManager.js';
import {
    updateAllPlayerRanks
} from '../../core/main.js';
import {
    errorLog
} from '../../core/logger.js';
import {
    sendMessage
} from '../../core/messaging.js';
import * as mc from '@minecraft/server';
const reloadCommand: CustomCommand = {
    name: 'reload',
    slashName: 'xreload',
    description: 'Reloads the addon configuration from the config file.',
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    execute: async (player) => {
        try {
            if (player instanceof mc.Player) {
                sendMessage('§eReloading configuration...', player);
            } else {
                player.sendMessage('§eReloading configuration...');
            }
            await reloadConfig();
            if (player instanceof mc.Player) {
                sendMessage('§aConfiguration reloaded successfully.', player);
            } else {
                player.sendMessage('§aConfiguration reloaded successfully.');
            }
            updateAllPlayerRanks();
            if (player instanceof mc.Player) {
                sendMessage('§aAll online player ranks have been re-evaluated.', player);
            } else {
                player.sendMessage('§aAll online player ranks have been re-evaluated.');
            }
        } catch (error: any) {
            if (player instanceof mc.Player) {
                sendMessage('§cFailed to reload configuration. Check the console for errors.', player);
            } else {
                player.sendMessage('§cFailed to reload configuration. Check the console for errors.');
            }
            errorLog(`[/reload] ${error.stack}`);
        }
    }
};
export default reloadCommand;