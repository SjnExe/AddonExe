import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig } from '../../../core/configManager.js';
import * as kitAdminManager from '../../../core/kitAdminManager.js';
import * as kitItemsManager from '../../../core/kitItemsManager.js';
import { IPanelHandler, PanelItem, UIContext } from '../../../core/ui/types.js';
import { getPaginatedItems, itemsPerPage } from '../../../core/ui/uiUtils.js';
import { showPanel } from '../../../core/uiManager.js';

export class KitPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'kitManagementPanel' ||
            panelId.startsWith('kitActionMenu_') ||
            panelId.startsWith('kitSettingsPanel_') ||
            panelId.startsWith('kitItemsPanel_')
        );
    }

    async getItems(player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

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

        if (panelId === 'kitManagementPanel') {
            addBack('configCategoryPanel');
            const mainConfig = getConfig();
            const isEnabled = mainConfig.kits.enabled;
            items.push({
                id: 'toggleKits',
                text: isEnabled ? '§2Kit System: ENABLED' : '§4Kit System: DISABLED',
                icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'toggleKits'
            });
            items.push({
                id: 'createKit',
                text: '§l§2+ Create New Kit',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'createKit'
            });

            const allKits = kitAdminManager.getAllKits();
            const kitNames = Object.keys(allKits);
            const paginated = getPaginatedItems(kitNames, (context.page as number) || 1);
            paginated.forEach((name) => {
                const kit = allKits[name];
                items.push({
                    id: name,
                    text: `${name}\n${kit.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
                    icon: 'textures/ui/inventory_icon',
                    permissionLevel: 1,
                    actionType: 'openPanel',
                    actionValue: `kitActionMenu_${name}`
                });
            });
            addPagination(kitNames.length);
            return items;
        }

        if (panelId.startsWith('kitActionMenu_')) {
            const kitName = panelId.replace('kitActionMenu_', '');
            addBack('kitManagementPanel');
            items.push({
                id: 'editSettings',
                text: 'Edit Settings',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: `kitSettingsPanel_${kitName}`
            });
            items.push({
                id: 'editItems',
                text: 'Edit Items',
                icon: 'textures/ui/inventory_icon',
                permissionLevel: 1,
                actionType: 'openPanel',
                actionValue: `kitItemsPanel_${kitName}`
            });
            items.push({
                id: 'deleteKit',
                text: '§4Delete Kit',
                icon: 'textures/ui/cancel',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'deleteKit'
            });
            return items;
        }

        if (panelId.startsWith('kitItemsPanel_')) {
            const kitName = panelId.replace('kitItemsPanel_', '');
            addBack(`kitActionMenu_${kitName}`);
            items.push({
                id: 'addItem',
                text: '§l§2+ Add New Item',
                icon: 'textures/ui/color_plus',
                permissionLevel: 1,
                actionType: 'functionCall',
                actionValue: 'addKitItem'
            });

            const allKits = kitAdminManager.getAllKits();
            const kit = allKits[kitName];
            if (kit) {
                const paginated = getPaginatedItems(kit.items, (context.page as number) || 1);
                paginated.forEach((item, idx) => {
                    const realIdx = ((context.page as number) || 1 - 1) * itemsPerPage + idx;
                    items.push({
                        id: String(realIdx),
                        text: `${realIdx + 1}. ${item.typeId.replace('minecraft:', '')} x${item.amount}`,
                        icon: 'textures/items/item_frame',
                        permissionLevel: 1,
                        actionType: 'functionCall',
                        actionValue: 'manageKitItem'
                    });
                });
                addPagination(kit.items.length);
            }
            return items;
        }

        return items;
    }

    async buildModal(player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
        await Promise.resolve();
        if (panelId.startsWith('kitSettingsPanel_')) {
            const kitName = panelId.replace('kitSettingsPanel_', '');
            const kitsConfig = kitAdminManager.getAllKits();
            const kit = kitsConfig[kitName];
            if (!kit) return null;
            return new ModalFormData()
                .title(`Edit Kit: ${kitName}`)
                .toggle('Enabled', { defaultValue: kit.enabled })
                .textField('Name', 'Name', { defaultValue: kitName })
                .textField('Description', 'Description', { defaultValue: kit.description || '' })
                .textField('Icon', 'Icon', { defaultValue: kit.icon || '' })
                .textField('Cooldown', 'Cooldown', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission', 'Level', { defaultValue: String(kit.permissionLevel) })
                .textField('Price', 'Price', { defaultValue: String(kit.price || 0) });
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
                    return showPanel(player, item.actionValue, {
                        ...context,
                        page: 1,
                        selectedItemId: item.id,
                        id: item.id
                    });
                }
                if (item.actionValue === 'prevPage') {
                    return showPanel(player, panelId, { ...context, page: Math.max(1, (context.page as number) || 1) - 1 });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }

                if (item.actionValue === 'toggleKits') {
                    const config = getConfig();
                    const newStatus = !config.kits.enabled;
                    updateMultipleConfig({ 'kits.enabled': newStatus });
                    player.sendMessage(`§2Kit system ${newStatus ? 'enabled' : 'disabled'}.`);
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'createKit') {
                    const form = new ModalFormData().title('Create Kit').textField('Kit Name', 'Enter unique name');
                    const res = await form.show(player);
                    if (!res.canceled && res.formValues) {
                        const name = res.formValues[0] as string;
                        if (name) {
                            kitAdminManager.createKit(name);
                            player.sendMessage('§2Kit created.');
                        }
                    }
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'deleteKit') {
                    const kitName = panelId.replace('kitActionMenu_', '');
                    kitAdminManager.deleteKit(kitName);
                    player.sendMessage('§2Kit deleted.');
                    return showPanel(player, 'kitManagementPanel', context);
                }

                if (item.actionValue === 'addKitItem') {
                    const kitName = panelId.replace('kitItemsPanel_', '');
                    const form = new ModalFormData()
                        .title('Add Item')
                        .textField('Item ID', 'minecraft:stone')
                        .textField('Amount', '1', { defaultValue: '1' });
                    const res = await form.show(player);
                    if (!res.canceled && res.formValues) {
                        const [typeId, amountStr] = res.formValues as [string, string];
                        const amount = parseInt(amountStr);
                        if (typeId && !isNaN(amount)) {
                            const result = kitItemsManager.addItemToKit(kitName, { typeId, amount });
                            player.sendMessage(result.message);
                        }
                    }
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'manageKitItem') {
                    const kitName = panelId.replace('kitItemsPanel_', '');
                    const itemIndex = Number(item.id);
                    const form = new ActionFormData()
                        .title('Manage Item')
                        .button('Delete Item', 'textures/ui/trash')
                        .button('Cancel', 'textures/ui/cancel');
                    const res = await form.show(player);
                    if (!res.canceled && res.selection === 0) {
                        const result = kitItemsManager.removeItemFromKit(kitName, itemIndex);
                        player.sendMessage(result.message);
                    }
                    return showPanel(player, panelId, context);
                }
            }
        }

        // Modal Handling for Settings
        if (panelId.startsWith('kitSettingsPanel_')) {
            const kitName = panelId.replace('kitSettingsPanel_', '');
            if ((response as ModalFormResponse).canceled) return showPanel(player, `kitActionMenu_${kitName}`, context);

            if (values) {
                const [enabled, name, desc, icon, cooldownStr, permStr, priceStr] = values as [
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
    }
}
