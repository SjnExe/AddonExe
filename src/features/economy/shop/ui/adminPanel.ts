import { getConfig, updateMultipleConfig } from '@core/config/configManager.js';
import { getShopConfig } from '@core/config/configurations.js';
import * as shopAdminManager from '@features/economy/shop/adminManager.js';
import type { ShopCategory } from '@features/economy/shop/config.js';
import { getShopCatalogEntries } from '@features/economy/shop/manager.js';
import { ensureItemsConfig, getAllItems, parseRankOverrides } from '@features/economy/shop/utils.js';
import {
  formatShopPriceSubtitle,
  formatTwoLineButton,
  resolveTradeItemDisplayName,
  resolveTradeItemIcon,
  resolveTradeItemMetadata,
} from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { ActionFormBuilder } from '@ui/builders/actionFormBuilder.js';
import { CustomFormBuilder } from '@ui/builders/customFormBuilder.js';
import { showConfirmationDialog } from '@ui/components.js';

function returnToAdminContainer(player: mc.Player, categoryName: string, subCategoryName?: string): void {
  if (isNonEmptyString(subCategoryName)) {
    void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
  } else {
    void showShopAdminCategoryPanel(player, categoryName, 1);
  }
}

/**
 * Opens the main shop management dashboard for admins.
 *
 * @param player Admin player.
 * @param page Current page number.
 */
export async function showShopManagementPanel(player: mc.Player, page: number = 1): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }

  const mainConfig = getConfig();
  const shopConfig = getShopConfig();
  const isEnabled = mainConfig.shop.enabled;
  const categories = shopConfig.categories as Record<string, ShopCategory>;

  const form = new ActionFormBuilder()
    .grid(2)
    .title('Shop Management')
    .body(`§7Status: ${isEnabled ? '§aENABLED' : '§cDISABLED'} §8| §7Categories: §f${Object.keys(categories).length}`)
    .button(
      formatTwoLineButton(isEnabled ? '§2Shop: ENABLED' : '§4Shop: DISABLED', 'Tap to toggle'),
      isEnabled ? 'textures/ui/realms_green_check' : 'textures/ui/cancel',
      () => {
        const newStatus = !getConfig().shop.enabled;
        updateMultipleConfig({ 'shop.enabled': newStatus });
        player.sendMessage(`§2Shop system ${newStatus ? 'enabled' : 'disabled'}.`);
        void showShopManagementPanel(player, page);
      },
    )
    .button(formatTwoLineButton('§6Search & Edit', 'Find any item fast'), 'textures/ui/magnifyingGlass', () => {
      void showShopAdminSearchPanel(player);
    })
    .button(formatTwoLineButton('§a+ Add Held Item', 'Use item in hand'), 'textures/ui/icon_recipe_item', () => {
      void showAddHeldItemWizard(player);
    })
    .button(formatTwoLineButton('§2+ Add Category', 'Create new group'), 'textures/ui/color_plus', () => {
      void showAddCategoryPanel(player);
    })
    .button(formatTwoLineButton('§bEconomy Tools', 'Scale prices & reset'), 'textures/ui/icon_setting', () => {
      void showShopAdminEconomyToolsPanel(player);
    });

  const categoryNames = Object.keys(categories);
  form.addPaginatedButtons(
    categoryNames,
    page,
    (catName, formBuilder) => {
      const cat = categories[catName];
      if (!isDefined(cat)) {
        return;
      }
      const subCount = Object.keys(cat.subCategories ?? {}).length;
      const itemCount = Object.keys(cat.items ?? {}).length;
      const subtitle =
        subCount > 0 ? `${subCount} groups${itemCount > 0 ? ` • ${itemCount} items` : ''}` : `${itemCount} items`;
      formBuilder.button(formatTwoLineButton(`§f${catName}`, subtitle), resolveTradeItemIcon(catName, cat.icon), () => {
        void showShopAdminCategoryPanel(player, catName, 1);
      });
    },
    (newPage) => {
      void showShopManagementPanel(player, newPage);
    },
  );

  form.addBackButton(async () => {
    const { showConfigCategoryPanel } = await import('@core/ui/panels/configPanel.js');
    await showConfigCategoryPanel(player);
  });

  await form.show(player);
}

/**
 * Opens the admin search modal to find any shop item.
 *
 * @param player Admin player.
 */
export async function showShopAdminSearchPanel(player: mc.Player): Promise<void> {
  const modal = new CustomFormBuilder<{ query: string }>('Search Shop Items')
    .textField('query', 'Item Name or ID', 'e.g. diamond, mending, oak', '')
    .submitButton('Search');
  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res || !isNonEmptyString(res.query.trim())) {
    void showShopManagementPanel(player, 1);
    return;
  }
  void showShopAdminSearchResultsPanel(player, res.query.trim(), 1);
}

/**
 * Displays matching shop items in the admin search results panel.
 *
 * @param player Admin player.
 * @param query Search query string.
 * @param page Current page number.
 */
