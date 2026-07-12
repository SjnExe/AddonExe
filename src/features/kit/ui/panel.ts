import { MinecraftItemTypes } from '@minecraft/vanilla-data';

import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { showPanel } from '@core/uiManager.js';
import * as kitAdminManager from '@features/kit/adminManager.js';
import * as kitItemsManager from '@features/kit/itemsManager.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';

export class KitPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId === 'kitManagementPanel' || panelId.startsWith('kitActionMenu_') || panelId.startsWith('kitSettingsPanel_') || panelId.startsWith('kitItemsPanel_');
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await Promise.resolve();
        const items: PanelItem[] = [];

        if (panelId === 'kitManagementPanel') {
            addBackButton(items, 'configCategoryPanel');
            const mainConfig = getConfig();
            const isEnabled = mainConfig.kits.enabled;
            items.push(
                {
                    id: 'toggleKits',
                    text: isEnabled ? '§2Kit System: ENABLED' : '§4Kit System: DISABLED',
                    icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'toggleKits'
                },
                {
                    id: 'createKit',
                    text: '§l§2+ Create New Kit',
                    icon: 'textures/ui/color_plus',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'createKit'
                }
            );

            const allKits = kitAdminManager.getAllKits();
            const kitNames = Object.keys(allKits);
            const paginated = getPaginatedItems(kitNames, (context.page as number) || 1);
            for (const name of paginated) {
                const kit = allKits[name];
                if (!kit) continue;
                items.push({
                    id: name,
                    text: `${name}\n${kit.enabled ? '§2[Enabled]' : '§4[Disabled]'}`,
                    icon: 'textures/ui/inventory_icon',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: `kitActionMenu_${name}`
                });
            }
            addPaginationItems(items, (context.page as number) || 1, kitNames.length);
            return items;
        }

        if (panelId.startsWith('kitActionMenu_')) {
            const kitName = panelId.replace('kitActionMenu_', '');
            addBackButton(items, 'kitManagementPanel');
            items.push(
                {
                    id: 'editSettings',
                    text: 'Edit Settings',
                    icon: 'textures/ui/icon_setting',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: `kitSettingsPanel_${kitName}`
                },
                {
                    id: 'editItems',
                    text: 'Edit Items',
                    icon: 'textures/ui/inventory_icon',
                    permission: 'ui.panel.admin',
                    actionType: 'openPanel',
                    actionValue: `kitItemsPanel_${kitName}`
                },
                {
                    id: 'deleteKit',
                    text: '§4Delete Kit',
                    icon: 'textures/ui/cancel',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'deleteKit'
                }
            );
            return items;
        }

        if (panelId.startsWith('kitItemsPanel_')) {
            const kitName = panelId.replace('kitItemsPanel_', '');
            addBackButton(items, `kitActionMenu_${kitName}`);
            items.push(
                {
                    id: 'addItem',
                    text: '§l§2+ Add New Item (Manual)',
                    icon: 'textures/ui/color_plus',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'addKitItem'
                },
                {
                    id: 'addItemHand',
                    text: '§l§6+ Add Item From Hand',
                    icon: 'textures/ui/inventory_icon',
                    permission: 'ui.panel.admin',
                    actionType: 'functionCall',
                    actionValue: 'addKitItemHand'
                }
            );

            const allKits = kitAdminManager.getAllKits();
            const kit = allKits[kitName];
            if (kit) {
                const paginated = getPaginatedItems(kit.items, (context.page as number) || 1);
                for (const [idx, item] of paginated.entries()) {
                    const realIdx = (((context.page as number) || 1) - 1) * itemsPerPage + idx;
                    items.push({
                        id: String(realIdx),
                        text: `${realIdx + 1}. ${item.typeId.replace(/^minecraft:/, '')} x${item.amount}`,
                        icon: 'textures/items/item_frame',
                        permission: 'ui.panel.admin',
                        actionType: 'functionCall',
                        actionValue: 'manageKitItem'
                    });
                }
                addPaginationItems(items, (context.page as number) || 1, kit.items.length);
            }
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, _context: UIContext): Promise<ModalFormData | undefined> {
        await Promise.resolve();
        if (panelId.startsWith('kitSettingsPanel_')) {
            const kitName = panelId.replace('kitSettingsPanel_', '');
            const kitsConfig = kitAdminManager.getAllKits();
            const kit = kitsConfig[kitName];
            if (!kit) return undefined;
            return new ModalFormData()
                .title(`Edit Kit: ${kitName}`)
                .toggle('Enabled', { defaultValue: kit.enabled })
                .textField('Name', 'Name', { defaultValue: kitName })
                .textField('Description', 'Description', { defaultValue: kit.description || '' })
                .textField('Icon', 'Icon', { defaultValue: kit.icon || '' })
                .textField('Cooldown', 'Cooldown', { defaultValue: String(kit.cooldownSeconds) })
                .textField('Permission Node', 'ui.panel.member', { defaultValue: kit.permission })
                .textField('Price', 'Price', { defaultValue: String(kit.price || 0) });
        }
        return undefined;
    }

    async handleResponse(player: mc.Player, panelId: string, response: ActionFormResponse | ModalFormResponse, context: UIContext): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            await this.handleSelection(player, panelId, selection, context);
            return;
        }

        // Modal Handling for Settings
        if (panelId.startsWith('kitSettingsPanel_')) {
            await this.handleKitSettings(player, panelId, response, context);
        }
    }

    private async handleSelection(player: mc.Player, panelId: string, selection: number, context: UIContext): Promise<void> {
        const items = await this.getItems(player, panelId, context);
        if (selection >= 0 && selection < items.length) {
            const item = items[selection];
            if (!item) return;

            if (item.actionType === 'openPanel') {
                return showPanel(player, item.actionValue, {
                    ...context,
                    page: 1,
                    selectedItemId: item.id,
                    id: item.id
                });
            }
            if (item.actionValue === 'prevPage') {
                return showPanel(player, panelId, {
                    ...context,
                    page: Math.max(1, (context.page as number) || 1) - 1
                });
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
                await this.handleCreateKit(player, panelId, context);
                return;
            }

            if (item.actionValue === 'deleteKit') {
                const kitName = panelId.replace('kitActionMenu_', '');
                kitAdminManager.deleteKit(kitName);
                player.sendMessage('§2Kit deleted.');
                return showPanel(player, 'kitManagementPanel', context);
            }

            if (item.actionValue === 'addKitItemHand') {
                const kitName = panelId.replace('kitItemsPanel_', '');
                const result = kitItemsManager.addItemFromHandToKit(kitName, player);
                player.sendMessage(result.message);
                return showPanel(player, panelId, context);
            }

            if (item.actionValue === 'addKitItem') {
                await this.handleAddKitItem(player, panelId, context);
                return;
            }

            if (item.actionValue === 'manageKitItem') {
                await this.handleManageKitItem(player, panelId, item.id, context);
                return;
            }
        }
    }

    private async handleCreateKit(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
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

    private async handleAddKitItem(player: mc.Player, panelId: string, context: UIContext): Promise<void> {
        const kitName = panelId.replace('kitItemsPanel_', '');
        const form = new ModalFormData().title('Add Item').textField('Item ID', MinecraftItemTypes.Stone).textField('Amount', '1', { defaultValue: '1' });
        const res = await form.show(player);
        if (!res.canceled && res.formValues) {
            const [typeId, amountStr] = res.formValues as [string, string];
            const amount = Number.parseInt(amountStr);
            if (typeId && !Number.isNaN(amount)) {
                const result = kitItemsManager.addItemToKit(kitName, { typeId, amount });
                player.sendMessage(result.message);
            }
        }
        return showPanel(player, panelId, context);
    }

    private async handleManageKitItem(player: mc.Player, panelId: string, itemId: string, context: UIContext): Promise<void> {
        const kitName = panelId.replace('kitItemsPanel_', '');
        const itemIndex = Number(itemId);
        const form = new ActionFormData().title('Manage Item').button('Delete Item', 'textures/ui/trash').button('Cancel', 'textures/ui/cancel');
        const res = await form.show(player);
        if (!res.canceled && res.selection === 0) {
            const result = kitItemsManager.removeItemFromKit(kitName, itemIndex);
            player.sendMessage(result.message);
        }
        return showPanel(player, panelId, context);
    }

    private async handleKitSettings(player: mc.Player, panelId: string, response: ModalFormResponse, context: UIContext): Promise<void> {
        const kitName = panelId.replace('kitSettingsPanel_', '');
        if (response.canceled) return showPanel(player, `kitActionMenu_${kitName}`, context);

        if (response.formValues) {
            const [enabled, name, desc, icon, cooldownStr, permStr, priceStr] = response.formValues as [boolean, string, string, string, string, string, string];
            const cooldown = Number.parseInt(cooldownStr) || 0;
            const perm = permStr || 'ui.panel.member';
            const price = Number.parseInt(priceStr) || 0;

            kitAdminManager.updateKitSettings(kitName, {
                enabled,
                description: desc,
                icon,
                cooldownSeconds: cooldown,
                permission: perm,
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
