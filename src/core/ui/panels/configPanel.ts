/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { refreshXrayCache } from '@modules/detections/xrayDetection.js';

import { getConfig, resetConfigSection } from '../../configManager.js';
import { errorLog } from '../../logger.js';
import { getValueFromPath, setValueByPath } from '../../objectUtils.js';
import { getOrCreatePlayer, PlayerData } from '../../playerDataManager.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { handleUIAction } from '../actions.js';
import { showConfirmationDialog } from '../components.js';
import { configPanelSchema } from '../configPanelRegistry.js';
import { PanelItem, UIContext } from '../panelRegistry.js';
import { IPanelHandler } from '../types.js';
import {
    getPaginatedItems,
    getSystemsByCategory,
    getVisibleCategories,
    itemsPerPage,
    configHandlers as uiConfigHandlers
} from '../uiUtils.js';

export class ConfigPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'configCategoryPanel' ||
            panelId.startsWith('configSubCategoryPanel_') ||
            panelId === 'configResetPanel' ||
            panelId.startsWith('configResetCategoryPanel_') ||
            panelId.startsWith('config_')
        );
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];
        const pData: PlayerData = getOrCreatePlayer(player);
        const permissionLevel = pData.permissionLevel;

        const addBack = (target: string) => {
            items.push({
                id: '__back__',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: target
            });
        };

        const addPagination = (totalItems: number) => {
            const page = context.page || 1;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (page > 1) {
                items.push({
                    id: '__prev__',
                    text: '§6< Previous Page',
                    icon: 'textures/ui/arrow_left.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'prevPage'
                });
            }
            if (page < totalPages) {
                items.push({
                    id: '__next__',
                    text: '§6Next Page >',
                    icon: 'textures/ui/arrow_right.png',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'nextPage'
                });
            }
        };

        if (panelId === 'configCategoryPanel') {
            addBack('adminPanel');
            const categories = getVisibleCategories(pData);
            const paginated = getPaginatedItems(categories, context.page || 1);
            paginated.forEach((cat) => {
                items.push({
                    id: cat.id,
                    text: cat.title,
                    icon: cat.icon,
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: `configSubCategoryPanel_${cat.id}`
                });
            });
            if (permissionLevel === 0) {
                items.push({
                    id: 'resetSettings',
                    text: '§l§cReset Settings§r',
                    icon: 'textures/ui/wysiwyg_reset',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: 'configResetPanel'
                });
            }
            addPagination(categories.length);
            return items;
        }

        if (panelId.startsWith('configSubCategoryPanel_')) {
            const category = panelId.replace('configSubCategoryPanel_', '');
            addBack('configCategoryPanel');
            const systems = getSystemsByCategory(pData, category);
            const paginated = getPaginatedItems(systems, context.page || 1);
            paginated.forEach((sys) => {
                items.push({
                    id: sys.id,
                    text: sys.title,
                    icon: sys.icon,
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: sys.id.startsWith('config_') ? sys.id : sys.id
                });
            });
            addPagination(systems.length);
            return items;
        }

        if (panelId === 'configResetPanel') {
            addBack('configCategoryPanel');
            const categories = getVisibleCategories(pData);
            const paginated = getPaginatedItems(categories, context.page || 1);
            paginated.forEach((cat) => {
                items.push({
                    id: cat.id,
                    text: `Reset ${cat.title}`,
                    icon: cat.icon,
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `configResetCategoryPanel_${cat.id}`
                });
            });
            if (context.page! >= Math.ceil(categories.length / itemsPerPage)) {
                items.push({
                    id: 'resetAll',
                    text: '§l§4Reset All Systems',
                    icon: 'textures/ui/trash',
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: 'resetAllConfig'
                });
            }
            addPagination(categories.length);
            return items;
        }

        if (panelId.startsWith('configResetCategoryPanel_')) {
            const category = panelId.replace('configResetCategoryPanel_', '');
            addBack('configResetPanel');
            const systems = getSystemsByCategory(pData, category);
            const paginated = getPaginatedItems(systems, context.page || 1);

            items.push({
                id: 'resetCategory',
                text: `§l§4Reset All ${category}§r`,
                icon: 'textures/ui/trash',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: `resetCategory_${category}`
            });

            paginated.forEach((sys) => {
                items.push({
                    id: sys.id,
                    text: `§4Reset ${sys.title}`,
                    icon: sys.icon,
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: `resetSystem_${sys.id}`
                });
            });
            addPagination(systems.length);
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | null> {
        await Promise.resolve();
        if (panelId.startsWith('config_')) {
            const categoryId = panelId.replace('config_', '');
            const category = configPanelSchema.find((c) => c.id === categoryId);
            if (!category) return null;
            const form = new ModalFormData().title(category.title);
            const configSource = category.configSource || 'main';
            const handler = uiConfigHandlers[configSource];
            if (!handler) return null;
            const config = handler.get() as unknown as Record<string, unknown>;

            for (const setting of category.settings) {
                const currentValue = getValueFromPath(config, setting.key);
                if (setting.type === 'toggle') {
                    form.toggle(setting.label, { defaultValue: !!currentValue });
                } else if (setting.type === 'textField') {
                    const val = currentValue ?? '';
                    const strVal =
                        typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | boolean);
                    form.textField(setting.label, setting.description || '', { defaultValue: strVal });
                } else if (setting.type === 'dropdown') {
                    let index = -1;
                    const options = setting.options || [];
                    if (setting.key === 'logLevel' && typeof currentValue === 'number') index = currentValue;
                    else index = options.indexOf(currentValue as string);
                    form.dropdown(setting.label, options, { defaultValueIndex: Math.max(0, index) });
                }
            }
            return form;
        }
        return null;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const values = (response as ModalFormResponse).formValues;
        const pData = getOrCreatePlayer(player);

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];
                if (item.actionType === 'openPanel') {
                    // Title Fix for SubCategories
                    if (item.actionValue.startsWith('configSubCategoryPanel_')) {
                        const catId = item.actionValue.replace('configSubCategoryPanel_', '');
                        const title = catId.charAt(0).toUpperCase() + catId.slice(1) + ' Configuration';
                        return showPanel(player, item.actionValue, { ...context, page: 1, customTitle: title });
                    }
                    return showPanel(player, item.actionValue, { ...context, page: 1 });
                }
                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, { ...context, page: Math.max(1, (context.page || 1) - 1) });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: (context.page || 1) + 1 });
                }

                // --- Reset Actions ---
                if (item.actionValue === 'resetAllConfig') {
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

                if (item.actionValue.startsWith('resetCategory_')) {
                    const category = item.actionValue.replace('resetCategory_', '');
                    // Removed dynamic import of getSystemsByCategory as it caused shadowing
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

                if (item.actionValue.startsWith('resetSystem_')) {
                    const sysId = item.actionValue.replace('resetSystem_', '');
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

                if (item.actionType === 'functionCall') {
                    await handleUIAction(player, item.actionValue, { ...context, selectedItemId: item.id });
                    return;
                }
            }
        }

        // Modal Handling
        if (panelId.startsWith('config_')) {
            if ((response as ModalFormResponse).canceled) {
                return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
            }

            const categoryId = panelId.replace('config_', '');
            const category = configPanelSchema.find((c) => c.id === categoryId);
            if (category) {
                if (values) {
                    const updates: Record<string, unknown> = {};
                    category.settings.forEach((setting, index) => {
                        let value = values[index];
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
}
