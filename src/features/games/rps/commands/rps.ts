import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { resolveSingleOnlineTarget } from '@core/utils/index.js';
import { handleCommonGameSubcommand, sendGameInvite } from '@features/games/matchmakingManager.js';
import { startRpsBotMatch } from '@features/games/rps/manager.js';
import { showRpsMatchPanel, showRpsMenu } from '@features/games/rps/ui/panel.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const rpsCommand: CustomCommand = {
  name: 'rps',
  aliases: ['rockpaperscissors'],
  description: 'Play multiplayer or solo Rock Paper Scissors.',
  category: 'Games',
  permissionNode: 'cmd.rps.member',
  parameters: [
    { name: 'actionOrFriend', type: 'string', optional: true },
    { name: 'wagerOrPlayer', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { actionOrFriend?: string; wagerOrPlayer?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const gamesCfg = getGamesConfig();
    if (!gamesCfg.enabled || gamesCfg.rps?.enabled === false) {
      executor.sendMessage('§cRock Paper Scissors is currently disabled.');
      return;
    }

    const firstArg = args.actionOrFriend;
    const secondArg = args.wagerOrPlayer;

    if (!isNonEmptyString(firstArg)) {
      await showRpsMenu(executor);
      return;
    }

    const sub = firstArg.toLowerCase();

    if (sub === 'bot' || sub === 'solo' || sub === 'ai') {
      const match = startRpsBotMatch(executor);
      await showRpsMatchPanel(executor, match.id);
      return;
    }

    if (handleCommonGameSubcommand(executor, 'rps', sub, secondArg)) {
      return;
    }

    const targetName = sub === 'invite' && isNonEmptyString(secondArg) ? secondArg : firstArg;
    const wagerVal = sub === 'invite' ? 0 : isNonEmptyString(secondArg) ? Number.parseFloat(secondArg) : 0;

    const resolved = resolveSingleOnlineTarget(targetName, executor, {
      selfErrorMessage: '§cYou cannot challenge yourself.',
    });
    if (resolved.error || !resolved.player) {
      executor.sendMessage(resolved.error ?? '§cPlayer not found.');
      return;
    }

    const res = sendGameInvite(executor, resolved.player, 'rps', Number.isNaN(wagerVal) ? 0 : wagerVal);
    executor.sendMessage(res.message);
  },
};

export default rpsCommand;
