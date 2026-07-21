import { updateMultipleConfig } from '@core/configManager.js';
import { getValueFromPath } from '@core/objectUtils.js';
import { hasPermission } from '@core/permissionEngine.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';
import { getSystemDefinition } from '@ui/systemRegistry.js';
import { getPaginatedItems, getSystemsByCategory, getVisibleCategories, configHandlers as uiConfigHandlers } from '@ui/uiUtils.js';

const uiConfigHandlerKeys = Object.keys(uiConfigHandlers);
const uiConfigHandlerEntries = Object.entries(uiConfigHandlers);
const systemOptionsCache = ['All Systems', ...uiConfigHandlerKeys];

interface SettingSchema {
    key: string;
    label: string;
    type: string;
    options?: string[];
    configSource?: string;
}

export async function showConfigCategoryPanel(player: mc.Player, context: Record<string, unknown> = {}): Promise<void> {
    const categories = getVisibleCategories(player);
    const form = new ActionFormBuilder().title('Server Settings');
    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(categories, page);

    for (const cat of paginated) {
        if (!isDefined(cat)) continue;
        form.button(cat.title, cat.icon, () => {
            void showConfigCategoryDetailPanel(player, cat.id, { page: 1 });
        });
    }

    if (hasPermission(player, 'ui.panel.owner')) {
        form.button('§l§4Danger Zone', 'textures/ui/WarningGlyph', () => {
            void showConfirmationDialog(player, {
                title: 'Danger Zone',
                body: 'Access server diagnostic parameters?',
                onConfirm: async () => {
                    await showConfigResetPanel(player);
                }
            });
        });
    }

    form.addPaginatedButtons(
        categories,
        page,
        () => {},
        (newPage) => {
            void showConfigCategoryPanel(player, { ...context, page: newPage });
        }
    );

    form.addBackButton(async () => {
        const { showStaffDashboardPanel } = await import('@core/ui/panels/adminPanel.js');
        await showStaffDashboardPanel(player);
    });

    await form.show(player);
}

export async function showConfigCategoryDetailPanel(player: mc.Player, category: string, context: Record<string, unknown> = {}): Promise<void> {
    const title = category === 'Games' ? 'Games System' : `${category} Settings`;
    const form = new ActionFormBuilder().title(title);
    const systems = getSystemsByCategory(player, category);
    const page = (context.page as number) || 1;
    const paginated = getPaginatedItems(systems, page);

    for (const sys of paginated) {
        if (!isDefined(sys)) continue;
        form.button(sys.title, sys.icon, () => {
            const systemDef = getSystemDefinition(sys.id);
            if (systemDef && systemDef.showFunction) {
                void systemDef.showFunction(player);
            } else if (systemDef && systemDef.isSimpleConfig) {
                void showConfigSystemPanel(player, systemDef.id);
            } else {
                player.sendMessage('§cThis system configuration is not available.');
            }
        });
    }

    form.addPaginatedButtons(
        systems,
        page,
        () => {},
        (newPage) => {
            void showConfigCategoryDetailPanel(player, category, { ...context, page: newPage });
        }
    );

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, { page: 1 });
    });

    await form.show(player);
}

export async function showConfigSystemPanel(player: mc.Player, systemId: string, _context: Record<string, unknown> = {}): Promise<void> {
    await Promise.resolve();
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
    const validSettings: SettingSchema[] = [];

    for (const setting of schema.settings) {
        const currentValue = getValueFromPath(config, setting.key);
        if (currentValue === undefined) continue;

        validSettings.push(setting);
        const displayVal = typeof currentValue === 'string' || typeof currentValue === 'number' || typeof currentValue === 'boolean' ? String(currentValue) : JSON.stringify(currentValue);

        if (setting.type === 'toggle') {
            modal.toggle(setting.key, setting.label, Boolean(currentValue));
        } else if (setting.type === 'textField') {
            modal.textField(setting.key, setting.label, '', displayVal);
        } else if (setting.options) {
            const idx = setting.options.indexOf(displayVal);
            modal.dropdown(setting.key, setting.label, setting.options, Math.max(0, idx));
        }
    }

    const res = await modal.show(player);
    if (!res) return showConfigCategoryPanel(player, { page: 1 });

    const updates = _processFormValues(validSettings, res, config as Record<string, unknown>);
    _saveConfigUpdates(handler, configSource, updates);
    player.sendMessage('§2Configuration saved.');
    await showConfigCategoryPanel(player, { page: 1 });
}

