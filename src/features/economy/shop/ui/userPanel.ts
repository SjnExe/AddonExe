import { getShopConfig } from '@core/config/configurations.js';
import { getOrCreatePlayer } from '@core/data/playerDataManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { formatCurrency } from '@core/utils/index.js';
import type { ShopCategory, ShopItemInfo } from '@features/economy/shop/config.js';
import {
  buyItem,
  executeSellAllInventory,
  getPlayerInventoryShopItemCount,
  getPlayerSellableInventoryItems,
  getPlayerShopItemPrice,
  getPlayerShopPerkSummary,
  getRemainingDailyShopQuota,
  getShopCatalogEntries,
  isUnstackableShopItem,
  previewSellAllInventory,
  sellItem,
} from '@features/economy/shop/manager.js';
import { ensureItemsConfig } from '@features/economy/shop/utils.js';
import {
  formatShopPriceSubtitle,
  formatTwoLineButton,
  resolveTradeItemIcon,
  resolveTradeItemMetadata,
} from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

/** View mode for shop panels (`shop`, `buy`, or `sell`). */
export type ShopViewMode = 'shop' | 'buy' | 'sell';

function formatRankPerkLine(player: mc.Player): string | undefined {
  const perks = getPlayerShopPerkSummary(player);
  const parts: string[] = [];
  if (perks.buyMultiplier < 1) {
    parts.push(`${Math.round((1 - perks.buyMultiplier) * 100)}% off buy`);
  }
  if (perks.sellMultiplier > 1) {
    parts.push(`+${Math.round((perks.sellMultiplier - 1) * 100)}% sell`);
  }
  if (perks.limitMultiplier > 1) {
    parts.push(`${perks.limitMultiplier}x daily limits`);
  }
  return parts.length > 0 ? `§dRank Perk: §f${parts.join(' §8• §f')}` : undefined;
}

async function promptSellAllFlow(player: mc.Player, onDone: () => Promise<void>): Promise<void> {
  if (!player.isValid) {
    return;
  }
  const preview = previewSellAllInventory(player);
  const confirmSellAll = async (quote: ReturnType<typeof previewSellAllInventory>): Promise<void> => {
    if (!player.isValid) {
      return;
    }
    if (quote.overflowed) {
      player.sendMessage('§cSale payout exceeds supported numeric limits.');
      await onDone();
      return;
    }
    if (quote.totalItems === 0) {
      player.sendMessage('§cYou have no sellable shop items in your inventory.');
      await onDone();
      return;
    }
    const topLines = quote.breakdown
      .slice(0, 6)
      .map((b) => `§7- §f${b.displayName} §ex${b.count} §7(§a${formatCurrency(b.payout)}§7)`)
      .join('\n');
    const extraLine = quote.breakdown.length > 6 ? `\n§8...and ${quote.breakdown.length - 6} more item types` : '';

    await showConfirmationDialog(player, {
      title: 'Confirm Sell All',
      body: `Sell §e${quote.totalItems}§f items (§b${quote.distinctTypes}§f types) for §a${formatCurrency(quote.totalPayout)}§f?\n\n${topLines}${extraLine}`,
      confirmButtonText: `§2Sell All (${formatCurrency(quote.totalPayout)})`,
      cancelButtonText: '§cCancel',
      onConfirm: async () => {
        if (!player.isValid) {
          return;
        }
        const res = executeSellAllInventory(player, {
          totalItems: quote.totalItems,
          totalPayout: quote.totalPayout,
          breakdown: quote.breakdown,
        });
        player.sendMessage(res.message);
        if (res.quoteChanged && res.updatedPreview) {
          await confirmSellAll(res.updatedPreview);
          return;
        }
        await onDone();
      },
      onCancel: async () => {
        if (!player.isValid) {
          return;
        }
        await onDone();
      },
    });
  };
  await confirmSellAll(preview);
}

/**
 * Displays the main server shop panel to a player.
 *
 * @param player Target player.
 * @param mode Optional view mode (`shop`, `buy`, or `sell`).
 */
