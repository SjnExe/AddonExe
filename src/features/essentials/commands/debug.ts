import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerCount } from '@core/playerCache.js';
import { sendMessage } from '@core/messaging.js';

const debugCommand: CustomCommand = {
    name: 'debug',
    description: 'Displays debug information.',
    category: 'Essentials',
    permissionLevel: 1, // Admin only
    execute: (executor: CommandExecutor) => {
        const memory = mc.system.currentTick;
        // Optimization: Use cached player count
        const players = getPlayerCount();
        const tps = '20.0 (Target)'; // Bedrock API doesn't expose real TPS easily

        const info = [
            '§a--- Debug Info ---',
            `§7Tick: §f${memory}`,
            `§7Players: §f${players}`,
            `§7TPS: §f${tps}`
        ];

        sendMessage(info.join('\n'), executor);
    }
};

export default debugCommand;
