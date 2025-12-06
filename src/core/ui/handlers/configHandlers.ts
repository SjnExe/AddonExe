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
import { configPanelSchema, UIContext } from '../panelRegistry.js';
import {
    getPaginatedItems,
    getResettableSystems,
    getVisibleConfigSystems,
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

    // --- Main Config Menu ---
    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'mainPanel', context);

        const sortedSystems = getVisibleConfigSystems(pData);
        const paginatedSystems = getPaginatedItems(sortedSystems, page);

        let buttonIndex = selection - 1;

        if (buttonIndex >= 0 && buttonIndex < paginatedSystems.length) {
            const system = paginatedSystems[buttonIndex];
            // Explicitly reset page to 1 when entering a sub-panel to avoid page number leakage
            return showPanel(player, system.id, { ...context, page: 1 });
        }
        buttonIndex -= paginatedSystems.length;

        const totalPages = Math.ceil(sortedSystems.length / itemsPerPage);
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

    // --- Reset Config Panel ---
    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const sortedSystems = getResettableSystems();

        if (selection === 0) {
            // Back button
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        const paginatedSystems = getPaginatedItems(sortedSystems, page);
        const selectionIndex = selection && selection > 0 ? selection - 1 : -1;

        if (selectionIndex >= 0 && selectionIndex < paginatedSystems.length) {
            const selectedSystem = paginatedSystems[selectionIndex];
            await showConfirmationDialog(player, {
                title: `Confirm Reset: ${selectedSystem.title}`,
                body: `This action cannot be undone. Are you sure you want to reset the ${selectedSystem.title} configuration to its default values?`,
                confirmButtonText: '§4Yes, Reset',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    const finalConfirmForm = new ModalFormData()
                        .title('Final Confirmation')
                        .textField(`Type "confirm" to reset ${selectedSystem.title}.`, 'Case-insensitive', {
                            defaultValue: ''
                        });

                    const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);

                    if (finalConfirmResponse.canceled) {
                        player.sendMessage('§4Final confirmation failed. Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }

                    const confirmModal = finalConfirmResponse as ModalFormResponse;
                    const confirmationValue =
                        confirmModal.formValues && confirmModal.formValues[0] ? String(confirmModal.formValues[0]) : '';

                    if (confirmationValue.trim().toLowerCase() !== 'confirm') {
                        player.sendMessage('§4Final confirmation failed. Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }

                    const result = await resetConfigSection(selectedSystem.id, player);
                    if (result.success) {
                        player.sendMessage(`§2${result.message}`);
                        // If X-Ray was reset, refresh its cache
                        if (selectedSystem.id === 'xray' || selectedSystem.id === 'all') {
                            refreshXrayCache();
                        }
                    } else {
                        player.sendMessage(
                            '§4Failed to reset the configuration. Please check the console for details.'
                        );
                        errorLog(
                            `[UIManager] Failed to reset config section '${selectedSystem.id}': ${result.message}`
                        );
                    }
                    return showPanel(player, 'configResetPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    player.sendMessage('§2Reset canceled.');
                    return showPanel(player, 'configResetPanel', { ...context, page });
                }
            });
            return;
        }

        const buttonIndex = selectionIndex >= 0 ? selectionIndex - paginatedSystems.length : -1;

        const totalPages = Math.ceil(sortedSystems.length / itemsPerPage);

        // "Reset All" button logic (appears on the last page)
        if (page >= totalPages && buttonIndex === 0) {
            await showConfirmationDialog(player, {
                title: 'Confirm Reset All',
                body: 'This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?',
                confirmButtonText: '§4Yes, Reset All',
                cancelButtonText: '§2No, Cancel',
                onConfirm: async () => {
                    const finalConfirmForm = new ModalFormData()
                        .title('Final Confirmation')
                        .textField('Type "confirm" to reset ALL systems.', 'Case-insensitive', {
                            defaultValue: ''
                        });

                    const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);

                    if (finalConfirmResponse.canceled) {
                        player.sendMessage('§4Final confirmation failed. Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }

                    const confirmModal = finalConfirmResponse as ModalFormResponse;
                    const confirmationValue =
                        confirmModal.formValues && confirmModal.formValues[0] ? String(confirmModal.formValues[0]) : '';

                    if (confirmationValue.trim().toLowerCase() !== 'confirm') {
                        player.sendMessage('§4Final confirmation failed. Reset canceled.');
                        return showPanel(player, 'configResetPanel', { ...context, page });
                    }

                    const result = await resetConfigSection('all', player);
                    if (result.success) {
                        player.sendMessage(`§2${result.message}`);
                        refreshXrayCache(); // Refresh cache on reset all
                    } else {
                        player.sendMessage(
                            '§4Failed to reset all configurations. Please check the console for details.'
                        );
                        errorLog(`[UIManager] Failed to reset all config sections: ${result.message}`);
                    }
                    return showPanel(player, 'configResetPanel', { ...context, page: 1 });
                },
                onCancel: () => {
                    player.sendMessage('§2Reset canceled.');
                    return showPanel(player, 'configResetPanel', { ...context, page });
                }
            });
            return;
        }

        // Handle pagination
        const hasPrev = page > 1;

        if (hasPrev && buttonIndex === 0) {
            return showPanel(player, panelId, { ...context, page: page - 1 });
        }
        if (buttonIndex >= 0) {
            // Should be next page
            return showPanel(player, panelId, { ...context, page: page + 1 });
        }

        return;
    }
}
