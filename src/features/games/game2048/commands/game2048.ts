import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { start2048Game } from '@features/games/game2048/manager.js';
import { show2048Board, show2048Menu } from '@features/games/game2048/ui/panel.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const game2048Command: CustomCommand = {
  name: '2048',
  aliases: ['play2048'],
  description: 'Play the 4x4 2048 tile-merging puzzle game.',
  category: 'Games',
  permissionNode: 'cmd.2048.member',
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['play', 'new', 'menu'],
    },
  ],
  execute: async (executor: CommandExecutor, args: { action?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.game2048?.enabled === false) {
      executor.sendMessage('§c2048 is currently disabled.');
      return;
    }

    const sub = isNonEmptyString(args.action) ? args.action.toLowerCase() : 'menu';
    if (sub === 'new') {
      start2048Game(executor);
      await show2048Board(executor);
      return;
    }
    if (sub === 'play') {
      await show2048Board(executor);
      return;
    }

    await show2048Menu(executor);
  },
};

export default game2048Command;