export async function showShopMainPanel(player: mc.Player, mode: ShopViewMode = 'shop'): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }
  const pData = getOrCreatePlayer(player);
  const perkLine = formatRankPerkLine(player);
  const modeLabel = mode === 'buy' ? ' §8(Buy Mode)' : mode === 'sell' ? ' §8(Sell Mode)' : '';
  const bodyLines = [
    `§7Balance: §a${formatCurrency(pData.balance)}`,
    ...(perkLine ? [perkLine] : []),
    '§7Choose a category, search items, or sell from your inventory:',
  ];

  const form = new ActionFormBuilder()
    .grid(3)
    .title(`Server Shop${modeLabel}`)
    .body(bodyLines.join('\n'))
    .button(formatTwoLineButton('§l§6Search Shop', 'Find items by name'), 'textures/ui/magnifyingGlass', () => {
      void showShopSearchPanel(player, mode);
    })
    .button(formatTwoLineButton('§l§eSell Inventory', 'Browse your sellable items'), 'textures/ui/icon_deals', () => {
      void showShopSellInventoryPanel(player, 1, mode);
    })
    .button(formatTwoLineButton('§l§aSell All', 'Bulk sell inventory'), 'textures/ui/icon_recipe_equipment', () => {
      void promptSellAllFlow(player, () => showShopMainPanel(player, mode));
    });

  const shopConfig = getShopConfig();
  const validCategories = Object.keys(shopConfig.categories).filter((categoryName: string) => {
    const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
    if (!isDefined(category)) {
      return false;
    }
    return (
      Object.keys(category.items ?? {}).length > 0 ||
      (category.subCategories && Object.keys(category.subCategories).length > 0)
    );
  });

  for (const catName of validCategories) {
    const cat = shopConfig.categories[catName] as ShopCategory | undefined;
    if (!isDefined(cat)) {
      continue;
    }
    const subCount = isDefined(cat.subCategories) ? Object.keys(cat.subCategories).length : 0;
    const itemCount = Object.keys(cat.items ?? {}).length;
    const subtitle =
      subCount > 0
        ? `${subCount} group${subCount === 1 ? '' : 's'}${itemCount > 0 ? ` • ${itemCount} items` : ''}`
        : `${itemCount} item${itemCount === 1 ? '' : 's'}`;
    const icon = resolveTradeItemIcon(catName, cat.icon);

    form.button(formatTwoLineButton(`§l§f${catName}`, subtitle), icon, () => {
      void showShopCategoryPanel(player, catName, 1, mode);
    });
  }

  form.addBackButton(async () => {
    const { showEconomyHub } = await import('@core/ui/panels/mainPanel.js');
    await showEconomyHub(player);
  });

  await form.show(player);
}

/**
 * Displays all sellable shop items currently in the player's inventory.
 *
 * @param player Target player.
 * @param page Current page number.
 * @param mode View mode preserved for Back navigation.
 */
