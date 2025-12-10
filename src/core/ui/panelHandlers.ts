import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { addSentryBreadcrumb } from '@core/diagnostics.js';
import { panelRouter } from './PanelRouter.js';
import { UIContext } from './types.js';

export async function handleFormResponse(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    addSentryBreadcrumb(`UI Interaction: ${panelId} by ${player.name}`, 'ui', 'info');
    // 1. Router Check (Modular System)
    const handler = panelRouter.getHandler(panelId);
    if (handler && handler.handleResponse) {
        return handler.handleResponse(player, panelId, response, context);
    }
}
