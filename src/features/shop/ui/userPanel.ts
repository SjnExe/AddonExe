import { getShopConfig } from '@core/configurations.js';
import { hasPermission } from '@core/permissionEngine.js';
import { showPanel } from '@core/uiManager.js';
import { formatCurrency } from '@core/utils.js';
import { buyItem, getPlayerShopItemPrice, sellItem } from '@features/shop/manager.js';
import { ensureItemsConfig } from '@features/shop/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/ActionFormBuilder.js';
import { ModalFormBuilder } from '@ui/builders/ModalFormBuilder.js';
('@core/playerDataManager.js');

export async function showShopMainPanel(player: mc.Player): Promise<void> {
    await ensureItemsConfig();
    const form = new ActionFormBuilder().title('Shop').button('§l§6Search Item', 'textures/ui/magnifyingGlass', async () => {
        await showShopSearchPanel(player);
    });

    const shopConfig = getShopConfig();
    const validCategories = Object.keys(shopConfig.categories)
        .filter((categoryName: string) => {
            const category = shopConfig.categories[categoryName];
            if (!isDefined(category)) return false;
            return Object.keys(category.items).length > 0 || Object.keys(category.subCategories).length > 0;
        })
        .toSorted((a, b) => a.localeCompare(b));

    for (const catName of validCategories) {
        const cat = shopConfig.categories[catName];
        if (!isDefined(cat)) continue;
        form.button(catName, cat.icon, async () => {
            await showShopCategoryPanel(player, catName, 1);
        });
    }

    form.addBackButton(async () => {
        await showPanel(player, 'mainPanel');
    });

    await form.show(player);
}

export async function showShopCategoryPanel(player: mc.Player, categoryName: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];

    if (!category) {
        player.sendMessage('§cCategory not found.');
        await showShopMainPanel(player);
        return;
    }

    const form = new ActionFormBuilder().title(categoryName);

    const entries: { type: 'subCategory' | 'item'; id: string; name: string; icon?: string; itemData?: any }[] = [];

    if (category.subCategories) {
        for (const [subId, subData] of Object.entries(category.subCategories)) {
            entries.push({ type: 'subCategory', id: subId, name: subId, icon: subData.icon });
        }
    }

    if (category.items) {
        for (const [itemId, itemData] of Object.entries(category.items)) {
            if (isNonEmptyString(itemData.permission) && !hasPermission(player, itemData.permission)) continue;
            entries.push({ type: 'item', id: itemId, name: itemData.displayName || itemId.replace('minecraft:', ''), icon: itemData.icon, itemData });
        }
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            if (entry.type === 'subCategory') {
                formBuilder.button(`§l${entry.name}`, entry.icon, async () => {
                    await showShopItemListPanel(player, categoryName, entry.id, 1);
                });
            } else {
                const itemData = entry.itemData!;
                const prices = { buyPrice: getPlayerShopItemPrice(player, itemData, 'buy'), sellPrice: getPlayerShopItemPrice(player, itemData, 'sell') };
                let displayPrice = '';
                if (prices.buyPrice > 0) displayPrice += `§2Buy: ${formatCurrency(prices.buyPrice)} `;
                if (prices.sellPrice > 0) displayPrice += `§4Sell: ${formatCurrency(prices.sellPrice)}`;
                if (displayPrice === '') displayPrice = '§cNot For Sale';

                formBuilder.button(`${entry.name}\n${displayPrice.trim()}`, entry.icon, async () => {
                    await showBuyOrSellPanel(player, entry.id, itemData, { returnTo: 'category', categoryName, page });
                });
            }
        },
        async (newPage) => {
            await showShopCategoryPanel(player, categoryName, newPage);
        }
    );

    form.addBackButton(async () => {
        await showShopMainPanel(player);
    });

    await form.show(player);
}

