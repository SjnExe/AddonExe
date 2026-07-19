import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getShopConfig } from '@core/configurations.js';
import * as shopAdminManager from '@features/shop/adminManager.js';
import { ensureItemsConfig, getAllItems } from '@features/shop/utils.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

export async function showShopManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
    const mainConfig = getConfig();
    const shopConfig = getShopConfig();
    const isEnabled = mainConfig.shop.enabled;
    const categories = shopConfig.categories;

    const form = new ActionFormBuilder()
        .title('Shop Management')
        .button(isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED', isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel', async () => {
            const newStatus = !getConfig().shop.enabled;
            updateMultipleConfig({ 'shop.enabled': newStatus });
            player.sendMessage(`§2Shop system ${newStatus ? 'enabled' : 'disabled'}.`);
            await showShopManagementPanel(player, page);
        })
        .button('§l§2+ Add Category', 'textures/ui/color_plus', async () => {
            await showAddCategoryPanel(player);
        });

    const categoryNames = Object.keys(categories);
    form.addPaginatedButtons(
        categoryNames,
        page,
        (catName, formBuilder) => {
            const cat = categories[catName];
            if (cat) {
                formBuilder.button(catName, cat.icon, async () => {
                    await showShopAdminCategoryActionPanel(player, catName);
                });
            }
        },
        async (newPage) => {
            await showShopManagementPanel(player, newPage);
        }
    );

    form.addBackButton(async () => {
        const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
        await showConfigCategoryPanel(player);
    });

    await form.show(player);
}

export async function showShopAdminCategoryActionPanel(player: mc.Player, categoryName: string): Promise<void> {
    const form = new ActionFormBuilder()
        .title(`Edit ${categoryName}`)
        .button('Open Category', 'textures/ui/inventory_icon', async () => {
            await showShopAdminCategoryPanel(player, categoryName, 1);
        })
        .button('Edit Settings', 'textures/ui/icon_setting', async () => {
            await showEditCategoryPanel(player, categoryName);
        })
        .button('§4Delete Category', 'textures/ui/cancel', async () => {
            showConfirmationDialog(player, {
                title: 'Confirm Delete',
                body: `Are you sure you want to delete ${categoryName} and all its contents?`,
                onConfirm: async () => {
                    shopAdminManager.deleteCategory(categoryName);
                    player.sendMessage(`§2Deleted category: ${categoryName}`);
                    await showShopManagementPanel(player, 1);
                },
                onCancel: async () => {
                    await showShopAdminCategoryActionPanel(player, categoryName);
                }
            });
        });

    form.addBackButton(async () => {
        await showShopManagementPanel(player, 1);
    });

    await form.show(player);
}

export async function showShopAdminCategoryPanel(player: mc.Player, categoryName: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) {
        player.sendMessage('§4Category not found.');
        await showShopManagementPanel(player, 1);
        return;
    }

    const form = new ActionFormBuilder()
        .title(`Manage ${categoryName}`)
        .button('§l§2+ Add Item', 'textures/ui/color_plus', async () => {
            await showShopAddItemPanel(player, categoryName, undefined);
        })
        .button('§l§2+ Add Sub-Category', 'textures/ui/color_plus', async () => {
            await showAddSubCategoryPanel(player, categoryName);
        });

    const entries: { type: 'subCategory' | 'item'; id: string; name: string; icon?: string }[] = [];

    if (category.subCategories) {
        for (const [subId, subData] of Object.entries(category.subCategories)) {
            entries.push({ type: 'subCategory', id: subId, name: subId, icon: subData.icon });
        }
    }

    if (category.items) {
        for (const [itemId, itemData] of Object.entries(category.items)) {
            entries.push({ type: 'item', id: itemId, name: itemData.displayName || itemId, icon: itemData.icon });
        }
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            if (entry.type === 'subCategory') {
                formBuilder.button(`§l${entry.name}`, entry.icon, async () => {
                    await showShopAdminSubCategoryActionPanel(player, categoryName, entry.id);
                });
            } else {
                formBuilder.button(entry.name, entry.icon, async () => {
                    await showEditItemFormPanel(player, categoryName, undefined, entry.id);
                });
            }
        },
        async (newPage) => {
            await showShopAdminCategoryPanel(player, categoryName, newPage);
        }
    );

    form.addBackButton(async () => {
        await showShopAdminCategoryActionPanel(player, categoryName);
    });

    await form.show(player);
}

