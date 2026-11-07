import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getPlayerCount } from '@core/data/playerCache.js';
import { debugLog } from '@core/utils/logger.js';
import { sendMessage } from '@core/utils/messaging.js';
import { getTimerStats } from '@core/utils/timerManager.js';
import { getCurrentTps } from '@features/sidebar/manager.js';
import * as mc from '@minecraft/server';

let debugUtilsPromise: Promise<typeof import('@minecraft/debug-utilities') | null> | null = null;

/**
 * Resolves and caches the `@minecraft/debug-utilities` module if available in the runtime.
 *
 * @returns The imported module instance or `null` if unavailable.
 */
async function getDebugUtilities(): Promise<typeof import('@minecraft/debug-utilities') | null> {
  if (debugUtilsPromise) {
    return debugUtilsPromise;
  }
  debugUtilsPromise = import('@minecraft/debug-utilities').catch((error: unknown) => {
    debugLog(`[Debug] Runtime stats unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  return debugUtilsPromise;
}

const debugCommand: CustomCommand = {
  name: 'debug',
  description: 'Displays debug information.',
  category: 'Essentials',
  permissionNode: 'cmd.debug.owner',
  allowConsole: true,
  execute: async (executor: CommandExecutor) => {
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

    debugLog(
      `[Debug] Tick: ${memory} | Players: ${players} | TPS: ${tps} | Timers: ${timerStats.intervals}i, ${timerStats.timeouts}t, ${timerStats.jobs}j`,
    );

    const debugUtils = await getDebugUtilities();
    if (debugUtils) {
      if (typeof debugUtils.collectRuntimeStats === 'function') {
        try {
          const stats = debugUtils.collectRuntimeStats();
          const usedMb = (stats.memoryUsedSize / (1024 * 1024)).toFixed(2);
          const allocMb = (stats.memoryAllocatedSize / (1024 * 1024)).toFixed(2);
          info.push(
            `§7Memory Heap: §f${usedMb} MB §7(Allocated: §f${allocMb} MB§7)`,
            `§7Heap Objects: §f${stats.objectCount} §7(Strings: §f${stats.stringCount}§7, Arrays: §f${stats.arrayCount}§7)`,
          );
          debugLog(
            `[Debug] Heap: ${usedMb}/${allocMb} MB | Objects: ${stats.objectCount} (str: ${stats.stringCount}, arr: ${stats.arrayCount})`,
          );
        } catch (error: unknown) {
          debugLog(
            `[Debug] Failed to collect runtime stats: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (typeof debugUtils.collectPluginStats === 'function') {
        try {
          const pluginStats = debugUtils.collectPluginStats();
          let totalHandles = 0;
          for (const plugin of pluginStats.plugins) {
            totalHandles += Object.values(plugin.handleCounts).reduce((acc, count) => acc + count, 0);
          }
          info.push(`§7Active Handles: §f${totalHandles}`);
          debugLog(`[Debug] Active Handles: ${totalHandles}`);
        } catch (error: unknown) {
          debugLog(`[Debug] Failed to collect plugin stats: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    if ('isValid' in executor && executor.isValid === false) {
      return;
    }

    sendMessage(info.join('\n'), executor);
  },
};

export default debugCommand;
