import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getEconomyConfig } from '@core/config/configurations.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { parseCurrency } from '@core/utils/index.js';
import { sendMessage } from '@core/utils/messaging.js';
import { cancelBuyOrder, createBuyOrder, fulfillBuyOrder, getBuyOrders } from '@features/economy/orders/manager.js';
import { showBuyOrdersPanel } from '@features/economy/orders/ui/panel.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const ordersCommand: CustomCommand = {
  name: 'orders',
  aliases: ['buyorders', 'request'],
  description: 'Open the Buy Orders board or create/cancel escrowed item requests.',
  category: 'Economy',
  permissionNode: 'cmd.orders.member',
  parameters: [
    {
      name: 'subcommand',
      type: 'string',
      optional: true,
      enumOptions: ['create', 'fulfill', 'cancel', 'my'],
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
    if (!isFeatureActive('eco') || ecoCfg.orders?.enabled !== true) {
      sendMessage('§cBuy Orders are currently disabled.', executor);
      return;
    }

    const sub = args.subcommand?.toLowerCase();
    if (!isNonEmptyString(sub)) {
      await showBuyOrdersPanel(executor);
      return;
    }

    if (sub === 'my') {
      const mine = getBuyOrders({ buyerId: executor.id });
      if (mine.length === 0) {
        sendMessage('§7You have no active buy orders.', executor);
        return;
      }
      sendMessage(
        `§eYour Buy Orders (${mine.length}):\n${mine
          .map(
            (o) =>
              `§7- §f${o.id}§7: ${o.remainingQuantity}/${o.originalQuantity}x ${o.itemDisplayName} @ ${o.unitPrice}`,
          )
          .join('\n')}`,
        executor,
      );
      return;
    }

    if (sub === 'create') {
      if (!isNonEmptyString(args.arg1) || !isNonEmptyString(args.arg2) || !isNonEmptyString(args.arg3)) {
        sendMessage('§cUsage: /orders create <itemId> <quantity> <unitPrice>', executor);
        return;
      }
      const qty = Number(args.arg2.trim());
      const unitPrice = parseCurrency(args.arg3.trim());
      const res = createBuyOrder(executor, args.arg1, qty, unitPrice);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'fulfill') {
      if (!isNonEmptyString(args.arg1)) {
        sendMessage('§cUsage: /orders fulfill <orderId> [quantity]', executor);
        return;
      }
      const qty = isNonEmptyString(args.arg2) ? Number(args.arg2.trim()) : undefined;
      const res = fulfillBuyOrder(executor, args.arg1.trim(), qty);
      sendMessage(res.message, executor);
      return;
    }

    if (sub === 'cancel') {
      if (!isNonEmptyString(args.arg1)) {
        sendMessage('§cUsage: /orders cancel <orderId>', executor);
        return;
      }
      const res = cancelBuyOrder(executor.id, args.arg1.trim());
      sendMessage(res.message, executor);
      return;
    }

    await showBuyOrdersPanel(executor);
  },
};

export default ordersCommand;