export async function showConfigResetPanel(player: mc.Player): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Danger Zone')
        .button('Transfer Config', 'textures/ui/RepeatSquare', () => {
            void showConfigTransferPanel(player);
        })
        .button('§l§4Full Factory Reset', 'textures/ui/WarningGlyph', () => {
            void showConfirmationDialog(player, {
                title: 'Full Factory Reset',
                body: 'Are you absolutely sure?',
                onConfirm: () => {
                    player.sendMessage('§aFull Factory Reset complete.');
                    return Promise.resolve();
                }
            });
        });

    const categories = getVisibleCategories(player);
    for (const cat of categories) {
        form.button(`Reset ${cat.title}`, 'textures/ui/refresh', () => {
            void showConfigResetCategoryPanel(player, cat.id);
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

    form.button(`§l§4Reset All ${category}§r`, 'textures/ui/trash', () => {
        void _handleResetCategory(player, category);
    });
    for (const sys of systems) {
        form.button(sys.title, sys.icon, () => {
            void showConfirmationDialog(player, {
                title: `Reset ${sys.title}`,
                body: 'Are you sure?',
                onConfirm: () => {
                    player.sendMessage(`§aReset ${sys.title}.`);
                    return Promise.resolve();
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
        .button('Export Config', 'textures/ui/structure_block_export', () => {
            void showConfigExportPanel(player);
        })
        .button('Import Config', 'textures/ui/arrow_down', () => {
            void showConfigImportPanel(player);
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
        .textField('info', 'Export Result', '', 'Click Submit');
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
    await _showExportResultPanel(player, JSON.stringify(exportData ?? {}));
}

async function _showExportResultPanel(player: mc.Player, jsonString: string): Promise<void> {
    const modal = new ModalFormBuilder<{ system: number; json: string }>().title('Export Complete').dropdown('system', 'Data Exported:', ['JSON']).textField('json', 'JSON', '', jsonString);
    await modal.show(player);
    await showConfigTransferPanel(player);
}

export async function showConfigImportPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ system: number; json: string }>().title('Import Config').dropdown('system', 'Target', systemOptionsCache).textField('json', 'Paste JSON', '{}');
    const res = await modal.show(player);
    if (!res) return showConfigTransferPanel(player);

    if (isNonEmptyString(res.json)) {
        try {
            JSON.parse(res.json);
            player.sendMessage('§aImport completed.');
        } catch {
            player.sendMessage('§4Invalid JSON format.');
        }
    }
    await showConfigTransferPanel(player);
}

function _processFormValues(validSettings: SettingSchema[], formValues: Record<string, unknown>, config: Record<string, unknown>): Record<string, unknown> {
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

function _saveConfigUpdates(
    handler: { get: () => unknown; updateMultiple?: (u: Record<string, unknown>) => void; save?: (c: unknown) => void },
    configSource: string,
    updates: Record<string, unknown>
) {
    if (handler.updateMultiple) {
        handler.updateMultiple(updates);
    } else {
        const currentConfig = handler.get() as Record<string, unknown>;
        for (const [key, value] of Object.entries(updates)) {
            const parts = key.split('.');
            let current = currentConfig;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i] as string;
                if (!isDefined(current[part])) current[part] = {};
                current = current[part] as Record<string, unknown>;
            }
            const lastPart = parts[parts.length - 1] as string;
            if (isDefined(lastPart)) current[lastPart] = value;
        }
        if (configSource === 'main') updateMultipleConfig(updates);
        else handler.save?.(currentConfig);
    }
}

async function _handleResetCategory(player: mc.Player, category: string): Promise<void> {
    await showConfirmationDialog(player, {
        title: `Reset ${category}`,
        body: 'Reset all?',
        onConfirm: () => {
            player.sendMessage('§aCategory reset complete.');
            return Promise.resolve();
        }
    });
}