export async function showShopAdminSearchResultsPanel(
  player: mc.Player,
  query: string,
  page: number = 1,
): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }

  const results = getShopCatalogEntries(undefined, { query, includeDisabled: true });
  const form = new ActionFormBuilder()
    .grid(2)
    .title(`Admin Search: "${query}"`)
    .body(`§7Found §f${results.length}§7 matching item${results.length === 1 ? '' : 's'}.`)
    .button(formatTwoLineButton('§6New Search', 'Search another item'), 'textures/ui/magnifyingGlass', () => {
      void showShopAdminSearchPanel(player);
    });

  form.addPaginatedButtons(
    results,
    page,
    (entry, formBuilder) => {
      const loc = entry.subCategoryName ? `${entry.categoryName} > ${entry.subCategoryName}` : entry.categoryName;
      const priceStr = formatShopPriceSubtitle(entry.shopItem.buyPrice ?? -1, entry.shopItem.sellPrice ?? -1);
      formBuilder.button(
        formatTwoLineButton(entry.shopItem.displayName ?? entry.itemKey, `${priceStr} §8(${loc})`),
        entry.icon,
        () => {
          void showShopAdminItemActionPanel(player, entry.categoryName, entry.subCategoryName, entry.itemKey);
        },
      );
    },
    (newPage) => {
      void showShopAdminSearchResultsPanel(player, query, newPage);
    },
  );

  form.addBackButton(() => {
    void showShopManagementPanel(player, 1);
  });

  await form.show(player);
}

/**
 * Opens a wizard to add the player's currently held item to a shop category.
 *
 * @param player Admin player.
 */
export async function showAddHeldItemWizard(player: mc.Player): Promise<void> {
  if (!player.isValid) {
    return;
  }
  const equipment = player.getComponent(EntityComponentTypes.Equippable);
  const heldItem = equipment?.getEquipment(mc.EquipmentSlot.Mainhand);
  if (!isDefined(heldItem)) {
    player.sendMessage('§cHold an item in your main hand first.');
    void showShopManagementPanel(player, 1);
    return;
  }

  const shopConfig = getShopConfig();
  const targets = buildContainerDestinationOptions(shopConfig);

  if (targets.length === 0) {
    player.sendMessage('§cCreate a category first before adding items.');
    void showShopManagementPanel(player, 1);
    return;
  }

  const itemName = heldItem.nameTag || resolveTradeItemDisplayName(heldItem.typeId);
  const modal = new CustomFormBuilder<{
    target: string;
    buyPrice: string;
    sellPrice: string;
    dailyBuyLimit: string;
    dailySellLimit: string;
  }>(`Add Held: ${itemName}`)
    .dropdown(
      'target',
      'Destination Category',
      targets.map((t) => t.option),
      0,
    )
    .textField('buyPrice', 'Buy Price (0 or -1 to disable)', '100', '100')
    .textField('sellPrice', 'Sell Price (0 or -1 to disable)', '25', '25')
    .textField('dailyBuyLimit', 'Daily Buy Limit (0 = Unlimited)', '0', '0')
    .textField('dailySellLimit', 'Daily Sell Limit (0 = Unlimited)', '0', '0')
    .submitButton('Add to Shop');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopManagementPanel(player, 1);
    return;
  }

  const buyPrice = parseAndNormalizeShopPrice(res.buyPrice);
  const sellPrice = parseAndNormalizeShopPrice(res.sellPrice);
  const dailyBuyLimit = parseNonNegativeSafeInt(res.dailyBuyLimit);
  const dailySellLimit = parseNonNegativeSafeInt(res.dailySellLimit);
  if (!isDefined(buyPrice) || !isDefined(sellPrice)) {
    player.sendMessage('§cInvalid prices. Enter finite numbers >= 0, or -1 to disable.');
    void showAddHeldItemWizard(player);
    return;
  }
  if (!isDefined(dailyBuyLimit) || !isDefined(dailySellLimit)) {
    player.sendMessage('§cDaily limits must be non-negative whole numbers.');
    void showAddHeldItemWizard(player);
    return;
  }

  const selectedTarget = targets.find((t) => t.option === res.target) ?? targets[0]!;
  const result = shopAdminManager.addShopItemFromHand(
    heldItem,
    selectedTarget.categoryName,
    selectedTarget.subCategoryName,
    buyPrice,
    sellPrice,
  );
  if (result.success && result.itemId) {
    if (dailyBuyLimit > 0 || dailySellLimit > 0) {
      const limitResult = shopAdminManager.quickUpdateItemPrices(
        selectedTarget.categoryName,
        selectedTarget.subCategoryName,
        result.itemId,
        undefined,
        undefined,
        dailyBuyLimit,
        dailySellLimit,
      );
      if (!limitResult.success) {
        player.sendMessage(`§e${result.message} §c(Limits not saved: ${limitResult.message})`);
        void showShopManagementPanel(player, 1);
        return;
      }
    }
    player.sendMessage(`§2${result.message}`);
    returnToAdminContainer(player, selectedTarget.categoryName, selectedTarget.subCategoryName);
  } else {
    player.sendMessage(`§c${result.message}`);
    void showShopManagementPanel(player, 1);
  }
}

/**
 * Opens bulk shop economy tools (price scaling and preset reset).
 *
 * @param player Admin player.
 */