export async function showShopAdminSubCategoryActionPanel(player: mc.Player, categoryName: string, subCategoryName: string): Promise<void> {
    const form = new ActionFormBuilder()
        .title(`Edit ${subCategoryName}`)
        .button('Open Sub-Category', 'textures/ui/inventory_icon', async () => {
            await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        })
        .button('Edit Settings', 'textures/ui/icon_setting', async () => {
            await showEditSubCategoryPanel(player, categoryName, subCategoryName);
        })
        .button('§4Delete Sub-Category', 'textures/ui/cancel', async () => {
            showConfirmationDialog(player, {
                title: 'Confirm Delete',
                body: `Are you sure you want to delete ${subCategoryName} and all its contents?`,
                onConfirm: async () => {
                    shopAdminManager.deleteSubCategory(categoryName, subCategoryName);
                    player.sendMessage(`§2Deleted sub-category: ${subCategoryName}`);
                    await showShopAdminCategoryPanel(player, categoryName, 1);
                }
            });
        });

    form.addBackButton(async () => {
        await showShopAdminCategoryPanel(player, categoryName, 1);
    });

    await form.show(player);
}

export async function showShopAdminSubCategoryItemPanel(player: mc.Player, categoryName: string, subCategoryName: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category || !category.subCategories || !category.subCategories[subCategoryName]) {
        player.sendMessage('§4Sub-category not found.');
        await showShopAdminCategoryPanel(player, categoryName, 1);
        return;
    }
    const subCat = category.subCategories[subCategoryName];

    const form = new ActionFormBuilder().title(`Manage ${subCategoryName}`).button('§l§2+ Add Item', 'textures/ui/color_plus', async () => {
        await showShopAddItemPanel(player, categoryName, subCategoryName);
    });

    const entries: { type: 'item'; id: string; name: string; icon?: string }[] = [];
    if (subCat.items) {
        for (const [itemId, itemData] of Object.entries(subCat.items)) {
            entries.push({ type: 'item', id: itemId, name: itemData.displayName || itemId, icon: itemData.icon });
        }
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            formBuilder.button(entry.name, entry.icon, async () => {
                await showEditItemFormPanel(player, categoryName, subCategoryName, entry.id);
            });
        },
        async (newPage) => {
            await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, newPage);
        }
    );

    form.addBackButton(async () => {
        await showShopAdminSubCategoryActionPanel(player, categoryName, subCategoryName);
    });

    await form.show(player);
}

export async function showShopAddItemPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Add Item')
        .button('§6Add Item From List', 'textures/ui/inventory_icon', async () => {
            await showAddItemFromListPanel(player, categoryName, subCategoryName, 1);
        })
        .button('§2Add Custom Item (Manual)', 'textures/ui/color_plus', async () => {
            await showAddCustomItemPanel(player, categoryName, subCategoryName);
        });

    form.addBackButton(async () => {
        if (subCategoryName) {
            await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            await showShopAdminCategoryPanel(player, categoryName, 1);
        }
    });

    await form.show(player);
}

// Modals
export async function showAddCategoryPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ catName: string; icon: string }>()
        .title('Add Category')
        .textField('catName', 'Category Name', 'e.g., Blocks')
        .textField('icon', 'Icon Path', 'textures/items/diamond');

    const res = await modal.show(player);
    if (!res) {
        await showShopManagementPanel(player, 1);
        return;
    }

    if (isNonEmptyString(res.catName)) {
        shopAdminManager.addCategory(res.catName, res.icon);
        player.sendMessage(`§2Category added: ${res.catName}`);
    } else {
        player.sendMessage('§4Invalid category name.');
    }
    await showShopManagementPanel(player, 1);
}

