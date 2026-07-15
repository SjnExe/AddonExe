import { errorLog } from '@core/logger.js';
import { getValueFromPath, setValueByPath } from '@core/objectUtils.js';
import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

import { configPanelSchema } from '@ui/configPanelRegistry.js';
import { configHandlers as uiConfigHandlers } from '@ui/uiUtils.js';
const uiConfigHandlerEntries = Object.entries(uiConfigHandlers);

import { getSystemRegistry } from '@ui/systemRegistry.js';

let systemOptionsCache: string[] = [];

function getSystemOptions(): string[] {
    if (systemOptionsCache.length > 0) return systemOptionsCache;
    systemOptionsCache = ['All Systems', ...Object.keys(uiConfigHandlers)];
    return systemOptionsCache;
}

export async function showConfigCategoryPanel(player: mc.Player, context: any = {}): Promise<void> {
    const form = new ActionFormBuilder().title('Configuration');

    if (!hasPermission(player, 'ui.panel.admin')) {
        player.sendMessage('§cYou do not have permission to view configurations.');
        return;
    }

    const systems = getSystemRegistry();
    const categories = new Set<string>();

    systems.forEach((system) => {
        if (!system.hidden) {
            categories.add(system.category ?? 'Uncategorized');
        }
    });

    const categoryList = Array.from(categories).sort();

    for (const cat of categoryList) {
        form.button(cat, 'textures/ui/settings_glyph_color_2x', async () => {
            await showConfigSubCategoryPanel(player, cat, context);
        });
    }

    form.button('§4Reset Configurations', 'textures/ui/refresh', async () => {
        await showConfigResetPanel(player, context);
    });

    if (hasPermission(player, 'ui.panel.owner')) {
        form.button('Export/Import Configs', 'textures/ui/refresh', async () => {
            await showConfigTransferPanel(player, context);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'staffDashboardPanel');
    });

    await form.show(player);
}

export async function showConfigSubCategoryPanel(player: mc.Player, category: string, context: any = {}): Promise<void> {
    if (!hasPermission(player, 'ui.panel.admin')) {
        player.sendMessage('§cYou do not have permission to view configurations.');
        return;
    }
    const form = new ActionFormBuilder().title(`Config: ${category}`);
    const systems = getSystemRegistry();
    const matchingSystems = systems.filter((s) => (s.category ?? 'Uncategorized') === category && !s.hidden).sort((a, b) => a.title.localeCompare(b.title));

    for (const sys of matchingSystems) {
        form.button(sys.title, sys.icon, async () => {
            if (sys.isSimpleConfig) {
                await showSimpleConfigPanel(player, sys.id, category, context);
            } else {
                await showPanel(player, sys.configPanelId, context);
            }
        });
    }

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, context);
    });

    await form.show(player);
}

