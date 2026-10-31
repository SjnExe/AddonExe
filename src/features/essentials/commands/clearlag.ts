import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  cancelPendingSweep,
  isPendingSweep,
  queryWorldEntityCounts,
  startSweepCountdown,
} from '@features/essentials/lagSweeper.js';

interface ClearLagArgs {
  action?: string;
  arg?: string;
}

const clearLagCommand: CustomCommand = {
  name: 'clearlag',
  aliases: ['lagsweep', 'cleanlag'],
  description: 'Manages entity lag sweeps to clear dropped items and reduce server lag.',
  category: 'Administration',
  permissionNode: 'cmd.clearlag.admin',
  allowConsole: true,
  parameters: [
    { name: 'action', type: 'string', optional: true, description: 'run | info | cancel' },
    { name: 'arg', type: 'string', optional: true, description: 'Optional countdown in seconds or "now"' },
  ],
  execute: (executor: CommandExecutor, args: ClearLagArgs) => {
    const action = args.action?.toLowerCase() ?? 'run';

    if (action === 'info' || action === 'count' || action === 'status') {
      const counts = queryWorldEntityCounts();
      sendMessage('§6=== ClearLag World Entity Status ===', executor);
      sendMessage(` §7• Dropped Items: §e${counts.items}`, executor);
      sendMessage(` §7• Hostile Mobs: §c${counts.hostile}`, executor);
      sendMessage(` §7• Passive Mobs: §a${counts.passive}`, executor);
      sendMessage(` §7• Total Entities: §b${counts.total}`, executor);
      return;
    }

    if (action === 'cancel' || action === 'stop') {
      if (cancelPendingSweep()) {
        sendMessage('§a[ClearLag] Pending entity sweep was cancelled.', executor);
      } else {
        sendMessage('§7[ClearLag] No sweep countdown is currently active.', executor);
      }
      return;
    }

    if (action === 'run' || action === 'sweep' || action === 'start') {
      if (isPendingSweep()) {
        sendMessage('§e[ClearLag] A sweep countdown is already in progress. Use /clearlag cancel to abort.', executor);
        return;
      }

      let countdown = 30;
      if (args.arg?.toLowerCase() === 'now' || args.arg === '0') {
        countdown = 0;
      } else if (typeof args.arg === 'string' && !Number.isNaN(Number(args.arg))) {
        countdown = Math.max(0, Math.min(300, Number(args.arg)));
      }

      startSweepCountdown(countdown, (stats) => {
        sendMessage(
          `§a[ClearLag] Sweep finished: §e${stats.items}§7 items, §e${stats.experienceOrbs}§7 XP orbs, §e${stats.hostileMobs}§7 mobs removed.`,
          executor,
        );
      });
      return;
    }

    sendMessage('§cUsage: /clearlag [run [now|seconds] | info | cancel]', executor);
  },
};

export default [clearLagCommand];
