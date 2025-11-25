import {
    CustomCommand
} from './commandManager.js';
import {
    saveAllData
} from '../../core/dataManager.js';
import {
    playSoundFromConfig
} from '../../core/utils.js';
import {
    errorLog
} from '../../core/logger.js';
import {
    sendMessage
} from '../../core/messaging.js';
import * as mc from '@minecraft/server';
const saveCommand: CustomCommand = {
    name: 'save',
    slashName: 'xsave',
    description: 'Manually saves all server data to disk.',
    category: 'Administration',
    permissionLevel: 1,
    allowConsole: true,
    execute: (player) => {
        if (player instanceof mc.Player) {
            sendMessage('§aStarting manual data save...', player);
        } else {
            player.sendMessage('§aStarting manual data save...');
        }
        try {
            saveAllData({
                log: true
            });
            if (player instanceof mc.Player) {
                sendMessage('§aAll server data has been successfully saved.', player);
                playSoundFromConfig(player, 'adminNotificationReceived');
            } else {
                player.sendMessage('§aAll server data has been successfully saved.');
            }
        } catch (e: any) {
            if (player instanceof mc.Player) {
                sendMessage(`§cAn error occurred during save: ${e.message}`, player);
            } else {
                player.sendMessage(`§cAn error occurred during save: ${e.message}`);
            }
            errorLog(`[/save] Manual save failed: ${e.stack}`);
        }
    }
};
export default saveCommand;