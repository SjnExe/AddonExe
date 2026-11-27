import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, parseCurrency } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import {
  cancelPlayerVoucher,
  createAdminVoucher,
  createPlayerVoucher,
  getPlayerVouchers,
  redeemVoucher,
} from '@features/economy/vouchers/manager.js';
import { showVouchersPanel } from '@features/economy/vouchers/ui/panel.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const voucherCommand: CustomCommand = {
  name: 'voucher',
  aliases: ['banknote', 'vouchers'],
  description: 'Mint, redeem, or manage server-verified economy vouchers.',
  category: 'Economy',
  permissionNode: 'cmd.voucher.member',
  parameters: [
    {
      name: 'subcommand',
      type: 'string',
      optional: true,
      enumOptions: ['create', 'redeem', 'cancel', 'list', 'admin'],
    },
    { name: 'arg1', type: 'string', optional: true },
    { name: 'arg2', type: 'string', optional: true },
    { name: 'arg3', type: 'string', optional: true },
  ],
  execute: async (
    executor: CommandExecutor,
    args: { subcommand?: string; arg1?: string; arg2?: string; arg3?: string },
  ) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const ecoCfg = getEconomyConfig();
    if (!isFeatureActive('eco') || ecoCfg.vouchers?.enabled !== true) {
      sendMessage('§cVouchers are currently disabled.', executor);
      return;
    }

    const isAdmin = hasPermission(executor, 'cmd.voucher.admin');
    const sub = args.subcommand?.toLowerCase();

    if (!isNonEmptyString(sub)) {
      await showVouchersPanel(executor, isAdmin);
      return;
    }

    if (sub === 'create') {
      if (!isNonEmptyString(args.arg1)) {
        sendMessage('§cUsage: /voucher create <amount>', executor);
        return;
      }
      const amount = parseCurrency(args.arg1.trim());
      const res = createPlayerVoucher(executor, amount);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'redeem') {
      if (!isNonEmptyString(args.arg1)) {
        sendMessage('§cUsage: /voucher redeem <code>', executor);
        return;
      }
      const res = redeemVoucher(executor, args.arg1);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'cancel') {
      if (!isNonEmptyString(args.arg1)) {
        sendMessage('§cUsage: /voucher cancel <code>', executor);
        return;
      }
      const res = cancelPlayerVoucher(executor.id, args.arg1);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'list') {
      const list = getPlayerVouchers(executor.id);
      if (list.length === 0) {
        sendMessage('§7You have no active vouchers.', executor);
        return;
      }
      sendMessage(
        `§eYour Vouchers (${list.length}):\n${list
          .map((v) => `§7- §e${v.code}§7: ${formatCurrency(v.amount)} (${v.remainingUses}/${v.maxUses} uses)`)
          .join('\n')}`,
        executor,
      );
      return;
    }

    if (sub === 'admin') {
      if (!isAdmin) {
        sendMessage('§cYou do not have permission to issue admin vouchers.', executor);
        return;
      }
      if (!isNonEmptyString(args.arg1)) {
        sendMessage('§cUsage: /voucher admin <amount> [maxUses] [expiryHours]', executor);
        return;
      }
      const amount = parseCurrency(args.arg1.trim());
      const maxUses = isNonEmptyString(args.arg2) ? Number(args.arg2.trim()) : 1;
      const expiryHours = isNonEmptyString(args.arg3) ? Number(args.arg3.trim()) : 168;
      const res = createAdminVoucher(executor, amount, maxUses, expiryHours);
      sendMessage(res.message, executor);
      return;
    }

    await showVouchersPanel(executor, isAdmin);
  },
};

export default voucherCommand;
