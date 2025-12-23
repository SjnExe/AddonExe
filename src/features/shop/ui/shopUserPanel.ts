import * as mc from '@minecraft/server';
import { ActionFormResponse, ModalFormData, ModalFormResponse } from '@minecraft/server-ui';

import { getShopConfig } from '@core/configurations.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency, parseCurrency } from '@core/utils.js';
import { IPanelHandler, PanelItem, UIContext } from '@ui/types.js';
import { addBackButton, addPaginationItems, getPaginatedItems } from '@ui/uiUtils.js';
import * as shopManager from '../shopManager.js';
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

export class ShopUserPanelHandler implements IPanelHandler {
    canHandle(panelId: string): boolean {
        return (
            panelId === 'shopMainPanel' ||
            panelId === 'shopSearchResultsPanel' ||
            panelId.startsWith('shopCategoryPanel_') ||
            panelId.startsWith('shopItemListPanel_') ||
            panelId === 'buyOrSellPanel'
        );
    }

    async getTitle(_player: mc.Player, panelId: string, context: UIContext): Promise<string | undefined> {
        if (panelId.startsWith('shopCategoryPanel_')) {
            return context.categoryName as string;
        }
        if (panelId.startsWith('shopItemListPanel_')) {
            return context.subCategoryName as string;
        }
        return undefined;
    }

    async getItems(_player: mc.Player, panelId: string, context: UIContext): Promise<PanelItem[]> {
        await ensureItemsConfig();
        const allItems = getAllItems();
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
                .toSorted();

            for (const catName of validCategories) {
                const cat = shopConfig.categories[catName];
                if (!cat) continue;
                items.push({
                    id: catName,
                    text: catName,
                    icon: cat.icon,
                    permissionLevel: 1024,
                    actionType: 'openPanel',
                    actionValue: `shopCategoryPanel_${catName}`
                });
            }
            return items;
        }

