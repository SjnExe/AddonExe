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
import { getPanelItems } from '../panelBuilder.js';
import { UIContext } from '../types.js';
import { configHandlers as uiConfigHandlers } from '../uiUtils.js';

export async function handleConfigPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = (response as ModalFormResponse).canceled;
    const formValues = (response as ModalFormResponse).formValues;
    const pData = getPlayer(player.id);

    if (!pData) return;

    // --- Action Forms (Category, SubCategory, Reset Lists) ---
    if (
        panelId === 'configCategoryPanel' ||
        panelId.startsWith('configSubCategoryPanel_') ||
        panelId === 'configResetPanel' ||
        panelId.startsWith('configResetCategoryPanel_')
    ) {
        if (typeof selection === 'number') {
            const items = await getPanelItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const selectedItem = items[selection];

                // Navigation
                if (selectedItem.actionType === 'openPanel') {
                    return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
                }

                if (selectedItem.id === '__back__') {
                    return showPanel(player, selectedItem.actionValue, { ...context, page: 1 });
                }
                if (selectedItem.id === '__prev__') {
                    const newPage = (context.page || 1) - 1;
                    return showPanel(player, panelId, { ...context, page: newPage });
                }
                if (selectedItem.id === '__next__') {
                    const newPage = (context.page || 1) + 1;
                    return showPanel(player, panelId, { ...context, page: newPage });
                }

                // Reset Logic
                if (selectedItem.actionValue === 'resetAllConfig') {
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
                            if (finalConfirmResponse.canceled) return showPanel(player, panelId, context);
                            const confirmModal = finalConfirmResponse as ModalFormResponse;
                            const confirmationValue =
                                confirmModal.formValues && confirmModal.formValues[0]
                                    ? String(confirmModal.formValues[0])
                                    : '';
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

                if (selectedItem.actionValue.startsWith('resetCategory_')) {
                    const category = selectedItem.actionValue.replace('resetCategory_', '');
                    const { getSystemsByCategory } = await import('../uiUtils.js');
                    const systems = getSystemsByCategory(pData, category);

                    await showConfirmationDialog(player, {
                        title: `Reset ${category}`,
                        body: `Are you sure you want to reset all systems in the ${category} category?`,
                        confirmButtonText: '§4Yes, Reset Category',
                        cancelButtonText: '§2No, Cancel',
                        onConfirm: async () => {
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

                if (selectedItem.actionValue.startsWith('resetSystem_')) {
                    const sysId = selectedItem.actionValue.replace('resetSystem_', '');
                    await showConfirmationDialog(player, {
                        title: `Reset System`,
                        body: `Reset this system to defaults?`,
                        confirmButtonText: '§4Yes, Reset',
                        cancelButtonText: '§2No, Cancel',
                        onConfirm: async () => {
                            const result = await resetConfigSection(sysId, player);
                            if (result.success) {
                                player.sendMessage(`§2${result.message}`);
                                if (sysId === 'xray') refreshXrayCache();
                            } else {
                                player.sendMessage('§4Failed to reset.');
                            }
                            return showPanel(player, panelId, context);
                        },
                        onCancel: () => showPanel(player, panelId, context)
                    });
                    return;
                }
            }
        }
        return;
    }

    // --- Generic Schema-Based Config Panels (Modal) ---
    if (panelId.startsWith('config_')) {
        if (canceled) {
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
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

                    if (configSource === 'xray') {
                        refreshXrayCache();
                    }
                }
            }
        }
        return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
    }
}