export async function showShopItemListPanel(player: mc.Player, categoryName: string, subCategoryName: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName];
    if (!category || !category.subCategories || !category.subCategories[subCategoryName]) {
        player.sendMessage('§cSub-category not found.');
        await showShopCategoryPanel(player, categoryName, 1);
        return;
    }

    const subCat = category.subCategories[subCategoryName];
    const form = new ActionFormBuilder().title(subCategoryName);

    const entries: { id: string; name: string; icon?: string; itemData: any }[] = [];
    if (subCat.items) {
        for (const [itemId, itemData] of Object.entries(subCat.items)) {
            if (isNonEmptyString(itemData.permission) && !hasPermission(player, itemData.permission)) continue;
            entries.push({ id: itemId, name: itemData.displayName || itemId.replace('minecraft:', ''), icon: itemData.icon, itemData });
        }
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            const itemData = entry.itemData;
            const prices = { buyPrice: getPlayerShopItemPrice(player, itemData, 'buy'), sellPrice: getPlayerShopItemPrice(player, itemData, 'sell') };
            let displayPrice = '';
            if (prices.buyPrice > 0) displayPrice += `§2Buy: ${formatCurrency(prices.buyPrice)} `;
            if (prices.sellPrice > 0) displayPrice += `§4Sell: ${formatCurrency(prices.sellPrice)}`;
            if (displayPrice === '') displayPrice = '§cNot For Sale';

            formBuilder.button(`${entry.name}\n${displayPrice.trim()}`, entry.icon, async () => {
                await showBuyOrSellPanel(player, entry.id, itemData, { returnTo: 'subCategory', categoryName, subCategoryName, page });
            });
        },
        async (newPage) => {
            await showShopItemListPanel(player, categoryName, subCategoryName, newPage);
        }
    );

    form.addBackButton(async () => {
        await showShopCategoryPanel(player, categoryName, 1);
    });

    await form.show(player);
}

export async function showShopSearchPanel(player: mc.Player): Promise<void> {
    const modal = new ModalFormBuilder<{ query: string }>().title('Search Shop').textField('query', 'Item Name', 'e.g., diamond');

    const res = await modal.show(player);
    if (!res) {
        await showShopMainPanel(player);
        return;
    }

    if (isNonEmptyString(res.query)) {
        await showShopSearchResultsPanel(player, res.query, 1);
    } else {
        await showShopMainPanel(player);
    }
}

export async function showShopSearchResultsPanel(player: mc.Player, query: string, page: number = 1): Promise<void> {
    const shopConfig = getShopConfig();
    const results: { id: string; name: string; icon?: string; itemData: any; path: { categoryName: string; subCategoryName?: string } }[] = [];

    const lowerQuery = query.toLowerCase();

    for (const [catName, cat] of Object.entries(shopConfig.categories)) {
        for (const [itemId, itemData] of Object.entries(cat.items)) {
            const displayName = itemData.displayName || itemId.replace('minecraft:', '');
            if (displayName.toLowerCase().includes(lowerQuery) || itemId.toLowerCase().includes(lowerQuery)) {
                if (!isNonEmptyString(itemData.permission) || hasPermission(player, itemData.permission)) {
                    results.push({ id: itemId, name: displayName, icon: itemData.icon, itemData, path: { categoryName: catName } });
                }
            }
        }

        if (cat.subCategories) {
            for (const [subCatName, subCat] of Object.entries(cat.subCategories)) {
                for (const [itemId, itemData] of Object.entries(subCat.items)) {
                    const displayName = itemData.displayName || itemId.replace('minecraft:', '');
                    if (displayName.toLowerCase().includes(lowerQuery) || itemId.toLowerCase().includes(lowerQuery)) {
                        if (!isNonEmptyString(itemData.permission) || hasPermission(player, itemData.permission)) {
                            results.push({ id: itemId, name: displayName, icon: itemData.icon, itemData, path: { categoryName: catName, subCategoryName: subCatName } });
                        }
                    }
                }
            }
        }
    }

    const form = new ActionFormBuilder().title(`Search: ${query}`);

    if (results.length === 0) {
        form.body('No items found matching your search.');
    }

    form.addPaginatedButtons(
        results,
        page,
        (entry, formBuilder) => {
            const itemData = entry.itemData;
            const prices = { buyPrice: getPlayerShopItemPrice(player, itemData, 'buy'), sellPrice: getPlayerShopItemPrice(player, itemData, 'sell') };
            let displayPrice = '';
            if (prices.buyPrice > 0) displayPrice += `§2Buy: ${formatCurrency(prices.buyPrice)} `;
            if (prices.sellPrice > 0) displayPrice += `§4Sell: ${formatCurrency(prices.sellPrice)}`;
            if (displayPrice === '') displayPrice = '§cNot For Sale';

            formBuilder.button(`${entry.name}\n${displayPrice.trim()}`, entry.icon, async () => {
                await showBuyOrSellPanel(player, entry.id, itemData, { returnTo: 'search', query, page });
            });
        },
        async (newPage) => {
            await showShopSearchResultsPanel(player, query, newPage);
        }
    );

    form.addBackButton(async () => {
        await showShopMainPanel(player);
    });

    await form.show(player);
}

