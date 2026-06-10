import * as mc from '@minecraft/server';

import { getCooldown, setCooldown } from '@core/cooldownManager.js';
import { debugLog, errorLog } from '@core/logger.js';
import * as utils from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { buildPanelForm } from '@ui/panelBuilder.js';
import { handleFormResponse } from '@ui/panelHandlers.js';
import { panelDefinitions, UIContext } from '@ui/panelRegistry.js';

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
        // Rate Limiting
        const cooldown = getCooldown(player.id, 'ui_spam');
        if (cooldown > 0) {
            return;
        }
        setCooldown(player.id, 'ui_spam', 0.5); // 0.5s global UI cooldown

        debugLog(`[UIManager] Showing panel '${panelId}' to ${player.name} with context: ${JSON.stringify(context)}`);

        const form = await buildPanelForm(player, panelId, context);
        if (!isDefined(form)) {
            debugLog(`[UIManager] buildPanelForm returned undefined for panel '${panelId}'. Aborting.`);
            return;
        }

        const response = await utils.uiWait(player, form);
        if (!isDefined(response) || response.canceled) {
            debugLog(`[UIManager] Panel '${panelId}' was canceled by ${player.name}.`);
            // Show the parent panel if the user cancels and a parent is defined
            if (isNonEmptyString(context.returnPanel)) {
                const targetPanel = context.returnPanel;
                delete context.returnPanel;
                return showPanel(player, targetPanel, context);
            }
            const panelDef = panelDefinitions[panelId];
            if (isDefined(panelDef) && isNonEmptyString(panelDef.parentPanelId)) {
                return showPanel(player, panelDef.parentPanelId, context);
            }
            return;
        }

        await handleFormResponse(player, panelId, response, context);
    } catch (error: unknown) {
        errorLog(`[UIManager] showPanel failed for panel '${String(panelId)}': ${String(error)}`);
        player.sendMessage('§cAn unexpected error occurred while trying to open the UI. Please check the content log for details.');
    }
}
