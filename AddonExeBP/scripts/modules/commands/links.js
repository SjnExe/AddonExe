import { commandManager } from './commandManager.js';
import { getConfig } from '../../core/configManager.js';

commandManager.register({
    name: 'links',
    aliases: ['link', 'websites'],
    description: 'Displays helpful server links.',
    category: 'General',
    permissionLevel: 1024, // Everyone
    allowConsole: true,
    execute: (player, args) => {
        const config = getConfig();
        const links = config.serverInfo.helpfulLinks;

        if (!links || links.length === 0) {
            player.sendMessage('§cNo helpful links have been configured by the admin.');
            return;
        }

        player.sendMessage('§l§9--- Helpful Links ---');
        for (const link of links) {
            player.sendMessage(`${link.title}: §r${link.url}`);
        }
        player.sendMessage('§l§9-------------------');
    }
});