import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getShopConfig } from '@core/configurations.js';
import * as shopAdminManager from '@features/shop/adminManager.js';
import { ensureItemsConfig, getAllItems } from '@features/shop/utils.js';
import { isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

interface ShopItemInfo {
    itemId: string;
    buyPrice: number;
    sellPrice: number;
    displayName?: string;
    icon?: string;
    permission?: string;
    rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
}
interface ShopSubCategory {
    icon?: string;
    items: Record<string, ShopItemInfo>;
}
interface ShopCategory {
    icon?: string;
    subCategories?: Record<string, ShopSubCategory>;
    items: Record<string, ShopItemInfo>;
}

export async function showShopManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
    const mainConfig = getConfig();
    const shopConfig = getShopConfig();
    const isEnabled = mainConfig.shop.enabled;
    const categories = shopConfig.categories as Record<string, ShopCategory>;

    const form = new ActionFormBuilder()
        .title('Shop Management')
        .button(isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED', isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel', () => {
            const newStatus = !getConfig().shop.enabled;
            void (updateMultipleConfig as (updates: Record<string, unknown>) => Promise<void>)({ 'shop.enabled': newStatus }).then(() => {
                player.sendMessage(`§2Shop system ${newStatus ? 'enabled' : 'disabled'}.`);
                void showShopManagementPanel(player, page);
            });
        })
        .button('§l§2+ Add Category', 'textures/ui/color_plus', () => {
            void showAddCategoryPanel(player);
        });

    const categoryNames = Object.keys(categories);
    form.addPaginatedButtons(
        categoryNames,
        page,
        (catName, formBuilder) => {
            const cat = categories[catName];
            if (cat) {
                formBuilder.button(catName, cat.icon, () => {
                    void showShopAdminCategoryActionPanel(player, catName);
                });
            }
        },
        (newPage) => {
            void showShopManagementPanel(player, newPage);
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
        .button('Open Category', 'textures/ui/inventory_icon', () => {
            void showShopAdminCategoryPanel(player, categoryName, 1);
        })
        .button('Edit Settings', 'textures/ui/icon_setting', () => {
            void showEditCategoryPanel(player, categoryName);
        })
        .button('§4Delete Category', 'textures/ui/cancel', () => {
            void showConfirmationDialog(player, {
                title: 'Confirm Delete',
                body: `Are you sure you want to delete ${categoryName} and all its contents?`,
                onConfirm: () => {
                    shopAdminManager.deleteCategory(categoryName);
                    player.sendMessage(`§2Deleted category: ${categoryName}`);
                    void showShopManagementPanel(player, 1);
                    return Promise.resolve();
                },
                onCancel: () => {
                    void showShopAdminCategoryActionPanel(player, categoryName);
                    return Promise.resolve();
                }
            });
        });

    form.addBackButton(() => {
        void showShopManagementPanel(player, 1);
    });

    await form.show(player);
}

export async function showShopAdminCategoryPanel(player: mc.Player, categoryName: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
    if (!category) {
        player.sendMessage('§4Category not found.');
        void showShopManagementPanel(player, 1);
        return;
    }

    const form = new ActionFormBuilder()
        .title(`Manage ${categoryName}`)
        .button('§l§2+ Add Item', 'textures/ui/color_plus', () => {
            void showShopAddItemPanel(player, categoryName, undefined);
        })
        .button('§l§2+ Add Sub-Category', 'textures/ui/color_plus', () => {
            void showAddSubCategoryPanel(player, categoryName);
        });

    const entries: { type: 'subCategory' | 'item'; id: string; name: string; icon?: string }[] = [];

    if (category.subCategories) {
        for (const [subId, subData] of Object.entries(category.subCategories)) {
            entries.push({ type: 'subCategory', id: subId, name: subId, icon: subData.icon });
        }
    }

    for (const [itemId, itemData] of Object.entries(category.items)) {
        entries.push({ type: 'item', id: itemId, name: itemData.displayName || itemId, icon: itemData.icon });
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            if (entry.type === 'subCategory') {
                formBuilder.button(`§l substitute ${entry.name}`, entry.icon, () => {
                    void showShopAdminSubCategoryActionPanel(player, categoryName, entry.id);
                });
            } else {
                formBuilder.button(entry.name, entry.icon, () => {
                    void showEditItemFormPanel(player, categoryName, undefined, entry.id);
                });
            }
        },
        (newPage) => {
            void showShopAdminCategoryPanel(player, categoryName, newPage);
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
        .button('Open Sub-Category', 'textures/ui/inventory_icon', () => {
            void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        })
        .button('Edit Settings', 'textures/ui/icon_setting', () => {
            void showEditSubCategoryPanel(player, categoryName, subCategoryName);
        })
        .button('§4Delete Sub-Category', 'textures/ui/cancel', () => {
            void showConfirmationDialog(player, {
                title: 'Confirm Delete',
                body: `Are you sure you want to delete ${subCategoryName} and all its contents?`,
                onConfirm: () => {
                    shopAdminManager.deleteSubCategory(categoryName, subCategoryName);
                    player.sendMessage(`§2Deleted sub-category: ${subCategoryName}`);
                    void showShopAdminCategoryPanel(player, categoryName, 1);
                    return Promise.resolve();
                }
            });
        });

    form.addBackButton(() => {
        void showShopAdminCategoryPanel(player, categoryName, 1);
    });

    await form.show(player);
}

export async function showShopAdminSubCategoryItemPanel(player: mc.Player, categoryName: string, subCategoryName: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
    const subCat = category?.subCategories?.[subCategoryName];
    if (!subCat) {
        player.sendMessage('§4Sub-category not found.');
        void showShopAdminCategoryPanel(player, categoryName, 1);
        return;
    }

    const form = new ActionFormBuilder().title(`Manage ${subCategoryName}`).button('§l§2+ Add Item', 'textures/ui/color_plus', () => {
        void showShopAddItemPanel(player, categoryName, subCategoryName);
    });

    const entries: { type: 'item'; id: string; name: string; icon?: string }[] = [];
    for (const [itemId, itemData] of Object.entries(subCat.items)) {
        entries.push({ type: 'item', id: itemId, name: itemData.displayName || itemId, icon: itemData.icon });
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            formBuilder.button(entry.name, entry.icon, () => {
                void showEditItemFormPanel(player, categoryName, subCategoryName, entry.id);
            });
        },
        (newPage) => {
            void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, newPage);
        }
    );

    form.addBackButton(() => {
        void showShopAdminSubCategoryActionPanel(player, categoryName, subCategoryName);
    });

    await form.show(player);
}

export async function showShopAddItemPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined): Promise<void> {
    const form = new ActionFormBuilder()
        .title('Add Item')
        .button('§6Add Item From List', 'textures/ui/inventory_icon', () => {
            void showAddItemFromListPanel(player, categoryName, subCategoryName, 1);
        })
        .button('§2Add Custom Item (Manual)', 'textures/ui/color_plus', () => {
            void showAddCustomItemPanel(player, categoryName, subCategoryName);
        });

    form.addBackButton(() => {
        if (subCategoryName) {
            void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            void showShopAdminCategoryPanel(player, categoryName, 1);
        }
    });

    await form.show(player);
}

