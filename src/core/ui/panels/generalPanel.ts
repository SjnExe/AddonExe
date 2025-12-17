import * as mc from '@minecraft/server';
import { ActionFormResponse } from '@minecraft/server-ui';

import { getConfig } from '@core/configManager.js';
import { getPlayerRank } from '@core/rankManager.js';
import { showPanel } from '@core/uiManager.js';
import { handleUIAction } from '@ui/actions.js';
import { getStaticMenuItems } from '@ui/panelBuilder.js';
import { panelDefinitions, PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';

export class GeneralPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'mainPanel' ||
            panelId === 'gameplayPanel' ||
            panelId === 'bountyActionsPanel' ||
            panelId === 'bountyListPanel'
        );
    }

    getItems(player: mc.Player, panelId: string, _context: UIContext): Promise<PanelItem[]> {
        const items: PanelItem[] = [];
        const def = panelDefinitions[panelId];
        if (def) {
            const config = getConfig();
            const rank = getPlayerRank(player, config);
            const staticItems = getStaticMenuItems(def, rank.permissionLevel);
            items.push(...staticItems);
        }
        return Promise.resolve(items);
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse,
        context: UIContext
    ): Promise<void> {
        if (response.canceled || response.selection === undefined) return;

        const items = await this.getItems(player, panelId, context);
        if (response.selection >= 0 && response.selection < items.length) {
            const item = items[response.selection];
            if (!item) return;
            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
            if (item.actionType === 'functionCall') {
                return handleUIAction(player, item.actionValue, context);
            }
        }
    }
}