export async function showSimpleConfigPanel(player: mc.Player, systemId: string, parentCategory: string, context: any = {}): Promise<void> {
    const schema = configPanelSchema.find((s) => s.id === systemId);
    if (!schema) {
        player.sendMessage(`§cNo config schema found for ${systemId}.`);
        return showConfigSubCategoryPanel(player, parentCategory, context);
    }

    const configSource = schema.configSource ?? 'main';
    const handlers = uiConfigHandlers as Record<string, { get: () => unknown; save: (cfg: unknown) => void }>;
    const handler = handlers[configSource];
    if (!handler) {
        player.sendMessage(`§cNo config handler found for source ${configSource}.`);
        return showConfigSubCategoryPanel(player, parentCategory, context);
    }

    const config = handler.get() as Record<string, any>;
    const form = new ModalFormBuilder().title(`Edit: ${schema.title}`);

    for (const setting of schema.settings) {
        const currentValue = getValueFromPath(config, setting.key);

        if (setting.type === 'toggle') {
            form.toggle(setting.key, setting.label, !!currentValue);
        } else if (setting.type === 'dropdown') {
            const options = setting.options ?? [];
            let defaultIndex = 0;
            if (setting.key === 'logLevel' && typeof currentValue === 'number') {
                defaultIndex = currentValue;
            } else if (typeof currentValue === 'string') {
                defaultIndex = Math.max(0, options.indexOf(currentValue));
            }
            form.dropdown(setting.key, setting.label, options, defaultIndex);
        } else if (setting.type === 'textField') {
            const currentStr = currentValue !== undefined ? String(currentValue) : '';
            form.textField(setting.key, setting.label, setting.description ?? '', currentStr);
        }
    }

    const result = await form.show(player);
    if (result.canceled) {
        return showConfigSubCategoryPanel(player, parentCategory, context);
    }

    const updates: Record<string, any> = {};
    const validSettings = schema.settings.filter((s) => ['toggle', 'textField', 'dropdown'].includes(s.type));
    for (const setting of validSettings) {
        if (!result.formValues) continue;
        let value = result.formValues[setting.key];

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
                    continue; // Skip invalid
                }
            }
        }
        updates[setting.key] = value;
    }

    if (configSource === 'main') {
        handler.save(updates);
    } else {
        const currentConfig = handler.get() as Record<string, any>;
        for (const key in updates) {
            setValueByPath(currentConfig, key, updates[key]);
        }
        handler.save(currentConfig);
    }

    player.sendMessage('§2Configuration saved.');
    if (systemId === 'data') {
        await import('@core/dataManager.js').then(({ restartAutoSave }) => restartAutoSave());
    }
    if (configSource === 'xray') {
        const { refreshXrayCache } = await import('@features/anticheat/xrayDetection.js');
        refreshXrayCache();
    }

    await showConfigSubCategoryPanel(player, parentCategory, context);
}

export async function showConfigResetPanel(player: mc.Player, context: any = {}): Promise<void> {
    if (!hasPermission(player, 'ui.panel.owner')) {
        player.sendMessage('§cYou do not have permission to reset configurations.');
        return;
    }
    const form = new ActionFormBuilder().title('Reset Configurations');

    form.button('§4Reset ALL Systems', 'textures/ui/warning_alex', async () => {
        await handleSystemReset(player, 'All Systems', context);
    });

    const systems = getSystemRegistry();
    for (const sys of systems) {
        form.button(`Reset ${sys.title}`, sys.icon, async () => {
            await handleSystemReset(player, sys.id, context);
        });
    }

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, context);
    });

    await form.show(player);
}

import { resetConfigSection } from '@core/configManager.js';

async function handleSystemReset(player: mc.Player, systemId: string, context: any): Promise<void> {
    const form = new ModalFormBuilder()
        .title(`Confirm Reset`)
        .textField('confirm', `Are you sure you want to reset ${systemId} to default settings?\nType 'confirm' to proceed.\n\n§4This action cannot be undone.`, 'Type confirm here');

    const response = await form.show(player);
    if (response.canceled || response.formValues?.confirm !== 'confirm') {
        player.sendMessage('§cReset canceled or confirmation failed.');
        return showConfigResetPanel(player, context);
    }

    if (systemId === 'All Systems') {
        await resetConfigSection('all', player);
        player.sendMessage('§aSuccessfully reset All Systems to default settings.');
    } else {
        const result = await resetConfigSection(systemId, player);
        if (result.success) {
            player.sendMessage(`§aSuccessfully reset ${systemId} to default settings.`);
        } else {
            player.sendMessage(`§cCannot reset ${systemId}: ${result.message}`);
        }
    }
    await showConfigResetPanel(player, context);
    return;
}

export async function showConfigTransferPanel(player: mc.Player, context: any = {}): Promise<void> {
    if (!hasPermission(player, 'ui.panel.owner')) {
        player.sendMessage('§cYou do not have permission to manage configurations.');
        return;
    }
    const form = new ActionFormBuilder().title('Config Transfer');

    form.button('Export Config', 'textures/ui/arrow_right', async () => {
        await showConfigExportPanel(player, context);
    });

    form.button('Import Config', 'textures/ui/arrow_left', async () => {
        await showConfigImportPanel(player, context);
    });

    form.addBackButton(async () => {
        await showConfigCategoryPanel(player, context);
    });

    await form.show(player);
}