export async function showShopSellInventoryPanel(
  player: mc.Player,
  page: number = 1,
  mode: ShopViewMode = 'shop',
): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }

  const pData = getOrCreatePlayer(player);
  const sellableItems = getPlayerSellableInventoryItems(player);
  const totalValue =
    Math.round(sellableItems.reduce((acc, item) => acc + item.sellableCount * item.unitPrice, 0) * 100) / 100;

  const form = new ActionFormBuilder()
    .grid(2)
    .title('Sell From Inventory')
    .body(
      sellableItems.length > 0
        ? `§7Balance: §a${formatCurrency(pData.balance)} §8| §7Est. Value: §a${formatCurrency(totalValue)}\n§7Select an item to sell:`
        : `§7Balance: §a${formatCurrency(pData.balance)}\n§cYou have no sellable items in your inventory.`,
    );

  if (sellableItems.length > 0) {
    form.button(
      formatTwoLineButton('§l§aSell All Eligible', `Earn ~${formatCurrency(totalValue)}`),
      'textures/ui/icon_recipe_equipment',
      () => {
        void promptSellAllFlow(player, () => showShopSellInventoryPanel(player, 1, mode));
      },
    );
  }

  form.addPaginatedButtons(
    sellableItems,
    page,
    (entry, formBuilder) => {
      const estPayout = Math.round(entry.sellableCount * entry.unitPrice * 100) / 100;
      const quotaNote = Number.isFinite(entry.remainingQuota) ? ` • Cap ${entry.remainingQuota}` : '';
      formBuilder.button(
        formatTwoLineButton(
          `§l§f${entry.displayName} §eSellable x${entry.sellableCount}`,
          `§a${formatCurrency(entry.unitPrice)} ea §8(${formatCurrency(estPayout)}${quotaNote})`,
        ),
        entry.icon,
        () => {
          void showBuyOrSellPanel(player, entry.itemKey, entry.shopItem, {
            returnTo: 'sellInventory',
            page,
            mode,
          });
        },
      );
    },
    (newPage) => {
      void showShopSellInventoryPanel(player, newPage, mode);
    },
  );

  form.addBackButton(() => {
    void showShopMainPanel(player, mode);
  });

  await form.show(player);
}

/**
 * Displays a shop category panel with subcategories and items.
 *
 * @param player Target player.
 * @param categoryName Category identifier.
 * @param page Current page number.
 * @param mode Optional view mode (`shop`, `buy`, or `sell`).
 */
export async function showShopCategoryPanel(
  player: mc.Player,
  categoryName: string,
  page: number = 1,
  mode: ShopViewMode = 'shop',
): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }
  const shopConfig = getShopConfig();
  const category = shopConfig.categories[categoryName] as ShopCategory | undefined;

  if (!category) {
    player.sendMessage('§cCategory not found.');
    void showShopMainPanel(player, mode);
    return;
  }

  const pData = getOrCreatePlayer(player);
  const form = new ActionFormBuilder()
    .grid(3)
    .title(categoryName)
    .body(`§7Balance: §a${formatCurrency(pData.balance)}`);

  const entries: {
    type: 'subCategory' | 'item';
    id: string;
    name: string;
    subtitle: string;
    icon: string;
    itemData?: ShopItemInfo;
  }[] = [];

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
        subtitle: `§6Group • §7${subItemKeys.length} items`,
        icon,
      });
    }
  }

  for (const [itemId, itemData] of Object.entries(category.items ?? {})) {
    if (!isDefined(itemData)) {
      continue;
    }
    if (isNonEmptyString(itemData.permission) && !hasPermission(player, itemData.permission)) {
      continue;
    }
    const meta = resolveTradeItemMetadata(itemId, itemData);
    const buyP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'buy');
    const sellP = getPlayerShopItemPrice(player, { ...itemData, itemId: meta.itemId }, 'sell');
    if (buyP <= 0 && sellP <= 0) {
      continue;
    }
    if (mode === 'buy' && buyP <= 0) {
      continue;
    }
    if (mode === 'sell' && sellP <= 0) {
      continue;
    }
    entries.push({
      type: 'item',
      id: itemId,
      name: meta.displayName,
      subtitle: formatShopPriceSubtitle(buyP, sellP),
      icon: meta.icon,
      itemData: {
        ...itemData,
        itemId: meta.itemId,
        displayName: meta.displayName,
        icon: meta.icon,
        ...(isDefined(meta.enchantment) ? { enchantment: meta.enchantment } : {}),
      },
    });
  }

  form.addPaginatedButtons(
    entries,
    page,
    (entry, formBuilder) => {
      if (entry.type === 'subCategory') {
        formBuilder.button(formatTwoLineButton(`§l§6${entry.name}`, entry.subtitle), entry.icon, () => {
          void showShopItemListPanel(player, categoryName, entry.id, 1, mode);
        });
      } else if (isDefined(entry.itemData)) {
        const targetItem = entry.itemData;
        formBuilder.button(formatTwoLineButton(`§l§f${entry.name}`, entry.subtitle), entry.icon, () => {
          void showBuyOrSellPanel(player, entry.id, targetItem, { returnTo: 'category', categoryName, page, mode });
        });
      }
    },
    (newPage) => {
      void showShopCategoryPanel(player, categoryName, newPage, mode);
    },
  );

  form.addBackButton(() => {
    void showShopMainPanel(player, mode);
  });

  await form.show(player);
}

