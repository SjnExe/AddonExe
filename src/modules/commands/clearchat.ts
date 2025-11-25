import * as mc from '@minecraft/server';
import { CustomCommand, CommandExecutor } from './commandManager.js';
import { errorLog } from '../../core/logger.js';
import { sendMessage } from '../../core/messaging.js';

const clearchatCommand: CustomCommand = {
    name: 'clearchat',
    aliases: ['cc'],
    description: 'Clears the chat for all players.',
    permissionLevel: 2,
    allowConsole: true,
    execute: (executor: CommandExecutor) => {
        try {
            const emptyLines = '\n'.repeat(100);
            const announcer = executor instanceof mc.Player ? executor.name : 'the Console';
            mc.world.sendMessage(emptyLines);
            mc.world.sendMessage(`§aChat has been cleared by ${announcer}.`);
        } catch (error: any) {
            if (executor instanceof mc.Player) {
                sendMessage('§cFailed to clear chat.', executor);
            } else {
                executor.sendMessage('§cFailed to clear chat.');
            }
            errorLog(`[/x:clearchat] ${error.stack}`);
        }
    }
};

export default clearchatCommand;