export async function showShopAdminEconomyToolsPanel(player: mc.Player): Promise<void> {
  const form = new ActionFormBuilder()
    .grid(1)
    .title('Shop Economy Tools')
    .body('§7Adjust shop inflation/prices in bulk or restore the default balanced preset.')
    .button(
      formatTwoLineButton('§6Scale Prices (Global / Category)', 'Multiply buy & sell prices by a factor'),
      'textures/ui/icon_setting',
      () => {
        void showScalePricesPanel(player);
      },
    )
    .button(
      formatTwoLineButton('§cReset Shop to Default Preset', 'Restore balanced built-in categories & prices'),
      'textures/ui/refresh_light',
      () => {
        void showConfirmationDialog(player, {
          title: 'Reset Shop Config',
          body: 'Are you sure you want to reset the entire shop to the default balanced preset? Custom categories and price edits will be overwritten.',
          confirmButtonText: '§cReset Shop',
          cancelButtonText: '§7Cancel',
          onConfirm: () => {
            if (!player.isValid) {
              return Promise.resolve();
            }
            const res = shopAdminManager.resetShopToDefaults();
            player.sendMessage(`§a${res.message}`);
            void showShopManagementPanel(player, 1);
            return Promise.resolve();
          },
          onCancel: () => {
            if (!player.isValid) {
              return Promise.resolve();
            }
            void showShopAdminEconomyToolsPanel(player);
            return Promise.resolve();
          },
        });
      },
    )
    .addBackButton(() => {
      void showShopManagementPanel(player, 1);
    });

  await form.show(player);
}

async function showScalePricesPanel(player: mc.Player): Promise<void> {
  const shopConfig = getShopConfig();
  const globalOption = '0. All Categories (Global)';
  const categoryOptions = Object.keys(shopConfig.categories ?? {}).map((cat, idx) => ({
    option: `${idx + 1}. ${cat}`,
    categoryName: cat,
  }));
  const scopes = [globalOption, ...categoryOptions.map((c) => c.option)];
  const modal = new CustomFormBuilder<{ scope: string; buyMult: string; sellMult: string }>('Scale Shop Prices')
    .dropdown('scope', 'Target Scope', scopes, 0)
    .textField('buyMult', 'Buy Price Multiplier (e.g. 1.1 = +10%, 0.9 = -10%)', '1.0', '1.0')
    .textField('sellMult', 'Sell Price Multiplier (e.g. 1.1 = +10%, 0.9 = -10%)', '1.0', '1.0')
    .submitButton('Apply Scaling');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminEconomyToolsPanel(player);
    return;
  }

  const parsePositiveMult = (raw: string): number => {
    const trimmed = raw.trim();
    if (!/^\d+(?:\.\d+)?$/.test(trimmed)) {
      return Number.NaN;
    }
    return Number(trimmed);
  };
  const buyMult = parsePositiveMult(res.buyMult);
  const sellMult = parsePositiveMult(res.sellMult);
  const isGlobalScope = res.scope === globalOption;
  const targetCat = isGlobalScope ? undefined : categoryOptions.find((c) => c.option === res.scope)?.categoryName;
  if (!isGlobalScope && !isDefined(targetCat)) {
    player.sendMessage('§cInvalid target scope selected.');
    void showShopAdminEconomyToolsPanel(player);
    return;
  }
  const out = shopAdminManager.applyGlobalPriceMultiplier(buyMult, sellMult, targetCat);
  player.sendMessage(out.success ? `§a${out.message}` : `§c${out.message}`);
  void showShopAdminEconomyToolsPanel(player);
}

/**
 * Displays a category's subcategories, items, and category actions for admins.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 * @param page Current page number.
 */
export async function showShopAdminCategoryPanel(
  player: mc.Player,
  categoryName: string,
  page: number = 1,
): Promise<void> {
  const shopConfig = getShopConfig();
  const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
  if (!category) {
    player.sendMessage('§4Category not found.');
    void showShopManagementPanel(player, 1);
    return;
  }

  const form = new ActionFormBuilder()
    .grid(2)
    .title(`Manage: ${categoryName}`)
    .button(formatTwoLineButton('§2+ Add Item', 'From list or custom'), 'textures/ui/color_plus', () => {
      void showShopAddItemPanel(player, categoryName, undefined);
    })
    .button(formatTwoLineButton('§2+ Add Sub-Category', 'Create item group'), 'textures/ui/color_plus', () => {
      void showAddSubCategoryPanel(player, categoryName);
    })
    .button(formatTwoLineButton('§eEdit Category', 'Rename or icon'), 'textures/ui/icon_setting', () => {
      void showEditCategoryPanel(player, categoryName);
    })
    .button(formatTwoLineButton('§4Delete Category', 'Remove category'), 'textures/ui/cancel', () => {
      void showConfirmationDialog(player, {
        title: 'Confirm Delete',
        body: `Are you sure you want to delete ${categoryName} and all its contents?`,
        onConfirm: () => {
          if (!player.isValid) {
            return Promise.resolve();
          }
          shopAdminManager.deleteCategory(categoryName);
          player.sendMessage(`§2Deleted category: ${categoryName}`);
          void showShopManagementPanel(player, 1);
          return Promise.resolve();
        },
        onCancel: () => {
          if (!player.isValid) {
            return Promise.resolve();
          }
          void showShopAdminCategoryPanel(player, categoryName, page);
          return Promise.resolve();
        },
      });
    });

  const entries: { type: 'subCategory' | 'item'; id: string; name: string; icon?: string }[] = [];

  if (category.subCategories) {
    for (const [subId, subData] of Object.entries(category.subCategories)) {
      const subItems = Object.keys(subData.items ?? {});
      entries.push({
        type: 'subCategory',
        id: subId,
        name: formatTwoLineButton(`§6[Group] ${subId}`, `${subItems.length} items`),
        icon: resolveTradeItemIcon(subItems[0] ?? subId, subData.icon),
      });
    }
  }

  for (const [itemId, itemData] of Object.entries(category.items)) {
    const meta = resolveTradeItemMetadata(itemId, itemData);
    entries.push({
      type: 'item',
      id: itemId,
      name: formatTwoLineButton(meta.displayName, formatShopPriceSubtitle(itemData.buyPrice, itemData.sellPrice)),
      icon: meta.icon,
    });
  }

  form.addPaginatedButtons(
    entries,
    page,
    (entry, formBuilder) => {
      if (entry.type === 'subCategory') {
        formBuilder.button(entry.name, entry.icon, () => {
          void showShopAdminSubCategoryItemPanel(player, categoryName, entry.id, 1);
        });
      } else {
        formBuilder.button(entry.name, entry.icon, () => {
          void showShopAdminItemActionPanel(player, categoryName, undefined, entry.id);
        });
      }
    },
    (newPage) => {
      void showShopAdminCategoryPanel(player, categoryName, newPage);
    },
  );

  form.addBackButton(() => {
    void showShopManagementPanel(player, 1);
  });

  await form.show(player);
}

