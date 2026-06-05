import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { showChatFilter } from '@features/anticheat/commands/logs.js';
import * as mc from '@minecraft/server';

const chatlogCommand: CustomCommand = {
    name: 'chatlog',
    description: 'View chat logs directly.',
    category: 'Moderation',

    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
        await showChatFilter(executor);
    }
};

export default chatlogCommand;
