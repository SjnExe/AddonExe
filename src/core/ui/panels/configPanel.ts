import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { refreshXrayCache } from '@features/anticheat/xrayDetection.js';

import { resetConfigSection } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { getValueFromPath, setValueByPath } from '@core/objectUtils.js';
import { showPanel } from '@core/uiManager.js';
import * as utils from '@core/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { showConfirmationDialog } from '@ui/components.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';
import { PanelItem, UIContext } from '@ui/panelRegistry.js';
import { IPanelHandler } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems, getSystemsByCategory, getVisibleCategories, configHandlers as uiConfigHandlers } from '@ui/uiUtils.js';

interface ConfigSetting {
    key: string;
    type: string;
    label: string;
    description?: string;
    options?: string[];
    [key: string]: unknown;
}

export class ConfigPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'configCategoryPanel' ||
            panelId.startsWith('configSubCategoryPanel_') ||
            panelId === 'configResetPanel' ||
            panelId.startsWith('configResetCategoryPanel_') ||
            panelId.startsWith('config_') ||
            panelId === 'configTransferPanel' ||
            panelId === 'configExportPanel' ||
            panelId === 'configImportPanel'
        );
    }

    getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        if (panelId === 'configCategoryPanel') {
            return Promise.resolve(this.getCategoryPanelItems(player, context));
        }

        if (panelId.startsWith('configSubCategoryPanel_')) {
            const category = panelId.replace('configSubCategoryPanel_', '');
            return Promise.resolve(this.getSubCategoryPanelItems(player, category, context));
        }

        if (panelId === 'configResetPanel') {
            return Promise.resolve(this.getResetPanelItems(player, context));
        }

        if (panelId.startsWith('configResetCategoryPanel_')) {
            const category = panelId.replace('configResetCategoryPanel_', '');
            return Promise.resolve(this.getResetCategoryPanelItems(player, category, context));
        }

        if (panelId === 'configTransferPanel') {
            return Promise.resolve(this.getTransferPanelItems(player, context));
        }

        return Promise.resolve([]);
    }

    private getTransferPanelItems(_player: mc.Player, _context: UIContext): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'configCategoryPanel');
        items.push({
            id: 'exportConfig',
            text: 'Export Configurations',
            icon: 'textures/ui/arrow_right',
            permission: 'ui.panel.owner',
            actionType: 'openPanel',
            actionValue: 'configExportPanel'
        });
        items.push({
            id: 'importConfig',
            text: 'Import Configurations',
            icon: 'textures/ui/arrow_left',
            permission: 'ui.panel.owner',
            actionType: 'openPanel',
            actionValue: 'configImportPanel'
        });
        return items;
    }

    private getCategoryPanelItems(player: mc.Player, context: UIContext): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'staffDashboardPanel');
        const categories = getVisibleCategories(player);

        const paginated = getPaginatedItems(categories, (context.page as number) || 1);
        for (const cat of paginated) {
            if (!isDefined(cat)) continue;

            items.push({
                id: cat.id,
                text: cat.title,
                icon: cat.icon,
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: `configSubCategoryPanel_${cat.id}`
            });
        }

        addPaginationItems(items, (context.page as number) || 1, categories.length, 'ui.panel.admin');

        if (hasPermission(player, 'ui.panel.owner')) {
            items.push({
                id: 'resetSettings',
                text: '§l§4Reset Settings§r',
                icon: 'textures/ui/wysiwyg_reset',
                permission: 'ui.panel.owner',
                actionType: 'openPanel',
                actionValue: 'configResetPanel'
            });
        }

        return items;
    }

    private getSubCategoryPanelItems(player: mc.Player, category: string, context: UIContext): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'configCategoryPanel');
        const systems = getSystemsByCategory(player, category);
        const paginated = getPaginatedItems(systems, (context.page as number) || 1);
        for (const sys of paginated) {
            if (!isDefined(sys)) continue;
            items.push({
                id: sys.id,
                text: sys.title,
                icon: sys.icon,
                permission: 'ui.panel.admin',
                actionType: 'openPanel',
                actionValue: sys.id
            });
        }
        addPaginationItems(items, (context.page as number) || 1, systems.length, 'ui.panel.admin');
        return items;
    }

    private getResetPanelItems(player: mc.Player, context: UIContext): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'configCategoryPanel');
        const categories = getVisibleCategories(player);

        categories.push({
            id: 'resetAll',
            title: '§l§cReset All Systems',
            icon: 'textures/ui/trash'
        });

        const paginated = getPaginatedItems(categories, (context.page as number) || 1);
        for (const cat of paginated) {
            if (!isDefined(cat)) continue;

            if (cat.id === 'resetAll') {
                items.push({
                    id: 'resetAll',
                    text: '§l§4Reset All Systems',
                    icon: 'textures/ui/trash',
                    permission: 'ui.panel.owner',
                    actionType: 'functionCall',
                    actionValue: 'resetAllConfig'
                });
            } else {
                items.push({
                    id: cat.id,
                    text: `Reset ${cat.title}`,
                    icon: cat.icon,
                    permission: 'ui.panel.owner',
                    actionType: 'openPanel',
                    actionValue: `configResetCategoryPanel_${cat.id}`
                });
            }
        }

        addPaginationItems(items, (context.page as number) || 1, categories.length, 'ui.panel.admin');
        return items;
    }

    private getResetCategoryPanelItems(player: mc.Player, category: string, context: UIContext): PanelItem[] {
        const items: PanelItem[] = [];
        addBackButton(items, 'configResetPanel');
        const systems = getSystemsByCategory(player, category);
        const paginated = getPaginatedItems(systems, (context.page as number) || 1);

        items.push({
            id: 'resetCategory',
            text: `§l§4Reset All ${category}§r`,
            icon: 'textures/ui/trash',
            permission: 'ui.panel.owner',
            actionType: 'functionCall',
            actionValue: `resetCategory_${category}`
        });

        for (const sys of paginated) {
            if (!isDefined(sys)) continue;
            items.push({
                id: sys.id,
                text: `§4Reset ${sys.title}`,
                icon: sys.icon,
                permission: 'ui.panel.owner',
                actionType: 'functionCall',
                actionValue: `resetSystem_${sys.id}`
            });
        }
        addPaginationItems(items, (context.page as number) || 1, systems.length, 'ui.panel.admin');
        return items;
    }

    buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | undefined | void> {
        if (panelId === 'configExportPanel' || panelId === 'configImportPanel') {
            return this.buildTransferModal(panelId);
        }

        if (!panelId.startsWith('config_')) return Promise.resolve();

        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find((c) => c.id === categoryId);
        if (!isDefined(category)) return Promise.resolve();

        const form = new ModalFormData().title(category.title);
        const configSource = isNonEmptyString(category.configSource) ? category.configSource : 'main';

        const handlers = uiConfigHandlers as Record<string, { get: () => unknown; save: (cfg: unknown) => void }>;
        const handler = handlers[configSource];

        if (!isDefined(handler)) return Promise.resolve();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const config = handler.get() as Record<string, any>;

        // Cast settings to ConfigSetting array to avoid any errors
        const settings = category.settings as unknown as ConfigSetting[];
        this.addFormFields(form, settings, config);

        return Promise.resolve(form);
    }

    private buildTransferModal(panelId: string): Promise<ModalFormData> {
        const form = new ModalFormData();
        const systemOptions = ['All Systems', ...Object.keys(uiConfigHandlers)];

        if (panelId === 'configExportPanel') {
            form.title('Export Configuration');
            form.dropdown('Select System to Export', systemOptions, { defaultValueIndex: 0 });
            form.textField('Action Information', 'The exported JSON data will appear in a new window after you submit.', { defaultValue: 'Submit to generate and receive export data.' });
        } else {
            form.title('Import Configuration');
            form.dropdown('Select Target System', systemOptions, { defaultValueIndex: 0 });
            form.textField('Paste JSON Config Data', 'Paste the condensed JSON text here');
        }

        return Promise.resolve(form);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private addFormFields(form: ModalFormData, settings: ConfigSetting[], config: Record<string, any>) {
        // Filter settings to ensure consistent index mapping
        const validSettings = settings.filter((s) => ['toggle', 'textField', 'dropdown'].includes(s.type));

        for (const setting of validSettings) {
            const currentValue = getValueFromPath(config, setting.key);
            switch (setting.type) {
                case 'toggle': {
                    form.toggle(setting.label, { defaultValue: Boolean(currentValue) });
                    break;
                }
                case 'textField': {
                    const val = currentValue ?? '';
                    const strVal = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : JSON.stringify(val);
                    form.textField(setting.label, isNonEmptyString(setting.description) ? setting.description : '', {
                        defaultValue: strVal
                    });
                    break;
                }
                case 'dropdown': {
                    const options = setting.options ?? [];
                    const index = setting.key === 'logLevel' && typeof currentValue === 'number' ? currentValue : options.indexOf(currentValue as string);
                    form.dropdown(setting.label, options, { defaultValueIndex: Math.max(0, index) });
                    break;
                }
            }
        }
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
            return;
        }

        // Modal Handling
        if (panelId.startsWith('config_')) {
            await this.handleConfigModalSave(player, panelId, response, context);
            return;
        }

        if (panelId === 'configExportPanel') {
            return this.handleExportConfig(player, response, context);
        }

        if (panelId === 'configImportPanel') {
            return this.handleImportConfig(player, response, context);
        }
    }

    private async handleSelection(player: mc.Player, panelId: string, selection: number, context: UIContext): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const item = items[selection];
            if (!isDefined(item)) return;

            if (item.actionType === 'openPanel') {
                // Title Fix for SubCategories
                if (item.actionValue.startsWith('configSubCategoryPanel_')) {
                    const catId = item.actionValue.replace('configSubCategoryPanel_', '');
                    const title = catId
                        .replace(/([A-Z])/g, ' $1')
                        .trim()
                        .replace(/^./, (str) => str.toUpperCase()) + ' Configuration';
                    return showPanel(player, item.actionValue, { ...context, page: 1, customTitle: title });
                }
                return showPanel(player, item.actionValue, { ...context, page: 1 });
            }
            if (item.actionValue === 'prevPage') {
                return showPanel(player, panelId, {
                    ...context,
                    page: Math.max(1, ((context.page as number) || 1) - 1)
                });
            }
            if (item.actionValue === 'nextPage') {
                return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
            }

            if (item.actionValue === 'resetAllConfig' || item.actionValue.startsWith('resetCategory_') || item.actionValue.startsWith('resetSystem_')) {
                await this.handleResetAction(player, item.actionValue, panelId, context);
                return;
            }

            const { uiActionFunctions } = await import('@core/ui/actionRegistry.js');
            const action = uiActionFunctions[item.actionValue];
            if (isDefined(action)) {
                await action(player, context, panelId);
                return;
            }

            // Removed redundant functionCall check
            player.sendMessage(`§cAction ${item.actionValue} not mapped.`);
        }
    }

    private async handleResetAction(player: mc.Player, actionValue: string, panelId: string, context: UIContext): Promise<void> {
        if (actionValue === 'resetAllConfig') {
            await this.handleResetAll(player, panelId, context);
            return;
        }

        if (actionValue.startsWith('resetCategory_')) {
            const category = actionValue.replace('resetCategory_', '');
            await this.handleResetCategory(player, category, panelId, context);
            return;
        }

        if (actionValue.startsWith('resetSystem_')) {
            const sysId = actionValue.replace('resetSystem_', '');
            await this.handleResetSystem(player, sysId, panelId, context);
        }
    }

    private async handleResetAll(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        await showConfirmationDialog(player, {
            title: 'Confirm Reset All',
            body: 'This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?',
            confirmButtonText: '§4Yes, Reset All',
            cancelButtonText: '§2No, Cancel',
            onConfirm: async () => {
                const finalConfirmForm = new ModalFormData().title('Final Confirmation').textField('Type "confirm" to reset ALL systems.', 'Case-insensitive', {
                    defaultValue: ''
                });
                const finalConfirmResponse = await utils.uiWait(player, finalConfirmForm);
                if (finalConfirmResponse.canceled) return showPanel(player, panelId, context);
                const confirmModal = finalConfirmResponse as ModalFormResponse;
                const confirmationValue = isDefined(confirmModal.formValues) && isDefined(confirmModal.formValues[0]) ? String(confirmModal.formValues[0]) : '';
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
    }

    private async handleResetCategory(player: mc.Player, category: string, panelId: string, context: UIContext): Promise<void> {
        // Removed dynamic import of getSystemsByCategory as it caused shadowing
        const systems = getSystemsByCategory(player, category);

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
    }

    private async handleResetSystem(player: mc.Player, sysId: string, panelId: string, context: UIContext): Promise<void> {
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
    }

    private async handleConfigModalSave(player: mc.Player, panelId: string, response: ModalFormResponse, context: UIContext): Promise<void> {
        const categoryId = panelId.replace('config_', '');
        const category = configPanelSchema.find((c) => c.id === categoryId);
        const values = response.formValues;

        if (response.canceled) {
            if (isDefined(category) && isNonEmptyString(category.category)) {
                return showPanel(player, `configSubCategoryPanel_${category.category}`, { ...context, page: 1 });
            }
            return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
        }

        if (isDefined(category) && isDefined(values)) {
            const configSource = isNonEmptyString(category.configSource) ? category.configSource : 'main';
            const handlers = uiConfigHandlers as Record<string, { get: () => unknown; save: (cfg: unknown) => void }>;
            const handler = handlers[configSource];

            if (isDefined(handler)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const config = handler.get() as Record<string, any>;
                // Cast settings to ConfigSetting[] to match the type
                const updates = this.processFormValues(category.settings as unknown as ConfigSetting[], values, config);

                this.saveConfigUpdates(handler, configSource, updates);
                player.sendMessage('§2Configuration saved.');

                if (categoryId === 'data') {
                    await import('@core/dataManager.js').then(({ restartAutoSave }) => restartAutoSave());
                }

                if (configSource === 'xray') {
                    refreshXrayCache();
                }
            }
        }
        if (isDefined(category) && isNonEmptyString(category.category)) {
            return showPanel(player, `configSubCategoryPanel_${category.category}`, { ...context, page: 1 });
        }
        return showPanel(player, 'configCategoryPanel', { ...context, page: 1 });
    }

    private handleExportConfig(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> | void {
        if (response.canceled) return showPanel(player, 'configTransferPanel', context);

        const values = response.formValues;
        if (!isDefined(values) || !isDefined(values[0])) return showPanel(player, 'configTransferPanel', context);

        const systemOptions = ['All Systems', ...Object.keys(uiConfigHandlers)];
        const selectedIndex = values[0] as number;
        const selectedSystem = systemOptions[selectedIndex];

        let exportData: unknown;

        if (selectedSystem === 'All Systems') {
            const allData: Record<string, unknown> = {};
            for (const [key, handler] of Object.entries(uiConfigHandlers)) {
                allData[key] = handler.get();
            }
            exportData = allData;
        } else if (isDefined(selectedSystem) && isDefined(uiConfigHandlers[selectedSystem])) {
            exportData = uiConfigHandlers[selectedSystem].get();
        } else {
            player.sendMessage('§4Invalid system selected.');
            return showPanel(player, 'configTransferPanel', context);
        }

        try {
            const jsonString = JSON.stringify(exportData);
            // Instead of putting it in chat, open a new read-only modal with the data
            const form = new ModalFormData();
            form.title('Exported Data');
            form.textField('Copy the data below:', 'JSON Data', { defaultValue: jsonString });

            void utils.uiWait(player, form).then(() => {
                void showPanel(player, 'configTransferPanel', context);
            });
        } catch (error) {
            player.sendMessage(`§4Failed to generate export data. Check console for errors.`);
            errorLog(`[UIManager] Failed to export config: ${String(error)}`);
            return showPanel(player, 'configTransferPanel', context);
        }
    }

    private handleImportConfig(player: mc.Player, response: ModalFormResponse, context: UIContext): Promise<void> | void {
        if (response.canceled) return showPanel(player, 'configTransferPanel', context);

        const values = response.formValues;
        if (!isDefined(values) || !isDefined(values[0]) || !isDefined(values[1])) {
            return showPanel(player, 'configTransferPanel', context);
        }

        const systemOptions = ['All Systems', ...Object.keys(uiConfigHandlers)];
        const selectedIndex = values[0] as number;
        const selectedSystem = systemOptions[selectedIndex];
        const jsonString = values[1] as string;

        if (!isNonEmptyString(jsonString) || jsonString.trim() === '') {
            player.sendMessage('§4You must provide JSON data to import.');
            return showPanel(player, 'configTransferPanel', context);
        }

        let importData: unknown;
        try {
            importData = JSON.parse(jsonString);
        } catch {
            player.sendMessage('§4Invalid JSON format. Please ensure you copied the entire exported string correctly.');
            return showPanel(player, 'configTransferPanel', context);
        }

        try {
            if (selectedSystem === 'All Systems') {
                const parsedData = importData as Record<string, unknown>;
                for (const [key, handler] of Object.entries(uiConfigHandlers)) {
                    if (isDefined(parsedData[key])) {
                        handler.save(parsedData[key]);
                    }
                }
                player.sendMessage('§aSuccessfully imported All Systems configurations.');
            } else if (isDefined(selectedSystem) && isDefined(uiConfigHandlers[selectedSystem])) {
                uiConfigHandlers[selectedSystem].save(importData);
                player.sendMessage(`§aSuccessfully imported configuration for ${selectedSystem}.`);
            } else {
                player.sendMessage('§4Invalid system selected.');
                return showPanel(player, 'configTransferPanel', context);
            }

            // Trigger reloads where necessary
            if (selectedSystem === 'All Systems' || selectedSystem === 'xray') {
                refreshXrayCache();
            }
            if (selectedSystem === 'All Systems' || selectedSystem === 'ranks') {
                void import('@core/rankManager.js').then(({ reloadRanks }) => reloadRanks());
            }
            if (selectedSystem === 'All Systems' || selectedSystem === 'spawn') {
                void import('@features/essentials/spawnProtection.js').then(({ initializeSpawnProtection }) => initializeSpawnProtection());
            }
        } catch (error) {
            player.sendMessage(`§4Failed to apply imported configuration. Check console for errors.`);
            errorLog(`[UIManager] Failed to import config: ${String(error)}`);
        }

        return showPanel(player, 'configTransferPanel', context);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private processFormValues(settings: ConfigSetting[], values: unknown[], config: Record<string, any>): Record<string, unknown> {
        const updates: Record<string, unknown> = {};
        // Filter settings to match buildModal logic
        const validSettings = settings.filter((s) => ['toggle', 'textField', 'dropdown'].includes(s.type));

        for (const [index, setting] of validSettings.entries()) {
            let value = values[index];
            if (setting.type === 'dropdown') {
                const options = setting.options ?? [];
                const selectedIndex = value as number;
                value = setting.key === 'logLevel' ? selectedIndex : options[selectedIndex];
            } else if (setting.type === 'textField') {
                const strVal = value as string;
                const current = getValueFromPath(config, setting.key);
                if (
                    typeof current === 'number' ||
                    setting.key.includes('.x') ||
                    setting.key.includes('.y') ||
                    setting.key.includes('.z') ||
                    setting.key.includes('Radius') ||
                    setting.key.includes('Seconds') ||
                    setting.key.includes('Cost') ||
                    setting.key.includes('Length') ||
                    setting.key.includes('Percent') ||
                    setting.key.includes('Interval')
                ) {
                    if (!Number.isNaN(Number(strVal)) && isNonEmptyString(strVal) && strVal.trim() !== '') {
                        value = Number(strVal);
                    } else if (current === undefined && strVal.trim() === '') {
                        // Allow resetting to undefined
                        value = undefined;
                    } else if (strVal.trim() !== '') {
                        // Skip update if input is invalid for a number field, but allow empty strings if current is undefined
                        continue;
                    }
                }
            }
            updates[setting.key] = value;
        }
        return updates;
    }

    private saveConfigUpdates(handler: { get: () => unknown; save: (cfg: unknown) => void }, configSource: string, updates: Record<string, unknown>) {
        if (configSource === 'main') {
            handler.save(updates);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const currentConfig = handler.get() as Record<string, any>;
            for (const key in updates) {
                setValueByPath(currentConfig, key, updates[key]);
            }
            handler.save(currentConfig);
        }
    }
}