/**
 * Displays items and group actions within a shop subcategory for admins.
 *
 * @param player Admin player.
 * @param categoryName Parent category identifier.
 * @param subCategoryName Subcategory identifier.
 * @param page Current page number.
 */
export async function showShopAdminSubCategoryItemPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string,
  page: number = 1,
): Promise<void> {
  const shopConfig = getShopConfig();
  const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
  const subCat = category?.subCategories?.[subCategoryName];
  if (!subCat) {
    player.sendMessage('§4Sub-category not found.');
    void showShopAdminCategoryPanel(player, categoryName, 1);
    return;
  }

  const form = new ActionFormBuilder()
    .grid(2)
    .title(`${categoryName} > ${subCategoryName}`)
    .button(formatTwoLineButton('§2+ Add Item', 'From list or custom'), 'textures/ui/color_plus', () => {
      void showShopAddItemPanel(player, categoryName, subCategoryName);
    })
    .button(formatTwoLineButton('§eEdit Group', 'Rename or icon'), 'textures/ui/icon_setting', () => {
      void showEditSubCategoryPanel(player, categoryName, subCategoryName);
    })
    .button(formatTwoLineButton('§4Delete Group', 'Remove sub-category'), 'textures/ui/cancel', () => {
      void showConfirmationDialog(player, {
        title: 'Confirm Delete',
        body: `Are you sure you want to delete ${subCategoryName} and all its items?`,
        onConfirm: () => {
          if (!player.isValid) {
            return Promise.resolve();
          }
          shopAdminManager.deleteSubCategory(categoryName, subCategoryName);
          player.sendMessage(`§2Deleted sub-category: ${subCategoryName}`);
          void showShopAdminCategoryPanel(player, categoryName, 1);
          return Promise.resolve();
        },
        onCancel: () => {
          if (!player.isValid) {
            return Promise.resolve();
          }
          void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, page);
          return Promise.resolve();
        },
      });
    });

  const entries: { id: string; name: string; icon?: string }[] = [];
  for (const [itemId, itemData] of Object.entries(subCat.items)) {
    const meta = resolveTradeItemMetadata(itemId, itemData);
    entries.push({
      id: itemId,
      name: formatTwoLineButton(meta.displayName, formatShopPriceSubtitle(itemData.buyPrice, itemData.sellPrice)),
      icon: meta.icon,
    });
  }

  form.addPaginatedButtons(
    entries,
    page,
    (entry, formBuilder) => {
      formBuilder.button(entry.name, entry.icon, () => {
        void showShopAdminItemActionPanel(player, categoryName, subCategoryName, entry.id);
      });
    },
    (newPage) => {
      void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, newPage);
    },
  );

  form.addBackButton(() => {
    void showShopAdminCategoryPanel(player, categoryName, 1);
  });

  await form.show(player);
}

/**
 * Displays quick-price, full-settings, move, and delete actions for a shop item.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 * @param subCategoryName Optional subcategory identifier.
 * @param itemKey Shop item key.
 */
