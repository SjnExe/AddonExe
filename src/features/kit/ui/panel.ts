import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import * as kitAdminManager from '@features/kit/adminManager.js';
import * as kitItemsManager from '@features/kit/itemsManager.js';
import * as mc from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';

export async function showKitManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
    const mainConfig = getConfig();
    const isEnabled = mainConfig.kits.enabled;

    const form = new ActionFormBuilder()
        .title('Kit Management')
        .button(isEnabled ? '§2Kit System: ENABLED' : '§4Kit System: DISABLED', isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel', async () => {
            const newStatus = !getConfig().kits.enabled;
            updateMultipleConfig({ 'kits.enabled': newStatus });
            player.sendMessage(`§2Kit system ${newStatus ? 'enabled' : 'disabled'}.`);
            await showKitManagementPanel(player, page);
        })
        .button('§l§2+ Create New Kit', 'textures/ui/color_plus', async () => {
            const modal = new ModalFormBuilder<{ name: string }>().title('Create Kit').textField('name', 'Kit Name', 'Enter unique name');
            const res = await modal.show(player);
            if (res) {
                if (res.name) {
                    kitAdminManager.createKit(res.name);
                    player.sendMessage('§2Kit created.');
                }
            }
            await showKitManagementPanel(player, page);
        });

    const allKits = kitAdminManager.getAllKits();
    const kitNames = Object.keys(allKits);

    form.addPaginatedButtons(
        kitNames,
        page,
        (kitName, formBuilder) => {
            const kit = allKits[kitName];
            if (kit) {
                formBuilder.button(`${kitName}\n${kit.enabled ? '§2[Enabled]' : '§4[Disabled]'}`, 'textures/ui/inventory_icon', async () => {
                    await showKitActionMenu(player, kitName);
                });
            }
        },
        async (newPage) => {
            await showKitManagementPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryPanel(player);
    });

    await form.show(player);
}

export async function showKitActionMenu(player: mc.Player, kitName: string): Promise<void> {
    const form = new ActionFormBuilder()
        .title(`Kit Actions: ${kitName}`)
        .button('Edit Settings', 'textures/ui/icon_setting', async () => {
            await showKitSettingsPanel(player, kitName);
        })
        .button('Edit Items', 'textures/ui/inventory_icon', async () => {
            await showKitItemsPanel(player, kitName, 1);
        })
        .button('§4Delete Kit', 'textures/ui/cancel', async () => {
            kitAdminManager.deleteKit(kitName);
            player.sendMessage('§2Kit deleted.');
            await showKitManagementPanel(player, 1);
        });

    form.addBackButton(async () => {
        await showKitManagementPanel(player, 1);
    });

    await form.show(player);
}

export async function showKitSettingsPanel(player: mc.Player, kitName: string): Promise<void> {
    const allKits = kitAdminManager.getAllKits();
    const kit = allKits[kitName];
    if (!kit) return;

    const modal = new ModalFormBuilder<{
        enabled: boolean;
        name: string;
        desc: string;
        icon: string;
        cooldown: string;
        perm: string;
        price: string;
    }>()
        .title(`Edit Kit: ${kitName}`)
        .toggle('enabled', 'Enabled', kit.enabled)
        .textField('name', 'Name', 'Name', kitName)
        .textField('desc', 'Description', 'Description', kit.description || '')
        .textField('icon', 'Icon', 'Icon', kit.icon || '')
        .textField('cooldown', 'Cooldown', 'Cooldown', String(kit.cooldownSeconds))
        .textField('perm', 'Permission Node', 'ui.panel.member', kit.permission)
        .textField('price', 'Price', 'Price', String(kit.price || 0));

    const res = await modal.show(player);
    if (!res) {
        await showKitActionMenu(player, kitName);
        return;
    }

    const cooldownParsed = Number.parseInt(res.cooldown);
    const cooldown = Number.isNaN(cooldownParsed) ? 0 : cooldownParsed;
    const perm = res.perm || 'ui.panel.member';
    const priceParsed = Number.parseInt(res.price);
    const price = Number.isNaN(priceParsed) ? 0 : priceParsed;

    kitAdminManager.updateKitSettings(kitName, {
        enabled: res.enabled,
        description: res.desc,
        icon: res.icon,
        cooldownSeconds: cooldown,
        permission: perm,
        price
    });

    if (res.name !== kitName && res.name) {
        const renameRes = kitAdminManager.renameKit(kitName, res.name);
        player.sendMessage(renameRes.message);
        if (renameRes.success) {
            await showKitActionMenu(player, res.name);
            return;
        }
    } else {
        player.sendMessage('§2Kit settings updated.');
    }

    await showKitActionMenu(player, kitName);
}

export async function showKitItemsPanel(player: mc.Player, kitName: string, page: number = 1): Promise<void> {
    const form = new ActionFormBuilder()
        .title(`Kit Items: ${kitName}`)
        .button('§l§2+ Add New Item (Manual)', 'textures/ui/color_plus', async () => {
            const modal = new ModalFormBuilder<{ typeId: string; amount: string }>().title('Add Item').textField('typeId', 'Item ID', MinecraftItemTypes.Stone).textField('amount', 'Amount', '1', '1');
            const res = await modal.show(player);
            if (res) {
                const amountParsed = Number.parseInt(res.amount);
                const amount = Number.isNaN(amountParsed) ? 1 : amountParsed;
                if (res.typeId) {
                    const result = kitItemsManager.addItemToKit(kitName, { typeId: res.typeId, amount });
                    player.sendMessage(result.message);
                }
            }
            await showKitItemsPanel(player, kitName, page);
        })
        .button('§l§6+ Add Item From Hand', 'textures/ui/inventory_icon', async () => {
            const result = kitItemsManager.addItemFromHandToKit(kitName, player);
            player.sendMessage(result.message);
            await showKitItemsPanel(player, kitName, page);
        });

    const allKits = kitAdminManager.getAllKits();
    const kit = allKits[kitName];
    if (kit) {
        const items = kit.items.map((item, index) => ({ item, index }));
        form.addPaginatedButtons(
            items,
            page,
            ({ item, index }, formBuilder) => {
                formBuilder.button(`${index + 1}. ${item.typeId.replace(/^minecraft:/, '')} x${item.amount}`, 'textures/items/item_frame', async () => {
                    const manageForm = new ActionFormBuilder()
                        .title('Manage Item')
                        .button('Delete Item', 'textures/ui/trash', async () => {
                            const result = kitItemsManager.removeItemFromKit(kitName, index);
                            player.sendMessage(result.message);
                            await showKitItemsPanel(player, kitName, page);
                        })
                        .button('Cancel', 'textures/ui/cancel', async () => {
                            await showKitItemsPanel(player, kitName, page);
                        });
                    await manageForm.show(player);
                });
            },
            async (newPage) => {
                await showKitItemsPanel(player, kitName, newPage);
            }
        );
    }

    form.addBackButton(async () => {
        await showKitActionMenu(player, kitName);
    });

    await form.show(player);
}
