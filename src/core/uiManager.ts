import * as mc from '@minecraft/server';

import { debugLog, errorLog } from './logger.js';
import { buildPanelForm } from './ui/panelBuilder.js';
import { handleFormResponse } from './ui/panelHandlers.js';
import { panelDefinitions, UIContext } from './ui/panelRegistry.js';
import * as utils from './utils.js';

/**
 * Main entry point for showing a UI panel to a player.
 * This function coordinates the building of the form, showing it to the player,
 * and handling the subsequent response.
 * @param {mc.Player} player The player to show the panel to.
 * @param {string} panelId The unique identifier for the panel to show.
 * @param {UIContext} [context={}] An optional context object to pass data between panels.
 */
export async function showPanel(player: mc.Player, panelId: string, context: UIContext = {}) {
    try {
        debugLog(`[UIManager] Showing panel '${panelId}' to ${player.name} with context: ${JSON.stringify(context)}`);

        const form = await buildPanelForm(player, panelId, context);
        if (!form) {
            debugLog(`[UIManager] buildPanelForm returned undefined for panel '${panelId}'. Aborting.`);
            return;
        }

        const response = await utils.uiWait(player, form);
        if (!response || response.canceled) {
            debugLog(`[UIManager] Panel '${panelId}' was canceled by ${player.name}.`);
            // Show the parent panel if the user cancels and a parent is defined
            const panelDef = panelDefinitions[panelId];
            if (panelDef?.parentPanelId) {
                return showPanel(player, panelDef.parentPanelId, context);
            }
            return;
        }

        await handleFormResponse(player, panelId, response, context);
    } catch (error: unknown) {
        errorLog(`[UIManager] showPanel failed for panel '${String(panelId)}': ${String(error)}`);
        player.sendMessage(
            '§cAn unexpected error occurred while trying to open the UI. Please check the content log for details.'
        );
    }
}
