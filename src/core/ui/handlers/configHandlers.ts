import * as mc from '@minecraft/server';
import { ActionFormResponse, ActionFormData, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig, resetConfigSection } from '../../configManager.js';
import * as kitAdminManager from '../../kitAdminManager.js';
import { errorLog } from '../../logger.js';
import { getValueFromPath, setValueByPath } from '../../objectUtils.js';
import { getPlayer } from '../../playerDataManager.js';
import * as rankManager from '../../rankManager.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { showConfirmationDialog } from '../components.js';
import { configPanelSchema, UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems, configHandlers as uiConfigHandlers, getVisibleConfigSystems } from '../uiUtils.js';

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

    if (panelId === 'configCategoryPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'mainPanel', context);

        const sortedSystems = getVisibleConfigSystems(pData);
        const paginatedSystems = getPaginatedItems(sortedSystems, page);

        let buttonIndex = selection - 1;

        if (buttonIndex >= 0 && buttonIndex < paginatedSystems.length) {
            const system = paginatedSystems[buttonIndex];
            return showPanel(player, system.id, context);
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
                        import('../../dataManager.js').then(({ restartAutoSave }) => restartAutoSave());
                    }
                }
            }
        }
        return showPanel(player, 'configCategoryPanel', context);
    }

    if (panelId === 'configResetPanel') {
        const page = context.page || 1;
        const resettableSystems = [
            ...configPanelSchema
                .filter((c) => !c.id.startsWith('general_')) // General settings are not individually resettable via this panel
                .map((c) => ({ id: c.id, title: c.title, icon: c.icon })),
            { id: 'kits', title: '§l§5Kit System§r', icon: 'textures/ui/inventory_icon' },
            { id: 'shop', title: '§l§2Shop System§r', icon: 'textures/items/emerald' },
            { id: 'ranks', title: '§l§4Rank System§r', icon: 'textures/ui/permissions_member_star.png' }
        ];
        resettableSystems.sort((a, b) => a.title.replace(/§./g, '').localeCompare(b.title.replace(/§./g, '')));

        const sortedSystems = resettableSystems;

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

        const totalPages = Math.ceil(resettableSystems.length / itemsPerPage);

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

    if (panelId === 'kitManagementPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'configCategoryPanel', context);

        const config = getConfig();
        if (selection === 1) {
            const newStatus = !config.kits.enabled;
            updateMultipleConfig({ 'kits.enabled': newStatus });
            player.sendMessage(`§2Kit system ${newStatus ? 'enabled' : 'disabled'}.`);
            return showPanel(player, panelId, context);
        }

        if (selection === 2) {
            const form = new ModalFormData().title('Create Kit').textField('Kit Name', 'Enter unique name');
            const res = await utils.uiWait(player, form);
            if (!res.canceled && (res as ModalFormResponse).formValues) {
                const name = (res as ModalFormResponse).formValues![0] as string;
                if (name) {
                    kitAdminManager.createKit(name);
                    player.sendMessage('§2Kit created.');
                }
            }
            return showPanel(player, panelId, context);
        }

        const kitNames = Object.keys(kitAdminManager.getAllKits());
        const paginatedKits = getPaginatedItems(kitNames, page);
        let buttonIndex = selection - 3;

        if (buttonIndex >= 0 && buttonIndex < paginatedKits.length) {
            const kitName = paginatedKits[buttonIndex];
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }
        buttonIndex -= paginatedKits.length;

        const totalPages = Math.ceil(kitNames.length / itemsPerPage);
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

    if (panelId.startsWith('kitActionMenu_')) {
        const kitName = panelId.replace('kitActionMenu_', '');
        if (selection === 0) return showPanel(player, `kitSettingsPanel_${kitName}`, context);
        if (selection === 1) return showPanel(player, `kitItemsPanel_${kitName}`, context);
        if (selection === 2) {
            kitAdminManager.deleteKit(kitName);
            player.sendMessage('§2Kit deleted.');
            return showPanel(player, 'kitManagementPanel', context);
        }
        if (selection === 3) return showPanel(player, 'kitManagementPanel', context);
        return;
    }

    if (panelId.startsWith('kitSettingsPanel_')) {
        const kitName = panelId.replace('kitSettingsPanel_', '');
        if (canceled) return showPanel(player, `kitActionMenu_${kitName}`, context);

        if (formValues) {
            const [enabled, name, desc, icon, cooldownStr, permStr, priceStr] = formValues as [
                boolean,
                string,
                string,
                string,
                string,
                string,
                string
            ];
            const cooldown = parseInt(cooldownStr) || 0;
            const perm = parseInt(permStr) || 1024;
            const price = parseInt(priceStr) || 0;

            kitAdminManager.updateKitSettings(kitName, {
                enabled,
                description: desc,
                icon,
                cooldownSeconds: cooldown,
                permissionLevel: perm,
                price
            });

            if (name !== kitName && name) {
                const res = kitAdminManager.renameKit(kitName, name);
                player.sendMessage(res.message);
                if (res.success) {
                    return showPanel(player, `kitActionMenu_${name}`, context);
                }
            } else {
                player.sendMessage('§2Kit settings updated.');
            }
        }
        return showPanel(player, `kitActionMenu_${kitName}`, context);
    }

    if (panelId.startsWith('kitItemsPanel_')) {
        const kitName = panelId.replace('kitItemsPanel_', '');
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) {
            // Add Item
            const form = new ModalFormData()
                .title('Add Item')
                .textField('Item ID', 'minecraft:stone')
                .textField('Amount', '1', { defaultValue: '1' });
            const res = await utils.uiWait(player, form);
            if (!res.canceled && (res as ModalFormResponse).formValues) {
                const [typeId, amountStr] = (res as ModalFormResponse).formValues as [string, string];
                const amount = parseInt(amountStr);
                if (typeId && !isNaN(amount)) {
                    const { addItemToKit } = await import('../../kitItemsManager.js');
                    const result = addItemToKit(kitName, { typeId, amount });
                    player.sendMessage(result.message);
                }
            }
            return showPanel(player, panelId, context);
        }

        const kit = kitAdminManager.getAllKits()[kitName];
        if (!kit) return showPanel(player, 'kitManagementPanel', context);

        const paginatedItems = getPaginatedItems(kit.items, page);
        let buttonIndex = selection - 1;

        if (buttonIndex >= 0 && buttonIndex < paginatedItems.length) {
            // Edit/Delete Item
            const itemIndex = (page - 1) * itemsPerPage + buttonIndex;
            const form = new ActionFormData()
                .title('Manage Item')
                .button('Delete Item', 'textures/ui/trash')
                .button('Cancel', 'textures/ui/cancel');
            const res = await utils.uiWait(player, form);
            if (!res.canceled && (res as ActionFormResponse).selection === 0) {
                const { removeItemFromKit } = await import('../../kitItemsManager.js');
                const result = removeItemFromKit(kitName, itemIndex);
                player.sendMessage(result.message);
            }
            return showPanel(player, panelId, context);
        }
        buttonIndex -= paginatedItems.length;

        // Pagination
        const totalPages = Math.ceil(kit.items.length / itemsPerPage);
        const hasPrev = page > 1;
        const hasNext = page < totalPages;

        if (hasPrev) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page - 1 });
            buttonIndex--;
        }

        if (hasNext) {
            if (buttonIndex === 0) return showPanel(player, panelId, { ...context, page: page + 1 });
            buttonIndex--;
        }

        // Back (Last button)
        if (buttonIndex === 0) {
            return showPanel(player, `kitActionMenu_${kitName}`, context);
        }
        return showPanel(player, panelId, context);
    }

    if (panelId === 'commandSystemPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'configCategoryPanel', context);

        const config = getConfig();
        const commandSettings = config.commandSettings || {};
        const allCommands = Object.keys(commandSettings)
            .filter((c) => !c.startsWith('_'))
            .sort();

        const paginatedCommands = getPaginatedItems(allCommands, page);
        let buttonIndex = selection - 1;

        if (buttonIndex >= 0 && buttonIndex < paginatedCommands.length) {
            const cmd = paginatedCommands[buttonIndex];
            return showPanel(player, 'commandSettingsPanel', { ...context, commandName: cmd });
        }
        buttonIndex -= paginatedCommands.length;

        const totalPages = Math.ceil(allCommands.length / itemsPerPage);
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

    if (panelId === 'commandSettingsPanel') {
        if (canceled) return showPanel(player, 'commandSystemPanel', context);
        const { commandName } = context;
        if (formValues && commandName) {
            const [enabled, permLevelStr] = formValues as [boolean, string];
            const permLevel = parseInt(permLevelStr);
            if (!isNaN(permLevel)) {
                updateMultipleConfig({
                    [`commandSettings.${commandName}.enabled`]: enabled,
                    [`commandSettings.${commandName}.permissionLevel`]: permLevel
                });
                player.sendMessage(`§2Updated settings for ${commandName}.`);
            }
        }
        return showPanel(player, 'commandSystemPanel', context);
    }

    if (panelId === 'rankManagementPanel') {
        const page = context.page || 1;
        if (typeof selection !== 'number') return;
        if (selection === 0) return showPanel(player, 'configCategoryPanel', context);
        if (selection === 1) return showPanel(player, 'rankSettingsPanel', context);
        if (selection === 2) return showPanel(player, 'addRankPanel', context);

        const allRanks = rankManager.getAllRanks().sort((a, b) => a.permissionLevel - b.permissionLevel);
        const paginatedRanks = getPaginatedItems(allRanks, page);
        let buttonIndex = selection - 3;

        if (buttonIndex >= 0 && buttonIndex < paginatedRanks.length) {
            const rank = paginatedRanks[buttonIndex];
            return showPanel(player, `rankActionMenu_${rank.id}`, context);
        }
        buttonIndex -= paginatedRanks.length;

        const totalPages = Math.ceil(allRanks.length / itemsPerPage);
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

    if (panelId === 'addRankPanel') {
        if (canceled) return showPanel(player, 'rankManagementPanel', context);
        if (formValues) {
            const [name, id, permStr, nameColor, chatColor, prefix] = formValues as string[];
            const perm = parseInt(permStr);
            if (name && id && !isNaN(perm)) {
                const rankDb = await import('../../rankDb.js');
                const result = rankDb.addRank({
                    id,
                    name,
                    permissionLevel: perm,
                    chatFormatting: {
                        nameColor: nameColor || '§8',
                        messageColor: chatColor || '§r',
                        prefixText: prefix || ''
                    },
                    conditions: [{ type: 'hasTag', value: id }],
                    locked: false
                });
                player.sendMessage(result.message);
                if (result.success) rankManager.reloadRanks();
            }
        }
        return showPanel(player, 'rankManagementPanel', context);
    }

    if (panelId.startsWith('rankActionMenu_')) {
        const rankId = panelId.replace('rankActionMenu_', '');
        if (selection === 0) return showPanel(player, 'editRankPanel', { ...context, rankId });
        if (selection === 1) {
            // Delete
            const rankDb = await import('../../rankDb.js');
            const result = rankDb.deleteRank(rankId);
            player.sendMessage(result.message);
            if (result.success) rankManager.reloadRanks();
            return showPanel(player, 'rankManagementPanel', context);
        }
        if (selection === 2) return showPanel(player, 'rankManagementPanel', context);
        return;
    }

    if (panelId === 'editRankPanel') {
        if (canceled) return showPanel(player, 'rankManagementPanel', context);
        const { rankId } = context;
        if (formValues && rankId) {
            const [name, newId, permStr, nameColor, chatColor, prefix, nametag] = formValues as string[];
            const perm = parseInt(permStr);
            if (!isNaN(perm)) {
                const rankDb = await import('../../rankDb.js');
                const result = rankDb.updateRank(rankId, {
                    id: newId,
                    name,
                    permissionLevel: perm,
                    chatFormatting: { nameColor: nameColor, messageColor: chatColor, prefixText: prefix },
                    nametagPrefix: nametag
                });
                player.sendMessage(result.message);
                if (result.success) rankManager.reloadRanks();
            }
        }
        return showPanel(player, 'rankManagementPanel', context);
    }

    if (panelId === 'rankSettingsPanel') {
        if (canceled) return showPanel(player, 'rankManagementPanel', context);
        if (formValues) {
            const styleIndex = formValues[0] as number;
            const styles = ['above', 'before', 'after', 'under'];
            const style = styles[styleIndex];
            updateMultipleConfig({ 'ranks.nameTagStyle': style });
            player.sendMessage('§2Rank settings updated.');
        }
        return showPanel(player, 'rankManagementPanel', context);
    }


    if (panelId === 'xrayOresPanel') {
        if (selection === 0) {
            // Back
            return showPanel(player, 'config_xray', context);
        }
        if (selection === 1) {
            // Add New Ore
            return showPanel(player, 'addXrayOrePanel', context);
        }
        // Need to import getXrayConfig
        const { getXrayConfig } = await import('../../configurations.js');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xrayConfig = getXrayConfig() as any;
        const ores = Object.values(xrayConfig.monitoredOreTypes || {}).sort(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any, b: any) => a.oreName.localeCompare(b.oreName)
        );
        if (typeof selection === 'number') {
            const selectedOreIndex = selection - 2;
            if (selectedOreIndex >= 0 && selectedOreIndex < ores.length) {
                return showPanel(player, 'editXrayOrePanel', { ...context, oreIndex: selectedOreIndex });
            }
        }
        return;
    }

    if (panelId === 'addXrayOrePanel') {
        if (canceled) {
            return showPanel(player, 'xrayOresPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const [blockId, dimensionId, minYStr, maxYStr, oreName] = values as string[];
        const minY = parseInt(minYStr, 10);
        const maxY = parseInt(maxYStr, 10);
        if (blockId && dimensionId && !isNaN(minY) && !isNaN(maxY) && oreName) {
            const { getXrayConfig, saveXrayConfig } = await import('../../configurations.js');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const xrayConfig = getXrayConfig() as any;
            if (!xrayConfig.monitoredOreTypes) {
                xrayConfig.monitoredOreTypes = {};
            }
            const key = oreName.toLowerCase().replace(/\s+/g, '_');
            xrayConfig.monitoredOreTypes[key] = {
                enabled: true,
                oreName,
                blocks: [{ blockId, dimensionId, minY, maxY }]
            };
            saveXrayConfig(xrayConfig);
            player.sendMessage('§2Successfully added new monitored ore.');
        } else {
            player.sendMessage('§4Invalid data. Please check all fields.');
        }
        return showPanel(player, 'xrayOresPanel', context);
    }

    if (panelId === 'editXrayOrePanel') {
        if (canceled) {
            return showPanel(player, 'xrayOresPanel', context);
        }
        const values = formValues;
        if (!values) return;

        const { oreIndex } = context;
        const [blockId, dimensionId, minYStr, maxYStr, oreName] = values as string[];
        const minY = parseInt(minYStr, 10);
        const maxY = parseInt(maxYStr, 10);
        if (blockId && dimensionId && !isNaN(minY) && !isNaN(maxY) && oreName) {
            const { getXrayConfig, saveXrayConfig } = await import('../../configurations.js');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const xrayConfig = getXrayConfig() as any;
            const oreTypes = xrayConfig.monitoredOreTypes;
            const oreKeys = Object.keys(oreTypes || {}).sort((a, b) => {
                const nameA = oreTypes[a].oreName;
                const nameB = oreTypes[b].oreName;
                return nameA.localeCompare(nameB);
            });
            const key = oreKeys[oreIndex];

            if (key && oreTypes && oreTypes[key]) {
                oreTypes[key] = {
                    enabled: true,
                    oreName,
                    blocks: [{ blockId, dimensionId, minY, maxY }]
                };
                saveXrayConfig(xrayConfig);
                player.sendMessage('§2Successfully updated monitored ore.');
            }
        } else {
            player.sendMessage('§4Invalid data. Please check all fields.');
        }
        return showPanel(player, 'xrayOresPanel', context);
    }
}
