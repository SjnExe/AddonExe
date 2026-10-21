import { getShopConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { formatCurrency } from '@core/utils/index.js';
import { buyItem, executeSellAllInventory, getPlayerInventoryShopItemCount, getPlayerShopItemPrice, previewSellAllInventory, sellItem } from '@features/economy/shop/manager.js';
import { ensureItemsConfig } from '@features/economy/shop/utils.js';
import { formatShopPriceSubtitle, formatTwoLineButton, resolveTradeItemIcon, resolveTradeItemMetadata } from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

interface ShopItemInfo {
    itemId?: string;
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

export async function showShopMainPanel(player: mc.Player): Promise<void> {
    await ensureItemsConfig();
    const pData = getOrCreatePlayer(player);
    const form = new ActionFormBuilder()
        .grid(3)
        .title('Server Shop')
        .body(`§7Your Balance: §a${formatCurrency(pData.balance)}\n§7Select a category or search for an item:`)
        .button(formatTwoLineButton('§l§6Search Shop', 'Find items by name'), 'textures/ui/magnifyingGlass', () => {
            void showShopSearchPanel(player);
        })
        .button(formatTwoLineButton('§l§aSell All', 'Bulk sell inventory'), 'textures/ui/icon_recipe_equipment', async () => {
            const preview = previewSellAllInventory(player);
            if (preview.totalItems === 0) {
                player.sendMessage('§cYou have no sellable shop items in your inventory.');
                await showShopMainPanel(player);
                return;
            }
            await showConfirmationDialog(player, {
                title: 'Confirm Sell All',
                body: `Sell §e${preview.totalItems}§f items (§b${preview.distinctTypes}§f types) for §a${formatCurrency(preview.totalPayout)}§f?`,
                confirmButtonText: `§2Sell All (${formatCurrency(preview.totalPayout)})`,
                cancelButtonText: '§cCancel',
                onConfirm: async () => {
                    const res = executeSellAllInventory(player);
                    player.sendMessage(res.message);
                    await showShopMainPanel(player);
                },
                onCancel: async () => {
                    await showShopMainPanel(player);
                }
            });
        });

    const shopConfig = getShopConfig();
    const validCategories = Object.keys(shopConfig.categories)
        .filter((categoryName: string) => {
            const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
            if (!isDefined(category)) {
                return false;
            }
            return Object.keys(category.items).length > 0 || (category.subCategories && Object.keys(category.subCategories).length > 0);
        })
        .toSorted((a, b) => a.localeCompare(b));

    for (const catName of validCategories) {
        const cat = shopConfig.categories[catName] as ShopCategory | undefined;
        if (!isDefined(cat)) {
            continue;
        }
        const subCount = isDefined(cat.subCategories) ? Object.keys(cat.subCategories).length : 0;
        const itemCount = Object.keys(cat.items ?? {}).length;
        const subtitle = subCount > 0 ? `${subCount} group${subCount === 1 ? '' : 's'}${itemCount > 0 ? ` • ${itemCount} items` : ''}` : `${itemCount} item${itemCount === 1 ? '' : 's'}`;
        const icon = resolveTradeItemIcon(catName, cat.icon);

        form.button(formatTwoLineButton(`§l§f${catName}`, subtitle), icon, () => {
            void showShopCategoryPanel(player, catName, 1);
        });
    }

    form.addBackButton(async () => {
        const { showEconomyHub } = await import('@core/ui/panels/mainPanel.js');
        await showEconomyHub(player);
    });

    await form.show(player);
}

export async function showShopCategoryPanel(player: mc.Player, categoryName: string, page: number = 1): Promise<void> {
    await ensureItemsConfig();
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;

    if (!category) {
        player.sendMessage('§cCategory not found.');
        void showShopMainPanel(player);
        return;
    }

    const pData = getOrCreatePlayer(player);
    const form = new ActionFormBuilder()
        .grid(3)
        .title(categoryName)
        .body(`§7Balance: §a${formatCurrency(pData.balance)}`);

    const entries: { type: 'subCategory' | 'item'; id: string; name: string; subtitle: string; icon: string; itemData?: ShopItemInfo }[] = [];

    if (category.subCategories) {
        for (const [subId, subData] of Object.entries(category.subCategories)) {
            if (!isDefined(subData)) {
                continue;
            }
            const subItemKeys = Object.keys(subData.items ?? {});
            const icon = resolveTradeItemIcon(subItemKeys[0] ?? subId, subData.icon);
            entries.push({
                type: 'subCategory',
                id: subId,
                name: subId,
                subtitle: `§6Folder • §7${subItemKeys.length} items`,
                icon
            });
        }
    }

    for (const [itemId, itemData] of Object.entries(category.items ?? {})) {
        if (!isDefined(itemData) || typeof itemData.buyPrice !== 'number') {
            continue;
        }
        if (isNonEmptyString(itemData.permission) && !hasPermission(player, itemData.permission)) {
            continue;
        }
        const meta = resolveTradeItemMetadata(itemId, itemData);
        const buyP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'buy');
        const sellP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'sell');
        entries.push({
            type: 'item',
            id: itemId,
            name: meta.displayName,
            subtitle: formatShopPriceSubtitle(buyP, sellP),
            icon: meta.icon,
            itemData: { ...itemData, itemId: meta.itemId, displayName: meta.displayName, icon: meta.icon }
        });
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            if (entry.type === 'subCategory') {
                formBuilder.button(formatTwoLineButton(`§l§6${entry.name}`, entry.subtitle), entry.icon, () => {
                    void showShopItemListPanel(player, categoryName, entry.id, 1);
                });
            } else if (isDefined(entry.itemData)) {
                const targetItem = entry.itemData;
                formBuilder.button(formatTwoLineButton(`§l§f${entry.name}`, entry.subtitle), entry.icon, () => {
                    void showBuyOrSellPanel(player, entry.id, targetItem, { returnTo: 'category', categoryName, page });
                });
            }
        },
        (newPage) => {
            void showShopCategoryPanel(player, categoryName, newPage);
        }
    );

    form.addBackButton(() => {
        void showShopMainPanel(player);
    });

    await form.show(player);
}

