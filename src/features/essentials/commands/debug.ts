import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerCount } from '@core/data/playerCache.js';
import { sendMessage } from '@core/utils/messaging.js';
import { getTimerStats } from '@core/utils/timerManager.js';
import { getCurrentTps } from '@features/sidebar/manager.js';
import * as mc from '@minecraft/server';

const debugCommand: CustomCommand = {
  name: 'debug',
  description: 'Displays debug information.',
  category: 'Essentials',
  permissionNode: 'cmd.debug.owner',
  allowConsole: true,
  execute: (executor: CommandExecutor) => {
    const memory = mc.system.currentTick;
    const players = getPlayerCount();
    const { tps, tpsNum } = getCurrentTps();
    const tpsColor = tpsNum >= 18 ? '§a' : tpsNum >= 14 ? '§e' : '§c';
    const timerStats = getTimerStats();

    const info = [
      '§a--- Debug Info ---',
      `§7Tick: §f${memory}`,
      `§7Players: §f${players}`,
      `§7TPS: ${tpsColor}${tps}§r §7/ 20.0`,
      `§7Timers: §f${timerStats.intervals} intervals, ${timerStats.timeouts} timeouts, ${timerStats.jobs} jobs`,
    ];

    sendMessage(info.join('\n'), executor);
  },
};

export default debugCommand;
