import { world } from '@minecraft/server';
import { commandManager } from './commandManager.js';
import { errorLog } from '../../core/errorLogger.js';

commandManager.register({
    name: 'clearchat',
    aliases: ['cc'],
    description: 'Clears the chat for all players.',
    category: 'Moderation',
    permissionLevel: 2, // Admins only
    allowConsole: true,
    parameters: [],
    execute: (player, args) => {
        try {
            // Send 100 empty lines to effectively clear the chat history for all players.
            const emptyLines = '\n'.repeat(100);
            const announcer = player.isConsole ? 'the Console' : player.name;
            world.sendMessage(emptyLines);
            world.sendMessage(`§aChat has been cleared by ${announcer}.`);
        } catch (error) {
            player.sendMessage('§cFailed to clear chat.');
            errorLog(`[/x:clearchat] ${error.stack}`);
        }
    }
});
