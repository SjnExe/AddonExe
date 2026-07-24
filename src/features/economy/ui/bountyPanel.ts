import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { getConfig } from '@core/configManager.js';
import { getPlayer, incrementPlayerBalance } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';
import * as bountyManager from '@features/economy/bountyManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

export async function showBountyListPanel(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
    const page = (context.page as number) || 1;
    const form = new ActionFormBuilder().title('Bounties');

    // Debug log to ensure bounties are retrieved
    const allBounties = bountyManager.getAllBounties();
    const bounties = [...allBounties.values()].toSorted((a, b) => b.amount - a.amount);

    if (bounties.length === 0) {
        form.button('§8No active bounties', 'textures/ui/infobulb');
    } else {
        const paginated = getPaginatedItems(bounties, page);

        for (const b of paginated) {
            form.button(`${b.name}\n${formatCurrency(b.amount)}`, 'textures/items/netherite_sword', async () => {
                await showPanel(player, 'playerActionsPanel', {
                    ...context,
                    page: 1,
                    targetPlayerId: b.playerId,
                    fromPanel: 'bountyListPanel'
                });
            });
        }

        const totalItems = bounties.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        if (page < totalPages) {
            form.button('§6Next Page >', 'textures/gui/newgui/DownArrow', async () => {
                await showBountyListPanel(player, { ...context, page: page + 1 });
            });
        }
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel', context);
    });

    await form.show(player);
}

export async function showBountyPlayer(player: mc.Player, context: Record<string, unknown>): Promise<void> {
    const targetId = context.targetPlayerId as string;
    if (!isNonEmptyString(targetId)) return;

    const targetData = getPlayer(targetId);

    const myData = getPlayer(player.id);
    if (!isDefined(myData)) return showBountyListPanel(player, context);

    const form = new ModalFormBuilder<{ amount: string }>().title(`Set Bounty: ${isDefined(targetData) ? targetData.name : 'Unknown'}`).textField('amount', 'Enter bounty amount (e.g. 100, 2.5k)', '');

    const res = await form.show(player);
    if (!res) return showBountyListPanel(player, context);

    const amountStr = res.amount;
    const amount = parseCurrency(amountStr);

    if (Number.isNaN(amount) || amount <= 0) {
        player.sendMessage('§4Invalid amount. Please enter a positive number (e.g. 100, 2.5k).');
        return showBountyListPanel(player, context);
    }

    if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001) {
        player.sendMessage('§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123');
        return showBountyListPanel(player, context);
    }

    if (myData.balance < amount) {
        player.sendMessage(`§4Insufficient funds. You have ${formatCurrency(myData.balance)}.`);
        return showBountyListPanel(player, context);
    }

    incrementPlayerBalance(player.id, -amount);
    bountyManager.incrementBounty(targetId, amount);
    player.sendMessage(`§2Added bounty of ${formatCurrency(amount)} to ${targetData?.name ?? 'Unknown'}.`);

    const config = getConfig();
    const bountiesConfig = (config as { modules?: { bounties?: { announce?: boolean } } }).modules?.bounties;
    if ((bountiesConfig?.announce ?? true) === true) {
        mc.world.sendMessage(`§6[Bounty] §r${player.name} has placed a ${formatCurrency(amount)} bounty on ${isDefined(targetData) ? targetData.name : 'Unknown'}!`);
    }
    await showPanel(player, 'playerActionsPanel', context);
}

export async function showRemovePlayerBounty(player: mc.Player, context: Record<string, unknown>): Promise<void> {
    const targetId = context.targetPlayerId as string;
    if (!isNonEmptyString(targetId)) return;

    const targetBounty = bountyManager.getBounty(targetId);

    if (!isDefined(targetBounty)) {
        player.sendMessage('§4Target has no bounty.');
        return showBountyListPanel(player, context);
    }

    const form = new ModalFormBuilder<{ amount: string }>().title('Remove Bounty').textField('amount', `Current Bounty: ${formatCurrency(targetBounty.amount)}`, 'Amount to pay off');

    const res = await form.show(player);
    if (!res) return showBountyListPanel(player, context);

    const amountStr = res.amount;
    const amount = parseCurrency(amountStr);

    if (Number.isNaN(amount) || amount <= 0) {
        player.sendMessage('§4Invalid amount. Please enter a positive number (e.g. 100, 2.5k).');
        return showBountyListPanel(player, context);
    }

    if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001) {
        player.sendMessage('§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123');
        return showBountyListPanel(player, context);
    }

    if (amount > targetBounty.amount) {
        player.sendMessage(`§4You cannot remove more than the current bounty.`);
        return showBountyListPanel(player, context);
    }

    const myData = getPlayer(player.id);
    if (!isDefined(myData) || myData.balance < amount) {
        player.sendMessage(`§4Insufficient funds.`);
        return showBountyListPanel(player, context);
    }

    incrementPlayerBalance(player.id, -amount);
    bountyManager.incrementBounty(targetId, -amount);
    player.sendMessage(`§2Removed ${formatCurrency(amount)} from bounty.`);
    return showBountyListPanel(player, context);
}