export async function showAddSubCategoryPanel(player: mc.Player, categoryName: string): Promise<void> {
    const modal = new ModalFormBuilder<{ subCatName: string; icon: string }>()
        .title('Add Sub-Category')
        .textField('subCatName', 'Sub-Category Name', 'e.g., Ores')
        .textField('icon', 'Icon Path', 'textures/items/diamond');

    const res = await modal.show(player);
    if (!res) {
        await showShopAdminCategoryPanel(player, categoryName, 1);
        return;
    }

    if (isNonEmptyString(res.subCatName)) {
        shopAdminManager.addSubCategory(categoryName, res.subCatName, res.icon);
        player.sendMessage(`§2Sub-Category added: ${res.subCatName}`);
    } else {
        player.sendMessage('§4Invalid sub-category name.');
    }
    await showShopAdminCategoryPanel(player, categoryName, 1);
}

export async function showEditCategoryPanel(player: mc.Player, categoryName: string): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category) return;

    const modal = new ModalFormBuilder<{ newName: string; icon: string }>()
        .title(`Edit ${categoryName}`)
        .textField('newName', 'New Name (leave blank to keep)', 'New Name', categoryName)
        .textField('icon', 'Icon Path', 'Icon Path', category.icon);

    const res = await modal.show(player);
    if (!res) {
        await showShopAdminCategoryActionPanel(player, categoryName);
        return;
    }

    shopAdminManager.editCategory(categoryName, res.newName || categoryName, res.icon);
    player.sendMessage(`§2Category updated.`);
    await showShopManagementPanel(player, 1); // Go back to management to show new name if changed
}

export async function showEditSubCategoryPanel(player: mc.Player, categoryName: string, subCategoryName: string): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category || !category.subCategories || !category.subCategories[subCategoryName]) return;
    const subCategory = category.subCategories[subCategoryName];

    const modal = new ModalFormBuilder<{ newName: string; icon: string }>()
        .title(`Edit ${subCategoryName}`)
        .textField('newName', 'New Name (leave blank to keep)', 'New Name', subCategoryName)
        .textField('icon', 'Icon Path', 'Icon Path', subCategory.icon);

    const res = await modal.show(player);
    if (!res) {
        await showShopAdminSubCategoryActionPanel(player, categoryName, subCategoryName);
        return;
    }

    shopAdminManager.editSubCategory(categoryName, subCategoryName, res.newName || subCategoryName, res.icon);
    player.sendMessage(`§2Sub-Category updated.`);
    await showShopAdminCategoryPanel(player, categoryName, 1); // Go back to category to show new name if changed
}

export async function showAddItemFromListPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined, page: number = 1): Promise<void> {
    await ensureItemsConfig();
    const allItems = Object.keys(getAllItems());

    const form = new ActionFormBuilder().title('Select Item');

    form.addPaginatedButtons(
        allItems,
        page,
        (itemId, formBuilder) => {
            formBuilder.button(itemId.replace('minecraft:', ''), 'textures/ui/inventory_icon', async () => {
                await showAddCustomItemPanel(player, categoryName, subCategoryName, itemId);
            });
        },
        async (newPage) => {
            await showAddItemFromListPanel(player, categoryName, subCategoryName, newPage);
        }
    );

    form.addBackButton(async () => {
        await showShopAddItemPanel(player, categoryName, subCategoryName);
    });

    await form.show(player);
}

export async function showAddCustomItemPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined, prefillItemId: string = ''): Promise<void> {
    const modal = new ModalFormBuilder<{
        itemId: string;
        buyPrice: string;
        sellPrice: string;
        displayName: string;
        icon: string;
        permission: string;
        rankMultiplierOverridesStr: string;
    }>()
        .title('Add Custom Item')
        .textField('itemId', 'Minecraft Item ID', 'e.g., minecraft:diamond', prefillItemId)
        .textField('buyPrice', 'Buy Price (-1 to disable)', '100', '100')
        .textField('sellPrice', 'Sell Price (-1 to disable)', '50', '50')
        .textField('displayName', 'Display Name (optional)', 'Diamond')
        .textField('icon', 'Icon Path (optional)', 'textures/items/diamond')
        .textField('permission', 'Required Permission (optional)', 'ui.panel.member')
        .textField('rankMultiplierOverridesStr', 'Rank Overrides (rank1:buy:sell,rank2:buy:sell)', '');

    const res = await modal.show(player);
    if (!res) {
        await showShopAddItemPanel(player, categoryName, subCategoryName);
        return;
    }

    const buyPrice = Number.parseInt(res.buyPrice);
    const sellPrice = Number.parseInt(res.sellPrice);

    if (isNonEmptyString(res.itemId) && !Number.isNaN(buyPrice) && !Number.isNaN(sellPrice)) {
        shopAdminManager.setItem(categoryName, subCategoryName, res.itemId, {
            itemId: res.itemId,
            buyPrice,
            sellPrice,
            displayName: res.displayName,
            icon: res.icon,
            permission: res.permission
        });
        player.sendMessage(`§2Item added: ${res.itemId}`);
        if (subCategoryName) {
            await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            await showShopAdminCategoryPanel(player, categoryName, 1);
        }
    } else {
        player.sendMessage('§4Invalid input.');
        await showAddCustomItemPanel(player, categoryName, subCategoryName, prefillItemId);
    }
}

