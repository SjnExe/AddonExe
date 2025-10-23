import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'version',
    aliases: ['ver'],
    description: 'Displays the current version of the addon.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    parameters: [],
    /**
     * Executes the /version command.
     * @param {import('@minecraft/server').Player} player The player executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        const versionString = `v${config.version.join('.')}`;
        sendMessage(`§7AddonExe Version: §e${versionString}`, player);
    }
});
