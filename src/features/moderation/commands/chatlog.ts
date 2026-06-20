import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { serviceLocator } from '@core/services/serviceLocator.js';
import * as mc from '@minecraft/server';

interface AnticheatLogsService {
    showChatFilter: (player: mc.Player) => Promise<void>;
}

const chatlogCommand: CustomCommand = {
    name: 'chatlog',
    description: 'View chat logs directly.',
    category: 'Moderation',
    permissionNode: 'cmd.chatlog',
    allowConsole: false,
    execute: async (executor: CommandExecutor) => {
        if (!(executor instanceof mc.Player)) return;
        const logService = serviceLocator.getService<AnticheatLogsService>('anticheat.logs');
        if (logService) {
            await logService.showChatFilter(executor);
        } else {
            executor.sendMessage('§cChat log service is not available.');
        }
    }
};

export default chatlogCommand;
