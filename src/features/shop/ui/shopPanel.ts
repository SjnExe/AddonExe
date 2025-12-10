import * as mc from '@minecraft/server';
import { ActionFormData, ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { loadConfig } from '@core/configLoader.js';
import { getConfig, updateMultipleConfig } from '@core/configManager.js';
import { getShopConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';
import { showConfirmationDialog } from '@ui/components.js';
import { IPanelHandler, MainConfig, PanelItem, ShopItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';
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

// Helper for ensure item config loaded
// We load it once and keep it in memory
async function ensureItemsConfig() {
    if (Object.keys(allItems).length === 0) {
        try {
            allItems = await loadConfig<Record<string, Item>>('./core/itemsConfig.js');
        } catch {
            // Ignore error
        }
    }
}

export class ShopPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return panelId.startsWith('shop');
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        // Initialize items config if needed
        await ensureItemsConfig();

        const items: PanelItem[] = [];

        if (panelId === 'shopMainPanel') {
            addBackButton(items, 'mainPanel');
            items.push({
                id: 'search',
                text: '§l§6Search Item',
                icon: 'textures/ui/magnifyingGlass',
                permissionLevel: 1024,
                actionType: 'openPanel',
                actionValue: 'shopSearchPanel'
            });

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

        if (panelId === 'shopSearchResultsPanel') {
            addBackButton(items, 'shopMainPanel');
            const query = ((context.searchQuery as string) || '').toLowerCase();
            const shopConfig = getShopConfig();
            const results: ShopEntry[] = [];

            for (const catName in shopConfig.categories) {
                const cat = shopConfig.categories[catName];
                // Items
                for (const itemId in cat.items) {
                    const item = cat.items[itemId];
                    const master = allItems[itemId] || {};
                    const dName = item.displayName || master.displayName || itemId;
                    if (dName.toLowerCase().includes(query) || itemId.toLowerCase().includes(query)) {
                        results.push({ id: itemId, type: 'item', ...item, displayName: dName });
                    }
                }
                // Subcategories
                for (const subName in cat.subCategories) {
                    const sub = cat.subCategories[subName];
                    for (const itemId in sub.items) {
                        const item = sub.items[itemId];
                        const master = allItems[itemId] || {};
                        const dName = item.displayName || master.displayName || itemId;
                        if (dName.toLowerCase().includes(query) || itemId.toLowerCase().includes(query)) {
                            results.push({ id: itemId, type: 'item', ...item, displayName: dName });
                        }
                    }
                }
            }

            const paginated = getPaginatedItems(results, (context.page as number) || 1);
            paginated.forEach((entry) => {
                const masterItem = allItems[entry.id] || {};
                const buy = (entry.buyPrice ?? 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice!)}` : '';
                const sell = (entry.sellPrice ?? 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice!)}` : '';
                const priceString = [buy, sell].filter(Boolean).join(' ');
                items.push({
                    id: entry.id,
                    text: `${entry.displayName}\n${priceString}`,
                    icon: entry.icon || masterItem.icon,
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'buyOrSell'
                });
            });
            addPaginationItems(items, (context.page as number) || 1, results.length);
            return items;
        }

        if (panelId.startsWith('shopCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            addBackButton(items, 'shopMainPanel');
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
                addPaginationItems(items, (context.page as number) || 1, allEntries.length);
            }
            return items;
        }

        if (panelId.startsWith('shopItemListPanel_')) {
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string;
            addBackButton(items, `shopCategoryPanel_${categoryName}`);
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
                addPaginationItems(items, (context.page as number) || 1, shopItems.length);
            }
            return items;
        }

        // --- Admin Shop Panels ---

        if (panelId === 'shopManagementPanel') {
            addBackButton(items, 'configCategoryPanel');
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
                actionType: 'openPanel', // Changed from functionCall
                actionValue: 'addCategoryPanel' // Updated
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
            addPaginationItems(items, (context.page as number) || 1, categories.length);
            return items;
        }

        if (panelId.startsWith('shopAdminCategoryPanel_')) {
            const categoryName = context.categoryName as string;
            addBackButton(items, 'shopManagementPanel');
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
                actionType: 'openPanel', // Changed from functionCall
                actionValue: 'addSubCategoryPanel' // Updated
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
                addPaginationItems(items, (context.page as number) || 1, allEntries.length);
            }
            return items;
        }

        if (panelId.startsWith('shopAdminSubCategoryItemPanel_')) {
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string;
            addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
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
                actionType: 'openPanel', // Changed to openPanel
                actionValue: 'addCustomItemPanel'
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
                    actionType: 'openPanel', // Changed to openPanel
                    actionValue: 'addItemFromListPanel'
                });
            });
            addPaginationItems(items, (context.page as number) || 1, allPossibleItems.length);
            return items;
        }

        if (panelId.startsWith('shopAdminCategoryActionPanel_')) {
            const categoryName = panelId.replace('shopAdminCategoryActionPanel_', '');
            addBackButton(items, `shopAdminCategoryPanel_${categoryName}`);
            items.push({
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 0,
                actionType: 'openPanel', // Changed
                actionValue: 'editCategoryPanel'
            });
            items.push({
                id: 'delete',
                text: '§4Delete',
                icon: 'textures/ui/trash',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'deleteCategory'
            });
            return items;
        }

        if (panelId.startsWith('shopAdminSubCategoryActionPanel_')) {
            const subCategoryName = panelId.replace('shopAdminSubCategoryActionPanel_', '');
            addBackButton(items, `shopAdminSubCategoryItemPanel_${subCategoryName}`);
            items.push({
                id: 'edit',
                text: 'Edit',
                icon: 'textures/ui/icon_setting',
                permissionLevel: 0,
                actionType: 'openPanel', // Changed
                actionValue: 'editSubCategoryPanel'
            });
            items.push({
                id: 'delete',
                text: '§4Delete',
                icon: 'textures/ui/trash',
                permissionLevel: 0,
                actionType: 'functionCall',
                actionValue: 'deleteSubCategory'
            });
            return items;
        }

        return [];
    }

    async buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | null> {
        if (panelId === 'shopSearchPanel') {
            return new ModalFormData().title('Search Shop').textField('Item Name/ID', 'e.g. diamond');
        }

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
            // Fallback for direct link
            if (!targetName && (context.id as string).startsWith('shopAdminCategoryActionPanel_')) {
                targetName = (context.id as string).replace('shopAdminCategoryActionPanel_', '');
            }

            const shopConfig = getShopConfig();
            const category = shopConfig.categories[targetName];
            return new ModalFormData()
                .title('Edit Category')
                .textField('Category Name', 'Enter new name', { defaultValue: targetName })
                .textField('Icon', 'Enter icon texture path', { defaultValue: category.icon });
        }

        if (panelId === 'editSubCategoryPanel') {
            const targetName = (context.id as string).replace('shopAdminSubCategoryActionPanel_', '');
            const { categoryName } = context;
            const shopConfig = getShopConfig();
            const subCategory = shopConfig.categories[categoryName as string].subCategories[targetName];
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
            await ensureItemsConfig();
            const masterItem = allItems[itemId];
            if (!masterItem) return null;
            return new ModalFormData()
                .title(`Add ${String(masterItem.displayName ?? itemId)}`)
                .textField('Icon Path', 'e.g., textures/items/diamond_sword', {
                    defaultValue: String(masterItem.icon ?? '')
                })
                .textField('Buy Price', '-1 to disable', { defaultValue: String(masterItem.buyPrice ?? -1) })
                .textField('Sell Price', '-1 to disable', { defaultValue: String(masterItem.sellPrice ?? -1) })
                .textField('Permission Level', 'e.g., 1024', { defaultValue: '1024' });
        }

        if (panelId === 'editItemPanel') {
            // Note: editItem is weird because it used ActionFormData first, then ModalFormData.
            // The architecture primarily supports ModalFormData via buildModal.
            // Complex flows might still need handling in handleResponse for ActionFormData parts,
            // or we split it into two panels: 'editItemActionPanel' and 'editItemFormPanel'.
            // For now, I'll keep the ActionFormData part in handleResponse and only move the Modal part if I can.
            // Actually, the original code had an ActionFormData "Edit" vs "Delete".
            // If the user clicked "Edit", it showed a Modal.
            // We can make "editItem" open 'editItemActionPanel', which has "Edit" and "Delete" buttons.
            // "Edit" opens 'editItemFormPanel'.
        }

        if (panelId === 'editItemFormPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;
            const shopConfig = getShopConfig();
            let shopItem;
            if (subCategoryName)
                shopItem = shopConfig.categories[categoryName].subCategories[subCategoryName].items[itemId];
            else shopItem = shopConfig.categories[categoryName].items[itemId];

            await ensureItemsConfig();
            const masterItem = allItems[itemId] || {};

            return new ModalFormData()
                .title(`Edit Item: ${String(itemId)}`)
                .textField('Display Name', 'Name', {
                    defaultValue: String(shopItem.displayName || masterItem.displayName || '')
                })
                .textField('Minecraft ID', 'ID', {
                    defaultValue: String(shopItem.itemId || masterItem.itemId || '')
                })
                .textField('Icon', 'Icon', { defaultValue: String(shopItem.icon || masterItem.icon || '') })
                .textField('Buy Price', 'Price', { defaultValue: String(shopItem.buyPrice ?? -1) })
                .textField('Sell Price', 'Price', { defaultValue: String(shopItem.sellPrice ?? -1) })
                .textField('Permission', 'Level', { defaultValue: String(shopItem.permissionLevel ?? 1024) });
        }

        if (panelId === 'buyOrSellPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;
            const shopConfig = getShopConfig();
            await ensureItemsConfig();
            const masterItem = allItems[itemId];

            let shopItem;
            if (subCategoryName) {
                shopItem = shopConfig.categories[categoryName].subCategories[subCategoryName].items[itemId];
            } else {
                shopItem = shopConfig.categories[categoryName].items[itemId];
            }

            if (!shopItem) return null;

            const canBuy = context.view !== 'sell' && (shopItem.buyPrice ?? 0) > 0;
            const canSell = context.view !== 'buy' && (shopItem.sellPrice ?? 0) > 0;

            const modal = new ModalFormData().title(masterItem?.displayName ?? itemId);

            if (canBuy && canSell) {
                modal.textField('Amount', 'Enter the amount', { defaultValue: '1' });
                const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                modal.dropdown('Action', options, { defaultValueIndex: 0 });
                modal.toggle('Process All (Max)', { defaultValue: false });
            } else if (canBuy) {
                modal.textField(`Amount to Buy (Price: $${shopItem.buyPrice})`, 'Enter a numeric value', {
                    defaultValue: '1'
                });
                modal.toggle('Buy Max Affordable', { defaultValue: false });
            } else {
                modal.textField(`Amount to Sell (Price: $${shopItem.sellPrice})`, 'Enter a numeric value', {
                    defaultValue: '1'
                });
                modal.toggle('Sell All', { defaultValue: false });
            }
            return modal;
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
        const formValues = (response as ModalFormResponse).formValues;

        if (panelId === 'shopSearchPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'shopMainPanel', context);
            const [query] = formValues as [string];
            if (query && query.length > 0) {
                return showPanel(player, 'shopSearchResultsPanel', { ...context, searchQuery: query, page: 1 });
            }
            return showPanel(player, 'shopMainPanel', context);
        }

        if (panelId === 'addCategoryPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'shopManagementPanel', context);
            const values = formValues as string[];
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
            const values = formValues as string[];
            const [name, iconStr] = values;
            if (name) {
                const result = shopAdminManager.addSubCategory(categoryName, name, iconStr || '');
                player.sendMessage(result.message);
            }
            return showPanel(player, `shopAdminCategoryPanel_${categoryName}`, { ...context, page: 1 });
        }

        if (panelId === 'editCategoryPanel') {
            let targetName = context.categoryName as string;
            // Fallback for direct link
            if (!targetName && (context.id as string).startsWith('shopAdminCategoryActionPanel_')) {
                targetName = (context.id as string).replace('shopAdminCategoryActionPanel_', '');
            }
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAdminCategoryActionPanel_${targetName}`, context);

            const values = formValues as string[];
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

            const values = formValues as string[];
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

            const values = formValues as string[];
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

        if (panelId === 'addItemFromListPanel') {
            const categoryName = context.categoryName as string;
            if ((response as ModalFormResponse).canceled)
                return showPanel(player, `shopAddItemPanel_${categoryName}`, context);

            const itemId = context.selectedItemId as string;
            await ensureItemsConfig();
            const masterItem = allItems[itemId];
            const values = formValues as string[];
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

        if (panelId === 'editItemFormPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;

            const parent = subCategoryName
                ? `shopAdminSubCategoryItemPanel_${subCategoryName}`
                : `shopAdminCategoryPanel_${categoryName}`;

            if ((response as ModalFormResponse).canceled) return showPanel(player, parent, context);

            const vals = formValues as string[];
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
            return showPanel(player, parent, context);
        }

        if (panelId === 'buyOrSellPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;

            const parent = subCategoryName
                ? `shopItemListPanel_${categoryName}_${subCategoryName}`
                : `shopCategoryPanel_${categoryName}`;

            if ((response as ModalFormResponse).canceled) return showPanel(player, parent, context);

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
            const hasDropdown = canBuy && canSell;

            let amount;
            let action: 'buy' | 'sell';
            let useMax = false;

            if (hasDropdown) {
                const values = formValues as [string, number, boolean];
                const amountStr = values[0];
                const actionIndex = values[1];
                useMax = values[2];
                amount = parseCurrency(amountStr);
                const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                const selectedActionString = options[actionIndex];
                action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
            } else {
                const values = formValues as [string, boolean];
                const amountStr = values[0];
                useMax = values[1];
                amount = parseCurrency(amountStr);
                if (canBuy) action = 'buy';
                else action = 'sell';
            }

            if (useMax) {
                amount = -1;
            } else if (isNaN(amount) || amount <= 0) {
                player.sendMessage('§4Invalid amount.');
                return showPanel(player, parent, context);
            }

            let result;
            if (action === 'buy') {
                result = shopManager.buyItem(player, itemId, amount);
            } else {
                result = shopManager.sellItem(player, itemId, amount);
            }
            player.sendMessage(result.message);
            return showPanel(player, parent, context);
        }

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
                    // New flow: Open 'editItemActionPanel' or directly handle the ActionForm here if we want to stay consistent with buildPanelForm?
                    // The buildPanelForm logic delegates to getItems for ActionForms.
                    // But here we need a dynamic small menu (Edit/Delete).
                    // We can create a dynamic panel ID 'editItemActionPanel' and handle it in getItems if we want to be pure.
                    // But for a simple 2-option menu, we can also use 'openPanel' if we define it in getItems.
                    // Or we can just use the handleUIAction trick or stick to the previous implementation but routed correctly.

                    // Let's stick to the previous implementation but cleaner:
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
                            (context.subCategoryName as string) || null,
                            item.id
                        );
                        player.sendMessage('§2Item removed.');
                        return showPanel(player, panelId, context);
                    }
                }

                if (item.actionValue === 'buyOrSell') {
                    return showPanel(player, 'buyOrSellPanel', {
                        ...context,
                        selectedItemId: item.id
                    });
                }
            }
        }
    }
}
