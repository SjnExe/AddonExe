/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await */
import { hasPermission } from '@core/permissionEngine.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { resetConfigSection } from '@core/configManager.js';
import { errorLog } from '@core/logger.js';
import { getValueFromPath, setValueByPath } from '@core/objectUtils.js';
import { showPanel } from '@core/uiManager.js';
import { refreshXrayCache } from '@features/anticheat/xrayDetection.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { showConfirmationDialog } from '@ui/components.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';
import { ConfigSetting, UIContext } from '@ui/types.js';
import { getPaginatedItems, getSystemsByCategory, getVisibleCategories, configHandlers as uiConfigHandlers } from '@ui/uiUtils.js';

const uiConfigHandlerKeys = Object.keys(uiConfigHandlers);
const uiConfigHandlerEntries = Object.entries(uiConfigHandlers);
const systemOptionsCache = ['All Systems', ...uiConfigHandlerKeys];

export async function showConfigCategoryPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const form = new ActionFormBuilder().title('Configuration');
    const categories = getVisibleCategories(player);
    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(categories, page);

    for (const cat of paginated) {
        if (!isDefined(cat)) continue;
        form.button(cat.title, cat.icon, async () => {
            await showConfigSubCategoryPanel(player, cat.id, { page: 1 });
        });
    }

    if (page > 1) {
        form.button('§l< Previous Page', undefined, async () => {
            await showConfigCategoryPanel(player, { ...context, page: page - 1 });
        });
    }
    if (page * 10 < categories.length) {
        form.button('§lNext Page >', undefined, async () => {
            await showConfigCategoryPanel(player, { ...context, page: page + 1 });
        });
    }

    if (hasPermission(player, 'ui.panel.owner')) {
        form.button('§l§4Reset Settings§r', 'textures/ui/wysiwyg_reset', async () => {
            void showConfigResetPanel(player, { page: 1 });
        });
    }

    form.addBackButton(async () => {
        const { showStaffDashboardPanel } = await import('./adminPanel.js');
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showConfigSubCategoryPanel(player: mc.Player, category: string, context: UIContext = {}): Promise<void> {
    const title =
        category
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .trim()
            .replace(/^./, (str) => str.toUpperCase()) + ' Configuration';

    const form = new ActionFormBuilder().title(title);
    const systems = getSystemsByCategory(player, category);
    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(systems, page);

    for (const sys of paginated) {
        if (!isDefined(sys)) continue;
        form.button(sys.title, sys.icon, async () => {
            if (sys.id.startsWith('config_')) {
                await showConfigSystemPanel(player, sys.id.replace('config_', ''));
            } else {
                await showPanel(player, sys.id, { page: 1 });
            }
        });
    }

    if (page > 1) {
        form.button('§l< Previous Page', undefined, async () => {
            await showConfigSubCategoryPanel(player, category, { ...context, page: page - 1 });
        });
    }
    if (page * 10 < systems.length) {
        form.button('§lNext Page >', undefined, async () => {
            await showConfigSubCategoryPanel(player, category, { ...context, page: page + 1 });
        });
    }

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigResetPanel(player: mc.Player, context: UIContext = {}): Promise<void> {
    const form = new ActionFormBuilder().title('Reset Configuration');
    const categories = getVisibleCategories(player);

    // reset all
    categories.push({
        id: 'resetAll',
        title: '§l§cReset All Systems',
        icon: 'textures/ui/trash'
    });

    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(categories, page);

    for (const cat of paginated) {
        if (!isDefined(cat)) continue;
        if (cat.id === 'resetAll') {
            form.button('§l§4Reset All Systems', 'textures/ui/trash', async () => {
                _handleResetAll(player).catch((e) => {
                    void e;
                });
            });
        } else {
            form.button(`Reset ${cat.title}`, cat.icon, async () => {
                void showConfigResetCategoryPanel(player, cat.id, { page: 1 });
            });
        }
    }

    if (page > 1) {
        form.button('§l< Previous Page', undefined, async () => {
            await showConfigResetPanel(player, { ...context, page: page - 1 });
        });
    }
    if (page * 10 < categories.length) {
        form.button('§lNext Page >', undefined, async () => {
            await showConfigResetPanel(player, { ...context, page: page + 1 });
        });
    }

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigResetCategoryPanel(player: mc.Player, category: string, context: UIContext = {}): Promise<void> {
    const form = new ActionFormBuilder().title(`Reset ${category}`);
    const systems = getSystemsByCategory(player, category);

    form.button(`§l§4Reset All ${category}§r`, 'textures/ui/trash', async () => {
        void _handleResetCategory(player, category);
    });

    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(systems, page);

    for (const sys of paginated) {
        if (!isDefined(sys)) continue;
        form.button(`§4Reset ${sys.title}`, sys.icon, async () => {
            void _handleResetSystem(player, sys.id);
        });
    }

    if (page > 1) {
        form.button('§l< Previous Page', undefined, async () => {
            await showConfigResetCategoryPanel(player, category, { ...context, page: page - 1 });
        });
    }
    if (page * 10 < systems.length) {
        form.button('§lNext Page >', undefined, async () => {
            await showConfigResetCategoryPanel(player, category, { ...context, page: page + 1 });
        });
    }

    form.addBackButton(async () => {
        await showConfigResetPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigTransferPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder().title('Configuration Transfer');

    form.button('Export Configurations', 'textures/ui/arrow_right', async () => {
        await showConfigExportPanel(player);
    });

    form.button('Import Configurations', 'textures/ui/arrow_left', async () => {
        await showConfigImportPanel(player);
    });

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigSystemPanel(player: mc.Player, categoryId: string): Promise<void> {
    const category = configPanelSchema.find((c) => c.id === categoryId);
    if (!isDefined(category)) {
        await showConfigCategoryPanel(player, { page: 1 });
        return;
    }

    const configSource = isNonEmptyString(category.configSource) ? category.configSource : 'main';
    const handlers = uiConfigHandlers as Record<string, { get: () => unknown; save: (cfg: unknown) => void }>;
    const handler = handlers[configSource];
    if (!isDefined(handler)) {
        await showConfigCategoryPanel(player, { page: 1 });
        return;
    }

    const config = handler.get() as Record<string, any>;
    const settings = category.settings as ConfigSetting[];
    const validSettings = settings.filter((s) => ['toggle', 'textField', 'dropdown'].includes(s.type));

    const form = new ModalFormBuilder<Record<string, any>>().title(category.title);

    for (const setting of validSettings) {
        const currentValue = getValueFromPath(config, setting.key);
        switch (setting.type) {
            case 'toggle': {
                form.toggle(setting.key, setting.label, Boolean(currentValue));
                break;
            }
            case 'textField': {
                const val = currentValue ?? '';
                const strVal = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : JSON.stringify(val);
                form.textField(setting.key, setting.label, isNonEmptyString(setting.description) ? setting.description : '', strVal);
                break;
            }
            case 'dropdown': {
                const options = setting.options ?? [];
                const index = setting.key === 'logLevel' && typeof currentValue === 'number' ? currentValue : options.indexOf(currentValue as string);
                form.dropdown(setting.key, setting.label, options, Math.max(0, index));
                break;
            }
        }
    }

    const res = await form.show(player);
    if (res.canceled) {
        if (isNonEmptyString(category.category)) {
            await showConfigSubCategoryPanel(player, category.category, { page: 1 });
        } else {
            await showConfigCategoryPanel(player, { page: 1 });
        }
        return;
    }

    const updates = _processFormValues(validSettings, res.formValues!, config as any) as any;
    _saveConfigUpdates(handler, configSource, updates);
    player.sendMessage('§2Configuration saved.');

    if (categoryId === 'data') {
        const { restartAutoSave } = await import('@core/dataManager.js');
        restartAutoSave();
    }
    if (configSource === 'xray') refreshXrayCache();

    if (isNonEmptyString(category.category)) {
        await showConfigSubCategoryPanel(player, category.category, { page: 1 });
    } else {
        await showConfigCategoryPanel(player, { page: 1 });
    }
}

export async function showConfigExportPanel(player: mc.Player): Promise<void> {
    if (!hasPermission(player, 'ui.panel.owner')) {
        player.sendMessage('§4You do not have permission to export configurations.');
        return showConfigTransferPanel(player);
    }
    const form = new ModalFormBuilder<{ system: number; info: string }>().title('Export Configuration');
    form.dropdown('system', 'Select System to Export', systemOptionsCache, 0);
    form.textField('info', 'Action Information', 'The exported JSON data will appear in a new window after you submit.', 'Submit to generate and receive export data.');

    const res = await form.show(player);
    if (res.canceled) return showConfigTransferPanel(player);

    const selectedSystem = systemOptionsCache[res.formValues!.system];
    let exportData: unknown;
    if (selectedSystem === 'All Systems') {
        const allData: Record<string, unknown> = {};
        for (const [key, handler] of uiConfigHandlerEntries) {
            allData[key] = handler.get();
        }
        exportData = allData;
    } else if (isDefined(selectedSystem) && isDefined(uiConfigHandlers[selectedSystem])) {
        exportData = uiConfigHandlers[selectedSystem].get();
    } else {
        player.sendMessage('§4Invalid system selected.');
        return showConfigTransferPanel(player);
    }

    try {
        const jsonString = JSON.stringify(exportData);
        const dataForm = new ModalFormBuilder<{ out: string }>().title('Exported Data');
        dataForm.textField('out', 'Copy the data below:', 'JSON Data', jsonString);
        await dataForm.show(player);
        await showConfigTransferPanel(player);
    } catch (error) {
        player.sendMessage(`§4Failed to generate export data. Check console for errors.`);
        errorLog(`[UIManager] Failed to export config: ${String(error)}`);
        return showConfigTransferPanel(player);
    }
}

export async function showConfigImportPanel(player: mc.Player): Promise<void> {
    if (!hasPermission(player, 'ui.panel.owner')) {
        player.sendMessage('§4You do not have permission to import configurations.');
        return showConfigTransferPanel(player);
    }
    const form = new ModalFormBuilder<{ system: number; json: string }>().title('Import Configuration');
    form.dropdown('system', 'Select Target System', systemOptionsCache, 0);
    form.textField('json', 'Paste JSON Config Data', 'Paste the condensed JSON text here', '');

    const res = await form.show(player);
    if (res.canceled) return showConfigTransferPanel(player);

    const selectedSystem = systemOptionsCache[res.formValues!.system];
    const jsonString = res.formValues!.json;

    if (!isNonEmptyString(jsonString) || jsonString.trim() === '') {
        player.sendMessage('§4You must provide JSON data to import.');
        return showConfigTransferPanel(player);
    }

    let importData: any;
    try {
        importData = JSON.parse(jsonString, (key, value) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
            return value;
        });
    } catch {
        player.sendMessage('§4Invalid JSON format. Please ensure you copied the entire exported string correctly.');
        return showConfigTransferPanel(player);
    }

    try {
        if (selectedSystem === 'All Systems') {
            const parsedData = importData as Record<string, any>;
            for (const [key, handler] of uiConfigHandlerEntries) {
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
            return showConfigTransferPanel(player);
        }

        if (selectedSystem === 'All Systems' || selectedSystem === 'xray') refreshXrayCache();
        if (selectedSystem === 'All Systems' || selectedSystem === 'ranks') {
            const { reloadRanks } = await import('@core/rankManager.js');
            reloadRanks();
        }
        if (selectedSystem === 'All Systems' || selectedSystem === 'spawn') {
            const { initializeSpawnProtection } = await import('@features/essentials/spawnProtection.js');
            initializeSpawnProtection();
        }
    } catch (error) {
        player.sendMessage(`§4Failed to apply imported configuration. Check console for errors.`);
        errorLog(`[UIManager] Failed to import config: ${String(error)}`);
    }

    return showConfigTransferPanel(player);
}

// Helpers

function _processFormValues(settings: ConfigSetting[], values: Record<string, any>, config: Record<string, any>): Record<string, unknown> {
    const updates: Record<string, unknown> = {};
    for (const setting of settings) {
        let value = values[setting.key];
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
                    value = undefined;
                } else if (strVal.trim() !== '') {
                    continue;
                }
            }
        }
        updates[setting.key] = value;
    }
    return updates;
}

function _saveConfigUpdates(handler: { get: () => unknown; save: (cfg: unknown) => void }, configSource: string, updates: Record<string, unknown>) {
    if (configSource === 'main') {
        handler.save(updates);
    } else {
        const currentConfig = handler.get() as Record<string, any>;
        for (const key in updates) {
            setValueByPath(currentConfig, key, updates[key]);
        }
        handler.save(currentConfig);
    }
}

async function _handleResetAll(player: mc.Player): Promise<void> {
    await showConfirmationDialog(player, {
        title: 'Confirm Reset All',
        body: 'This action cannot be undone. Are you sure you want to reset ALL system configurations to their default values?',
        confirmButtonText: '§4Yes, Reset All',
        cancelButtonText: '§2No, Cancel',
        onConfirm: () => {
            return Promise.resolve().then(async () => {
                const form = new ModalFormBuilder<{ confirm: string }>().title('Final Confirmation');
                form.textField('confirm', 'Type "confirm" to reset ALL systems.', 'Case-insensitive', '');
                const res = await form.show(player);
                if (res.canceled) return showConfigResetPanel(player);

                if (res.formValues!.confirm.trim().toLowerCase() !== 'confirm') {
                    player.sendMessage('§4Final confirmation failed. Reset canceled.');
                    return showConfigResetPanel(player);
                }
                for (const key of uiConfigHandlerKeys) {
                    if (key === 'ranks') continue;
                    resetConfigSection(key);
                }
                player.sendMessage('§aALL configurations have been reset to defaults.');
                await showConfigResetPanel(player);
            });
        },
        onCancel: () => {
            void showConfigResetPanel(player);
        }
    });
}

async function _handleResetCategory(player: mc.Player, category: string): Promise<void> {
    await showConfirmationDialog(player, {
        title: `Confirm Reset: ${category}`,
        body: `Are you sure you want to reset ALL systems in the ${category} category to default values?`,
        confirmButtonText: '§4Yes, Reset',
        cancelButtonText: '§2No',
        onConfirm: () => {
            const systems = getSystemsByCategory(player, category);
            return Promise.resolve().then(async () => {
                let count = 0;
                for (const sys of systems) {
                    const schema = configPanelSchema.find((c) => c.id === sys.id.replace('config_', ''));
                    if (schema && schema.configSource && schema.configSource !== 'ranks') {
                        resetConfigSection(schema.configSource);
                        count++;
                    }
                }
                player.sendMessage(`§aSuccessfully reset ${count} configurations in category ${category}.`);
                await showConfigResetCategoryPanel(player, category);
            });
        },
        onCancel: () => {
            void showConfigResetCategoryPanel(player, category);
        }
    });
}

async function _handleResetSystem(player: mc.Player, sysId: string): Promise<void> {
    const configId = sysId.replace('config_', '');
    const schema = configPanelSchema.find((c) => c.id === configId);
    if (!schema || !schema.configSource) {
        player.sendMessage(`§cCould not locate config source for ${sysId}.`);
        return;
    }
    const source = schema.configSource;
    await showConfirmationDialog(player, {
        title: `Confirm Reset: ${schema.title}`,
        body: `Are you sure you want to reset ${schema.title} to default values?`,
        confirmButtonText: '§4Yes, Reset',
        cancelButtonText: '§2No',
        onConfirm: () => {
            return Promise.resolve().then(async () => {
                if (source !== 'ranks') {
                    resetConfigSection(source);
                    player.sendMessage(`§aSuccessfully reset ${schema.title} configuration.`);
                } else {
                    player.sendMessage(`§cRank configuration cannot be reset this way.`);
                }
                const cat = schema.category || 'Core';
                await showConfigResetCategoryPanel(player, cat);
            });
        },
        onCancel: () => {
            const cat = schema.category || 'Core';
            void showConfigResetCategoryPanel(player, cat);
        }
    });
}
