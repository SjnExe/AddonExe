import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig } from '../../configManager.js';
import { getOrCreatePlayer } from '../../playerDataManager.js';
import { showPanel } from '../../uiManager.js';
import { getValueFromPath } from '../../objectUtils.js';
import { configPanelSchema } from '../configPanelRegistry.js';
import { getStaticMenuItems } from '../panelBuilder.js'; // Can reuse for back/reset buttons? Or duplicate logic.
import { panelDefinitions, PanelItem, UIContext, MainConfig } from '../panelRegistry.js';
import { IPanelHandler } from '../types.js';
import { configHandlers, getPaginatedItems, getSystemsByCategory, getVisibleCategories, itemsPerPage } from '../uiUtils.js';
import { handleUIAction } from '../actions.js';

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
        const items: PanelItem[] = [];
        const pData = getOrCreatePlayer(player);
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
            const page = context.page || 1;
            const totalPages = Math.ceil(categories.length / itemsPerPage);
            if (page >= totalPages) {
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

    async buildModal(player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
        if (panelId.startsWith('config_')) {
            const categoryId = panelId.replace('config_', '');
            const category = configPanelSchema.find((c) => c.id === categoryId);
            if (!category) return null;
            const form = new ModalFormData().title(category.title);
            const configSource = category.configSource || 'main';
            const handler = configHandlers[configSource];
            if (!handler) return null;
            const config = handler.get() as unknown as Record<string, unknown>;

            for (const setting of category.settings) {
                const currentValue = getValueFromPath(config, setting.key);
                if (setting.type === 'toggle') {
                    form.toggle(setting.label, { defaultValue: !!currentValue });
                } else if (setting.type === 'textField') {
                    const val = currentValue ?? '';
                    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val as string | number | boolean);
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
                if (item.actionType === 'functionCall') {
                    await handleUIAction(player, item.actionValue, { ...context, selectedItemId: item.id });
                    return;
                }
            }
        }

        // Modal Handling
        if (panelId.startsWith('config_')) {
            const { handleConfigPanel } = await import('../handlers/configHandlers.js'); // Reuse existing handler logic for save/reset
            // Wait, handleConfigPanel handles Modals AND Actions?
            // Existing handler logic for Modal is: save settings.
            // I should just call it or reimplement.
            // Reimplementing ensures decoupling.

            // Reimplement logic:
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'configCategoryPanel', context); // Back target logic?
            // Actually, back target depends on where we came from. Usually configSubCategoryPanel.
            // The context doesn't track parent.
            // I'll stick to 'configCategoryPanel' or handleConfigPanel's logic.
            // I'll call handleConfigPanel for now to save time and ensure correctness of the complex save logic.
            return handleConfigPanel(player, panelId, response, context);
        }
    }
}
