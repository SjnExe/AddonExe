import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/config/configurations.js';
import { validateCurrencyAmount } from '@core/utils/economy.js';
import { resolveTarget } from '@core/utils/index.js';
import { broadcastRandomCoinFlip, type CoinSide, playSoloWagerCoinFlip } from '@features/games/coinflip/manager.js';
import { showCoinFlipMenu } from '@features/games/coinflip/ui/panel.js';
import { handleCommonGameSubcommand, sendGameInvite } from '@features/games/matchmakingManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const coinFlipCommand: CustomCommand = {
  name: 'coinflip',
  aliases: ['cf', 'flip'],
  description: 'Flip a random 50/50 coin in chat, wager solo, or challenge a player.',
  category: 'Games',
  permissionNode: 'cmd.coinflip.member',
  parameters: [
    { name: 'sideOrTarget', type: 'string', optional: true },
    { name: 'wagerOrPlayer', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { sideOrTarget?: string; wagerOrPlayer?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getGamesConfig();
    if (!cfg.enabled || cfg.coinFlip?.enabled === false) {
      executor.sendMessage('§cCoin Flip is currently disabled.');
      return;
    }

    const first = args.sideOrTarget?.trim();
    const second = args.wagerOrPlayer?.trim();

    if (!isNonEmptyString(first)) {
      const res = broadcastRandomCoinFlip(executor);
      if (!res.success && isNonEmptyString(res.message)) {
        executor.sendMessage(res.message);
      }
      return;
    }

    const sub = first.toLowerCase();

    if (sub === 'ui' || sub === 'menu') {
      await showCoinFlipMenu(executor);
      return;
    }

    if (sub === 'heads' || sub === 'h' || sub === 'tails' || sub === 't') {
      const side: CoinSide = sub.startsWith('t') ? 'tails' : 'heads';
      if (!isNonEmptyString(second)) {
        const res = broadcastRandomCoinFlip(executor, side);
        if (!res.success && isNonEmptyString(res.message)) {
          executor.sendMessage(res.message);
        }
        return;
      }
      const wager = validateCurrencyAmount(second, true);
      if (!isDefined(wager)) {
        executor.sendMessage('§cInvalid wager amount.');
        return;
      }
      const res = playSoloWagerCoinFlip(executor, side, wager);
      if (!res.success && isNonEmptyString(res.message)) {
        executor.sendMessage(res.message);
      }
      return;
    }

    if (handleCommonGameSubcommand(executor, 'coinflip', sub, second)) {
      return;
    }

    const targetName = sub === 'invite' && isNonEmptyString(second) ? second : first;
    const wagerVal = sub === 'invite' ? 0 : isNonEmptyString(second) ? (validateCurrencyAmount(second, false) ?? 0) : 0;

    const targets = resolveTarget(targetName, executor);
    const targetPlayer = targets[0];
    if (!isDefined(targetPlayer)) {
      executor.sendMessage(`§cPlayer '${targetName}' is not online.`);
      return;
    }

    const res = sendGameInvite(executor, targetPlayer, 'coinflip', wagerVal);
    executor.sendMessage(res.message);
  },
};

export default coinFlipCommand;
