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

        context.history = context.history || [];

        // Intercept functionally migrated panels (Session 2)
        if (panelId === 'mainPanel') {
            const { showMainPanel } = await import('@ui/panels/generalPanel.js');
            return showMainPanel(player);
        }
        if (panelId === 'profileMainPanel') {
            const { showProfileMainPanel } = await import('@ui/panels/generalPanel.js');
            return showProfileMainPanel(player);
        }
        if (panelId === 'bountyListPanel') {
            const { showBountyListPanel } = await import('@ui/panels/generalPanel.js');
            return showBountyListPanel(player);
        }
        if (panelId === 'bountyActionsPanel') {
            const { showBountyActionsPanel } = await import('@ui/panels/generalPanel.js');
            return showBountyActionsPanel(player, context.targetPlayerId as string, context.targetPlayerName as string);
        }
        if (panelId === 'staffDashboardPanel') {
            const { showStaffDashboardPanel } = await import('@ui/panels/adminPanel.js');
            return showStaffDashboardPanel(player);
        }
        if (panelId === 'floatingTextListPanel') {
            const { showFloatingTextListPanel } = await import('@ui/panels/adminPanel.js');
            return showFloatingTextListPanel(player);
        }
        if (panelId === 'floatingTextCreatePanel') {
            const { showFloatingTextCreatePanel } = await import('@ui/panels/adminPanel.js');
            return showFloatingTextCreatePanel(player);
        }
        if (panelId === 'floatingTextEditPanel') {
            const { showFloatingTextEditPanel } = await import('@ui/panels/adminPanel.js');
            return showFloatingTextEditPanel(player, context.id as string);
        }
        if (panelId === 'floatingTextActionPanel') {
            const { showFloatingTextActionPanel } = await import('@ui/panels/adminPanel.js');
            return showFloatingTextActionPanel(player, context.id as string);
        }
        if (panelId === 'playerListPanel') {
            const { showPlayerListPanel } = await import('@ui/panels/playerPanel.js');
            return showPlayerListPanel(player);
        }
        if (panelId === 'playerManagementPanel') {
            const { showPlayerManagementPanel } = await import('@ui/panels/playerPanel.js');
            return showPlayerManagementPanel(player);
        }
        if (panelId === 'myStatsPanel') {
            const { showMyStatsPanel } = await import('@ui/panels/playerPanel.js');
            return showMyStatsPanel(player);
        }
        if (panelId === 'playerActionsPanel') {
            const { showPlayerActionsPanel } = await import('@ui/panels/playerPanel.js');
            return showPlayerActionsPanel(player, context.targetPlayerId as string, context.customTitle as string, context.returnPanel as string);
        }
        if (panelId.startsWith('config_')) {
            const { showSimpleConfigPanel } = await import('@ui/panels/configPanel.js');
            const systemId = panelId.replace('config_', '');
            // For simple configs triggered directly, we fallback the category to 'Uncategorized' or retrieve it from system registry
            const { getSystemRegistry } = await import('@ui/systemRegistry.js');
            const sys = getSystemRegistry().find((s) => s.id === systemId);
            return showSimpleConfigPanel(player, systemId, sys?.category ?? 'Uncategorized', context);
        }
        if (panelId === 'configCategoryPanel') {
            const { showConfigCategoryPanel } = await import('@ui/panels/configPanel.js');
            return showConfigCategoryPanel(player, context);
        }
        if (panelId.startsWith('configSubCategoryPanel_')) {
            const { showConfigSubCategoryPanel } = await import('@ui/panels/configPanel.js');
            return showConfigSubCategoryPanel(player, panelId.replace('configSubCategoryPanel_', ''), context);
        }
        if (panelId === 'configResetPanel') {
            const { showConfigResetPanel } = await import('@ui/panels/configPanel.js');
            return showConfigResetPanel(player, context);
        }
        if (panelId === 'configTransferPanel') {
            const { showConfigTransferPanel } = await import('@ui/panels/configPanel.js');
            return showConfigTransferPanel(player, context);
        }
        if (panelId === 'configExportPanel') {
            const { showConfigExportPanel } = await import('@ui/panels/configPanel.js');
            return showConfigExportPanel(player, context);
        }
        if (panelId === 'configImportPanel') {
            const { showConfigImportPanel } = await import('@ui/panels/configPanel.js');
            return showConfigImportPanel(player, context);
        }

        const form = await buildPanelForm(player, panelId, context);
        if (!isDefined(form)) {
            debugLog(`[UIManager] buildPanelForm returned undefined for panel '${panelId}'. Aborting.`);
            return;
        }

        const response = await utils.uiWait(player, form);
        if (!isDefined(response) || response.canceled) {
            debugLog(`[UIManager] Panel '${panelId}' was canceled by ${player.name}.`);

            if (Array.isArray(context.history) && context.history.length > 0) {
                const previousPanel = context.history.pop();
                if (previousPanel) return showPanel(player, previousPanel, context);
            }

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

        if (Array.isArray(context.history)) context.history.push(panelId);
        await handleFormResponse(player, panelId, response, context);
    } catch (error: unknown) {
        errorLog(`[UIManager] showPanel failed for panel '${String(panelId)}': ${String(error)}`);
        player.sendMessage('§cAn unexpected error occurred while trying to open the UI. Please check the content log for details.');
    }
}
