import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerCount } from '@core/playerCache.js';

const statusCommand: CustomCommand = {
    name: 'status',
    description: 'Shows server status.',
    category: 'Essentials',

    execute: (executor: CommandExecutor) => {
        const playerCount = getPlayerCount();
        const tick = mc.system.currentTick;

        sendMessage(`§aServer Status:\n§7Players: §f${playerCount}\n§7Tick: §f${tick}`, executor);
    }
};

export default statusCommand;