export async function showConfigExportPanel(player: mc.Player, context: any = {}): Promise<void> {
    if (!hasPermission(player, 'ui.panel.owner')) {
        player.sendMessage('§cYou do not have permission to export configurations.');
        return;
    }
    const options = getSystemOptions();
    const form = new ModalFormBuilder().title('Export Config').dropdown('systemIndex', 'Select System to Export', options);

    const result = await form.show(player);
    if (result.canceled || !result.formValues) return showConfigTransferPanel(player, context);

    const selectedSystem = options[result.formValues.systemIndex as number];
    let exportData: unknown;

    if (selectedSystem === 'All Systems') {
        const allData: Record<string, unknown> = {};
        for (const [key, handler] of uiConfigHandlerEntries) {
            allData[key] = (handler as any).get();
        }
        exportData = allData;
    } else if (isDefined(selectedSystem) && isDefined(uiConfigHandlers[selectedSystem])) {
        exportData = uiConfigHandlers[selectedSystem].get();
    } else {
        player.sendMessage('§4Invalid system selected.');
        return showConfigTransferPanel(player, context);
    }

    try {
        const jsonString = JSON.stringify(exportData);
        const copyForm = new ModalFormBuilder().title('Exported Data').textField('data', 'Copy the data below:', 'JSON Data', jsonString);
        await copyForm.show(player);
    } catch (error) {
        player.sendMessage(`§4Failed to generate export data. Check console for errors.`);
        errorLog(`[UIManager] Failed to export config: ${String(error)}`);
    }

    await showConfigTransferPanel(player, context);
}

export async function showConfigImportPanel(player: mc.Player, context: any = {}): Promise<void> {
    if (!hasPermission(player, 'ui.panel.owner')) {
        player.sendMessage('§cYou do not have permission to import configurations.');
        return;
    }
    const options = getSystemOptions();
    const form = new ModalFormBuilder().title('Import Config').dropdown('systemIndex', 'Select System to Import', options).textField('data', 'JSON Data', 'Paste JSON here');

    const result = await form.show(player);
    if (result.canceled || !result.formValues) return showConfigTransferPanel(player, context);

    const selectedSystem = options[result.formValues.systemIndex as number];
    const jsonString = result.formValues.data as string;

    if (!isNonEmptyString(jsonString) || jsonString.trim() === '') {
        player.sendMessage('§4You must provide JSON data to import.');
        return showConfigTransferPanel(player, context);
    }

    let importData: unknown;
    try {
        importData = JSON.parse(jsonString, (key, value) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
            return value;
        });
    } catch {
        player.sendMessage('§4Invalid JSON format. Please ensure you copied the entire exported string correctly.');
        return showConfigTransferPanel(player, context);
    }

    try {
        if (selectedSystem === 'All Systems') {
            const parsedData = importData as Record<string, unknown>;
            for (const [key, handler] of uiConfigHandlerEntries) {
                if (isDefined(parsedData[key])) {
                    (handler as any).save(parsedData[key]);
                }
            }
            player.sendMessage('§aSuccessfully imported All Systems configurations.');
        } else if (isDefined(selectedSystem) && isDefined(uiConfigHandlers[selectedSystem])) {
            uiConfigHandlers[selectedSystem].save(importData);
            player.sendMessage(`§aSuccessfully imported configuration for ${selectedSystem}.`);
        } else {
            player.sendMessage('§4Invalid system selected.');
            return showConfigTransferPanel(player, context);
        }

        // Trigger reloads
        if (selectedSystem === 'All Systems' || selectedSystem === 'xray') {
            const { refreshXrayCache } = await import('@features/anticheat/xrayDetection.js');
            refreshXrayCache();
        }
        if (selectedSystem === 'All Systems' || selectedSystem === 'ranks') {
            await import('@core/rankManager.js').then(({ reloadRanks }) => reloadRanks());
        }
        if (selectedSystem === 'All Systems' || selectedSystem === 'spawn') {
            await import('@features/essentials/spawnProtection.js').then(({ initializeSpawnProtection }) => initializeSpawnProtection());
        }
    } catch (error) {
        player.sendMessage(`§4Failed to apply imported configuration. Check console for errors.`);
        errorLog(`[UIManager] Failed to import config: ${String(error)}`);
    }

    await showConfigTransferPanel(player, context);
}
