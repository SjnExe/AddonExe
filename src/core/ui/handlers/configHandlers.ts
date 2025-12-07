/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { refreshXrayCache } from '@modules/detections/xrayDetection.js';

import { getConfig, resetConfigSection } from '../../configManager.js';
import { errorLog } from '../../logger.js';
import { getValueFromPath, setValueByPath } from '../../objectUtils.js';
import { getPlayer } from '../../playerDataManager.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { showConfirmationDialog } from '../components.js';
import { configPanelSchema } from '../configPanelRegistry.js';
import { UIContext } from '../types.js';
import {
    getPaginatedItems,
    getSystemsByCategory,
    getVisibleCategories,
    itemsPerPage,
    configHandlers as uiConfigHandlers
} from '../uiUtils.js';

export async function handleConfigPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;
    const pData = getPlayer(player.id);

    if (!pData) return;

    // --- Main Config Menu (Categories) ---
    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'mainPanel', context);

        const categories = getVisibleCategories(pData);
        const paginatedCategories = getPaginatedItems(categories, page);

        let buttonIndex = selection - 1;

        // Category Buttons
        if (buttonIndex >= 0 && buttonIndex < paginatedCategories.length) {
            const category = paginatedCategories[buttonIndex];
            return showPanel(player, `configSubCategoryPanel_${category.id}`, { ...context, page: 1 });
        }
        buttonIndex -= paginatedCategories.length;

        // Reset Settings Button (if Owner)
        if (pData.permissionLevel === 0) {
            if (buttonIndex === 0) return showPanel(player, 'configResetPanel', { ...context, page: 1 });
            buttonIndex--;
        }

        // Pagination
        const totalPages = Math.ceil(categories.length / itemsPerPage);
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

    // --- Sub-Category Menu (Systems) ---
    if (panelId.startsWith('configSubCategoryPanel_')) {
        const category = panelId.replace('configSubCategoryPanel_', '');
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });

        const systems = getSystemsByCategory(pData, category);
        const paginatedSystems = getPaginatedItems(systems, page);

        let buttonIndex = selection - 1;

        if (buttonIndex >= 0 && buttonIndex < paginatedSystems.length) {
            const system = paginatedSystems[buttonIndex];
            return showPanel(player, system.id, { ...context, page: 1 });
        }
        buttonIndex -= paginatedSystems.length;

        const totalPages = Math.ceil(systems.length / itemsPerPage);
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

    // --- Generic Schema-Based Config Panels ---
    if (panelId.startsWith('config_')) {
        if (canceled) {
            return showPanel(player, 'configCategoryPanel', context);
        }

        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find((c) => c.id === categoryId);
        if (category) {
            if (formValues) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updates: Record<string, any> = {};
                category.settings.forEach((setting, index) => {
                    let value = formValues[index];
                    if (setting.type === 'dropdown') {
                        const options = setting.options || [];
                        const selectedIndex = value as number;
                        if (setting.key === 'logLevel') {
                            value = selectedIndex;
                        } else {
                            value = options[selectedIndex];
                        }
                    } else if (setting.type === 'textField') {
                        const strVal = value as string;
                        const current = getValueFromPath(getConfig(), setting.key);
                        if (typeof current === 'number' && !isNaN(Number(strVal)) && strVal.trim() !== '') {
                            value = Number(strVal);
                        }
                    }
                    updates[setting.key] = value;
                });

                const configSource = category.configSource || 'main';
                const handler = uiConfigHandlers[configSource];
                if (handler) {
                    if (configSource === 'main') {
                        handler.save(updates);
                    } else {
                        const currentConfig = handler.get();
                        for (const key in updates) {
                            setValueByPath(currentConfig, key, updates[key]);
                        }
                        handler.save(currentConfig);
                    }
                    player.sendMessage('§2Configuration saved.');

                    if (categoryId === 'data') {
                        await import('../../dataManager.js').then(({ restartAutoSave }) => restartAutoSave());
                    }

                    // Refresh X-Ray cache if config was X-Ray
                    if (configSource === 'xray') {
                        refreshXrayCache();
                    }
                }
            }
        }
        return showPanel(player, 'configCategoryPanel', context);
    }

    // --- Reset Config Menu (Categories) ---
    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const categories = getVisibleCategories(pData);
        if (selection === 0) {
            // Back button
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        const paginatedCategories = getPaginatedItems(categories, page);
        let buttonIndex = selection && selection > 0 ? selection - 1 : -1;

        if (buttonIndex >= 0 && buttonIndex < paginatedCategories.length) {
            const category = paginatedCategories[buttonIndex];
            return showPanel(player, `configResetCategoryPanel_${category.id}`, { ...context, page: 1 });
        }
        buttonIndex -= paginatedCategories.length;

        // Reset All Button
        const totalPages = Math.ceil(categories.length / itemsPerPage);
        if (page >= totalPages && buttonIndex === 0) {
            // Reset All Logic (Same as before)
            await showConfirmationDialog(player, {
                title: 'Confirm Reset All',
                body: 'This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?',
                confirmButtonText: '§4Yes, Reset All',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    const finalConfirmForm = new ModalFormData()
                        .title('Final Confirmation')
                        .textField('Type "confirm" to reset ALL systems.', 'Case-insensitive', { defaultValue: '' });
                    const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);
                    if (finalConfirmResponse.canceled) return showPanel(player, panelId, context);
                    const confirmModal = finalConfirmResponse as ModalFormResponse;
                    const confirmationValue =
                        confirmModal.formValues && confirmModal.formValues[0] ? String(confirmModal.formValues[0]) : '';
                    if (confirmationValue.trim().toLowerCase() !== 'confirm') {
                        player.sendMessage('§4Final confirmation failed. Reset canceled.');
                        return showPanel(player, panelId, context);
                    }
                    const result = await resetConfigSection('all', player);
                    if (result.success) {
                        player.sendMessage(`§2${result.message}`);
                        refreshXrayCache();
                    } else {
                        player.sendMessage('§4Failed to reset all configurations. Please check the console.');
                        errorLog(`[UIManager] Failed to reset all: ${result.message}`);
                    }
                    return showPanel(player, panelId, { ...context, page: 1 });
                },
                onCancel: () => showPanel(player, panelId, context)
            });
            return;
        }
        buttonIndex--;

        // Pagination
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

    // --- Reset Category Menu (Systems) ---
    if (panelId.startsWith('configResetCategoryPanel_')) {
        const category = panelId.replace('configResetCategoryPanel_', '');
        const page = context.page || 1;
        if (selection === 0) return showPanel(player, 'configResetPanel', { ...context, page: 1 });

        const systems = getSystemsByCategory(pData, category);
        const paginatedSystems = getPaginatedItems(systems, page);
        let buttonIndex = selection && selection > 0 ? selection - 1 : -1;

        // Reset All In Category
        if (buttonIndex === 0) {
            await showConfirmationDialog(player, {
                title: `Reset ${category}`,
                body: `Are you sure you want to reset all systems in the ${category} category?`,
                confirmButtonText: '§4Yes, Reset Category',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    // Reset each system in the category
                    let successCount = 0;
                    for (const sys of systems) {
                        const res = await resetConfigSection(sys.id, player);
                        if (res.success) successCount++;
                    }
                    player.sendMessage(`§2Reset ${successCount} systems in ${category}.`);
                    if (category === 'Moderation') refreshXrayCache();
                    return showPanel(player, panelId, context);
                },
                onCancel: () => showPanel(player, panelId, context)
            });
            return;
        }
        buttonIndex--;

        if (buttonIndex >= 0 && buttonIndex < paginatedSystems.length) {
            const system = paginatedSystems[buttonIndex];
            // Reset Single System
            await showConfirmationDialog(player, {
                title: `Reset ${system.title}`,
                body: `Reset ${system.title} to defaults?`,
                confirmButtonText: '§4Yes, Reset',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    const result = await resetConfigSection(system.id, player);
                    if (result.success) {
                        player.sendMessage(`§2${result.message}`);
                        if (system.id === 'xray') refreshXrayCache();
                    } else {
                        player.sendMessage('§4Failed to reset.');
                    }
                    return showPanel(player, panelId, context);
                },
                onCancel: () => showPanel(player, panelId, context)
            });
            return;
        }
        buttonIndex -= paginatedSystems.length;

        // Pagination
        const totalPages = Math.ceil(systems.length / itemsPerPage);
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
}
