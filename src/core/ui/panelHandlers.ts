import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { showPanel } from '@core/uiManager.js';
import { panelRouter } from '@ui/PanelRouter.js';
import { UIContext } from '@ui/types.js';

export async function handleFormResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext) {
    // 1. Router Check (Modular System)
    const handler = panelRouter.getHandler(panelId);
    if (handler && handler.handleResponse) {
        // Global check for disabled items in ActionFormData dynamically built lists
        if (!response.canceled && 'selection' in response && response.selection !== undefined && handler.getItems) {
            const items = await handler.getItems(player, panelId, context);
            if (items && items[response.selection] && items[response.selection].text.includes('[§4Disabled]')) {
                player.sendMessage('§cThis feature is currently disabled.');
                return showPanel(player, panelId, context);
            }
        }

        return handler.handleResponse(player, panelId, response, context);
    }
}
