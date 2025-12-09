import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import * as bountyManager from '@core/bountyManager.js';
import { IPanelHandler, PanelItem, UIContext } from '@core/ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@core/ui/uiUtils.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils.js';

export class BountyPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'bountyListPanel';
    }

    async getItems(_player: mc.Player, _panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

        items.push({
            id: '__back__',
            text: '§l§8< Back',
            icon: 'textures/gui/controls/left.png',
            permissionLevel: 1024,
            actionType: 'openPanel',
            actionValue: 'gameplayPanel'
        });

        const bounties = Array.from(bountyManager.getAllBounties().values()).sort((a, b) => b.amount - a.amount);

        const paginated = getPaginatedItems(bounties, (context.page as number) || 1);

        paginated.forEach((b) => {
            items.push({
                id: b.playerId,
                text: `${b.name}\n${formatCurrency(b.amount)}`,
                icon: 'textures/items/netherite_sword',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'playerActionsPanel'
            });
        });

        const totalItems = bounties.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const page = (context.page as number) || 1;

        if (page > 1) {
            items.push({
                id: '__prev__',
                text: '§6< Previous Page',
                icon: 'textures/ui/arrow_left.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'prevPage'
            });
        }
        if (page < totalPages) {
            items.push({
                id: '__next__',
                text: '§6Next Page >',
                icon: 'textures/ui/arrow_right.png',
                permissionLevel: 1024,
                actionType: 'functionCall',
                actionValue: 'nextPage'
            });
        }

        return items;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

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
            }
        }
    }
}
