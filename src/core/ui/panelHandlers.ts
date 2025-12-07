import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getPlayer } from '../playerDataManager.js';
import { showPanel } from '../uiManager.js';

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

    // Helper properties with type guards implicitly handled by usage context
    const selection = (response as ActionFormResponse).selection;

    // Generic handler for registry-defined panels
    const panelDef = panelDefinitions[panelId];

    // Check if we should use the Generic Handler
    if (
        panelDef &&
        !panelId.startsWith('shop') &&
        !panelId.startsWith('team') &&
        !panelId.startsWith('floating') &&
        !panelId.startsWith('rules') &&
        !panelId.startsWith('helpfulLinks') &&
        !panelId.startsWith('config') &&
        !panelId.startsWith('xray')
    ) {
        let items: PanelItem[] = [];
        // Use the HEADLESS BUILDER to get the exact items
        if (panelId === 'playerActionsPanel') {
            items = getVisiblePlayerActionItems(context, pData.permissionLevel, player.id);
        } else {
            items = await getPanelItems(player, panelId, context);
        }

        if (typeof selection === 'number') {
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                if (item.actionType === 'openPanel') {
                    // Pass current context (including targetPlayerId etc) forward
                    // IMPORTANT: Reset page to 1 for new panel unless specified
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                } else if (item.actionType === 'functionCall') {
                    // Inject item ID into context for actions like unblockPlayer
                    await handleUIAction(player, item.actionValue, { ...context, selectedItemId: item.id });
                    return;
                }
            }
        }
    }

    // Delegate to specialized handlers

    // --- Complex Systems ---
    if (panelId.startsWith('shop')) {
        return handleShopPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('sidebar') || panelId.startsWith('actionBar')) {
        return handleSidebarPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('team')) {
        return handleTeamPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('kit')) {
        return handleKitPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('rank')) {
        return handleRankPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('command')) {
        return handleCommandPanel(player, panelId, response, context);
    }
    if (panelId.startsWith('xray')) {
        return handleXrayPanel(player, panelId, response, context);
    }
    if (
        panelId === 'mobDropsSystemPanel' ||
        panelId.startsWith('addMob') ||
        panelId.startsWith('editMob') ||
        panelId === 'economyPanel'
    ) {
        return handleEconomyPanel(player, panelId, response, context);
    }

    // --- Core Systems ---
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

    // --- Config Catch-All ---
    // (Handles configCategoryPanel, configResetPanel, and any panelId starting with 'config_')
    if (panelId.startsWith('config')) {
        return handleConfigPanel(player, panelId, response, context);
    }
}
