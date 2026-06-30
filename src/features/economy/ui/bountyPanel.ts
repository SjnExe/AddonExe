import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { getPlayer, incrementPlayerBalance } from '@core/playerDataManager.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency, parseCurrency, uiWait } from '@core/utils.js';
import * as bountyManager from '@features/economy/bountyManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

export class BountyPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'bountyListPanel';
    }

    async getItems(_player: mc.Player, _panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [
            {
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'economyMainPanel'
            }
        ];

        // Debug log to ensure bounties are retrieved
        const allBounties = bountyManager.getAllBounties();
        const bounties = [...allBounties.values()].toSorted((a, b) => b.amount - a.amount);

        // If empty, show a visual indicator item
        if (bounties.length === 0) {
            items.push({
                id: 'no_bounties',
                text: '§8No active bounties',
                icon: 'textures/ui/info_icon',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'noop' // Does nothing
            });
            return items;
        }

        const paginated = getPaginatedItems(bounties, (context.page as number) || 1);

        for (const b of paginated) {
            items.push({
                id: b.playerId,
                text: `${b.name}\n${formatCurrency(b.amount)}`,
                icon: 'textures/items/netherite_sword',
                permission: 'ui.panel.member',
                actionType: 'openPanel',
                actionValue: 'playerActionsPanel'
            });
        }

        const totalItems = bounties.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const page = (context.page as number) || 1;

        if (page > 1) {
            items.push({
                id: '__prev__',
                text: '§6< Previous Page',
                icon: 'textures/ui/arrow_left.png',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'prevPage'
            });
        }
        if (page < totalPages) {
            items.push({
                id: '__next__',
                text: '§6Next Page >',
                icon: 'textures/ui/arrow_right.png',
                permission: 'ui.panel.member',
                actionType: 'functionCall',
                actionValue: 'nextPage'
            });
        }

        return items;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (!item) return;

                if (item.actionValue === 'noop') return; // Do nothing for informational items

                if (item.actionType === 'openPanel') {
                    if (item.actionValue === 'playerActionsPanel') {
                        // Pass the target player ID
                        return showPanel(player, item.actionValue, {
                            ...context,
                            page: 1,
                            targetPlayerId: item.id,
                            fromPanel: 'bountyListPanel'
                        });
                    }
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                }

                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, {
                        ...context,
                        page: Math.max(1, ((context.page as number) || 1) - 1)
                    });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }

                if (item.actionValue === 'bountyPlayer') {
                    await this.handleBountyPlayer(player, context);
                    return;
                }
                if (item.actionValue === 'removePlayerBounty') {
                    await this.handleRemovePlayerBounty(player, context);
                    return;
                }
            }
        }
    }

    private async handleBountyPlayer(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const targetData = getPlayer(targetId);

        const myData = getPlayer(player.id);
        if (!isDefined(myData)) return showPanel(player, 'bountyActionsPanel', context);

        const form = new ModalFormData().title(`Set Bounty: ${isDefined(targetData) ? targetData.name : 'Unknown'}`).textField('Amount', 'Enter bounty amount (e.g. 100, 2.5k)');

        const res = await uiWait(player, form);
        if (isDefined(res) && res.canceled === true) return showPanel(player, 'bountyActionsPanel', context);

        const values = (res as import('@minecraft/server-ui').ModalFormResponse).formValues;
        if (!isDefined(values)) return showPanel(player, 'bountyActionsPanel', context);

        const [amountStr] = values as [string];
        const amount = parseCurrency(amountStr);

        if (Number.isNaN(amount) || amount <= 0) {
            player.sendMessage('§4Invalid amount. Please enter a positive number (e.g. 100, 2.5k).');
            return showPanel(player, 'bountyActionsPanel', context);
        }

        if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001) {
            player.sendMessage('§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123');
            return showPanel(player, 'bountyActionsPanel', context);
        }

        if (myData.balance < amount) {
            player.sendMessage(`§4Insufficient funds. You have ${formatCurrency(myData.balance)}.`);
            return showPanel(player, 'bountyActionsPanel', context);
        }

        incrementPlayerBalance(player.id, -amount);
        bountyManager.incrementBounty(targetId, amount);
        player.sendMessage(`§2Added bounty of ${formatCurrency(amount)} to ${targetData?.name ?? 'Unknown'}.`);

        const config = getConfig();
        const bountiesConfig = (config as { modules?: { bounties?: { announce?: boolean } } }).modules?.bounties;
        if ((bountiesConfig?.announce ?? true) === true) {
            mc.world.sendMessage(`§6[Bounty] §r${player.name} has placed a ${formatCurrency(amount)} bounty on ${isDefined(targetData) ? targetData.name : 'Unknown'}!`);
        }
        return showPanel(player, 'playerActionsPanel', context);
    }

    private async handleRemovePlayerBounty(player: mc.Player, context: UIContext): Promise<void> {
        const targetId = context.targetPlayerId as string;
        if (!isNonEmptyString(targetId)) return;

        const targetBounty = bountyManager.getBounty(targetId);

        if (!isDefined(targetBounty)) {
            player.sendMessage('§4Target has no bounty.');
            return showPanel(player, 'bountyActionsPanel', context);
        }

        const form = new ModalFormData().title('Remove Bounty').textField(`Current Bounty: ${formatCurrency(targetBounty.amount)}`, 'Amount to pay off');

        const res = await uiWait(player, form);
        if (isDefined(res) && res.canceled === true) return showPanel(player, 'bountyActionsPanel', context);

        const values = (res as import('@minecraft/server-ui').ModalFormResponse).formValues;
        if (!isDefined(values)) return showPanel(player, 'bountyActionsPanel', context);

        const [amountStr] = values as [string];
        const amount = parseCurrency(amountStr);

        if (Number.isNaN(amount) || amount <= 0) {
            player.sendMessage('§4Invalid amount. Please enter a positive number (e.g. 100, 2.5k).');
            return showPanel(player, 'bountyActionsPanel', context);
        }

        if (Math.abs(amount - Number.parseFloat(amount.toFixed(2))) > 0.001) {
            player.sendMessage('§cInvalid precision. You can only use up to 2 decimal places.\n§eAllowed: 10.55, 100\n§cNot Allowed: 10.555, 20.123');
            return showPanel(player, 'bountyActionsPanel', context);
        }

        if (amount > targetBounty.amount) {
            player.sendMessage(`§4You cannot remove more than the current bounty.`);
            return showPanel(player, 'bountyActionsPanel', context);
        }

        const myData = getPlayer(player.id);
        if (!isDefined(myData) || myData.balance < amount) {
            player.sendMessage(`§4Insufficient funds.`);
            return showPanel(player, 'bountyActionsPanel', context);
        }

        incrementPlayerBalance(player.id, -amount);
        bountyManager.incrementBounty(targetId, -amount);
        player.sendMessage(`§2Removed ${formatCurrency(amount)} from bounty.`);
        return showPanel(player, 'bountyActionsPanel', context);
    }
}
