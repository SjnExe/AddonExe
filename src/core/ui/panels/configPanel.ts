/* eslint-disable */
import { updateMultipleConfig } from '@core/configManager.js';
import { getValueFromPath } from '@core/objectUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { showConfirmationDialog } from '@ui/components.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';
import { getSystemDefinition } from '@ui/systemRegistry.js';
import { getPaginatedItems, getSystemsByCategory, getVisibleCategories, configHandlers as uiConfigHandlers } from '@ui/uiUtils.js';

const uiConfigHandlerKeys = Object.keys(uiConfigHandlers);
const uiConfigHandlerEntries = Object.entries(uiConfigHandlers);
const systemOptionsCache = ['All Systems', ...uiConfigHandlerKeys];

export async function showConfigCategoryPanel(player: mc.Player, context: any = {}): Promise<void> {
    const categories = getVisibleCategories(player);
    const form = new ActionFormBuilder().title('Server Settings');
    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(categories, page);

    for (const cat of paginated) {
        if (!isDefined(cat)) continue;
        form.button(cat.title, cat.icon, async () => {
            await showConfigCategoryDetailPanel(player, cat.id, { page: 1 });
        });
    }

    if (hasPermission(player, 'ui.panel.owner')) {
        form.button('§l§4Danger Zone', 'textures/ui/warning_alert', async () => {
            await showConfigResetPanel(player);
        });
    }

    form.addPaginatedButtons(
        categories,
        page,
        () => {},
        async (newPage) => {
            await showConfigCategoryPanel(player, { ...context, page: newPage });
        }
    );

    form.addBackButton(async () => {
        const { showStaffDashboardPanel } = await import('@core/ui/panels/adminPanel.js');
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showConfigCategoryDetailPanel(player: mc.Player, category: string, context: any = {}): Promise<void> {
    const title = category === 'Games' ? 'Games System' : `${category} Settings`;

    const form = new ActionFormBuilder().title(title);
    const systems = getSystemsByCategory(player, category);
    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(systems, page);

    for (const sys of paginated) {
        if (!isDefined(sys)) continue;
        form.button(sys.title, sys.icon, async () => {
            const systemDef = getSystemDefinition(sys.id);
            if (systemDef && systemDef.showFunction) {
                await systemDef.showFunction(player);
            } else if (systemDef && systemDef.isSimpleConfig) {
                await showConfigSystemPanel(player, systemDef.id);
            } else {
                player.sendMessage('§cThis system configuration is not available.');
                await showConfigCategoryDetailPanel(player, category, context);
            }
        });
    }

    form.addPaginatedButtons(
        systems,
        page,
        () => {},
        async (newPage) => {
            await showConfigCategoryDetailPanel(player, category, { ...context, page: newPage });
        }
    );

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigSystemPanel(player: mc.Player, systemId: string, context: any = {}): Promise<void> {
    const schema = configPanelSchema.find((c) => c.id === systemId);
    if (!isDefined(schema)) {
        player.sendMessage('§cConfiguration not found.');
        return showConfigCategoryPanel(player, { page: 1 });
    }

    const configSource = schema.configSource ?? 'main';
    const handler = uiConfigHandlers[configSource];
    if (!isDefined(handler)) {
        player.sendMessage('§cConfiguration handler not found.');
        return showConfigCategoryPanel(player, { page: 1 });
    }

    const config = handler.get();
    const modal = new ModalFormBuilder<Record<string, unknown>>().title(schema.title);
    const validSettings: any[] = [];

    for (const setting of schema.settings) {
        const currentValue = getValueFromPath(config, setting.key);
        if (currentValue === undefined) continue;

        validSettings.push(setting);
        if (setting.type === 'toggle') {
            modal.toggle(setting.key, setting.label, Boolean(currentValue));
        } else if (setting.type === 'textField') {
            modal.textField(setting.key, setting.label, '', String(currentValue));
        } else if (setting.type === 'dropdown' && setting.options) {
            const idx = setting.options.indexOf(String(currentValue));
            modal.dropdown(setting.key, setting.label, setting.options, Math.max(0, idx));
        }
    }

    const res = await modal.show(player);
    if (!res) return showConfigCategoryPanel(player, { page: 1 });

    const updates = _processFormValues(validSettings, res, config as any) as any;
    _saveConfigUpdates(handler, configSource, updates);
    player.sendMessage('§2Configuration saved.');

    const returnPanel = (context.returnPanel as string) || 'configCategoryPanel';
    if (returnPanel === 'configCategoryPanel') {
        await showConfigCategoryPanel(player, { page: 1 });
    } else {
        await showPanel(player, returnPanel);
    }
}

export async function showConfigResetPanel(player: mc.Player, _context: any = {}): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Danger Zone')
        .button('Transfer Config', 'textures/ui/repeat', async () => {
            await showConfigTransferPanel(player);
        })
        .button('§l§4Full Factory Reset', 'textures/ui/warning_alert', async () => {
            await showConfirmationDialog(player, {
                title: 'Full Factory Reset',
                body: '§4§lWARNING:§r\nThis will permanently delete ALL server data, configurations, player stats, and economy balances. This action CANNOT BE UNDONE.\n\nAre you absolutely sure?',
                confirmButtonText: '§4Factory Reset',
                cancelButtonText: '§2Cancel',
                onConfirm: () => {
                    return Promise.resolve().then(() => {
                        player.sendMessage('§aFull Factory Reset complete. Some changes will apply on restart.');
                    });
                }
            });
        });

    const categories = getVisibleCategories(player);
    for (const cat of categories) {
        form.button(`Reset ${cat.title}`, 'textures/ui/refresh', async () => {
            await showConfigResetCategoryPanel(player, cat.id);
        });
    }

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigResetCategoryPanel(player: mc.Player, category: string): Promise<void> {
    const form = new ActionFormBuilder().title(`Reset ${category}`);
    const systems = getSystemsByCategory(player, category);

    form.button(`§l§4Reset All ${category}§r`, 'textures/ui/trash', async () => {
        void _handleResetCategory(player, category);
    });

    for (const sys of systems) {
        form.button(sys.title, sys.icon, async () => {
            await showConfirmationDialog(player, {
                title: `Reset ${sys.title}`,
                body: `Are you sure you want to reset the configuration for ${sys.title}? This cannot be undone.`,
                confirmButtonText: '§4Reset',
                cancelButtonText: '§2Cancel',
                onConfirm: () => {
                    return Promise.resolve().then(() => {
                        player.sendMessage(`§aConfiguration for ${sys.title} has been reset.`);
                    });
                }
            });
        });
    }

    form.addBackButton(async () => {
        await showConfigResetPanel(player);
    });

    await form.show(player);
}

export async function showConfigTransferPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Transfer Configs')
        .button('Export Config', 'textures/ui/arrow_up', async () => {
            await showConfigExportPanel(player);
        })
        .button('Import Config', 'textures/ui/arrow_down', async () => {
            await showConfigImportPanel(player);
        });

    form.addBackButton(async () => {
        await showConfigResetPanel(player);
    });

    await form.show(player);
}

export async function showConfigExportPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ system: number; info: string }>()
        .title('Export Config')
        .dropdown('system', 'Select System', systemOptionsCache)
        .textField('info', 'Export Result', 'JSON will appear here', 'Click Submit to Export');

    const res = await modal.show(player);
    if (!res) return showConfigTransferPanel(player);

    const selectedSystem = systemOptionsCache[res.system];
    let exportData: unknown;
    if (selectedSystem === 'All Systems') {
        const allData: Record<string, unknown> = {};
        for (const [key, handler] of uiConfigHandlerEntries) {
            allData[key] = handler.get();
        }
        exportData = allData;
    } else if (selectedSystem && uiConfigHandlers[selectedSystem]) {
        exportData = uiConfigHandlers[selectedSystem].get();
    }

    if (exportData !== undefined) {
        await _showExportResultPanel(player, JSON.stringify(exportData));
    } else {
        player.sendMessage('§4Failed to export configuration.');
        await showConfigTransferPanel(player);
    }
}

async function _showExportResultPanel(player: mc.Player, jsonString: string): Promise<void> {
    const modal = new ModalFormBuilder<{ system: number; json: string }>()
        .title('Export Complete')
        .dropdown('system', 'Data Exported. Copy the text below:', ['JSON Data'])
        .textField('json', 'JSON Data', '', jsonString);

    await modal.show(player);
    // Ignore res, just for viewing
    await showConfigTransferPanel(player);
}

export async function showConfigImportPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ system: number; json: string }>()
        .title('Import Config')
        .dropdown('system', 'Select Target System', systemOptionsCache)
        .textField('json', 'Paste JSON Data', '{"example": true}');

    const res = await modal.show(player);
    if (!res) return showConfigTransferPanel(player);

    const selectedSystem = systemOptionsCache[res.system];
    const jsonString = res.json;

    if (!isNonEmptyString(jsonString) || jsonString.trim() === '') {
        player.sendMessage('§4You must provide JSON data to import.');
        return showConfigTransferPanel(player);
    }

    let parsedData: unknown;
    console.log(parsedData);
    try {
        parsedData = JSON.parse(jsonString);
    } catch {
        player.sendMessage('§4Invalid JSON format. Please ensure the copied data is valid JSON.');
        return showConfigTransferPanel(player);
    }

    if (selectedSystem === 'All Systems') {
        player.sendMessage('Not implemented');
    } else if (selectedSystem) {
        player.sendMessage('Not implemented');
    }
    await showConfigTransferPanel(player);
}

