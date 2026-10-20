import { resetConfigSection, updateMultipleConfig } from '@core/config/configManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { showPanel } from '@core/ui/uiManager.js';
import { debugLog } from '@core/utils/logger.js';
import { getValueFromPath } from '@core/utils/objectUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';
import { configPanelSchema } from '@ui/configPanelRegistry.js';
import { getSystemDefinition } from '@ui/systemRegistry.js';
import { getSystemsByCategory, getVisibleCategories, itemsPerPage, configHandlers as uiConfigHandlers } from '@ui/uiUtils.js';

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
    const form = new ActionFormBuilder().title('System Configurations');
    form.body('Select a configuration category to fine-tune server settings:');
    const page = (context.page as number) || 1;

    form.button('§l§6Master Feature Toggles', 'textures/ui/settings_glyph_color_2x', () => {
        void showConfigSystemPanel(player, 'featureToggles');
    });

    const totalPages = Math.ceil(categories.length / itemsPerPage);
    if (page >= totalPages && hasPermission(player, 'ui.panel.owner')) {
        form.button('§l§4Danger Zone & Backup', 'textures/ui/WarningGlyph', () => {
            void showConfirmationDialog(player, {
                title: 'Danger Zone',
                body: 'Access server reset and config backup/restore parameters?',
                onConfirm: async () => {
                    await showConfigResetPanel(player);
                }
            });
        });
    }

    form.addPaginatedButtons(
        categories,
        page,
        (cat, f) => {
            if (isDefined(cat)) {
                f.button(cat.title, cat.icon, () => {
                    void showConfigCategoryDetailPanel(player, cat.id, { page: 1 });
                });
            }
        },
        (newPage) => {
            void showConfigCategoryPanel(player, { ...context, page: newPage });
        },
        itemsPerPage
    );

    form.addBackButton(async () => {
        await showPanel(player, 'staffConfigHub');
    });

    await form.show(player);
}