/**
 * Displays items within a shop subcategory.
 *
 * @param player Target player.
 * @param categoryName Parent category identifier.
 * @param subCategoryName Subcategory identifier.
 * @param page Current page number.
 * @param mode Optional view mode (`shop`, `buy`, or `sell`).
 */
export async function showShopItemListPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string,
  page: number = 1,
  mode: ShopViewMode = 'shop',
): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }
  const shopConfig = getShopConfig();
  const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
  const subCat = category?.subCategories?.[subCategoryName];
  if (!subCat) {
    player.sendMessage('§cSub-category not found.');
    void showShopCategoryPanel(player, categoryName, 1, mode);
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
    if (buyP <= 0 && sellP <= 0) {
      continue;
    }
    if (mode === 'buy' && buyP <= 0) {
      continue;
    }
    if (mode === 'sell' && sellP <= 0) {
      continue;
    }
    entries.push({
      id: itemId,
      name: meta.displayName,
      subtitle: formatShopPriceSubtitle(buyP, sellP),
      icon: meta.icon,
      itemData: {
        ...itemData,
        itemId: meta.itemId,
        displayName: meta.displayName,
        icon: meta.icon,
        ...(isDefined(meta.enchantment) ? { enchantment: meta.enchantment } : {}),
      },
    });
  }

  form.addPaginatedButtons(
    entries,
    page,
    (entry, formBuilder) => {
      formBuilder.button(formatTwoLineButton(`§l§f${entry.name}`, entry.subtitle), entry.icon, () => {
        void showBuyOrSellPanel(player, entry.id, entry.itemData, {
          returnTo: 'subCategory',
          categoryName,
          subCategoryName,
          page,
          mode,
        });
      });
    },
    (newPage) => {
      void showShopItemListPanel(player, categoryName, subCategoryName, newPage, mode);
    },
  );

  form.addBackButton(() => {
    void showShopCategoryPanel(player, categoryName, 1, mode);
  });

  await form.show(player);
}

/**
 * Opens the shop search input modal.
 *
 * @param player Target player.
 * @param mode Optional view mode (`shop`, `buy`, or `sell`).
 */
export async function showShopSearchPanel(player: mc.Player, mode: ShopViewMode = 'shop'): Promise<void> {
  const modal = new CustomFormBuilder<{ query: string }>('Search Shop')
    .textField('query', 'Item Name', 'e.g., Diamond Sword, Stone Stairs', '')
    .submitButton('Search');
  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopMainPanel(player, mode);
    return;
  }
  if (isNonEmptyString(res.query.trim())) {
    void showShopSearchResultsPanel(player, res.query.trim(), 1, mode);
  } else {
    void showShopMainPanel(player, mode);
  }
}

/**
 * Displays paginated shop search results matching `query`.
 *
 * @param player Target player.
 * @param query Search query string.
 * @param page Current page number.
 * @param mode Optional view mode (`shop`, `buy`, or `sell`).
 */