export async function showShopItemListPanel(player: mc.Player, categoryName: string, subCategoryName: string, page: number = 1): Promise<void> {
    await ensureItemsConfig();
    const shopConfig = getShopConfig();
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
    const subCat = category?.subCategories?.[subCategoryName];
    if (!subCat) {
        player.sendMessage('§cSub-category not found.');
        void showShopCategoryPanel(player, categoryName, 1);
        return;
    }

    const pData = getOrCreatePlayer(player);
    const form = new ActionFormBuilder()
        .grid(3)
        .title(`${categoryName} > ${subCategoryName}`)
        .body(`§7Balance: §a${formatCurrency(pData.balance)}`);

    const entries: { id: string; name: string; subtitle: string; icon: string; itemData: ShopItemInfo }[] = [];
    for (const [itemId, itemData] of Object.entries(subCat.items ?? {})) {
        if (!isDefined(itemData)) {
            continue;
        }
        if (isNonEmptyString(itemData.permission) && !hasPermission(player, itemData.permission)) {
            continue;
        }
        const meta = resolveTradeItemMetadata(itemId, itemData);
        const buyP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'buy');
        const sellP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'sell');
        entries.push({
            id: itemId,
            name: meta.displayName,
            subtitle: formatShopPriceSubtitle(buyP, sellP),
            icon: meta.icon,
            itemData: { ...itemData, itemId: meta.itemId, displayName: meta.displayName, icon: meta.icon }
        });
    }

    form.addPaginatedButtons(
        entries,
        page,
        (entry, formBuilder) => {
            formBuilder.button(formatTwoLineButton(`§l§f${entry.name}`, entry.subtitle), entry.icon, () => {
                void showBuyOrSellPanel(player, entry.id, entry.itemData, { returnTo: 'subCategory', categoryName, subCategoryName, page });
            });
        },
        (newPage) => {
            void showShopItemListPanel(player, categoryName, subCategoryName, newPage);
        }
    );

    form.addBackButton(() => {
        void showShopCategoryPanel(player, categoryName, 1);
    });

    await form.show(player);
}