interface ReturnContext {
    returnTo: 'category' | 'subCategory' | 'search';
    categoryName?: string;
    subCategoryName?: string;
    query?: string;
    page: number;
}

export async function showBuyOrSellPanel(player: mc.Player, itemKey: string, itemData: any, returnCtx: ReturnContext): Promise<void> {
    const prices = { buyPrice: getPlayerShopItemPrice(player, itemData, 'buy'), sellPrice: getPlayerShopItemPrice(player, itemData, 'sell') };
    const itemName = itemData.displayName || itemData.itemId || itemKey.replace('minecraft:', '');

    const form = new ActionFormBuilder().title(`Trade ${itemName}`);

    if (prices.buyPrice > 0) {
        form.button(`§2Buy 1 - ${formatCurrency(prices.buyPrice)}`, 'textures/ui/color_plus', async () => {
            const res = buyItem(player, itemKey, 1);
            player.sendMessage(res.message);
            await showBuyOrSellPanel(player, itemKey, itemData, returnCtx);
        });
        form.button(`§2Buy 64 - ${formatCurrency(prices.buyPrice * 64)}`, 'textures/ui/color_plus', async () => {
            const res = buyItem(player, itemKey, 64);
            player.sendMessage(res.message);
            await showBuyOrSellPanel(player, itemKey, itemData, returnCtx);
        });
    }

    if (prices.sellPrice > 0) {
        form.button(`§4Sell 1 - ${formatCurrency(prices.sellPrice)}`, 'textures/ui/minus', async () => {
            const res = sellItem(player, itemKey, 1);
            player.sendMessage(res.message);
            await showBuyOrSellPanel(player, itemKey, itemData, returnCtx);
        });
        form.button(`§4Sell 64 - ${formatCurrency(prices.sellPrice * 64)}`, 'textures/ui/minus', async () => {
            const res = sellItem(player, itemKey, 64);
            player.sendMessage(res.message);
            await showBuyOrSellPanel(player, itemKey, itemData, returnCtx);
        });
        form.button(`§6Sell All`, 'textures/ui/icon_recipe_equipment', async () => {
            const res = sellItem(player, itemKey, -1); // Manager handles -1 as sell all
            player.sendMessage(res.message);
            await showBuyOrSellPanel(player, itemKey, itemData, returnCtx);
        });
    }

    form.addBackButton(async () => {
        if (returnCtx.returnTo === 'category' && returnCtx.categoryName) {
            await showShopCategoryPanel(player, returnCtx.categoryName, returnCtx.page);
        } else if (returnCtx.returnTo === 'subCategory' && returnCtx.categoryName && returnCtx.subCategoryName) {
            await showShopItemListPanel(player, returnCtx.categoryName, returnCtx.subCategoryName, returnCtx.page);
        } else if (returnCtx.returnTo === 'search' && returnCtx.query) {
            await showShopSearchResultsPanel(player, returnCtx.query, returnCtx.page);
        } else {
            await showShopMainPanel(player);
        }
    });

    await form.show(player);
}