export async function showShopSearchResultsPanel(
  player: mc.Player,
  query: string,
  page: number = 1,
  mode: ShopViewMode = 'shop',
): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }

  const catalogMatches = getShopCatalogEntries(player, {
    query,
    mode: mode === 'shop' ? 'all' : mode,
  });

  const form = new ActionFormBuilder()
    .grid(3)
    .title(`Search: "${query}"`)
    .body(
      catalogMatches.length === 0
        ? '§cNo items found matching your search.'
        : `§7Found §f${catalogMatches.length}§7 matching item${catalogMatches.length === 1 ? '' : 's'}.`,
    )
    .button(formatTwoLineButton('§l§6New Search', 'Search another item'), 'textures/ui/magnifyingGlass', () => {
      void showShopSearchPanel(player, mode);
    });

  form.addPaginatedButtons(
    catalogMatches,
    page,
    (entry, formBuilder) => {
      const buyP = getPlayerShopItemPrice(player, entry.shopItem, 'buy');
      const sellP = getPlayerShopItemPrice(player, entry.shopItem, 'sell');
      const displayName = entry.shopItem.displayName ?? entry.itemKey;
      formBuilder.button(
        formatTwoLineButton(`§l§f${displayName}`, formatShopPriceSubtitle(buyP, sellP)),
        entry.icon,
        () => {
          void showBuyOrSellPanel(player, entry.itemKey, entry.shopItem, { returnTo: 'search', query, page, mode });
        },
      );
    },
    (newPage) => {
      void showShopSearchResultsPanel(player, query, newPage, mode);
    },
  );

  form.addBackButton(() => {
    void showShopMainPanel(player, mode);
  });

  await form.show(player);
}

/** Navigation context used by the trade panel Back button. */
export interface ReturnContext {
  returnTo: 'category' | 'subCategory' | 'search' | 'sellInventory' | 'main';
  categoryName?: string;
  subCategoryName?: string;
  query?: string;
  page: number;
  mode?: ShopViewMode;
}

/**
 * Displays the buy/sell transaction panel for a specific shop item.
 *
 * @param player Target player.
 * @param itemKey Shop item key.
 * @param itemData Raw item configuration data.
 * @param returnCtx Navigation context for the Back button.
 */
