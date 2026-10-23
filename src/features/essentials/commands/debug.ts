import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerCount } from '@core/data/playerCache.js';
import { sendMessage } from '@core/utils/messaging.js';
import { getTimerStats } from '@core/utils/timerManager.js';
import * as mc from '@minecraft/server';

const debugCommand: CustomCommand = {
  name: 'debug',
  description: 'Displays debug information.',
  category: 'Essentials',
  permissionNode: 'cmd.debug.owner', // Admin only
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
      `§7Timers: §f${timerStats.intervals} intervals, ${timerStats.timeouts} timeouts, ${timerStats.jobs} jobs`,
    ];

    sendMessage(info.join('\n'), executor);
  },
};

export default debugCommand;
