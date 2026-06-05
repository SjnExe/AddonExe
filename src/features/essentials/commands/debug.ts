import * as mc from '@minecraft/server';

import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/messaging.js';
import { getPlayerCount } from '@core/playerCache.js';
import { getTimerStats } from '@core/timerManager.js';

const debugCommand: CustomCommand = {
    name: 'debug',
    description: 'Displays debug information.',
    category: 'Essentials',

    execute: (executor: CommandExecutor) => {
        const memory = mc.system.currentTick;
        // Optimization: Use cached player count
        const players = getPlayerCount();
        const tps = '20.0 (Target)'; // Bedrock API doesn't expose real TPS easily
        const timerStats = getTimerStats();

        const info = [
            '§a--- Debug Info ---',
            `§7Tick: §f${memory}`,
            `§7Players: §f${players}`,
            `§7TPS: §f${tps}`,
            `§7Timers: §f${timerStats.intervals} intervals, ${timerStats.timeouts} timeouts, ${timerStats.jobs} jobs`
        ];

        sendMessage(info.join('\n'), executor);
    }
};

export default debugCommand;