export async function showShopAdminItemActionPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string | undefined,
  itemKey: string,
): Promise<void> {
  const shopConfig = getShopConfig();
  const cat = shopConfig.categories[categoryName] as ShopCategory | undefined;
  const item = subCategoryName ? cat?.subCategories?.[subCategoryName]?.items[itemKey] : cat?.items[itemKey];
  if (!item) {
    player.sendMessage('§4Item not found.');
    returnToAdminContainer(player, categoryName, subCategoryName);
    return;
  }

  const meta = resolveTradeItemMetadata(itemKey, item);
  const bodyLines = [
    `§7Key: §f${itemKey} §8| §7Type: §f${meta.itemId}`,
    `§7Pricing: ${formatShopPriceSubtitle(item.buyPrice, item.sellPrice)}`,
    `§7Daily Limits: §2Buy ${item.dailyBuyLimit ?? '∞'} §8| §cSell ${item.dailySellLimit ?? '∞'} §8(${item.limitScope ?? 'player'})`,
    `§7Permission: §f${isNonEmptyString(item.permission) ? item.permission : 'Everyone'}`,
  ];

  const form = new ActionFormBuilder()
    .grid(2)
    .title(`Edit: ${meta.displayName}`)
    .body(bodyLines.join('\n'))
    .button(formatTwoLineButton('§aQuick Edit Prices', 'Buy, sell & daily limits'), 'textures/ui/icon_deals', () => {
      void showQuickEditPricesPanel(player, categoryName, subCategoryName, itemKey);
    })
    .button(formatTwoLineButton('§eFull Settings', 'Name, icon, perm, overrides'), 'textures/ui/icon_setting', () => {
      void showEditItemFormPanel(player, categoryName, subCategoryName, itemKey);
    })
    .button(formatTwoLineButton('§bMove Item', 'Change category/group'), 'textures/ui/arrow_right', () => {
      void showMoveShopItemPanel(player, categoryName, subCategoryName, itemKey);
    })
    .button(formatTwoLineButton('§4Delete Item', 'Remove from shop'), 'textures/ui/cancel', () => {
      void showConfirmationDialog(player, {
        title: 'Delete Shop Item',
        body: `Remove §e${meta.displayName}§f from the shop?`,
        confirmButtonText: '§cDelete',
        cancelButtonText: '§7Cancel',
        onConfirm: () => {
          if (!player.isValid) {
            return Promise.resolve();
          }
          shopAdminManager.removeItem(categoryName, subCategoryName, itemKey);
          player.sendMessage(`§2Deleted item: ${meta.displayName}`);
          returnToAdminContainer(player, categoryName, subCategoryName);
          return Promise.resolve();
        },
        onCancel: () => {
          if (!player.isValid) {
            return Promise.resolve();
          }
          void showShopAdminItemActionPanel(player, categoryName, subCategoryName, itemKey);
          return Promise.resolve();
        },
      });
    })
    .addBackButton(() => {
      returnToAdminContainer(player, categoryName, subCategoryName);
    });

  await form.show(player);
}

async function showQuickEditPricesPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string | undefined,
  itemKey: string,
): Promise<void> {
  const shopConfig = getShopConfig();
  const cat = shopConfig.categories[categoryName] as ShopCategory | undefined;
  const item = subCategoryName ? cat?.subCategories?.[subCategoryName]?.items[itemKey] : cat?.items[itemKey];
  if (!item) {
    returnToAdminContainer(player, categoryName, subCategoryName);
    return;
  }

  const initialBuy = item.buyPrice;
  const initialSell = item.sellPrice;
  const initialBuyLimit = item.dailyBuyLimit ?? 0;
  const initialSellLimit = item.dailySellLimit ?? 0;

  const meta = resolveTradeItemMetadata(itemKey, item);
  const modal = new CustomFormBuilder<{
    buyPrice: string;
    sellPrice: string;
    dailyBuyLimit: string;
    dailySellLimit: string;
  }>(`Prices: ${meta.displayName}`)
    .textField('buyPrice', 'Buy Price (0 or -1 to disable)', '100', String(initialBuy))
    .textField('sellPrice', 'Sell Price (0 or -1 to disable)', '25', String(initialSell))
    .textField('dailyBuyLimit', 'Daily Buy Limit (0 = Unlimited)', '0', String(initialBuyLimit))
    .textField('dailySellLimit', 'Daily Sell Limit (0 = Unlimited)', '0', String(initialSellLimit))
    .submitButton('Save Prices');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminItemActionPanel(player, categoryName, subCategoryName, itemKey);
    return;
  }

  const buyPrice = parseAndNormalizeShopPrice(res.buyPrice);
  const sellPrice = parseAndNormalizeShopPrice(res.sellPrice);
  const dailyBuyLimit = parseNonNegativeSafeInt(res.dailyBuyLimit);
  const dailySellLimit = parseNonNegativeSafeInt(res.dailySellLimit);
  if (!isDefined(buyPrice) || !isDefined(sellPrice)) {
    player.sendMessage('§cInvalid prices. Enter finite numbers >= 0, or -1 to disable.');
    void showQuickEditPricesPanel(player, categoryName, subCategoryName, itemKey);
    return;
  }
  if (!isDefined(dailyBuyLimit) || !isDefined(dailySellLimit)) {
    player.sendMessage('§cDaily limits must be non-negative whole numbers.');
    void showQuickEditPricesPanel(player, categoryName, subCategoryName, itemKey);
    return;
  }

  const out = shopAdminManager.quickUpdateItemPrices(
    categoryName,
    subCategoryName,
    itemKey,
    buyPrice === initialBuy ? undefined : buyPrice,
    sellPrice === initialSell ? undefined : sellPrice,
    dailyBuyLimit === initialBuyLimit ? undefined : dailyBuyLimit,
    dailySellLimit === initialSellLimit ? undefined : dailySellLimit,
  );
  player.sendMessage(out.success ? `§a${out.message}` : `§c${out.message}`);
  void showShopAdminItemActionPanel(player, categoryName, subCategoryName, itemKey);
}