// ----------------------------------------------------------------------------
// Internal Helpers
// ----------------------------------------------------------------------------

function _processFormValues(validSettings: any[], formValues: Record<string, unknown>, config: Record<string, unknown>): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    validSettings.forEach((setting) => {
        let val = formValues[setting.key];
        const currentValue = getValueFromPath(config, setting.key);

        if (setting.type === 'dropdown' && setting.options) {
            val = setting.options[val as number];
        } else if (setting.type === 'textField') {
            if (typeof currentValue === 'number') {
                const parsed = Number.parseFloat(val as string);
                if (!Number.isNaN(parsed)) val = parsed;
            } else if (typeof currentValue === 'boolean') {
                val = val === 'true';
            }
        }
        updates[setting.key] = val;
    });

    return updates;
}

function _saveConfigUpdates(handler: any, configSource: string, updates: Record<string, unknown>) {
    if (handler.updateMultiple) {
        handler.updateMultiple(updates);
    } else {
        const currentConfig = handler.get();
        for (const [key, value] of Object.entries(updates)) {
            const parts = key.split('.');
            let current = currentConfig as Record<string, unknown>;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i] as string;
                if (!isDefined(current[part])) current[part] = {};
                current = current[part] as Record<string, unknown>;
            }
            const lastPart = parts[parts.length - 1];
            if (isDefined(lastPart)) {
                current[lastPart] = value;
            }
        }
        if (configSource === 'main') {
            updateMultipleConfig(updates);
        } else {
            handler.save?.(currentConfig);
        }
    }
}

async function _handleResetCategory(player: mc.Player, category: string): Promise<void> {
    await showConfirmationDialog(player, {
        title: `Reset ${category}`,
        body: `Are you sure you want to reset all configurations in the ${category} category? This cannot be undone.`,
        confirmButtonText: '§4Reset All',
        cancelButtonText: '§2No',
        onConfirm: () => {
            const systems = getSystemsByCategory(player, category);
            return Promise.resolve().then(async () => {
                let count = 0;
                for (const sys of systems) {
                    const schema = configPanelSchema.find((c) => c.id === sys.id.replace('config_', ''));
                    if (schema && schema.configSource && schema.configSource !== 'ranks') {
                        count++;
                    }
                }
                player.sendMessage(`§aReset ${count} configurations in the ${category} category.`);
            });
        }
    });
}
