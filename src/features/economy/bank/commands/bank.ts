import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { economyDisabled } from '@core/utils/constants.js';
import { validateCurrencyAmount } from '@core/utils/economy.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  claimOrBreakFixedDeposit,
  createFixedDeposit,
  depositToSavings,
  ensurePlayerBankState,
  formatPlayerBankOverview,
  withdrawFromSavings,
} from '@features/economy/bank/manager.js';
import { showBankMainPanel } from '@features/economy/bank/ui/panel.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const bankCommand: CustomCommand = {
  name: 'bank',
  aliases: ['b', 'vault'],
  description: 'Manage your Bank Savings Account (AMB interest) and Fixed Deposits via command or UI.',
  category: 'Economy',
  permissionNode: 'cmd.bank.member',
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['info', 'deposit', 'withdraw', 'fd', 'ui'],
    },
    { name: 'arg1', type: 'string', optional: true },
    { name: 'arg2', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { action?: string; arg1?: string; arg2?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    if (!isFeatureActive('eco') || !isFeatureActive('eco.bank')) {
      sendMessage(economyDisabled, executor);
      return;
    }

    const action = isNonEmptyString(args.action) ? args.action.trim().toLowerCase() : 'info';
    const arg1 = args.arg1?.trim();
    const arg2 = args.arg2?.trim();

    if (action === 'ui' || action === 'menu') {
      await showBankMainPanel(executor);
      return;
    }

    if (action === 'info' || action === 'status' || action === 'bal' || action === 'balance') {
      sendMessage(formatPlayerBankOverview(executor), executor);
      return;
    }

    if (action === 'deposit' || action === 'dep' || action === 'd') {
      if (!isNonEmptyString(arg1)) {
        sendMessage('§cUsage: /bank deposit <amount|all>', executor);
        return;
      }
      const amt =
        arg1.toLowerCase() === 'all' ? getOrCreatePlayer(executor).balance : validateCurrencyAmount(arg1, true);
      if (!isDefined(amt)) {
        sendMessage('§cInvalid deposit amount.', executor);
        return;
      }
      sendMessage(depositToSavings(executor, amt).message, executor);
      return;
    }

    if (action === 'withdraw' || action === 'with' || action === 'w') {
      if (!isNonEmptyString(arg1)) {
        sendMessage('§cUsage: /bank withdraw <amount|all>', executor);
        return;
      }
      const amt =
        arg1.toLowerCase() === 'all'
          ? ensurePlayerBankState(executor).bank.savingsBalance
          : validateCurrencyAmount(arg1, true);
      if (!isDefined(amt)) {
        sendMessage('§cInvalid withdrawal amount.', executor);
        return;
      }
      sendMessage(withdrawFromSavings(executor, amt).message, executor);
      return;
    }

    if (action === 'fd' || action === 'cd') {
      const sub = isNonEmptyString(arg1) ? arg1.toLowerCase() : 'list';
      if (sub === 'list' || sub === 'info') {
        sendMessage(formatPlayerBankOverview(executor), executor);
        return;
      }
      if (sub === 'claim') {
        sendMessage(claimOrBreakFixedDeposit(executor, arg2, false).message, executor);
        return;
      }
      if (sub === 'break' || sub === 'cancel') {
        sendMessage(claimOrBreakFixedDeposit(executor, arg2, true).message, executor);
        return;
      }
      if (sub === 'create' || sub === 'new') {
        if (!isNonEmptyString(arg2)) {
          sendMessage('§cUsage: /bank fd create <amount> (or /bank fd <1d|3d|7d> <amount>)', executor);
          return;
        }
        const amt = validateCurrencyAmount(arg2, true);
        if (!isDefined(amt)) {
          sendMessage('§cInvalid Fixed Deposit amount.', executor);
          return;
        }
        sendMessage(createFixedDeposit(executor, amt, '1d').message, executor);
        return;
      }
      if (sub === '1d' || sub === '3d' || sub === '7d') {
        if (!isNonEmptyString(arg2)) {
          sendMessage(`§cUsage: /bank fd ${sub} <amount>`, executor);
          return;
        }
        const amt = validateCurrencyAmount(arg2, true);
        if (!isDefined(amt)) {
          sendMessage('§cInvalid Fixed Deposit amount.', executor);
          return;
        }
        sendMessage(createFixedDeposit(executor, amt, sub).message, executor);
        return;
      }

      const directAmt = validateCurrencyAmount(sub, true);
      if (isDefined(directAmt)) {
        const plan = arg2 === '3d' || arg2 === '7d' ? arg2 : '1d';
        sendMessage(createFixedDeposit(executor, directAmt, plan).message, executor);
        return;
      }

      sendMessage('§cUsage: /bank fd <1d|3d|7d|claim|break|list> [amountOrId]', executor);
      return;
    }

    sendMessage('§cUsage: /bank [info|deposit|withdraw|fd|ui] [amount|subcommand] [planOrAmount]', executor);
  },
};

export default bankCommand;
