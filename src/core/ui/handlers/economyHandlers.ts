import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormResponse } from '@minecraft/server-ui';

import { getEconomyConfig, saveEconomyConfig } from '../../configurations.js';
import { showPanel } from '../../uiManager.js';
import { panelDefinitions, UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

/**
 * Handles Economy System UI interactions (including Mob Drops).
 */
export async function handleEconomyPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

    // Handle generic sub-menu navigation for the main economy panel
    if (panelId === 'economyPanel') {
        const panelDef = panelDefinitions[panelId];
        if (typeof selection === 'number' && panelDef && panelDef.items) {
            if (selection >= 0 && selection < panelDef.items.length) {
                const item = panelDef.items[selection];
                if (item.actionType === 'openPanel') {
                    return showPanel(player, item.actionValue, context);
                }
            }
        }
        // If selection is invalid or cancelled, go back to Config
        if (canceled || selection === undefined) {
            return showPanel(player, 'configCategoryPanel', context);
        }
        return;
    }

    if (panelId === 'mobDropsSystemPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'economyPanel', context); // Back
        if (selection === 1) return showPanel(player, 'addMobDropPanel', context);

        const economyConfig = getEconomyConfig();
        const mobMoney = economyConfig.mobMoney || {};
        const mobTypes = Object.keys(mobMoney).sort();

        const paginatedMobs = getPaginatedItems(mobTypes, page);
        let buttonIndex = selection - 2; // Offset by Back and Add buttons

        if (buttonIndex >= 0 && buttonIndex < paginatedMobs.length) {
            const mobType = paginatedMobs[buttonIndex];
            return showPanel(player, 'editMobDropPanel', { ...context, mobType });
        }
        buttonIndex -= paginatedMobs.length;

        // Pagination Logic
        const totalPages = Math.ceil(mobTypes.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }
        if (hasNext) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page + 1 });
        }
        return;
    }

    if (panelId === 'addMobDropPanel') {
        if (canceled) return showPanel(player, 'mobDropsSystemPanel', context);
        if (formValues) {
            const [mobType, rewardStr] = formValues as [string, string];
            const reward = parseInt(rewardStr);
            if (mobType && !isNaN(reward)) {
                const config = getEconomyConfig();
                if (!config.mobMoney) config.mobMoney = {};
                config.mobMoney[mobType] = reward;
                saveEconomyConfig(config);
                player.sendMessage(`§2Added drop for ${mobType}: ${reward}`);
            }
        }
        return showPanel(player, 'mobDropsSystemPanel', context);
    }

    if (panelId === 'editMobDropPanel') {
        if (canceled) return showPanel(player, 'mobDropsSystemPanel', context);
        if (formValues) {
            const { mobType } = context;
            const [rewardStr, shouldDelete] = formValues as [string, boolean];
            const reward = parseInt(rewardStr);

            const config = getEconomyConfig();
            if (config.mobMoney && mobType) {
                if (shouldDelete) {
                    delete config.mobMoney[mobType];
                    player.sendMessage(`§2Removed drop for ${mobType}`);
                } else if (!isNaN(reward)) {
                    config.mobMoney[mobType] = reward;
                    player.sendMessage(`§2Updated drop for ${mobType}: ${reward}`);
                }
                saveEconomyConfig(config);
            }
        }
        return showPanel(player, 'mobDropsSystemPanel', context);
    }
}
