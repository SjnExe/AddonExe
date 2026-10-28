import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { resolveTarget } from '@core/utils/index.js';
import { showConnect4Menu } from '@features/games/connect4/ui/panel.js';
import { handleCommonGameSubcommand, sendGameInvite } from '@features/games/matchmakingManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const connect4Command: CustomCommand = {
  name: 'connect4',
  aliases: ['c4'],
  description: 'Play 2-player 7x6 Connect 4.',
  category: 'Games',
  permissionNode: 'cmd.connect4.member',
  parameters: [
    { name: 'actionOrFriend', type: 'string', optional: true },
    { name: 'wagerOrPlayer', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { actionOrFriend?: string; wagerOrPlayer?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.connect4?.enabled === false) {
      executor.sendMessage('§cConnect 4 is currently disabled.');
      return;
    }

    const first = args.actionOrFriend?.trim();
    const second = args.wagerOrPlayer?.trim();

    if (!isNonEmptyString(first)) {
      await showConnect4Menu(executor);
      return;
    }

    const sub = first.toLowerCase();
    if (handleCommonGameSubcommand(executor, 'connect4', sub, second)) {
      return;
    }

    const targetName = sub === 'invite' && isNonEmptyString(second) ? second : first;
    const wagerVal = sub === 'invite' ? 0 : isNonEmptyString(second) ? Number.parseFloat(second) : 0;
    const target = resolveTarget(targetName, executor)[0];
    if (!isDefined(target)) {
      executor.sendMessage(`§cPlayer '${targetName}' is not online.`);
      return;
    }

    executor.sendMessage(sendGameInvite(executor, target, 'connect4', Number.isNaN(wagerVal) ? 0 : wagerVal).message);
  },
};

export default connect4Command;