export async function showBuyOrSellPanel(
  player: mc.Player,
  itemKey: string,
  itemData: unknown,
  returnCtx: ReturnContext,
): Promise<void> {
  if (!player.isValid) {
    return;
  }
  const typedItemData = (itemData ?? {}) as ShopItemInfo;
  const meta = resolveTradeItemMetadata(itemKey, typedItemData);
  const resolvedInfo = {
    ...typedItemData,
    itemId: meta.itemId,
    displayName: meta.displayName,
    icon: meta.icon,
    ...(isDefined(meta.enchantment) ? { enchantment: meta.enchantment } : {}),
  };
  const buyPrice = getPlayerShopItemPrice(player, resolvedInfo, 'buy');
  const sellPrice = getPlayerShopItemPrice(player, resolvedInfo, 'sell');
  const pData = getOrCreatePlayer(player);
  const ownedCount = getPlayerInventoryShopItemCount(player, itemKey);
  const unstackable = isUnstackableShopItem(resolvedInfo);

  const remBuy = getRemainingDailyShopQuota(player, itemKey, resolvedInfo, 'buy');
  const remSell = getRemainingDailyShopQuota(player, itemKey, resolvedInfo, 'sell');
  const quotaParts: string[] = [];
  if (Number.isFinite(remBuy)) {
    quotaParts.push(`§2Daily Buy Left: §f${remBuy}`);
  }
  if (Number.isFinite(remSell)) {
    quotaParts.push(`§eDaily Sell Left: §f${remSell}`);
  }

  const perkLine = formatRankPerkLine(player);
  const bodyLines = [
    `§7Item: §b${meta.displayName}`,
    `§7Your Balance: §a${formatCurrency(pData.balance)} §8| §7In Inventory: §ex${ownedCount}`,
    `§7Unit Price: ${formatShopPriceSubtitle(buyPrice, sellPrice)}`,
    ...(perkLine ? [perkLine] : []),
    ...(quotaParts.length > 0 ? [`§7Quota: ${quotaParts.join(' §8| ')}`] : []),
  ];

  const form = new ActionFormBuilder().grid(2).title(`Trade: ${meta.displayName}`).body(bodyLines.join('\n'));

  if (buyPrice > 0) {
    form.button(formatTwoLineButton('§2Buy 1', formatCurrency(buyPrice)), meta.icon, () => {
      if (!player.isValid) {
        return;
      }
      player.sendMessage(buyItem(player, itemKey, 1).message);
      void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
    });
    if (!unstackable) {
      form.button(formatTwoLineButton('§2Buy 16', formatCurrency(buyPrice * 16)), meta.icon, () => {
        if (!player.isValid) {
          return;
        }
        player.sendMessage(buyItem(player, itemKey, 16).message);
        void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      });
      form.button(formatTwoLineButton('§2Buy 64', formatCurrency(buyPrice * 64)), meta.icon, () => {
        if (!player.isValid) {
          return;
        }
        player.sendMessage(buyItem(player, itemKey, 64).message);
        void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      });
    }
    if (!unstackable || (resolvedInfo.dailyBuyLimit ?? 0) !== 1) {
      form.button(formatTwoLineButton('§2Buy Max', 'Max affordable'), 'textures/ui/color_plus', () => {
        if (!player.isValid) {
          return;
        }
        player.sendMessage(buyItem(player, itemKey, -1).message);
        void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      });
    }
  }

  if (sellPrice > 0) {
    form.button(formatTwoLineButton('§cSell 1', formatCurrency(sellPrice)), 'textures/ui/cancel', () => {
      if (!player.isValid) {
        return;
      }
      player.sendMessage(sellItem(player, itemKey, 1).message);
      void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
    });
    if (!unstackable) {
      form.button(formatTwoLineButton('§cSell 16', formatCurrency(sellPrice * 16)), 'textures/ui/cancel', () => {
        if (!player.isValid) {
          return;
        }
        player.sendMessage(sellItem(player, itemKey, 16).message);
        void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      });
      form.button(formatTwoLineButton('§cSell 64', formatCurrency(sellPrice * 64)), 'textures/ui/cancel', () => {
        if (!player.isValid) {
          return;
        }
        player.sendMessage(sellItem(player, itemKey, 64).message);
        void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      });
    }
    form.button(
      formatTwoLineButton(`§6Sell All (x${ownedCount})`, formatCurrency(sellPrice * Math.max(0, ownedCount))),
      'textures/ui/icon_recipe_equipment',
      () => {
        if (!player.isValid) {
          return;
        }
        player.sendMessage(sellItem(player, itemKey, -1).message);
        void showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      },
    );
  }

  if ((buyPrice > 0 || sellPrice > 0) && !unstackable) {
    form.button(
      formatTwoLineButton('§bCustom Amount', 'Enter exact qty'),
      'textures/ui/book_edit_default',
      async () => {
        if (!player.isValid) {
          return;
        }
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
        if (!player.isValid) {
          return;
        }
        if (res) {
          const trimmedQty = res.qty.trim();
          const parsedQty = /^\d+$/.test(trimmedQty) ? Number(trimmedQty) : Number.NaN;
          if (Number.isSafeInteger(parsedQty) && parsedQty > 0) {
            const out =
              res.mode === 'Sell' ? sellItem(player, itemKey, parsedQty) : buyItem(player, itemKey, parsedQty);
            player.sendMessage(out.message);
          } else {
            player.sendMessage('§cInvalid quantity.');
          }
        }
        await showBuyOrSellPanel(player, itemKey, resolvedInfo, returnCtx);
      },
    );
  }

  form.addBackButton(() => {
    const mode = returnCtx.mode ?? 'shop';
    if (returnCtx.returnTo === 'category' && returnCtx.categoryName) {
      void showShopCategoryPanel(player, returnCtx.categoryName, returnCtx.page, mode);
    } else if (returnCtx.returnTo === 'subCategory' && returnCtx.categoryName && returnCtx.subCategoryName) {
      void showShopItemListPanel(player, returnCtx.categoryName, returnCtx.subCategoryName, returnCtx.page, mode);
    } else if (returnCtx.returnTo === 'search' && returnCtx.query) {
      void showShopSearchResultsPanel(player, returnCtx.query, returnCtx.page, mode);
    } else if (returnCtx.returnTo === 'sellInventory') {
      void showShopSellInventoryPanel(player, returnCtx.page, mode);
    } else {
      void showShopMainPanel(player, mode);
    }
  });

  await form.show(player);
}