export async function showShopSearchPanel(player: mc.Player): Promise<void> {
    const modal = new CustomFormBuilder<{ query: string }>('Search Shop').textField('query', 'Item Name', 'e.g., Diamond Sword, Stone Stairs', '').submitButton('Search');
    const res = await modal.show(player);
    if (!res) {
        void showShopMainPanel(player);
        return;
    }
    if (isNonEmptyString(res.query.trim())) {
        void showShopSearchResultsPanel(player, res.query.trim(), 1);
    } else {
        void showShopMainPanel(player);
    }
}

export async function showShopSearchResultsPanel(player: mc.Player, query: string, page: number = 1): Promise<void> {
    await ensureItemsConfig();
    const shopConfig = getShopConfig();
    const results: { id: string; name: string; subtitle: string; icon: string; itemData: ShopItemInfo }[] = [];
    const lowerQuery = query.toLowerCase();
    const catMap = shopConfig.categories as Record<string, ShopCategory>;

    const collectFromMap = (itemMap: Record<string, ShopItemInfo>) => {
        for (const [itemId, itemData] of Object.entries(itemMap ?? {})) {
            if (!isDefined(itemData) || typeof itemData.buyPrice !== 'number') {
                continue;
            }
            if (isNonEmptyString(itemData.permission) && !hasPermission(player, itemData.permission)) {
                continue;
            }
            const meta = resolveTradeItemMetadata(itemId, itemData);
            if (meta.displayName.toLowerCase().includes(lowerQuery) || itemId.toLowerCase().includes(lowerQuery) || meta.itemId.toLowerCase().includes(lowerQuery)) {
                const buyP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'buy');
                const sellP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'sell');
                results.push({
                    id: itemId,
                    name: meta.displayName,
                    subtitle: formatShopPriceSubtitle(buyP, sellP),
                    icon: meta.icon,
                    itemData: { ...itemData, itemId: meta.itemId, displayName: meta.displayName, icon: meta.icon }
                });
            }
        }
    };

    for (const cat of Object.values(catMap)) {
        if (!isDefined(cat)) {
            continue;
        }
        collectFromMap(cat.items);
        if (cat.subCategories) {
            for (const subCat of Object.values(cat.subCategories)) {
                if (isDefined(subCat)) {
                    collectFromMap(subCat.items);
                }
            }
        }
    }

    const form = new ActionFormBuilder().grid(3).title(`Search: "${query}"`);
    if (results.length === 0) {
        form.body('No items found matching your search.');
    }

    form.addPaginatedButtons(
        results,
        page,
        (entry, formBuilder) => {
            formBuilder.button(formatTwoLineButton(`§l§f${entry.name}`, entry.subtitle), entry.icon, () => {
                void showBuyOrSellPanel(player, entry.id, entry.itemData, { returnTo: 'search', query, page });
            });
        },
        (newPage) => {
            void showShopSearchResultsPanel(player, query, newPage);
        }
    );

    form.addBackButton(() => {
        void showShopMainPanel(player);
    });

    await form.show(player);
}

export interface ReturnContext {
    returnTo: 'category' | 'subCategory' | 'search' | 'main';
    categoryName?: string;
    subCategoryName?: string;
    query?: string;
    page: number;
}

