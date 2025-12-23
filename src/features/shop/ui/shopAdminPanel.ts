import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getShopConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { showConfirmationDialog } from '@ui/components.js';
import { IPanelHandler, MainConfig, PanelItem, ShopItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';
import * as shopAdminManager from '../shopAdminManager.js';
import { ensureItemsConfig, getAllItems } from '../shopUtils.js';

interface ShopCategoryEntry {
    type: 'subCategory';
    id: string;
    name: string;
    icon: string;
}

interface ShopItemEntry {
    type: 'item';
    id: string;
    icon?: string;
    displayName?: string;
    buyPrice: number;
    sellPrice: number;
    permissionLevel: number;
}

type ShopEntry = ShopCategoryEntry | ShopItemEntry;

export class ShopAdminPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'shopManagementPanel' ||
            panelId.startsWith('shopAdmin') ||
            panelId.startsWith('shopAddItem') ||
            panelId === 'addCategoryPanel' ||
            panelId === 'addSubCategoryPanel' ||
            panelId === 'editCategoryPanel' ||
            panelId === 'editSubCategoryPanel' ||
            panelId === 'addCustomItemPanel' ||
            panelId === 'addItemFromListPanel' ||
            panelId === 'editItemFormPanel'
        );
    }

    async getTitle(_player: mc.Player, panelId: string, context: UIContext): Promise<string | undefined> {
        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            return `Manage ${categoryName}`;
        }
        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const subName = context.subCategoryName as string;
            return `Manage ${subName}`;
        }
        if (panelId.startsWith('shopAddItemPanel_')) {
            const categoryName = context.categoryName as string;
            return `Add Item to ${categoryName}`;
        }
        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const name = panelId.replace('shopAdminCategoryActionPanel_', '');
            return `Edit ${name}`;
        }
        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const name = panelId.replace('shopAdminSubCategoryActionPanel_', '');
            return `Edit ${name}`;
        }
        return undefined;
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await ensureItemsConfig();
        const allItems = getAllItems();
        const items: PanelItem[] = [];

        if (panelId === 'shopManagementPanel') {
            addBackButton(items, 'configCategoryPanel');
            const mainConfig = getConfig() as unknown as MainConfig;
            const isEnabled = mainConfig.shop.enabled;
            const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED';
            items.push(
                {
                    id: 'toggleShop',
                    text: toggleText,
                    icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: 'toggleShop'
                },
                {
                    id: 'addCategory',
                    text: '§l§2+ Add Category',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: 'addCategoryPanel'
                }
            );

            const shopConfig = getShopConfig();
            const categories = Object.keys(shopConfig.categories).toSorted();
            const paginated = getPaginatedItems(categories, (context.page as number) || 1);

            for (const catName of paginated) {
                const cat = shopConfig.categories[catName];
                if (!cat) continue;
                items.push({
                    id: catName,
                    text: catName,
                    icon: cat.icon,
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `shopAdminCategoryPanel_${catName}`
                });
            }
            addPaginationItems(items, (context.page as number) || 1, categories.length);
            return items;
        }

        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            addBackButton(items, 'shopManagementPanel');
            items.push(
                {
                    id: 'addItem',
                    text: '§l§2+ Add Item',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `shopAddItemPanel_${categoryName}`
                },
                {
                    id: 'addSubCategory',
                    text: '§l§2+ Add Subcategory',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: 'addSubCategoryPanel'
                },
                {
                    id: 'editCategory',
                    text: '§l§9* Edit Category',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `shopAdminCategoryActionPanel_${categoryName}`
                }
            );

            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            if (category) {
                const subCategories = Object.keys(category.subCategories).toSorted();
                const shopItems = Object.keys(category.items);

                const allEntries: ShopEntry[] = [
                    ...subCategories.map((n) => {
                        const sub = category.subCategories[n];
                        return {
                            id: n,
                            name: n,
                            type: 'subCategory' as const,
                            icon: sub?.icon || ''
                        };
                    }),
                    ...shopItems.map((n) => {
                        const item = category.items[n];
                        return {
                            id: n,
                            type: 'item' as const,
                            ...(item?.icon ? { icon: item.icon } : {}),
                            ...(item?.displayName ? { displayName: item.displayName } : {}),
                            buyPrice: item?.buyPrice || -1,
                            sellPrice: item?.sellPrice || -1,
                            permissionLevel: item?.permissionLevel || 1024
                        };
                    })
                ];

                const paginated = getPaginatedItems(allEntries, (context.page as number) || 1);

                for (const entry of paginated) {
                    if (!entry) continue;
                    if (entry.type === 'subCategory') {
                        const sub = category.subCategories[entry.id];
                        if (!sub) continue;
                        items.push({
                            id: entry.id,
                            text: `§6${entry.id}`,
                            icon: sub.icon,
                            permissionLevel: 0,
                            actionType: 'openPanel',
                            actionValue: `shopAdminSubCategoryItemPanel_${categoryName}_${entry.id}`
                        });
                    } else {
                        const item = category.items[entry.id];
                        if (!item) continue;
                        const masterItem = allItems[entry.id] || {};
                        const icon = item.icon || masterItem.icon;
                        items.push({
                            id: entry.id,
                            text: item.displayName || masterItem.displayName || entry.id,
                            ...(icon ? { icon } : {}),
                            permissionLevel: 0,
                            actionType: 'functionCall',
                            actionValue: 'editItem'
                        });
                    }
                }
                addPaginationItems(items, (context.page as number) || 1, allEntries.length);
            }
            return items;
        }

        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string;
            addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
            items.push(
                {
                    id: 'addItem',
                    text: '§l§2+ Add Item',
                    icon: 'textures/ui/color_plus',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `shopAddItemPanel_${categoryName}`
                },
                {
                    id: 'editSubCategory',
                    text: '§l§9* Edit Subcategory',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `shopAdminSubCategoryActionPanel_${subCategoryName}`
                }
            );

            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName]?.subCategories[subCategoryName];
            if (subCategory) {
                const shopItems = Object.keys(subCategory.items);
                const paginated = getPaginatedItems(shopItems, (context.page as number) || 1);
                for (const id of paginated) {
                    if (!id) continue;
                    const item = (subCategory.items as Record<string, ShopItem>)[id];
                    if (!item) continue;
                    const masterItem = allItems[id] || {};
                    const icon = item.icon || masterItem.icon;
                    items.push({
                        id: id,
                        text: item.displayName || masterItem.displayName || id,
                        ...(icon ? { icon } : {}),
                        permissionLevel: 0,
                        actionType: 'functionCall',
                        actionValue: 'editItem'
                    });
                }
                addPaginationItems(items, (context.page as number) || 1, shopItems.length);
            }
            return items;
        }

        if (panelId.startsWith('shopAddItemPanel_')) {
            const categoryName = context.categoryName as string;
            addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
            items.push({
                id: 'addCustomItem',
                text: '§l§2+ Add Custom Item',
                icon: 'textures/ui/color_plus',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: 'addCustomItemPanel'
            });

            const allPossibleItems = Object.keys(allItems);
            const paginated = getPaginatedItems(allPossibleItems, (context.page as number) || 1);
            for (const itemId of paginated) {
                if (!itemId) continue;
                const masterItem = allItems[itemId];
                if (!masterItem) continue;
                items.push({
                    id: itemId,
                    text: masterItem.displayName ?? itemId,
                    ...(masterItem.icon ? { icon: masterItem.icon } : {}),
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: 'addItemFromListPanel'
                });
            }
            addPaginationItems(items, (context.page as number) || 1, allPossibleItems.length);
            return items;
        }

        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
            addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
            items.push(
                {
                    id: 'edit',
                    text: 'Edit',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: 'editCategoryPanel'
                },
                {
                    id: 'delete',
                    text: '§4Delete',
                    icon: 'textures/ui/trash',
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: 'deleteCategory'
                }
            );
            return items;
        }

        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
            addBackButton(items, `shopAdminSubCategoryItemPanel_${subCategoryName}`);
            items.push(
                {
                    id: 'edit',
                    text: 'Edit',
                    icon: 'textures/ui/icon_setting',
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: 'editSubCategoryPanel'
                },
                {
                    id: 'delete',
                    text: '§4Delete',
                    icon: 'textures/ui/trash',
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: 'deleteSubCategory'
                }
            );
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined> {
        await ensureItemsConfig();
        const allItems = getAllItems();

        if (panelId === 'addCategoryPanel') {
            return new ModalFormData()
                .title('Add Category')
                .textField('Category Name', 'Enter category name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
        }
        if (panelId === 'addSubCategoryPanel') {
            return new ModalFormData()
                .title('Add Subcategory')
                .textField('Subcategory Name', 'Enter subcategory name', { defaultValue: '' })
                .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
        }
        if (panelId === 'editCategoryPanel') {
            let targetName = context.categoryName as string;
            if (!targetName && (context.id as string).startsWith('shopAdminCategoryActionPanel_')) {
                targetName = (context.id as string).replace('shopAdminCategoryActionPanel_', '');
            }
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[targetName];
            if (!category) return undefined;
            return new ModalFormData()
                .title('Edit Category')
                .textField('Category Name', 'Enter new name', { defaultValue: targetName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
        }

        if (panelId === 'editSubCategoryPanel') {
            const targetName = (context.id as string).replace('shopAdminSubCategoryActionPanel_', '');
            const { categoryName } = context;
            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName as string]?.subCategories[targetName];
            if (!subCategory) return undefined;
            return new ModalFormData()
                .title('Edit Subcategory')
                .textField('Subcategory Name', 'Enter new name', { defaultValue: targetName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
        }

        if (panelId === 'addCustomItemPanel') {
            return new ModalFormData()
                .title('Add Custom Item')
                .textField('Item ID (unique key)', 'e.g., custom_sword')
                .textField('Display Name', 'e.g., Sword of Awesome')
                .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
        }

        if (panelId === 'addItemFromListPanel') {
            const itemId = context.selectedItemId as string;
            const masterItem = allItems[itemId];
            if (!masterItem) return undefined;
            return new ModalFormData()
                .title(`Add ${String(masterItem.displayName ?? itemId)}`)
                .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                    defaultValue: String(masterItem.icon ?? '')
                })
                .textField('Buy Price', '-1 to disable', { defaultValue: String(masterItem.buyPrice ?? -1) })
                .textField('Sell Price', '-1 to disable', { defaultValue: String(masterItem.sellPrice ?? -1) })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
        }

        if (panelId === 'editItemFormPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;
            const shopConfig = getShopConfig();
            const shopItem = subCategoryName
                ? shopConfig.categories[categoryName]?.subCategories[subCategoryName]?.items[itemId]
                : shopConfig.categories[categoryName]?.items[itemId];

            if (!shopItem) return undefined;

            return new ModalFormData()
                .title(`Edit Item: ${String(itemId)}`)
                .textField('Display Name', 'Name', { defaultValue: String(shopItem.displayName || '') })
                .textField('Minecraft ID', 'ID', { defaultValue: String(shopItem.itemId || '') })
                .textField('Icon', 'Icon', { defaultValue: String(shopItem.icon || '') })
                .textField('Buy Price', 'Price', { defaultValue: String(shopItem.buyPrice ?? -1) })
                .textField('Sell Price', 'Price', { defaultValue: String(shopItem.sellPrice ?? -1) })
                .textField('Permission', 'Level', { defaultValue: String(shopItem.permissionLevel ?? 1024) });
        }

        return undefined;
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;
        const formValues = (response as ModalFormResponse).formValues;

        await ensureItemsConfig();
        const allItems = getAllItems();

        if (panelId === 'addCategoryPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'shopManagementPanel', context);
            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, 'shopManagementPanel', context);
            const [name, iconStr] = values;
            if (name) {
                const result = shopAdminManager.addCategory(name, iconStr || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (panelId === 'addSubCategoryPanel') {
            const categoryName = context.categoryName as string;
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, context);
            const [name, iconStr] = values;
            if (name) {
                const result = shopAdminManager.addSubCategory(categoryName, name, iconStr || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        if (panelId === 'editCategoryPanel') {
            let targetName = context.categoryName as string;
            if (!targetName && (context.id as string).startsWith('shopAdminCategoryActionPanel_')) {
                targetName = (context.id as string).replace('shopAdminCategoryActionPanel_', '');
            }
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAdminCategoryActionPanel_${targetName}`, context);

            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
            const [newName, newIcon] = values;
            if (newName) {
                const result = shopAdminManager.editCategory(targetName, newName, newIcon || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
        }

        if (panelId === 'editSubCategoryPanel') {
            const targetName = (context.id as string).replace('shopAdminSubCategoryActionPanel_', '');
            const categoryName = context.categoryName as string;
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAdminSubCategoryActionPanel_${targetName}`, context);

            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
            const [newName, newIcon] = values;
            if (newName) {
                const result = shopAdminManager.editSubCategory(categoryName, targetName, newName, newIcon || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        if (panelId === 'addCustomItemPanel') {
            const categoryName = context.categoryName as string;
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAddItemPanel_${categoryName}`, context);

            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
            const [customId, displayName, mcId, iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
            const icon = iconStr || '';
            const buyPrice = Number.parseInt(buyPriceStr || '-1', 10);
            const sellPrice = Number.parseInt(sellPriceStr || '-1', 10);
            const permissionLevel = Number.parseInt(permLevelStr || '1024', 10);

            if (customId && displayName && mcId && !Number.isNaN(buyPrice)) {
                shopAdminManager.addCustomItemToConfig(customId, {
                    itemId: mcId,
                    icon,
                    buyPrice,
                    sellPrice,
                    displayName
                });
                shopAdminManager.setItem(
                    context.categoryName as string,
                    (context.subCategoryName as string) || undefined,
                    customId,
                    {
                        buyPrice,
                        sellPrice,
                        permissionLevel,
                        icon,
                        displayName,
                        itemId: customId
                    }
                );
                player.sendMessage(`§2Added ${displayName}.`);
            }
            const subName = context.subCategoryName as string | undefined;
            const parent = subName
                ? `shopAdminSubCategoryItemPanel_${subName}`
                : `shopAdminCategoryPanel_${context.categoryName as string}`;
            return showPanel(player, parent, { ...context, page: 1 });
        }

        if (panelId === 'addItemFromListPanel') {
            const categoryName = context.categoryName as string;
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAddItemPanel_${categoryName}`, context);

            const itemId = context.selectedItemId as string;
            const masterItem = allItems[itemId];
            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, `shopAddItemPanel_${categoryName}`, context);
            const [iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
            const icon = iconStr || '';
            const buyPrice = Number.parseInt(buyPriceStr || '-1', 10);
            const sellPrice = Number.parseInt(sellPriceStr || '-1', 10);
            const permissionLevel = Number.parseInt(permLevelStr || '1024', 10);

            if (!Number.isNaN(buyPrice) && masterItem) {
                shopAdminManager.setItem(
                    context.categoryName as string,
                    (context.subCategoryName as string) || undefined,
                    itemId,
                    {
                        buyPrice,
                        sellPrice,
                        permissionLevel,
                        icon,
                        displayName: masterItem.displayName || '',
                        itemId: itemId
                    }
                );
                player.sendMessage(`§2Added ${masterItem.displayName}.`);
            }
            const subName = context.subCategoryName as string | undefined;
            const parent = subName
                ? `shopAdminSubCategoryItemPanel_${subName}`
                : `shopAdminCategoryPanel_${context.categoryName as string}`;
            return showPanel(player, parent, { ...context, page: 1 });
        }

        if (panelId === 'editItemFormPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;

            const parent = subCategoryName
                ? `shopAdminSubCategoryItemPanel_${subCategoryName}`
                : `shopAdminCategoryPanel_${categoryName}`;

            if ((response as ModalFormResponse).canceled) return showPanel(player, parent, context);

            const vals = formValues as string[] | undefined;
            if (!vals) return showPanel(player, parent, context);
            // Fix: handle possible undefined from array destructuring
            const dName = vals[0] || undefined;
            const mId = vals[1] || undefined;
            const icon = vals[2] || undefined;
            const bPrice = vals[3] || undefined;
            const sPrice = vals[4] || undefined;
            const pLevel = vals[5] || undefined;

            shopAdminManager.updateShopItem(categoryName, subCategoryName || undefined, itemId, {
                buyPrice: bPrice ? Number(bPrice) : -1,
                sellPrice: sPrice ? Number(sPrice) : -1,
                permissionLevel: pLevel ? Number(pLevel) : 1024,
                icon: icon || '',
                minecraftId: mId || itemId,
                displayName: dName || itemId
            });
            player.sendMessage('§2Item updated.');
            return showPanel(player, parent, context);
        }

        if (typeof selection === 'number') {
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
                        page: Math.max(1, ((context.page as number) || 1) - 1)
                    });
                }
                if (item.actionValue === 'nextPage') {
                    return showPanel(player, panelId, { ...context, page: ((context.page as number) || 1) + 1 });
                }

                if (item.actionValue === 'toggleShop') {
                    const mainConfig = getConfig() as unknown as MainConfig;
                    const newStatus = !mainConfig.shop.enabled;
                    updateMultipleConfig({ 'shop.enabled': newStatus });
                    player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
                    return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
                }

                if (item.actionValue === 'deleteCategory') {
                    const targetName = panelId.replace('shopAdminCategoryActionPanel_', '');
                    await showConfirmationDialog(player, {
                        title: 'Confirm Deletion',
                        body: 'Are you sure?',
                        confirmButtonText: '§4Yes, Delete',
                        cancelButtonText: '§2No, Cancel',
                        onConfirm: () => {
                            const result = shopAdminManager.deleteCategory(targetName);
                            player.sendMessage(result.message);
                            return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
                        },
                        onCancel: () => showPanel(player, panelId, context)
                    });
                    return;
                }

                if (item.actionValue === 'deleteSubCategory') {
                    const targetName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
                    const { categoryName } = context;
                    await showConfirmationDialog(player, {
                        title: 'Confirm Deletion',
                        body: 'Are you sure?',
                        confirmButtonText: '§4Yes, Delete',
                        cancelButtonText: '§2No, Cancel',
                        onConfirm: () => {
                            const result = shopAdminManager.deleteSubCategory(categoryName as string, targetName);
                            player.sendMessage(result.message);
                            return showPanel(player, `shopAdminCategoryPanel_${categoryName as string}`, {
                                ...context,
                                page: 1
                            });
                        },
                        onCancel: () => showPanel(player, panelId, context)
                    });
                    return;
                }

                if (item.actionValue === 'editItem') {
                    const actionForm = new ActionFormData()
                        .title('Edit Item')
                        .button('Edit', 'textures/ui/icon_setting')
                        .button('Delete', 'textures/ui/trash');

                    const actionRes = await actionForm.show(player);
                    if (actionRes.canceled) return showPanel(player, panelId, context);

                    if (actionRes.selection === 0) {
                        return showPanel(player, 'editItemFormPanel', {
                            ...context,
                            selectedItemId: item.id
                        });
                    } else if (actionRes.selection === 1) {
                        shopAdminManager.removeItem(
                            context.categoryName as string,
                            (context.subCategoryName as string) || undefined,
                            item.id
                        );
                        player.sendMessage('§2Item removed.');
                        return showPanel(player, panelId, context);
                    }
                }
            }
        }
    }
}
