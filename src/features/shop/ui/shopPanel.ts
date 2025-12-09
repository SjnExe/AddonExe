import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { loadConfig } from '@core/configLoader.js';
import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getShopConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';
import { showConfirmationDialog } from '@ui/components.js';
import { IPanelHandler, MainConfig, PanelItem, ShopItem, UIContext } from '@ui/types.js';
import { getPaginatedItems, itemsPerPage } from '@ui/uiUtils.js';
import * as shopAdminManager from '../shopAdminManager.js';
import * as shopManager from '../shopManager.js';

interface Item {
    displayName?: string;
    icon?: string;
    buyPrice?: number;
    sellPrice?: number;
    itemId?: string;
}

interface ShopEntry {
    type: 'item' | 'subCategory';
    id: string;
    name?: string; // subCategory name
    icon?: string;
    displayName?: string; // item displayName
    buyPrice?: number;
    sellPrice?: number;
}

let allItems: Record<string, Item> = {};

export class ShopPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('shop');
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        // Initialize items config if needed
        if (Object.keys(allItems).length === 0) {
            try {
                // We use await here, satisfying the async requirement
                allItems = await loadConfig('./core/itemsConfig.js');
            } catch {
                // Ignore error
            }
        }

        const items: PanelItem[] = [];

        // Helper to add back button
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

        // Helper for pagination
        const addPagination = (totalItems: number) => {
            const page = (context.page as number) || 1;
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

        if (panelId === 'shopMainPanel') {
            addBack('mainPanel');
            const shopConfig = getShopConfig();
            const validCategories = Object.keys(shopConfig.categories)
                .filter((categoryName: string) => {
                    const category = shopConfig.categories[categoryName];
                    if (!category) return false;
                    return Object.keys(category.items).length > 0 || Object.keys(category.subCategories).length > 0;
                })
                .sort();

            validCategories.forEach((catName: string) => {
                const cat = shopConfig.categories[catName];
                items.push({
                    id: catName,
                    text: catName,
                    icon: cat.icon,
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: `shopCategoryPanel_${catName}`
                });
            });
            return items;
        }

        if (panelId.startsWith('shopCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            addBack('shopMainPanel');
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            if (category) {
                const subCategories: ShopEntry[] = Object.keys(category.subCategories)
                    .sort()
                    .map((name) => ({
                        id: name,
                        name,
                        ...category.subCategories[name],
                        type: 'subCategory'
                    }));
                const shopItems: ShopEntry[] = Object.keys(category.items).map((id) => ({
                    id,
                    ...category.items[id],
                    type: 'item'
                }));
                const allEntries = [...subCategories, ...shopItems];
                const paginated = getPaginatedItems(allEntries, (context.page as number) || 1);

                paginated.forEach((entry) => {
                    if (entry.type === 'subCategory') {
                        items.push({
                            id: entry.name!,
                            text: `§6${entry.name}`,
                            icon: entry.icon,
                            permissionLevel: 1024,
                            actionType: 'openPanel',
                            actionValue: `shopItemListPanel_${categoryName}_${entry.name}`
                        });
                    } else {
                        const masterItem = allItems[entry.id] || {};
                        const displayName = entry.displayName || masterItem.displayName || entry.id;
                        const buy = (entry.buyPrice ?? 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice!)}` : '';
                        const sell = (entry.sellPrice ?? 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice!)}` : '';
                        const priceString = [buy, sell].filter(Boolean).join(' ');
                        items.push({
                            id: entry.id,
                            text: `${displayName}\n${priceString}`,
                            icon: entry.icon || masterItem.icon,
                            permissionLevel: 1024,
                            actionType: 'functionCall',
                            actionValue: 'buyOrSell'
                        });
                    }
                });
                addPagination(allEntries.length);
            }
            return items;
        }

        if (panelId.startsWith('shopItemListPanel_')) {
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string;
            addBack(`shopCategoryPanel_${categoryName}`);
            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            const subCategory = category?.subCategories[subCategoryName];

            if (subCategory) {
                const shopItems = Object.keys(subCategory.items).map((id) => ({
                    id,
                    ...(subCategory.items as Record<string, ShopItem>)[id],
                    type: 'item'
                }));
                const paginated = getPaginatedItems(shopItems, (context.page as number) || 1);
                paginated.forEach((entry) => {
                    const masterItem = allItems[entry.id] || {};
                    const displayName = entry.displayName || masterItem.displayName || entry.id;
                    const buy = (entry.buyPrice ?? 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                    const sell = (entry.sellPrice ?? 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                    const priceString = [buy, sell].filter(Boolean).join(' ');
                    items.push({
                        id: entry.id,
                        text: `${displayName}\n${priceString}`,
                        icon: entry.icon || masterItem.icon,
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'buyOrSell'
                    });
                });
                addPagination(shopItems.length);
            }
            return items;
        }

        // --- Admin Shop Panels ---

        if (panelId === 'shopManagementPanel') {
            addBack('configCategoryPanel');
            const mainConfig = getConfig() as unknown as MainConfig;
            const isEnabled = mainConfig.shop.enabled;
            const toggleText = isEnabled ? '§2Shop System: ENABLED' : '§4Shop System: DISABLED';
            items.push({
                id: 'toggleShop',
                text: toggleText,
                icon: isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'toggleShop'
            });
            items.push({
                id: 'addCategory',
                text: '§l§2+ Add Category',
                icon: 'textures/ui/color_plus',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'addCategory'
            });

            const shopConfig = getShopConfig();
            const categories = Object.keys(shopConfig.categories).sort();
            const paginated = getPaginatedItems(categories, (context.page as number) || 1);

            paginated.forEach((catName: string) => {
                const cat = shopConfig.categories[catName];
                items.push({
                    id: catName,
                    text: catName,
                    icon: cat.icon,
                    permissionLevel: 0,
                    actionType: 'openPanel',
                    actionValue: `shopAdminCategoryPanel_${catName}`
                });
            });
            addPagination(categories.length);
            return items;
        }

        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            addBack('shopManagementPanel');
            items.push({
                id: 'addItem',
                text: '§l§2+ Add Item',
                icon: 'textures/ui/color_plus',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAddItemPanel_${categoryName}`
            });
            items.push({
                id: 'addSubCategory',
                text: '§l§2+ Add Subcategory',
                icon: 'textures/ui/color_plus',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'addSubCategory'
            });
            items.push({
                id: 'editCategory',
                text: '§l§9* Edit Category',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAdminCategoryActionPanel_${categoryName}`
            });

            const shopConfig = getShopConfig();
            const category = shopConfig.categories[categoryName];
            if (category) {
                const subCategories = Object.keys(category.subCategories).sort();
                const shopItems = Object.keys(category.items);
                const allEntries: ShopEntry[] = [
                    ...subCategories.map((n) => ({ id: n, type: 'subCategory' as const })),
                    ...shopItems.map((n) => ({ id: n, type: 'item' as const }))
                ];
                const paginated = getPaginatedItems(allEntries, (context.page as number) || 1);

                paginated.forEach((entry) => {
                    if (entry.type === 'subCategory') {
                        const sub = category.subCategories[entry.id];
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
                        const masterItem = allItems[entry.id] || {};
                        items.push({
                            id: entry.id,
                            text: item.displayName || masterItem.displayName || entry.id,
                            icon: item.icon || masterItem.icon,
                            permissionLevel: 0,
                            actionType: 'functionCall',
                            actionValue: 'editItem'
                        });
                    }
                });
                addPagination(allEntries.length);
            }
            return items;
        }

        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string;
            addBack(`shopAdminCategoryPanel_${categoryName}`);
            items.push({
                id: 'addItem',
                text: '§l§2+ Add Item',
                icon: 'textures/ui/color_plus',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAddItemPanel_${categoryName}`
            });
            items.push({
                id: 'editSubCategory',
                text: '§l§9* Edit Subcategory',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAdminSubCategoryActionPanel_${subCategoryName}`
            });

            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName]?.subCategories[subCategoryName];
            if (subCategory) {
                const shopItems = Object.keys(subCategory.items);
                const paginated = getPaginatedItems(shopItems, (context.page as number) || 1);
                paginated.forEach((id: string) => {
                    const item = (subCategory.items as Record<string, ShopItem>)[id];
                    const masterItem = allItems[id] || {};
                    items.push({
                        id: id,
                        text: item.displayName || masterItem.displayName || id,
                        icon: item.icon || masterItem.icon,
                        permissionLevel: 0,
                        actionType: 'functionCall',
                        actionValue: 'editItem'
                    });
                });
                addPagination(shopItems.length);
            }
            return items;
        }

        if (panelId.startsWith('shopAddItemPanel_')) {
            const categoryName = context.categoryName as string;
            addBack(`shopAdminCategoryPanel_${categoryName}`);
            items.push({
                id: 'addCustomItem',
                text: '§l§2+ Add Custom Item',
                icon: 'textures/ui/color_plus',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'addCustomItem'
            });

            const allPossibleItems = Object.keys(allItems);
            const paginated = getPaginatedItems(allPossibleItems, (context.page as number) || 1);
            paginated.forEach((itemId) => {
                const masterItem = allItems[itemId];
                items.push({
                    id: itemId,
                    text: masterItem.displayName ?? itemId,
                    icon: masterItem.icon,
                    permissionLevel: 0,
                    actionType: 'functionCall',
                    actionValue: 'addItemFromList'
                });
            });
            addPagination(allPossibleItems.length);
            return items;
        }

        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
            items.push({
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'editCategory'
            });
            items.push({
                id: 'delete',
                text: '§4Delete',
                icon: 'textures/ui/trash',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'deleteCategory'
            });
            items.push({
                id: 'back',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAdminCategoryPanel_${categoryName}`
            });
            return items;
        }

        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
            items.push({
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'editSubCategory'
            });
            items.push({
                id: 'delete',
                text: '§4Delete',
                icon: 'textures/ui/trash',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'deleteSubCategory'
            });
            items.push({
                id: 'back',
                text: '§l§8< Back',
                icon: 'textures/gui/controls/left.png',
                permissionLevel: 0,
                actionType: 'openPanel',
                actionValue: `shopAdminSubCategoryItemPanel_${subCategoryName}`
            });
            return items;
        }

        return [];
    }

    async handleResponse(
        player: mc.Player,
        panelId: string,
        response: ActionFormResponse | ModalFormResponse,
        context: UIContext
    ): Promise<void> {
        const selection = (response as ActionFormResponse).selection;

        if (typeof selection === 'number') {
            const items = await this.getItems(player, panelId, context);
            if (selection >= 0 && selection < items.length) {
                const item = items[selection];

                // --- Generic Handlers ---
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

                // --- Shop Function Calls ---

                if (item.actionValue === 'toggleShop') {
                    const mainConfig = getConfig() as unknown as MainConfig;
                    const newStatus = !mainConfig.shop.enabled;
                    updateMultipleConfig({ 'shop.enabled': newStatus });
                    player.sendMessage(`§2Shop system has been ${newStatus ? 'enabled' : 'disabled'}.`);
                    return showPanel(player, 'shopManagementPanel', { ...context, page: 1 });
                }

                if (item.actionValue === 'addCategory') {
                    const form = new ModalFormData()
                        .title('Add Category')
                        .textField('Category Name', 'Enter category name', { defaultValue: '' })
                        .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
                    const formRes = await form.show(player);
                    if (formRes.canceled) return showPanel(player, panelId, context);

                    const values = formRes.formValues;
                    if (!values) return;
                    const name = values[0] as string;
                    const iconStr = values[1] as string;

                    if (name) {
                        const result = shopAdminManager.addCategory(name, iconStr || '');
                        player.sendMessage(result.message);
                    }
                    return showPanel(player, panelId, { ...context, page: 1 });
                }

                if (item.actionValue === 'addSubCategory') {
                    const { categoryName } = context;
                    const form = new ModalFormData()
                        .title('Add Subcategory')
                        .textField('Subcategory Name', 'Enter subcategory name', { defaultValue: '' })
                        .textField('Icon', 'Enter icon texture path', { defaultValue: '' });
                    const formRes = await form.show(player);
                    if (formRes.canceled) return showPanel(player, panelId, context);

                    const values = formRes.formValues;
                    if (!values) return;
                    const name = values[0] as string;
                    const iconStr = values[1] as string;

                    if (name) {
                        const result = shopAdminManager.addSubCategory(categoryName as string, name, iconStr || '');
                        player.sendMessage(result.message);
                    }
                    return showPanel(player, panelId, { ...context, page: 1 });
                }

                if (item.actionValue === 'editCategory') {
                    let targetName = context.categoryName as string;
                    if (!targetName && panelId.startsWith('shopAdminCategoryActionPanel_')) {
                        targetName = panelId.replace('shopAdminCategoryActionPanel_', '');
                    }

                    const shopConfig = getShopConfig();
                    const category = shopConfig.categories[targetName];
                    const form = new ModalFormData()
                        .title('Edit Category')
                        .textField('Category Name', 'Enter new name', { defaultValue: targetName })
                        .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
                    const formRes = await form.show(player);
                    if (formRes.canceled) return showPanel(player, panelId, context);

                    const values = formRes.formValues;
                    if (!values) return;
                    const newName = values[0] as string;
                    const newIcon = values[1] as string;

                    if (newName) {
                        const result = shopAdminManager.editCategory(targetName, newName, newIcon || '');
                        player.sendMessage(result.message);
                    }
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

                if (item.actionValue === 'editSubCategory') {
                    const targetName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
                    const { categoryName } = context;
                    const shopConfig = getShopConfig();
                    const subCategory = shopConfig.categories[categoryName as string].subCategories[targetName];

                    const form = new ModalFormData()
                        .title('Edit Subcategory')
                        .textField('Subcategory Name', 'Enter new name', { defaultValue: targetName })
                        .textField('Icon', 'Enter icon texture path', { defaultValue: subCategory.icon });
                    const formRes = await form.show(player);
                    if (formRes.canceled) return showPanel(player, panelId, context);

                    const values = formRes.formValues;
                    if (!values) return;
                    const newName = values[0] as string;
                    const newIcon = values[1] as string;

                    if (newName) {
                        const result = shopAdminManager.editSubCategory(
                            categoryName as string,
                            targetName,
                            newName,
                            newIcon || ''
                        );
                        player.sendMessage(result.message);
                    }
                    return showPanel(player, `shopAdminCategoryPanel_${categoryName as string}`, {
                        ...context,
                        page: 1
                    });
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

                if (item.actionValue === 'addCustomItem') {
                    const form = new ModalFormData()
                        .title('Add Custom Item')
                        .textField('Item ID (unique key)', 'e.g., custom_sword')
                        .textField('Display Name', 'e.g., Sword of Awesome')
                        .textField('Minecraft Item ID', 'e.g., minecraft:diamond_sword')
                        .textField('Icon Path', 'e.g., textures/items/diamond_sword')
                        .textField('Buy Price', '-1 to disable', { defaultValue: '-1' })
                        .textField('Sell Price', '-1 to disable', { defaultValue: '-1' })
                        .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });

                    const formRes = await form.show(player);
                    if (formRes.canceled) return showPanel(player, panelId, context);

                    const values = formRes.formValues as string[];
                    const [customId, displayName, mcId, iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
                    const icon = iconStr || '';
                    const buyPrice = parseInt(buyPriceStr, 10);
                    const sellPrice = parseInt(sellPriceStr, 10);
                    const permissionLevel = parseInt(permLevelStr, 10);

                    if (customId && displayName && mcId && !isNaN(buyPrice)) {
                        shopAdminManager.addCustomItemToConfig(customId, {
                            itemId: mcId,
                            icon,
                            buyPrice,
                            sellPrice,
                            displayName
                        });
                        shopAdminManager.setItem(
                            context.categoryName as string,
                            (context.subCategoryName as string) || null,
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

                if (item.actionValue === 'addItemFromList') {
                    const itemId = item.id;
                    const masterItem = allItems[itemId];
                    const form = new ModalFormData()
                        .title(`Add ${masterItem.displayName}`)
                        .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                            defaultValue: masterItem.icon
                        })
                        .textField('Buy Price', '-1 to disable', { defaultValue: `${masterItem.buyPrice}` })
                        .textField('Sell Price', '-1 to disable', { defaultValue: `${masterItem.sellPrice}` })
                        .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });

                    const formRes = await form.show(player);
                    if (formRes.canceled) return showPanel(player, panelId, context);

                    const values = formRes.formValues as string[];
                    const [iconStr, buyPriceStr, sellPriceStr, permLevelStr] = values;
                    const icon = iconStr || '';
                    const buyPrice = parseInt(buyPriceStr, 10);
                    const sellPrice = parseInt(sellPriceStr, 10);
                    const permissionLevel = parseInt(permLevelStr, 10);

                    if (!isNaN(buyPrice)) {
                        shopAdminManager.setItem(
                            context.categoryName as string,
                            (context.subCategoryName as string) || null,
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

                if (item.actionValue === 'editItem') {
                    const actionForm = new ActionFormData()
                        .title('Edit Item')
                        .button('Edit', 'textures/ui/icon_setting')
                        .button('Delete', 'textures/ui/trash');

                    const actionRes = await actionForm.show(player);
                    if (actionRes.canceled) return showPanel(player, panelId, context);

                    if (actionRes.selection === 0) {
                        const itemId = item.id;
                        const categoryName = context.categoryName as string;
                        const subCategoryName = context.subCategoryName as string | undefined;
                        const shopConfig = getShopConfig();
                        let shopItem;
                        if (subCategoryName)
                            shopItem = shopConfig.categories[categoryName].subCategories[subCategoryName].items[itemId];
                        else shopItem = shopConfig.categories[categoryName].items[itemId];

                        const masterItem = allItems[itemId] || {};

                        const editForm = new ModalFormData()
                            .title(`Edit Item: ${itemId}`)
                            .textField('Display Name', 'Name', {
                                defaultValue: shopItem.displayName || masterItem.displayName
                            })
                            .textField('Minecraft ID', 'ID', {
                                defaultValue: shopItem.itemId || masterItem.itemId
                            })
                            .textField('Icon', 'Icon', { defaultValue: shopItem.icon || masterItem.icon })
                            .textField('Buy Price', 'Price', { defaultValue: String(shopItem.buyPrice) })
                            .textField('Sell Price', 'Price', { defaultValue: String(shopItem.sellPrice) })
                            .textField('Permission', 'Level', { defaultValue: String(shopItem.permissionLevel) });

                        const editRes = await editForm.show(player);
                        if (editRes.canceled) return showPanel(player, panelId, context);

                        const vals = editRes.formValues as string[];
                        const [dName, mId, icon, bPrice, sPrice, pLevel] = vals;
                        shopAdminManager.updateShopItem(categoryName, subCategoryName || null, itemId, {
                            buyPrice: Number(bPrice),
                            sellPrice: Number(sPrice),
                            permissionLevel: Number(pLevel),
                            icon,
                            minecraftId: mId,
                            displayName: dName
                        });
                        player.sendMessage('§2Item updated.');
                    } else if (actionRes.selection === 1) {
                        shopAdminManager.removeItem(
                            context.categoryName as string,
                            (context.subCategoryName as string) || null,
                            item.id
                        );
                        player.sendMessage('§2Item removed.');
                    }
                    return showPanel(player, panelId, context);
                }

                if (item.actionValue === 'buyOrSell') {
                    const itemId = item.id;
                    const masterItem = allItems[itemId];
                    const categoryName = context.categoryName as string;
                    const subCategoryName = context.subCategoryName as string;
                    const shopConfig = getShopConfig();

                    let shopItem;
                    if (subCategoryName) {
                        shopItem = shopConfig.categories[categoryName].subCategories[subCategoryName].items[itemId];
                    } else {
                        shopItem = shopConfig.categories[categoryName].items[itemId];
                    }

                    if (!shopItem) return;

                    const canBuy = context.view !== 'sell' && (shopItem.buyPrice ?? 0) > 0;
                    const canSell = context.view !== 'buy' && (shopItem.sellPrice ?? 0) > 0;

                    if (!canBuy && !canSell) {
                        player.sendMessage('§4This item cannot be bought or sold currently.');
                        return showPanel(player, panelId, context);
                    }

                    const modal = new ModalFormData().title(masterItem?.displayName ?? itemId);
                    let action: 'buy' | 'sell' | undefined;
                    let hasDropdown = false;

                    if (canBuy && canSell) {
                        modal.textField('Amount', 'Enter the amount', { defaultValue: '1' });
                        const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                        modal.dropdown('Action', options, { defaultValueIndex: 0 });
                        hasDropdown = true;
                    } else if (canBuy) {
                        modal.textField(`Amount to Buy (Price: $${shopItem.buyPrice})`, 'Enter a numeric value', {
                            defaultValue: '1'
                        });
                        action = 'buy';
                    } else {
                        modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', {
                            defaultValue: '1'
                        });
                        action = 'sell';
                    }

                    const modalResponse = await modal.show(player);
                    if (modalResponse.canceled) return showPanel(player, panelId, context);

                    let amount;
                    if (hasDropdown) {
                        const values = modalResponse.formValues as [string, number];
                        if (!values) return showPanel(player, panelId, context);
                        const amountStr = values[0];
                        const actionIndex = values[1];
                        amount = parseCurrency(amountStr);
                        const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                        const selectedActionString = options[actionIndex];
                        action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
                    } else {
                        const values = modalResponse.formValues as [string];
                        if (!values) return showPanel(player, panelId, context);
                        const amountStr = values[0];
                        amount = parseCurrency(amountStr);
                    }

                    if (isNaN(amount) || amount <= 0) {
                        player.sendMessage('§4Invalid amount.');
                        return showPanel(player, panelId, context);
                    }

                    let result;
                    if (action === 'buy') {
                        result = shopManager.buyItem(player, itemId, amount);
                    } else {
                        result = shopManager.sellItem(player, itemId, amount);
                    }
                    player.sendMessage(result.message);
                    return showPanel(player, panelId, context);
                }
            }
        }
    }
}
