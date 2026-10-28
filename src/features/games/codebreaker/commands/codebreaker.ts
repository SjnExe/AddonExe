import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { resolveTarget } from '@core/utils/index.js';
import { startSoloCodebreaker } from '@features/games/codebreaker/manager.js';
import { showCodebreakerBoard, showCodebreakerMenu } from '@features/games/codebreaker/ui/panel.js';
import { sendGameInvite } from '@features/games/matchmakingManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const codebreakerCommand: CustomCommand = {
  name: 'codebreaker',
  aliases: ['cb', 'mastermind'],
  description: 'Play Solo or 2P Codebreaker (Mastermind).',
  category: 'Games',
  permissionNode: 'cmd.codebreaker.member',
  parameters: [
    { name: 'actionOrFriend', type: 'string', optional: true },
    { name: 'wager', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { actionOrFriend?: string; wager?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.codebreaker?.enabled === false) {
      executor.sendMessage('§cCodebreaker is currently disabled.');
      return;
    }

    const first = args.actionOrFriend?.trim();
    if (!isNonEmptyString(first)) {
      await showCodebreakerMenu(executor);
      return;
    }

    if (first.toLowerCase() === 'solo') {
      startSoloCodebreaker(executor);
      await showCodebreakerBoard(executor);
      return;
    }

    const target = resolveTarget(first, executor)[0];
    if (!isDefined(target)) {
      executor.sendMessage(`§cPlayer '${first}' is not online.`);
      return;
    }

    const wager = isNonEmptyString(args.wager) ? Number.parseFloat(args.wager) : 0;
    executor.sendMessage(sendGameInvite(executor, target, 'codebreaker', Number.isNaN(wager) ? 0 : wager).message);
  },
};

export default codebreakerCommand;
