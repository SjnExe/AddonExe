import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getOrCreatePlayer } from '../../../core/playerDataManager.js';
import { getStaticMenuItems } from '../../../core/ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '../../../core/ui/panelRegistry.js';
import { IPanelHandler } from '../../../core/ui/types.js';
import { showPanel } from '../../../core/uiManager.js';

export class EconomyPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'economyPanel';
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const pData = getOrCreatePlayer(player);
        const items = getStaticMenuItems(panelDefinitions[panelId], pData.permissionLevel);

        // Add Back button manually if getStaticMenuItems didn't?
        // getStaticMenuItems adds it if parentPanelId is set.
        // economyPanel parent is configCategoryPanel.
        // So it's handled.

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
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                }
            }
        }
    }
}