export async function showEditItemFormPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined, itemKey: string): Promise<void> {
    const shopConfig = getShopConfig();
    const cat = shopConfig.categories[categoryName];
    const item = subCategoryName ? cat?.subCategories?.[subCategoryName]?.items[itemKey] : cat?.items[itemKey];

    if (!item) {
        player.sendMessage('§4Item not found.');
        if (subCategoryName) {
            await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            await showShopAdminCategoryPanel(player, categoryName, 1);
        }
        return;
    }

    let overridesStr = '';
    if (item.rankMultiplierOverrides) {
        const parts: string[] = [];
        for (const [rank, prices] of Object.entries(item.rankMultiplierOverrides)) {
            parts.push(`${rank}:${prices.buy}:${prices.sell}`);
        }
        overridesStr = parts.join(',');
    }

    const modal = new ModalFormBuilder<{
        itemId: string;
        buyPrice: string;
        sellPrice: string;
        displayName: string;
        icon: string;
        permission: string;
        rankMultiplierOverridesStr: string;
        action: string;
    }>()
        .title('Edit Item')
        .textField('itemId', 'Minecraft Item ID', 'e.g., minecraft:diamond', item.itemId || itemKey)
        .textField('buyPrice', 'Buy Price (-1 to disable)', '100', String(item.buyPrice))
        .textField('sellPrice', 'Sell Price (-1 to disable)', '50', String(item.sellPrice))
        .textField('displayName', 'Display Name (optional)', 'Diamond', item.displayName || '')
        .textField('icon', 'Icon Path (optional)', 'textures/items/diamond', item.icon || '')
        .textField('permission', 'Required Permission (optional)', 'ui.panel.member', item.permission || '')
        .textField('rankMultiplierOverridesStr', 'Rank Overrides (rank1:buy:sell,rank2:buy:sell)', '', overridesStr)
        .dropdown('action', 'Action', ['Save', 'Delete']);

    const res = await modal.show(player);
    if (!res) {
        if (subCategoryName) {
            await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            await showShopAdminCategoryPanel(player, categoryName, 1);
        }
        return;
    }

    if (res.action === 'Delete') {
        shopAdminManager.removeItem(categoryName, subCategoryName, itemKey);
        player.sendMessage(`§2Item deleted: ${itemKey}`);
    } else {
        const buyPrice = Number.parseInt(res.buyPrice);
        const sellPrice = Number.parseInt(res.sellPrice);

        if (isNonEmptyString(res.itemId) && !Number.isNaN(buyPrice) && !Number.isNaN(sellPrice)) {
            const newItemData = {
                itemId: res.itemId,
                buyPrice,
                sellPrice,
                displayName: res.displayName,
                icon: res.icon,
                permission: res.permission
            };
            shopAdminManager.updateShopItem(categoryName, subCategoryName, itemKey, newItemData);
            player.sendMessage(`§2Item updated: ${res.itemId}`);
        } else {
            player.sendMessage('§4Invalid input.');
            await showEditItemFormPanel(player, categoryName, subCategoryName, itemKey);
            return;
        }
    }

    if (subCategoryName) {
        await showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
    } else {
        await showShopAdminCategoryPanel(player, categoryName, 1);
    }
}
