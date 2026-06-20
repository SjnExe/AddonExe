import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { AnticheatService } from '@core/services/interfaces.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import * as mc from '@minecraft/server';

const chatlogCommand: CustomCommand = {
    name: 'chatlog',
    description: 'View chat logs directly.',
    category: 'Moderation',
    permissionNode: 'cmd.chatlog',
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;

        const anticheatService = serviceLocator.getService<AnticheatService>('anticheat');
        if (anticheatService) {
            await anticheatService.showChatFilter(executor);
        } else {
            executor.sendMessage('§cChat logging is currently unavailable (Anticheat feature disabled).');
        }
    }
};

export default chatlogCommand;
