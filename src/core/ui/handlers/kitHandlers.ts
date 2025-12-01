import * as mc from '@minecraft/server';
import { ActionFormResponse, ActionFormData, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig } from '../../configManager.js';
import * as kitAdminManager from '../../kitAdminManager.js';
import * as kitItemsManager from '../../kitItemsManager.js';
import { showPanel } from '../../uiManager.js';
import * as utils from '../../utils.js';
import { UIContext } from '../panelRegistry.js';
import { itemsPerPage, getPaginatedItems } from '../uiUtils.js';

/**
 * Handles Kit System UI interactions.
 */
export async function handleKitPanel(
    player: mc.Player,
    panelId: string,
    response: ActionFormResponse | ModalFormResponse,
    context: UIContext
) {
    const selection = (response as ActionFormResponse).selection;
    const canceled = response.canceled;
    const formValues = (response as ModalFormResponse).formValues;

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
                    const result = kitItemsManager.addItemToKit(kitName, { typeId, amount });
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
                const result = kitItemsManager.removeItemFromKit(kitName, itemIndex);
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
}