export async function showBuyOrSellPanel(player: mc.Player, itemKey: string, itemData: unknown, returnCtx: ReturnContext): Promise<void> {
    const typedItemData = (itemData ?? {}) as ShopItemInfo;
    const meta = resolveTradeItemMetadata(itemKey, typedItemData);
    const resolvedInfo = { ...typedItemData, itemId: meta.itemId, displayName: meta.displayName, icon: meta.icon };
    const buyPrice = getPlayerShopItemPrice(player, resolvedInfo, 'buy');
    const sellPrice = getPlayerShopItemPrice(player, resolvedInfo, 'sell');
    const pData = getOrCreatePlayer(player);
    const ownedCount = getPlayerInventoryShopItemCount(player, itemKey);

    const bodyLines = [
        `§7Item: §b${meta.displayName}`,
        `§7Your Balance: §a${formatCurrency(pData.balance)} §8| §7In Inventory: §ex${ownedCount}`,
        `§7Unit Price: ${formatShopPriceSubtitle(buyPrice, sellPrice)}`
    ];

    const form = new ActionFormBuilder().grid(2).title(`Trade: ${meta.displayName}`).body(bodyLines.join('\n'));

    if (buyPrice > 0) {
        form.button(formatTwoLineButton('§2Buy 1', formatCurrency(buyPrice)), meta.icon, () => {
            player.sendMessage(buyItem(player, itemKey, 1).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
        form.button(formatTwoLineButton('§2Buy 16', formatCurrency(buyPrice * 16)), meta.icon, () => {
            player.sendMessage(buyItem(player, itemKey, 16).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
        form.button(formatTwoLineButton('§2Buy 64', formatCurrency(buyPrice * 64)), meta.icon, () => {
            player.sendMessage(buyItem(player, itemKey, 64).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
        form.button(formatTwoLineButton('§2Buy Max', 'Max affordable'), 'textures/ui/color_plus', () => {
            player.sendMessage(buyItem(player, itemKey, -1).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
    }

    if (sellPrice > 0) {
        form.button(formatTwoLineButton('§cSell 1', formatCurrency(sellPrice)), 'textures/ui/minus', () => {
            player.sendMessage(sellItem(player, itemKey, 1).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
        form.button(formatTwoLineButton('§cSell 16', formatCurrency(sellPrice * 16)), 'textures/ui/minus', () => {
            player.sendMessage(sellItem(player, itemKey, 16).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
        form.button(formatTwoLineButton('§cSell 64', formatCurrency(sellPrice * 64)), 'textures/ui/minus', () => {
            player.sendMessage(sellItem(player, itemKey, 64).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
        form.button(formatTwoLineButton(`§6Sell All (x${ownedCount})`, formatCurrency(sellPrice * Math.max(0, ownedCount))), 'textures/ui/icon_recipe_equipment', () => {
            player.sendMessage(sellItem(player, itemKey, -1).message);
            void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
    }

    if (buyPrice > 0 || sellPrice > 0) {
        form.button(formatTwoLineButton('§bCustom Amount', 'Enter exact qty'), 'textures/ui/book_edit_default', async () => {
            const modes: string[] = [];
            if (buyPrice > 0) {
                modes.push('Buy');
            }
            if (sellPrice > 0) {
                modes.push('Sell');
            }
            const modal = new CustomFormBuilder<{ mode: string; qty: string }>(`Custom Trade: ${meta.displayName}`)
                .dropdown('mode', 'Transaction Type', modes, 0)
                .textField('qty', 'Quantity', 'e.g. 32', '16')
                .submitButton('Confirm Trade');
            const res = await modal.show(player);
            if (res) {
                const parsedQty = Number.parseInt(res.qty, 10);
                if (!Number.isNaN(parsedQty) && parsedQty > 0) {
                    const out = res.mode === 'Sell' ? sellItem(player, itemKey, parsedQty) : buyItem(player, itemKey, parsedQty);
                    player.sendMessage(out.message);
                } else {
                    player.sendMessage('§cInvalid quantity.');
                }
            }
            await showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
        });
    }

    form.addBackButton(() => {
        if (returnCtx.returnTo === 'category' && returnCtx.categoryName) {
            void showShopCategoryPanel(player, returnCtx.categoryName, returnCtx.page);
        } else if (returnCtx.returnTo === 'subCategory' && returnCtx.categoryName && returnCtx.subCategoryName) {
            void showShopItemListPanel(player, returnCtx.categoryName, returnCtx.subCategoryName, returnCtx.page);
        } else if (returnCtx.returnTo === 'search' && returnCtx.query) {
            void showShopSearchResultsPanel(player, returnCtx.query, returnCtx.page);
        } else {
            void showShopMainPanel(player);
        }
    });

    await form.show(player);
}