export async function showConfigCategoryDetailPanel(player: mc.Player, category: string, context: Record<string, unknown> = {}): Promise<void> {
    const title = category === 'Games' ? 'Games System' : `${category} Settings`;
    const form = new ActionFormBuilder().title(title);
    const systems = getSystemsByCategory(player, category);
    const page = (context.page as number) || 1;

    form.addPaginatedButtons(
        systems,
        page,
        (sys, f) => {
            if (isDefined(sys)) {
                f.button(sys.title, sys.icon, () => {
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
        },
        (newPage) => {
            void showConfigCategoryDetailPanel(player, category, { ...context, page: newPage });
        },
        itemsPerPage
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

    const defaultSource = schema.configSource ?? 'main';
    const defaultHandler = uiConfigHandlers[defaultSource];
    if (!isDefined(defaultHandler)) {
        debugLog(`[UI Config] Configuration handler not found for source: ${defaultSource}`);
        player.sendMessage('§cConfiguration handler not found.');
        return showConfigCategoryPanel(player, { page: 1 });
    }

    debugLog(`[UI Config] Loading config for system: ${systemId} from source: ${defaultSource} | Page: ${_context.page ?? 1}`);
    const modal = new CustomFormBuilder<Record<string, unknown>>(schema.title).submitButton('Save Settings');
    const validSettings: SettingSchema[] = [];

    for (const setting of schema.settings) {
        const source = setting.configSource ?? defaultSource;
        const handler = uiConfigHandlers[source];
        if (!isDefined(handler)) {
            continue;
        }
        const config = handler.get();
        const currentValue = getValueFromPath(config, setting.key);
        if (currentValue === undefined && !setting.key.startsWith('spawn.spawnLocation.')) {
            continue;
        }

        validSettings.push({ ...setting, configSource: source });
        let displayVal: string;
        if (currentValue === undefined) {
            displayVal = '';
        } else if (Array.isArray(currentValue)) {
            displayVal = currentValue.join(', ');
        } else {
            displayVal = typeof currentValue === 'string' || typeof currentValue === 'number' || typeof currentValue === 'boolean' ? String(currentValue) : JSON.stringify(currentValue);
        }

        const controlKey = `${source}:${setting.key}`;
        if (setting.type === 'toggle') {
            modal.toggle(controlKey, setting.label, Boolean(currentValue));
        } else if (setting.type === 'textField') {
            modal.textField(controlKey, setting.label, '', displayVal);
        } else if (setting.options) {
            let idx = setting.options.indexOf(displayVal);
            if (idx === -1 && typeof currentValue === 'number') {
                idx = setting.options.findIndex((opt) => opt.startsWith(`${currentValue}:`));
            }
            modal.dropdown(controlKey, setting.label, setting.options, Math.max(0, idx));
        }
    }

    const res = await modal.show(player);
    if (!res) {
        await showPanel(player, 'staffConfigHub');
        return;
    }

    const updatesBySource: Record<string, SettingSchema[]> = {};
    for (const s of validSettings) {
        const src = s.configSource ?? defaultSource;
        if (!updatesBySource[src]) {
            updatesBySource[src] = [];
        }
        updatesBySource[src]!.push(s);
    }

    for (const [src, settingsForSource] of Object.entries(updatesBySource)) {
        const handler = uiConfigHandlers[src];
        if (!isDefined(handler)) {
            continue;
        }
        const srcConfig = handler.get() as Record<string, unknown>;
        const updates = _processFormValues(settingsForSource, res, srcConfig);
        debugLog(`[UI Config] Saving updates for source: ${src} - ${JSON.stringify(updates)}`);
        _saveConfigUpdates(handler, src, updates);
    }

    player.sendMessage('§2Configuration saved.');
    await showPanel(player, 'staffConfigHub');
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
                body: 'Are you absolutely sure you want to reset ALL configurations to default?',
                onConfirm: async () => {
                    const res = await resetConfigSection('all', player);
                    player.sendMessage(res.success ? `§a${res.message}` : `§c${res.message}`);
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
                onConfirm: async () => {
                    const res = await resetConfigSection(sys.id, player);
                    player.sendMessage(res.success ? `§aReset ${sys.title}.` : `§c${res.message}`);
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
    const modal = new CustomFormBuilder<{ system: string; info: string }>('Export Config')
        .dropdown('system', 'Select System', systemOptionsCache)
        .textField('info', 'Export Result', '', 'Click Export')
        .submitButton('Export');
    const res = await modal.show(player);
    if (!res) {
        return showConfigTransferPanel(player);
    }

    const selectedSystem = res.system;
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
    const modal = new CustomFormBuilder<{ system: string; json: string }>('Export Complete')
        .dropdown('system', 'Data Exported:', ['JSON'])
        .textField('json', 'JSON', '', jsonString)
        .submitButton('Done');
    await modal.show(player);
    await showConfigTransferPanel(player);
}

export async function showConfigImportPanel(player: mc.Player): Promise<void> {
    const modal = new CustomFormBuilder<{ system: string; json: string }>('Import Config')
        .dropdown('system', 'Target', systemOptionsCache)
        .textField('json', 'Paste JSON', '{}')
        .submitButton('Import');
    const res = await modal.show(player);
    if (!res) {
        return showConfigTransferPanel(player);
    }

    if (isNonEmptyString(res.json)) {
        try {
            const parsed = JSON.parse(res.json) as Record<string, unknown>;
            if (res.system === 'All Systems') {
                for (const [key, handler] of uiConfigHandlerEntries) {
                    if (isDefined(parsed[key]) && typeof parsed[key] === 'object') {
                        handler.save(parsed[key]);
                    }
                }
            } else if (res.system && uiConfigHandlers[res.system]) {
                uiConfigHandlers[res.system]!.save(parsed);
            }
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
        const controlKey = `${setting.configSource ?? 'main'}:${setting.key}`;
        let val = formValues[controlKey] ?? formValues[setting.key];
        const currentValue = getValueFromPath(config, setting.key);
        if (setting.type === 'dropdown' && setting.options) {
            if (typeof val === 'number') {
                val = setting.options[val] ?? val;
            }
            if (typeof currentValue === 'number' && typeof val === 'string') {
                const parsedInt = Number.parseInt(val, 10);
                if (!Number.isNaN(parsedInt)) {
                    val = parsedInt;
                }
            }
        } else if (setting.type === 'textField') {
            if (Array.isArray(currentValue)) {
                if (typeof val === 'string') {
                    val = val
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                } else {
                    val = currentValue;
                }
            } else if (typeof currentValue === 'number' || setting.key.startsWith('spawn.spawnLocation.')) {
                if (setting.key.startsWith('spawn.spawnLocation.') && typeof val === 'string' && val.trim() === '') {
                    val = undefined;
                } else {
                    const parsed = Number.parseFloat(val as string);
                    if (!Number.isNaN(parsed)) {
                        val = parsed;
                    } else {
                        val = currentValue;
                    }
                }
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
    } else if (configSource === 'main') {
        updateMultipleConfig(updates);
    } else {
        const currentConfig = handler.get() as Record<string, unknown>;
        for (const [key, value] of Object.entries(updates)) {
            const parts = key.split('.');
            let current = currentConfig;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i] as string;
                if (!isDefined(current[part])) {
                    current[part] = {};
                }
                current = current[part] as Record<string, unknown>;
            }
            const lastPart = parts[parts.length - 1] as string;
            if (isDefined(lastPart)) {
                current[lastPart] = value;
            }
        }
        handler.save?.(currentConfig);
    }
}

async function _handleResetCategory(player: mc.Player, category: string): Promise<void> {
    await showConfirmationDialog(player, {
        title: `Reset ${category}`,
        body: 'Reset all systems in this category?',
        onConfirm: async () => {
            const systems = getSystemsByCategory(player, category);
            for (const sys of systems) {
                await resetConfigSection(sys.id, player);
            }
            player.sendMessage('§aCategory reset complete.');
        }
    });
}
