import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';
import { sendMessage } from '../../core/messaging.js';

commandManager.register({
    name: 'links',
    aliases: ['link', 'websites'],
    description: 'Displays helpful server links.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    allowConsole: true,
    /**
     * Executes the /links command.
     * @param {import('@minecraft/server').Player | object} player The player or console executing the command.
     */
    execute: (player) => {
        const config = getConfig();
        const links = config.serverInfo.helpfulLinks;

        if (!links || links.length === 0) {
            sendMessage('§cNo helpful links have been configured by the admin.', player);
            return;
        }

        let message = '§l§9--- Helpful Links ---';
        for (const link of links) {
            message += `\n${link.title}: §r${link.url}`;
        }
        message += '\n§l§9-------------------';
        sendMessage(message, player, { raw: true });
    }
});