export async function showAddCategoryPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ catName: string; icon: string }>()
        .title('Add Category')
        .textField('catName', 'Category Name', 'e.g., Blocks')
        .textField('icon', 'Icon Path', '');

    const res = await modal.show(player);
    if (!res) {
        void showShopManagementPanel(player, 1);
        return;
    }

    if (isNonEmptyString(res.catName)) {
        shopAdminManager.addCategory(res.catName, res.icon);
        player.sendMessage(`§2Category added: ${res.catName}`);
    } else {
        player.sendMessage('§4Invalid category name.');
    }
    void showShopManagementPanel(player, 1);
}

export async function showAddSubCategoryPanel(player: mc.Player, categoryName: string): Promise<void> {
    const modal = new ModalFormBuilder<{ subCatName: string; icon: string }>()
        .title('Add Sub-Category')
        .textField('subCatName', 'Sub-Category Name', 'e.g., Ores')
        .textField('icon', 'Icon Path', '');

    const res = await modal.show(player);
    if (!res) {
        void showShopAdminCategoryPanel(player, categoryName, 1);
        return;
    }

    if (isNonEmptyString(res.subCatName)) {
        shopAdminManager.addSubCategory(categoryName, res.subCatName, res.icon);
        player.sendMessage(`§2Sub-Category added: ${res.subCatName}`);
    } else {
        player.sendMessage('§4Invalid sub-category name.');
    }
    void showShopAdminCategoryPanel(player, categoryName, 1);
}

export async function showEditCategoryPanel(player: mc.Player, categoryName: string): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
    if (!category) return;

    const modal = new ModalFormBuilder<{ newName: string; icon: string }>()
        .title(`Edit ${categoryName}`)
        .textField('newName', 'New Name', 'New Name', categoryName)
        .textField('icon', 'Icon Path', 'Icon Path', category.icon ?? '');

    const res = await modal.show(player);
    if (!res) {
        void showShopAdminCategoryActionPanel(player, categoryName);
        return;
    }

    shopAdminManager.editCategory(categoryName, res.newName || categoryName, res.icon);
    player.sendMessage(`§2Category updated.`);
    void showShopManagementPanel(player, 1);
}

