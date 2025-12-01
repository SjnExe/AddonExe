import * as mc from '@minecraft/server';

import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';

import { CustomCommand, CommandExecutor } from './commandManager.js';

const clearchatCommand: CustomCommand = {
    name: 'clearchat',
    aliases: ['cc'],
    description: 'Clears the chat for all players.',
    category: 'Moderation',
    permissionLevel: 2,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        try {
            const emptyLines = '\n'.repeat(100);
            const announcer = executor instanceof mc.Player ? executor.name : 'the Console';
            mc.world.sendMessage(emptyLines);
            mc.world.sendMessage(`§aChat has been cleared by ${announcer}.`);
        } catch (error: unknown) {
            if (executor instanceof mc.Player) {
                sendMessage('§cFailed to clear chat.', executor);
            } else {
                executor.sendMessage('§cFailed to clear chat.');
            }
            const stack = error instanceof Error ? error.stack : String(error);
            errorLog(`[/x:clearchat] ${stack}`);
        }
    }
};

export default clearchatCommand;
