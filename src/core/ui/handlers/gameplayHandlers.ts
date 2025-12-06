/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import * as bountyManager from '../../bountyManager.js';
import { showPanel } from '../../uiManager.js';
import { UIContext } from '../panelRegistry.js';
import { getPaginatedItems, itemsPerPage } from '../uiUtils.js';

export async function handleGameplayPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;

    if (panelId === 'bountyListPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'mainPanel', context);

        const allBounties = Array.from(bountyManager.getAllBounties().entries())
            .map(([id, val]) => ({ ...val, targetId: id }))
            .sort((a, b) => b.amount - a.amount);

        const hasPrev = page > 1;
        let buttonIndex = selection - 1;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }

        const paginatedBounties = getPaginatedItems(allBounties, page);
        if (buttonIndex >= 0 && buttonIndex < paginatedBounties.length) {
            const bounty = paginatedBounties[buttonIndex];
            return showPanel(player, 'playerActionsPanel', {
                ...context,
                targetPlayerId: bounty.targetId,
                targetPlayerName: bounty.name,
                fromPanel: 'bountyListPanel'
            });
        }
        buttonIndex -= paginatedBounties.length;

        const totalPages = Math.ceil(allBounties.length / itemsPerPage);
        if (page < totalPages && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return;
    }
}
