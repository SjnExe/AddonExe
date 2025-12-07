import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getPlayer } from '../playerDataManager.js';
import { showPanel } from '../uiManager.js';

import { panelRouter } from './PanelRouter.js';
import { handleUIAction } from './actions.js';
import { handleAdminPanel } from './handlers/adminHandlers.js';
import { handleCommandPanel } from './handlers/commandHandlers.js';
import { handleConfigPanel } from './handlers/configHandlers.js';
import { handleEconomyPanel } from './handlers/economyHandlers.js';
import { handleGameplayPanel } from './handlers/gameplayHandlers.js';
import { handleKitPanel } from './handlers/kitHandlers.js';
import { handleMiscPanel } from './handlers/miscHandlers.js';
import { handlePlayerPanel } from './handlers/playerHandlers.js';
import { handleRankPanel } from './handlers/rankHandlers.js';
import { handleShopPanel } from './handlers/shopHandlers.js';
import { handleSidebarPanel } from './handlers/sidebarHandlers.js';
import { handleTeamPanel } from './handlers/teamHandlers.js';
import { handleXrayPanel } from './handlers/xrayHandlers.js';
import { getPanelItems, getVisiblePlayerActionItems } from './panelBuilder.js';
import { panelDefinitions } from './panelRegistry.js';
import { PanelItem, UIContext } from './types.js';

export async function handleFormResponse(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const pData = getPlayer(player.id);
    if (!pData) {
        return;
    }

    // Implicit default page to 1 to prevent leakage
    if (context.page === undefined) context.page = 1;

    // Helper properties
    const selection = (response as ActionFormResponse).selection;

    // 1. Router Check (Modular System)
    const handler = panelRouter.getHandler(panelId);
    if (handler && handler.handleResponse) {
        return handler.handleResponse(player, panelId, response, context);
    }

    // --- Specialized Handlers (Complex Systems / Modals) ---
    // These handlers often handle both Action and Modal forms, or have complex logic not yet ported to actions.ts
    // We check them FIRST if they need to override generic logic, OR we check them LAST if we want generic logic to take precedence for buttons.
    // Given the refactor, we want Generic Logic to handle Buttons (ActionForms) whenever possible to ensure ID matching.

    const isShop = panelId.startsWith('shop');
    const isTeam = panelId.startsWith('team');
    const isSidebar = panelId.startsWith('sidebar') || panelId.startsWith('actionBar');
    const isKit = panelId.startsWith('kit');
    const isRank = panelId.startsWith('rank');
    const isCmd = panelId.startsWith('command');
    const isXray = panelId.startsWith('xray');
    const isEco = panelId === 'mobDropsSystemPanel' || panelId.startsWith('addMob') || panelId.startsWith('editMob') || panelId === 'economyPanel';
    const isConfig = panelId.startsWith('config'); // Handles configCategoryPanel and Modals

    // --- Generic Headless Handler (Button Matching) ---
    // If it's a button click (selection is number), we try to resolve it via getPanelItems.
    if (typeof selection === 'number') {
        let items: PanelItem[] = [];

        if (panelId === 'playerActionsPanel') {
            items = getVisiblePlayerActionItems(context, pData.permissionLevel, player.id);
        } else {
            // Attempt to get items from builder
            items = await getPanelItems(player, panelId, context);
        }

        if (items.length > 0) {
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, { ...context, page: Math.max(1, (context.page || 1) - 1) });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: (context.page || 1) + 1 });
                }

                if (item.actionType === 'openPanel') {
                    // Inject item ID as selectedItemId AND id (legacy support)
                    return showPanel(player, item.actionValue, {
                        ...context,
                        page: 1,
                        selectedItemId: item.id,
                        id: item.id
                    });
                } else if (item.actionType === 'functionCall') {
                    // Inject item ID into context
                    await handleUIAction(player, item.actionValue, { ...context, selectedItemId: item.id, id: item.id });
                    return;
                }
            }
            // If selection was valid number but no action matched? (Shouldn't happen if items match)
            // But if we found items and handled the button, we return.
            // If items.length > 0 but we didn't return above (e.g. logic error?), fall through.
        }
    }

    // --- Fallback / Modal Delegation ---

    if (isShop) return handleShopPanel(player, panelId, response, context);
    if (isSidebar) return handleSidebarPanel(player, panelId, response, context);
    if (isTeam) return handleTeamPanel(player, panelId, response, context);
    if (isKit) return handleKitPanel(player, panelId, response, context);
    if (isRank) return handleRankPanel(player, panelId, response, context);
    if (isCmd) return handleCommandPanel(player, panelId, response, context);
    if (isXray) return handleXrayPanel(player, panelId, response, context);
    if (isEco) return handleEconomyPanel(player, panelId, response, context);
    if (isConfig) return handleConfigPanel(player, panelId, response, context);

    // --- Core Systems Fallback ---
    if (panelId.startsWith('player')) {
        return handlePlayerPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('floating') || panelId.startsWith('report')) {
        return handleAdminPanel(player, panelId, response, context);
    }
    if (
        panelId.startsWith('rules') ||
        panelId.startsWith('helpfulLink') ||
        panelId.startsWith('addRule') ||
        panelId.startsWith('addHelpful') ||
        panelId.startsWith('ruleAction')
    ) {
        return handleMiscPanel(player, panelId, response, context);
    }
    if (panelId === 'bountyListPanel') {
        return handleGameplayPanel(player, panelId, response, context);
    }
}