        if (panelId === 'shopSearchResultsPanel') {
            addBackButton(items, 'shopMainPanel');
            const query = ((context.searchQuery as string) || '').toLowerCase();
            const shopConfig = getShopConfig();
            const results: ShopItemEntry[] = [];

            for (const catName in shopConfig.categories) {
                const cat = shopConfig.categories[catName];
                if (!cat) continue;
                // Items
                for (const itemId in cat.items) {
                    const item = cat.items[itemId];
                    if (!item) continue;
                    const master = allItems[itemId] || {};
                    const dName = item.displayName || master.displayName || itemId;
                    if (dName.toLowerCase().includes(query) || itemId.toLowerCase().includes(query)) {
                        results.push({
                            id: itemId,
                            type: 'item',
                            ...(item.icon ? { icon: item.icon } : {}),
                            displayName: dName,
                            buyPrice: item.buyPrice,
                            sellPrice: item.sellPrice,
                            permissionLevel: item.permissionLevel
                        });
                    }
                }
                // Subcategories
                for (const subName in cat.subCategories) {
                    const sub = cat.subCategories[subName];
                    if (!sub) continue;
                    for (const itemId in sub.items) {
                        const item = sub.items[itemId];
                        if (!item) continue;
                        const master = allItems[itemId] || {};
                        const dName = item.displayName || master.displayName || itemId;
                        if (dName.toLowerCase().includes(query) || itemId.toLowerCase().includes(query)) {
                            results.push({
                                id: itemId,
                                type: 'item',
                                ...(item.icon ? { icon: item.icon } : {}),
                                displayName: dName,
                                buyPrice: item.buyPrice,
                                sellPrice: item.sellPrice,
                                permissionLevel: item.permissionLevel
                            });
                        }
                    }
                }
            }

            const paginated = getPaginatedItems(results, (context.page as number) || 1);
            for (const entry of paginated) {
                if (!entry) continue;
                const buy = (entry.buyPrice ?? 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                const sell = (entry.sellPrice ?? 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                const priceString = [buy, sell].filter(Boolean).join(' ');
                items.push({
                    id: entry.id,
                    text: `${entry.displayName}\n${priceString}`,
                    icon: entry.icon || '',
                    permissionLevel: 1024,
                    actionType: 'functionCall',
                    actionValue: 'buyOrSell'
                });
            }
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
                    .toSorted()
                    .map((name) => {
                        const sub = category.subCategories[name];
                        if (!sub) return;
                        return {
                            id: name,
                            name,
                            icon: sub.icon,
                            type: 'subCategory' as const
                        };
                    })
                    .filter((x) => x !== undefined) as ShopCategoryEntry[];

                const shopItems: ShopEntry[] = Object.keys(category.items)
                    .map((id) => {
                        const item = category.items[id];
                        if (!item) return;
                        return {
                            id,
                            icon: item.icon,
                            buyPrice: item.buyPrice,
                            sellPrice: item.sellPrice,
                            displayName: item.displayName,
                            permissionLevel: item.permissionLevel,
                            type: 'item' as const
                        };
                    })
                    .filter((x) => x !== undefined) as ShopItemEntry[];

                const allEntries = [...subCategories, ...shopItems];
                const paginated = getPaginatedItems(allEntries, (context.page as number) || 1);

                for (const entry of paginated) {
                    if (!entry) continue;
                    if (entry.type === 'subCategory') {
                        items.push({
                            id: entry.name,
                            text: `§6${entry.name}`,
                            icon: entry.icon,
                            permissionLevel: 1024,
                            actionType: 'openPanel',
                            actionValue: `shopItemListPanel_${categoryName}_${entry.name}`
                        });
                    } else {
                        const buy = (entry.buyPrice ?? 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                        const sell = (entry.sellPrice ?? 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                        const priceString = [buy, sell].filter(Boolean).join(' ');
                        items.push({
                            id: entry.id,
                            text: `${entry.displayName}\n${priceString}`,
                            icon: entry.icon || '',
                            permissionLevel: 1024,
                            actionType: 'functionCall',
                            actionValue: 'buyOrSell'
                        });
                    }
                }
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
                const shopItems = Object.keys(subCategory.items)
                    .map((id) => {
                        const item = subCategory.items[id];
                        if (!item) return;
                        return {
                            id,
                            icon: item.icon,
                            buyPrice: item.buyPrice,
                            sellPrice: item.sellPrice,
                            displayName: item.displayName,
                            permissionLevel: item.permissionLevel,
                            type: 'item' as const
                        };
                    })
                    .filter((x) => x !== undefined) as ShopItemEntry[];

                const paginated = getPaginatedItems(shopItems, (context.page as number) || 1);
                for (const entry of paginated) {
                    if (!entry) continue;
                    const buy = (entry.buyPrice ?? 0) > 0 ? `§2B: ${formatCurrency(entry.buyPrice)}` : '';
                    const sell = (entry.sellPrice ?? 0) > 0 ? `§4S: ${formatCurrency(entry.sellPrice)}` : '';
                    const priceString = [buy, sell].filter(Boolean).join(' ');
                    items.push({
                        id: entry.id,
                        text: `${entry.displayName}\n${priceString}`,
                        icon: entry.icon || '',
                        permissionLevel: 1024,
                        actionType: 'functionCall',
                        actionValue: 'buyOrSell'
                    });
                }
                addPaginationItems(items, (context.page as number) || 1, shopItems.length);
            }
            return items;
        }

        return items;
    }

    async buildModal(_player: mc.Player, panelId: string, context: UIContext): Promise<ModalFormData | undefined> {
        await ensureItemsConfig();

        if (panelId === 'shopSearchPanel') {
            return new ModalFormData().title('Search Shop').textField('Item Name/ID', 'e.g. diamond');
        }

        if (panelId === 'buyOrSellPanel') {
            const itemId = context.selectedItemId as string;
            const categoryName = context.categoryName as string;
            const subCategoryName = context.subCategoryName as string | undefined;
            const shopConfig = getShopConfig();

            const shopItem = subCategoryName
                ? shopConfig.categories[categoryName]?.subCategories[subCategoryName]?.items[itemId]
                : shopConfig.categories[categoryName]?.items[itemId];

            if (!shopItem) return undefined;

            const canBuy = context.view !== 'sell' && (shopItem.buyPrice ?? 0) > 0;
            const canSell = context.view !== 'buy' && (shopItem.sellPrice ?? 0) > 0;

            const modal = new ModalFormData().title(shopItem.displayName || itemId);

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

        if (panelId === 'shopSearchPanel') {
            if ((response as ModalFormResponse).canceled) return showPanel(player, 'shopMainPanel', context);
            const values = formValues as string[] | undefined;
            if (!values) return showPanel(player, 'shopMainPanel', context);
            const [query] = values;
            if (query && query.length > 0) {
                return showPanel(player, 'shopSearchResultsPanel', { ...context, searchQuery: query, page: 1 });
            }
            return showPanel(player, 'shopMainPanel', context);
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

            const shopItem = subCategoryName
                ? shopConfig.categories[categoryName]?.subCategories[subCategoryName]?.items[itemId]
                : shopConfig.categories[categoryName]?.items[itemId];

            if (!shopItem) return;

            const canBuy = context.view !== 'sell' && (shopItem.buyPrice ?? 0) > 0;
            const canSell = context.view !== 'buy' && (shopItem.sellPrice ?? 0) > 0;
            const hasDropdown = canBuy && canSell;

            let amount;
            let action: 'buy' | 'sell';
            let useMax = false;

            if (hasDropdown) {
                const values = formValues as [string, number, boolean] | undefined;
                if (!values) return showPanel(player, parent, context);
                const amountStr = values[0];
                const actionIndex = values[1];
                useMax = values[2];
                amount = parseCurrency(amountStr);
                const options = [`Buy ($${shopItem.buyPrice})`, `Sell ($${shopItem.sellPrice})`];
                const selectedActionString = options[actionIndex];
                if (selectedActionString) {
                    action = selectedActionString.startsWith('Buy') ? 'buy' : 'sell';
                } else {
                    action = 'buy';
                }
            } else {
                const values = formValues as [string, boolean] | undefined;
                if (!values) return showPanel(player, parent, context);
                const amountStr = values[0];
                useMax = values[1];
                amount = parseCurrency(amountStr);
                action = canBuy ? 'buy' : 'sell';
            }

            if (useMax) {
                amount = -1;
            } else if (Number.isNaN(amount) || amount <= 0) {
                player.sendMessage('§4Invalid amount.');
                return showPanel(player, parent, context);
            }

            const result =
                action === 'buy'
                    ? shopManager.buyItem(player, itemId, amount)
                    : shopManager.sellItem(player, itemId, amount);
            player.sendMessage(result.message);
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
