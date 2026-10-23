import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerCount } from '@core/data/playerCache.js';
import { sendMessage } from '@core/utils/messaging.js';
import * as mc from '@minecraft/server';

const statusCommand: CustomCommand = {
    name: 'status',
    description: 'Shows server status.',
    category: 'Essentials',
    permissionNode: 'cmd.status.owner',
    execute: (executor: CommandExecutor) => {
        const playerCount = getPlayerCount();
        const tick = mc.system.currentTick;

        sendMessage(`§aServer Status:\n§7Players: §f${playerCount}\n§7Tick: §f${tick}`, executor);
    }
};

export default statusCommand;