async function showMoveShopItemPanel(
  player: mc.Player,
  fromCategory: string,
  fromSubCategory: string | undefined,
  itemKey: string,
): Promise<void> {
  const shopConfig = getShopConfig();
  const targets = buildContainerDestinationOptions(shopConfig);

  const modal = new CustomFormBuilder<{ target: string }>(`Move Item: ${itemKey}`)
    .dropdown(
      'target',
      'Destination',
      targets.map((t) => t.option),
      0,
    )
    .submitButton('Move Item');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminItemActionPanel(player, fromCategory, fromSubCategory, itemKey);
    return;
  }

  const dest = targets.find((t) => t.option === res.target);
  if (!dest) {
    void showShopAdminItemActionPanel(player, fromCategory, fromSubCategory, itemKey);
    return;
  }

  const out = shopAdminManager.moveShopItem(
    fromCategory,
    fromSubCategory,
    itemKey,
    dest.categoryName,
    dest.subCategoryName,
  );
  player.sendMessage(out.success ? `§a${out.message}` : `§c${out.message}`);
  if (out.success) {
    void showShopAdminItemActionPanel(player, dest.categoryName, dest.subCategoryName, itemKey);
  } else {
    void showShopAdminItemActionPanel(player, fromCategory, fromSubCategory, itemKey);
  }
}

/**
 * Prompts the admin to add an item from the catalog or manually.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 * @param subCategoryName Optional subcategory identifier.
 */
export async function showShopAddItemPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string | undefined,
): Promise<void> {
  const form = new ActionFormBuilder()
    .grid(1)
    .title('Add Item')
    .button('§6Add Item From Catalog', 'textures/ui/icon_recipe_equipment', () => {
      void showAddItemFromListPanel(player, categoryName, subCategoryName, 1);
    })
    .button('§2Add Custom Item (Manual)', 'textures/ui/color_plus', () => {
      void showAddCustomItemPanel(player, categoryName, subCategoryName);
    });

  form.addBackButton(() => {
    returnToAdminContainer(player, categoryName, subCategoryName);
  });

  await form.show(player);
}

function parseAndNormalizeShopPrice(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || (parsed < 0 && parsed !== -1)) {
    return undefined;
  }
  if (parsed === -1) {
    return -1;
  }
  const rounded = Math.round(parsed * 100) / 100;
  return Number.isFinite(rounded) ? rounded : undefined;
}

function parseNonNegativeSafeInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function buildContainerDestinationOptions(shopConfig: ReturnType<typeof getShopConfig>): {
  option: string;
  categoryName: string;
  subCategoryName?: string;
}[] {
  const targets: { option: string; categoryName: string; subCategoryName?: string }[] = [];
  let idx = 1;
  for (const [catName, cat] of Object.entries(shopConfig.categories ?? {})) {
    if (!isDefined(cat)) {
      continue;
    }
    targets.push({ option: `${idx++}. ${catName}`, categoryName: catName });
    for (const subName of Object.keys(cat.subCategories ?? {})) {
      targets.push({ option: `${idx++}. ${catName} > ${subName}`, categoryName: catName, subCategoryName: subName });
    }
  }
  return targets;
}

/**
 * Opens the modal to create a new shop category.
 *
 * @param player Admin player.
 */
export async function showAddCategoryPanel(player: mc.Player): Promise<void> {
  const modal = new CustomFormBuilder<{ catName: string; icon: string }>('Add Category')
    .textField('catName', 'Category Name', 'e.g., Blocks', '')
    .textField('icon', 'Icon Path (optional)', 'textures/blocks/stonebrick', '')
    .submitButton('Add Category');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopManagementPanel(player, 1);
    return;
  }

  if (isNonEmptyString(res.catName)) {
    const out = shopAdminManager.addCategory(res.catName, res.icon);
    player.sendMessage(out.success ? `§2${out.message}` : `§c${out.message}`);
  } else {
    player.sendMessage('§4Invalid category name.');
  }
  void showShopManagementPanel(player, 1);
}

/**
 * Opens the modal to create a new subcategory inside `categoryName`.
 *
 * @param player Admin player.
 * @param categoryName Parent category identifier.
 */
export async function showAddSubCategoryPanel(player: mc.Player, categoryName: string): Promise<void> {
  const modal = new CustomFormBuilder<{ subCatName: string; icon: string }>('Add Sub-Category')
    .textField('subCatName', 'Sub-Category Name', 'e.g., Ores', '')
    .textField('icon', 'Icon Path (optional)', 'textures/items/diamond', '')
    .submitButton('Add Sub-Category');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminCategoryPanel(player, categoryName, 1);
    return;
  }

  if (isNonEmptyString(res.subCatName)) {
    const out = shopAdminManager.addSubCategory(categoryName, res.subCatName, res.icon);
    player.sendMessage(out.success ? `§2${out.message}` : `§c${out.message}`);
  } else {
    player.sendMessage('§4Invalid sub-category name.');
  }
  void showShopAdminCategoryPanel(player, categoryName, 1);
}

/**
 * Opens the modal to rename or change the icon of `categoryName`.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 */
export async function showEditCategoryPanel(player: mc.Player, categoryName: string): Promise<void> {
  const shopConfig = getShopConfig();
  const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
  if (!category) {
    return;
  }

  const modal = new CustomFormBuilder<{ newName: string; icon: string }>(`Edit ${categoryName}`)
    .textField('newName', 'New Name', 'New Name', categoryName)
    .textField('icon', 'Icon Path', 'Icon Path', category.icon ?? '')
    .submitButton('Save Settings');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminCategoryPanel(player, categoryName, 1);
    return;
  }

  const finalName = res.newName || categoryName;
  const out = shopAdminManager.editCategory(categoryName, finalName, res.icon);
  player.sendMessage(out.success ? `§2${out.message}` : `§c${out.message}`);
  void showShopAdminCategoryPanel(player, out.success ? finalName : categoryName, 1);
}