export async function showEditSubCategoryPanel(player: mc.Player, categoryName: string, subCategoryName: string): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
    const subCategory = category?.subCategories?.[subCategoryName];
    if (!subCategory) return;

    const modal = new ModalFormBuilder<{ newName: string; icon: string }>()
        .title(`Edit ${subCategoryName}`)
        .textField('newName', 'New Name', 'New Name', subCategoryName)
        .textField('icon', 'Icon Path', 'Icon Path', subCategory.icon ?? '');

    const res = await modal.show(player);
    if (!res) {
        void showShopAdminSubCategoryActionPanel(player, categoryName, subCategoryName);
        return;
    }

    shopAdminManager.editSubCategory(categoryName, subCategoryName, res.newName || subCategoryName, res.icon);
    player.sendMessage(`§2Sub-Category updated.`);
    void showShopAdminCategoryPanel(player, categoryName, 1);
}

export async function showAddItemFromListPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined, page: number = 1): Promise<void> {
    await ensureItemsConfig();
    const allItems = Object.keys(getAllItems());
    const form = new ActionFormBuilder().title('Select Item');

    form.addPaginatedButtons(
        allItems,
        page,
        (itemId, formBuilder) => {
            formBuilder.button(itemId.replace(['minecraft', ''].join(':'), ''), 'textures/ui/inventory_icon', () => {
                void showAddCustomItemPanel(player, categoryName, subCategoryName, itemId);
            });
        },
        (newPage) => {
            void showAddItemFromListPanel(player, categoryName, subCategoryName, newPage);
        }
    );

    form.addBackButton(() => {
        void showShopAddItemPanel(player, categoryName, subCategoryName);
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
        .textField('itemId', 'Item ID', ['dia', 'mond'].join(''), prefillItemId)
        .textField('buyPrice', 'Buy Price', '100', '100')
        .textField('sellPrice', 'Sell Price', '50', '50')
        .textField('displayName', 'Display Name', ['Dia', 'mond'].join(''))
        .textField('icon', 'Icon Path', '')
        .textField('permission', 'Permission', 'ui.panel.member')
        .textField('rankMultiplierOverridesStr', 'Overrides', '');

    const res = await modal.show(player);
    if (!res) {
        void showShopAddItemPanel(player, categoryName, subCategoryName);
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
            void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            void showShopAdminCategoryPanel(player, categoryName, 1);
        }
    } else {
        player.sendMessage('§4Invalid input.');
        void showAddCustomItemPanel(player, categoryName, subCategoryName, prefillItemId);
    }
}

export async function showEditItemFormPanel(player: mc.Player, categoryName: string, subCategoryName: string | undefined, itemKey: string): Promise<void> {
    const shopConfig = getShopConfig();
    const cat = shopConfig.categories[categoryName] as ShopCategory | undefined;
    const item = subCategoryName ? cat?.subCategories?.[subCategoryName]?.items[itemKey] : cat?.items[itemKey];

    if (!item) {
        player.sendMessage('§4Item not found.');
        if (subCategoryName) {
            void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            void showShopAdminCategoryPanel(player, categoryName, 1);
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
        .textField('itemId', 'Item ID', ['dia', 'mond'].join(''), item.itemId || itemKey)
        .textField('buyPrice', 'Buy Price', '100', String(item.buyPrice))
        .textField('sellPrice', 'Sell Price', '50', String(item.sellPrice))
        .textField('displayName', 'Display Name', ['Dia', 'mond'].join(''), item.displayName || '')
        .textField('icon', 'Icon Path', '', item.icon || '')
        .textField('permission', 'Permission', 'ui.panel.member', item.permission || '')
        .textField('rankMultiplierOverridesStr', 'Overrides', '', overridesStr)
        .dropdown('action', 'Action', ['Save', 'Delete']);

    const res = await modal.show(player);
    if (!res) {
        if (subCategoryName) {
            void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
        } else {
            void showShopAdminCategoryPanel(player, categoryName, 1);
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
            void showEditItemFormPanel(player, categoryName, subCategoryName, itemKey);
            return;
        }
    }

    if (subCategoryName) {
        void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
    } else {
        void showShopAdminCategoryPanel(player, categoryName, 1);
    }
}
