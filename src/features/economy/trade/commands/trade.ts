import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getConfig } from '@core/config/configManager.js';
import { validateCurrencyAmount } from '@core/utils/economy.js';
import { resolveTarget } from '@core/utils/index.js';
import {
  acceptTradeOffer,
  cancelTradeOffer,
  createTradeOffer,
  denyTradeOffer,
} from '@features/economy/trade/manager.js';
import { resolveTradeItemDisplayName } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { EntityComponentTypes } from '@minecraft/server';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';

export async function showCreateTradeModal(sender: mc.Player, target: mc.Player): Promise<void> {
  const inv = (sender.getComponent(EntityComponentTypes.Inventory) as mc.EntityInventoryComponent | undefined)
    ?.container;
  const held = inv?.getItem(sender.selectedSlotIndex);
  const heldLabel = isDefined(held)
    ? `Include My Held Item (${resolveTradeItemDisplayName(held.typeId)} x${held.amount})`
    : 'Include My Held Item (None currently held)';

  const modal = new CustomFormBuilder<{
    includeHeld: boolean;
    offerMoney: string;
    requireTargetItem: boolean;
    requestMoney: string;
  }>(`Trade with ${target.name}`)
    .toggle('includeHeld', heldLabel, isDefined(held))
    .textField('offerMoney', 'Money to Offer', '0', '0')
    .toggle('requireTargetItem', `Require ${target.name}'s Held Item`, false)
    .textField('requestMoney', `Money to Request from ${target.name}`, '0', '0')
    .submitButton('Send Trade Offer');

  const res = await modal.show(sender);
  if (!res) {
    return;
  }

  const offerMoney = validateCurrencyAmount(res.offerMoney.trim() || '0', false);
  const requestMoney = validateCurrencyAmount(res.requestMoney.trim() || '0', false);

  if (!isDefined(offerMoney) || !isDefined(requestMoney)) {
    sender.sendMessage('§cInvalid money amount in trade offer.');
    return;
  }

  const out = createTradeOffer(sender, target, {
    offerMoney,
    includeHeldItem: res.includeHeld,
    requestMoney,
    requireTargetHeldItem: res.requireTargetItem,
  });
  sender.sendMessage(out.message);
}

const tradeCommand: CustomCommand = {
  name: 'trade',
  description: 'Send or respond to a safe player-to-player item/money trade.',
  category: 'Economy',
  permissionNode: 'cmd.trade.member',
  parameters: [{ name: 'targetOrAction', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { targetOrAction?: string }) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }

    const cfg = getConfig();
    if (!cfg.trading?.enabled) {
      executor.sendMessage('§cPlayer trading (/trade) is currently disabled.');
      return;
    }

    const arg = args.targetOrAction?.trim();
    if (!isNonEmptyString(arg)) {
      executor.sendMessage('§cUsage: /trade <player|accept|deny|cancel>');
      return;
    }

    const sub = arg.toLowerCase();
    if (sub === 'accept' || sub === 'yes') {
      executor.sendMessage(acceptTradeOffer(executor).message);
      return;
    }
    if (sub === 'deny' || sub === 'no' || sub === 'decline') {
      executor.sendMessage(denyTradeOffer(executor).message);
      return;
    }
    if (sub === 'cancel') {
      executor.sendMessage(cancelTradeOffer(executor).message);
      return;
    }

    const target = resolveTarget(arg, executor)[0];
    if (!isDefined(target)) {
      executor.sendMessage(`§cPlayer '${arg}' not found.`);
      return;
    }

    await showCreateTradeModal(executor, target);
  },
};

export default tradeCommand;