/**
 * Opens the modal to rename or change the icon of `subCategoryName`.
 *
 * @param player Admin player.
 * @param categoryName Parent category identifier.
 * @param subCategoryName Subcategory identifier.
 */
export async function showEditSubCategoryPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string,
): Promise<void> {
  const shopConfig = getShopConfig();
  const category = shopConfig.categories[categoryName] as ShopCategory | undefined;
  const subCategory = category?.subCategories?.[subCategoryName];
  if (!subCategory) {
    return;
  }

  const modal = new CustomFormBuilder<{ newName: string; icon: string }>(`Edit ${subCategoryName}`)
    .textField('newName', 'New Name', 'New Name', subCategoryName)
    .textField('icon', 'Icon Path', 'Icon Path', subCategory.icon ?? '')
    .submitButton('Save Settings');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminSubCategoryItemPanel(player, categoryName, subCategoryName, 1);
    return;
  }

  const finalName = res.newName || subCategoryName;
  const out = shopAdminManager.editSubCategory(categoryName, subCategoryName, finalName, res.icon);
  player.sendMessage(out.success ? `§2${out.message}` : `§c${out.message}`);
  void showShopAdminSubCategoryItemPanel(player, categoryName, out.success ? finalName : subCategoryName, 1);
}

/**
 * Displays paginated catalog items for quick addition into a shop category.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 * @param subCategoryName Optional subcategory identifier.
 * @param page Current page number.
 */
export async function showAddItemFromListPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string | undefined,
  page: number = 1,
): Promise<void> {
  await ensureItemsConfig();
  if (!player.isValid) {
    return;
  }
  const allItems = Object.keys(getAllItems());
  const form = new ActionFormBuilder().grid(2).title('Select Catalog Item');

  form.addPaginatedButtons(
    allItems,
    page,
    (itemId, formBuilder) => {
      formBuilder.button(resolveTradeItemDisplayName(itemId), resolveTradeItemIcon(itemId), () => {
        void showAddCustomItemPanel(player, categoryName, subCategoryName, itemId);
      });
    },
    (newPage) => {
      void showAddItemFromListPanel(player, categoryName, subCategoryName, newPage);
    },
  );

  form.addBackButton(() => {
    void showShopAddItemPanel(player, categoryName, subCategoryName);
  });

  await form.show(player);
}

/**
 * Opens the full custom item creation modal.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 * @param subCategoryName Optional subcategory identifier.
 * @param prefillItemId Optional item ID to prefill.
 */
export async function showAddCustomItemPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string | undefined,
  prefillItemId: string = '',
): Promise<void> {
  const modal = new CustomFormBuilder<{
    itemId: string;
    buyPrice: string;
    sellPrice: string;
    displayName: string;
    icon: string;
    permission: string;
    rankMultiplierOverridesStr: string;
    dailyBuyLimit: string;
    dailySellLimit: string;
    limitScope: string;
  }>('Add Custom Item')
    .textField('itemId', 'Item ID', 'diamond', prefillItemId)
    .textField('buyPrice', 'Buy Price (0 or -1 to disable buying)', '100', '100')
    .textField('sellPrice', 'Sell Price (0 or -1 to disable selling)', '50', '50')
    .textField('displayName', 'Display Name', 'Diamond', '')
    .textField('icon', 'Icon Path', '', '')
    .textField('permission', 'Permission', 'ui.panel.member', '')
    .textField('rankMultiplierOverridesStr', 'Overrides (e.g. vip=0.8,1.2)', '', '')
    .textField('dailyBuyLimit', 'Daily Buy Limit (0 = Unlimited)', '0', '0')
    .textField('dailySellLimit', 'Daily Sell Limit (0 = Unlimited)', '0', '0')
    .dropdown('limitScope', 'Limit Scope', ['player', 'global'], 0)
    .submitButton('Add Item');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAddItemPanel(player, categoryName, subCategoryName);
    return;
  }

  const buyPrice = parseAndNormalizeShopPrice(res.buyPrice);
  const sellPrice = parseAndNormalizeShopPrice(res.sellPrice);
  const dailyBuyLimit = parseNonNegativeSafeInt(res.dailyBuyLimit);
  const dailySellLimit = parseNonNegativeSafeInt(res.dailySellLimit);
  const limitScope = res.limitScope === 'global' ? 'global' : 'player';

  if (
    isNonEmptyString(res.itemId) &&
    isDefined(buyPrice) &&
    isDefined(sellPrice) &&
    isDefined(dailyBuyLimit) &&
    isDefined(dailySellLimit)
  ) {
    const rankMultiplierOverrides = parseRankOverrides(res.rankMultiplierOverridesStr);
    const out = shopAdminManager.setItem(categoryName, subCategoryName, res.itemId, {
      itemId: res.itemId,
      buyPrice,
      sellPrice,
      displayName: res.displayName,
      icon: res.icon,
      permission: res.permission,
      ...(rankMultiplierOverrides ? { rankMultiplierOverrides } : {}),
      ...(dailyBuyLimit > 0 ? { dailyBuyLimit } : {}),
      ...(dailySellLimit > 0 ? { dailySellLimit } : {}),
      ...(dailyBuyLimit > 0 || dailySellLimit > 0 ? { limitScope } : {}),
    });
    player.sendMessage(out.success ? `§2Item added: ${res.itemId}` : `§c${out.message}`);
    returnToAdminContainer(player, categoryName, subCategoryName);
  } else {
    player.sendMessage('§4Invalid input.');
    void showAddCustomItemPanel(player, categoryName, subCategoryName, prefillItemId);
  }
}

