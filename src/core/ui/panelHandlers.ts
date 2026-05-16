import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { panelRouter } from '@ui/PanelRouter.js';
import { UIContext } from '@ui/types.js';

export async function handleFormResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext) {
    // 1. Router Check (Modular System)
    const handler = panelRouter.getHandler(panelId);
    if (handler && handler.handleResponse) {
        return handler.handleResponse(player, panelId, response, context);
    }
}