/**
 * Opens the full item settings editor modal.
 *
 * @param player Admin player.
 * @param categoryName Category identifier.
 * @param subCategoryName Optional subcategory identifier.
 * @param itemKey Shop item key.
 */
export async function showEditItemFormPanel(
  player: mc.Player,
  categoryName: string,
  subCategoryName: string | undefined,
  itemKey: string,
): Promise<void> {
  const shopConfig = getShopConfig();
  const cat = shopConfig.categories[categoryName] as ShopCategory | undefined;
  const item = subCategoryName ? cat?.subCategories?.[subCategoryName]?.items[itemKey] : cat?.items[itemKey];

  if (!item) {
    player.sendMessage('§4Item not found.');
    returnToAdminContainer(player, categoryName, subCategoryName);
    return;
  }

  let overridesStr = '';
  if (item.rankMultiplierOverrides) {
    const parts: string[] = [];
    for (const [rank, prices] of Object.entries(item.rankMultiplierOverrides)) {
      parts.push(`${rank}=${prices.buy},${prices.sell}`);
    }
    overridesStr = parts.join(';');
  }

  const modal = new CustomFormBuilder<{
    itemId: string;
    buyPrice: string;
    sellPrice: string;
    displayName: string;
    icon: string;
    permission: string;
    rankMultiplierOverridesStr: string;
    dailyBuyLimit: string;
    dailySellLimit: string;
    limitScope: string;
    action: string;
  }>('Edit Item')
    .textField('itemId', 'Item ID', 'diamond', item.itemId || itemKey)
    .textField('buyPrice', 'Buy Price (0 or -1 to disable buying)', '100', String(item.buyPrice))
    .textField('sellPrice', 'Sell Price (0 or -1 to disable selling)', '50', String(item.sellPrice))
    .textField('displayName', 'Display Name', 'Diamond', item.displayName || '')
    .textField('icon', 'Icon Path', '', item.icon || '')
    .textField('permission', 'Permission', 'ui.panel.member', item.permission || '')
    .textField('rankMultiplierOverridesStr', 'Overrides', '', overridesStr)
    .textField('dailyBuyLimit', 'Daily Buy Limit (0 = Unlimited)', '0', String(item.dailyBuyLimit ?? 0))
    .textField('dailySellLimit', 'Daily Sell Limit (0 = Unlimited)', '0', String(item.dailySellLimit ?? 0))
    .dropdown('limitScope', 'Limit Scope', ['player', 'global'], item.limitScope === 'global' ? 1 : 0)
    .dropdown('action', 'Action', ['Save', 'Delete'])
    .submitButton('Submit');

  const res = await modal.show(player);
  if (!player.isValid) {
    return;
  }
  if (!res) {
    void showShopAdminItemActionPanel(player, categoryName, subCategoryName, itemKey);
    return;
  }

  if (res.action === 'Delete') {
    shopAdminManager.removeItem(categoryName, subCategoryName, itemKey);
    player.sendMessage(`§2Item deleted: ${itemKey}`);
    returnToAdminContainer(player, categoryName, subCategoryName);
    return;
  }

  const buyPrice = parseAndNormalizeShopPrice(res.buyPrice);
  const sellPrice = parseAndNormalizeShopPrice(res.sellPrice);
  const dailyBuyLimit = parseNonNegativeSafeInt(res.dailyBuyLimit);
  const dailySellLimit = parseNonNegativeSafeInt(res.dailySellLimit);
  const limitScope: 'player' | 'global' = res.limitScope === 'global' ? 'global' : 'player';

  if (
    isNonEmptyString(res.itemId) &&
    isDefined(buyPrice) &&
    isDefined(sellPrice) &&
    isDefined(dailyBuyLimit) &&
    isDefined(dailySellLimit)
  ) {
    const rankOverrides = parseRankOverrides(res.rankMultiplierOverridesStr);
    const newItemData = {
      itemId: res.itemId,
      buyPrice,
      sellPrice,
      displayName: res.displayName,
      icon: res.icon,
      permission: res.permission,
      ...(rankOverrides ? { rankOverrides } : {}),
      ...(dailyBuyLimit > 0 ? { dailyBuyLimit } : {}),
      ...(dailySellLimit > 0 ? { dailySellLimit } : {}),
      ...(dailyBuyLimit > 0 || dailySellLimit > 0 ? { limitScope } : {}),
    };
    const out = shopAdminManager.updateShopItem(categoryName, subCategoryName, itemKey, newItemData);
    player.sendMessage(out.success ? `§2${out.message}` : `§c${out.message}`);
    returnToAdminContainer(player, categoryName, subCategoryName);
  } else {
    player.sendMessage('§4Invalid input.');
    void showEditItemFormPanel(player, categoryName, subCategoryName, itemKey);
  }
}
