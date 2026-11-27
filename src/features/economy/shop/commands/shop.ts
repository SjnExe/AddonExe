import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { hasPermission } from '@core/permissions/permissionEngine.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { showPanel } from '@core/ui/uiManager.js';
import { shopDisabled } from '@core/utils/constants.js';
import { formatCurrency, parseCurrency } from '@core/utils/index.js';
import * as shopAdminManager from '@features/economy/shop/adminManager.js';
import * as shopManager from '@features/economy/shop/manager.js';
import {
  type ShopViewMode,
  showShopSearchResultsPanel,
  showShopSellInventoryPanel,
} from '@features/economy/shop/ui/userPanel.js';
import { ensureItemsConfig } from '@features/economy/shop/utils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { EntityComponentTypes } from '@minecraft/server';
import * as mc from '@minecraft/server';
import { showConfirmationDialog } from '@ui/components.js';

const tryOpenHandItemPanel = async (player: mc.Player, mode: ShopViewMode = 'shop'): Promise<boolean> => {
  const equipment = player.getComponent(EntityComponentTypes.Equippable);
  if (!isDefined(equipment)) {
    return false;
  }

  const item = equipment.getEquipment(mc.EquipmentSlot.Mainhand);
  if (!isDefined(item)) {
    return false;
  }

  const match = shopManager.findShopItemByTypeId(item.typeId, player, mode === 'sell' ? 'sell' : undefined);
  if (isDefined(match)) {
    if (isNonEmptyString(match.shopItem.permission) && !hasPermission(player, match.shopItem.permission)) {
      return false;
    }
    await showPanel(player, 'shopBuyOrSellPanel', {
      itemKey: match.itemKey,
      itemData: match.shopItem,
      returnCtx: { returnTo: 'main', page: 1, mode },
    });
    return true;
  }
  return false;
};

function parsePositiveInt(raw: string): number | undefined {
  if (!/^\d+$/.test(raw)) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const shopCommand: CustomCommand = {
  name: 'shop',
  description: 'Opens the server shop or searches for an item.',
  category: 'Economy',
  permissionNode: 'cmd.shop.member',
  allowConsole: false,
  parameters: [{ name: 'query', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { query?: string } = {}) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco.shop')) {
      return executor.sendMessage(shopDisabled);
    }

    const query = args.query?.trim();
    if (isNonEmptyString(query)) {
      await ensureItemsConfig();
      if (!executor.isValid) {
        return;
      }
      const exact = shopManager.findBestShopMatchByQuery(query, executor, 'all');
      if (isDefined(exact)) {
        await showPanel(executor, 'shopBuyOrSellPanel', {
          itemKey: exact.itemKey,
          itemData: exact.shopItem,
          returnCtx: { returnTo: 'main', page: 1, mode: 'shop' },
        });
        return;
      }
      await showShopSearchResultsPanel(executor, query, 1, 'shop');
      return;
    }

    await showPanel(executor, 'shopMainPanel', { view: 'shop' });
  },
};

const buyCommand: CustomCommand = {
  name: 'buy',
  description: 'Buys an item directly or opens the shop buy view.',
  category: 'Economy',
  permissionNode: 'cmd.buy.member',
  allowConsole: false,
  parameters: [
    { name: 'item', type: 'string', optional: true },
    { name: 'amount', type: 'string', optional: true },
  ],
  execute: async (executor: CommandExecutor, args: { item?: string; amount?: string } = {}) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco.shop')) {
      return executor.sendMessage(shopDisabled);
    }

    const itemQuery = args.item?.trim();
    const amountRaw = args.amount?.trim();

    if (isNonEmptyString(itemQuery)) {
      await ensureItemsConfig();
      if (!executor.isValid) {
        return;
      }
      const match = shopManager.findBestShopMatchByQuery(itemQuery, executor, 'buy');
      if (isDefined(match)) {
        if (isNonEmptyString(amountRaw)) {
          const parsedAmount = amountRaw.toLowerCase() === 'max' ? -1 : parsePositiveInt(amountRaw);
          if (!isDefined(parsedAmount)) {
            executor.sendMessage('§cAmount must be a positive integer or "max".');
            return;
          }
          const result = shopManager.buyItem(executor, match.itemKey, parsedAmount);
          executor.sendMessage(result.message);
          return;
        }
        await showPanel(executor, 'shopBuyOrSellPanel', {
          itemKey: match.itemKey,
          itemData: match.shopItem,
          returnCtx: { returnTo: 'main', page: 1, mode: 'buy' },
        });
        return;
      }
      await showShopSearchResultsPanel(executor, itemQuery, 1, 'buy');
      return;
    }

    const opened = await tryOpenHandItemPanel(executor, 'buy');
    if (!opened) {
      await showPanel(executor, 'shopMainPanel', { view: 'buy' });
    }
  },
};

const sellCommand: CustomCommand = {
  name: 'sell',
  description: 'Sells held items or opens your sellable inventory.',
  category: 'Economy',
  permissionNode: 'cmd.sell.member',
  allowConsole: false,
  parameters: [{ name: 'target', type: 'string', optional: true }],
  execute: async (executor: CommandExecutor, args: { target?: string } = {}) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco.shop')) {
      return executor.sendMessage(shopDisabled);
    }

    const target = args.target?.trim().toLowerCase();
    if (isNonEmptyString(target)) {
      if (target === 'all') {
        await sellAllCommand.execute(executor, {});
        return;
      }
      if (target === 'hand') {
        await sellHandCommand.execute(executor, {});
        return;
      }
      const parsedQty = parsePositiveInt(target);
      if (isDefined(parsedQty)) {
        await sellHandCommand.execute(executor, { amount: String(parsedQty) });
        return;
      }
      executor.sendMessage('§cUsage: /sell [hand|all|<amount>]');
      return;
    }

    const opened = await tryOpenHandItemPanel(executor, 'sell');
    if (!opened) {
      await showShopSellInventoryPanel(executor, 1);
    }
  },
};

const sellHandCommand: CustomCommand = {
  name: 'sellhand',
  aliases: ['sh'],
  description: 'Quickly sells the item in your main hand.',
  category: 'Economy',
  permissionNode: 'cmd.sell.member',
  allowConsole: false,
  parameters: [{ name: 'amount', type: 'string', optional: true }],
  execute: (executor: CommandExecutor, args: { amount?: string } = {}) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco.shop')) {
      executor.sendMessage(shopDisabled);
      return;
    }

    const equipment = executor.getComponent(EntityComponentTypes.Equippable);
    const heldItem = equipment?.getEquipment(mc.EquipmentSlot.Mainhand);
    if (!isDefined(heldItem)) {
      executor.sendMessage('§cYou are not holding an item in your main hand.');
      return;
    }

    const match = shopManager.findShopItemByTypeId(heldItem.typeId, executor, 'sell');
    if (!isDefined(match)) {
      executor.sendMessage('§cThe item in your hand cannot be sold to the shop.');
      return;
    }
    if (isNonEmptyString(match.shopItem.permission) && !hasPermission(executor, match.shopItem.permission)) {
      executor.sendMessage('§cYou do not have permission to sell this item.');
      return;
    }
    if (!shopManager.isValidSellItem(heldItem, match.shopItem)) {
      executor.sendMessage('§cThe held item cannot be sold (must be undamaged, unenchanted, and empty).');
      return;
    }

    let quantity = heldItem.amount;
    const rawAmount = args.amount?.trim().toLowerCase();
    if (isNonEmptyString(rawAmount)) {
      if (rawAmount === 'all' || rawAmount === 'max') {
        quantity = -1;
      } else {
        const parsed = parsePositiveInt(rawAmount);
        if (!isDefined(parsed)) {
          executor.sendMessage('§cAmount must be a positive integer or "all".');
          return;
        }
        quantity = parsed;
      }
    } else if (heldItem.maxAmount <= 1) {
      quantity = 1;
    }

    const result = shopManager.sellItem(executor, match.itemKey, quantity);
    executor.sendMessage(result.message);
  },
};

const shopEditCommand: CustomCommand = {
  name: 'shopedit',
  description: 'Opens the shop management panel.',
  category: 'Economy',
  aliases: ['editshop'],
  permissionNode: 'cmd.shopedit.admin',
  allowConsole: false,
  execute: async (executor: CommandExecutor) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco.shop')) {
      return executor.sendMessage(shopDisabled);
    }
    const { showShopManagementPanel } = await import('@features/economy/shop/ui/adminPanel.js');
    await showShopManagementPanel(executor, 1);
  },
};

interface AddShopCommandArgs {
  category: string;
  buyPrice: string;
  sellPrice: string;
  subCategory?: string;
  dailyBuyLimit?: number;
  dailySellLimit?: number;
}

const addShopCommand: CustomCommand = {
  name: 'addshop',
  description: 'Adds the item in your hand to a shop category (-1 disables buy or sell).',
  category: 'Economy',
  permissionNode: 'cmd.addshop.admin',
  allowConsole: false,
  parameters: [
    { name: 'category', type: 'string' },
    { name: 'buyPrice', type: 'string' },
    { name: 'sellPrice', type: 'string' },
    { name: 'subCategory', type: 'string', optional: true },
    { name: 'dailyBuyLimit', type: 'int', optional: true },
    { name: 'dailySellLimit', type: 'int', optional: true },
  ],
  execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
    if (!(executor instanceof mc.Player) || !isDefined(args)) {
      return;
    }

    if (!isFeatureActive('eco.shop')) {
      return executor.sendMessage(shopDisabled);
    }

    const {
      category,
      buyPrice: buyPriceStr,
      sellPrice: sellPriceStr,
      subCategory,
      dailyBuyLimit,
      dailySellLimit,
    } = args as unknown as AddShopCommandArgs;

    if (!isNonEmptyString(buyPriceStr) || !isNonEmptyString(sellPriceStr)) {
      return executor.sendMessage('§cPlease specify buy and sell prices (-1 to disable).');
    }

    const buyPrice = buyPriceStr.trim() === '-1' ? -1 : parseCurrency(buyPriceStr);
    const sellPrice = sellPriceStr.trim() === '-1' ? -1 : parseCurrency(sellPriceStr);

    if (
      Number.isNaN(buyPrice) ||
      (buyPrice < 0 && buyPrice !== -1) ||
      Number.isNaN(sellPrice) ||
      (sellPrice < 0 && sellPrice !== -1)
    ) {
      return executor.sendMessage('§cInvalid prices. Enter non-negative numbers, or -1 to disable.');
    }

    if (
      (buyPrice >= 0 && Math.abs(buyPrice - Number.parseFloat(buyPrice.toFixed(2))) > 0.001) ||
      (sellPrice >= 0 && Math.abs(sellPrice - Number.parseFloat(sellPrice.toFixed(2))) > 0.001)
    ) {
      return executor.sendMessage('§cInvalid precision. Prices can only have up to 2 decimal places (e.g. 10.55).');
    }

    const equipment = executor.getComponent(EntityComponentTypes.Equippable);
    if (!isDefined(equipment)) {
      return executor.sendMessage('§cCould not access your inventory.');
    }
    const item = equipment.getEquipment(mc.EquipmentSlot.Mainhand);

    if (!isDefined(item)) {
      return executor.sendMessage("§cYou aren't holding anything.");
    }

    const result = shopAdminManager.addShopItemFromHand(
      item,
      category,
      isNonEmptyString(subCategory) ? subCategory : undefined,
      buyPrice,
      sellPrice,
    );

    if (result.success && result.itemId && ((dailyBuyLimit ?? 0) > 0 || (dailySellLimit ?? 0) > 0)) {
      shopAdminManager.quickUpdateItemPrices(
        category,
        isNonEmptyString(subCategory) ? subCategory : undefined,
        result.itemId,
        buyPrice,
        sellPrice,
        Math.max(0, dailyBuyLimit ?? 0),
        Math.max(0, dailySellLimit ?? 0),
      );
    }

    executor.sendMessage(result.message);

    if (result.success) {
      executor.sendMessage(`§aItem ID: ${result.itemId} — edit anytime with /shopedit`);
    }
  },
};

interface PendingSellAllQuote {
  expiresAt: number;
  totalItems: number;
  totalPayout: number;
  breakdown: { itemKey: string; count: number }[];
}

const pendingSellAllConfirmations = new Map<string, PendingSellAllQuote>();

const sellAllCommand: CustomCommand = {
  name: 'sellall',
  aliases: ['sa'],
  description: 'Sells all sellable shop items in your inventory (with confirmation).',
  category: 'Economy',
  permissionNode: 'cmd.sell.member',
  allowConsole: false,
  parameters: [
    {
      name: 'action',
      type: 'string',
      optional: true,
      enumOptions: ['confirm'],
    },
  ],
  execute: async (executor: CommandExecutor, args: { action?: string } = {}) => {
    if (!(executor instanceof mc.Player)) {
      return;
    }
    if (!isFeatureActive('eco.shop')) {
      executor.sendMessage(shopDisabled);
      return;
    }

    const preview = shopManager.previewSellAllInventory(executor);
    if (preview.overflowed) {
      executor.sendMessage('§cSale payout exceeds supported numeric limits.');
      return;
    }
    if (preview.totalItems === 0) {
      executor.sendMessage('§cYou have no sellable shop items in your inventory.');
      return;
    }

    const now = Date.now();
    for (const [id, entry] of pendingSellAllConfirmations.entries()) {
      if (entry.expiresAt <= now) {
        pendingSellAllConfirmations.delete(id);
      }
    }

    if (args.action?.toLowerCase() === 'confirm') {
      const pending = pendingSellAllConfirmations.get(executor.id);
      pendingSellAllConfirmations.delete(executor.id);
      if (!isDefined(pending) || pending.expiresAt <= now) {
        executor.sendMessage(
          '§cYour /sellall confirmation expired or was not found. Run /sellall again to get a fresh quote.',
        );
        return;
      }
      const expectedQuote = {
        totalItems: pending.totalItems,
        totalPayout: pending.totalPayout,
        breakdown: pending.breakdown,
      };
      const result = shopManager.executeSellAllInventory(executor, expectedQuote);
      if (result.quoteChanged && result.updatedPreview) {
        pendingSellAllConfirmations.set(executor.id, {
          expiresAt: Date.now() + 30_000,
          totalItems: result.updatedPreview.totalItems,
          totalPayout: result.updatedPreview.totalPayout,
          breakdown: result.updatedPreview.breakdown,
        });
      }
      executor.sendMessage(result.message);
      return;
    }

    const pendingEntry: PendingSellAllQuote = {
      expiresAt: Date.now() + 30_000,
      totalItems: preview.totalItems,
      totalPayout: preview.totalPayout,
      breakdown: preview.breakdown,
    };
    pendingSellAllConfirmations.set(executor.id, pendingEntry);
    const topLines = preview.breakdown
      .slice(0, 8)
      .map((b) => `§7- §f${b.displayName} §ex${b.count} §7(§a${formatCurrency(b.payout)}§7)`)
      .join('\n');
    const extraLine = preview.breakdown.length > 8 ? `\n§8...and ${preview.breakdown.length - 8} more item types` : '';

    executor.sendMessage(
      `§e[Shop] Ready to sell §f${preview.totalItems}§e items for §a${formatCurrency(preview.totalPayout)}§e. Confirm in the popup or type §a/sellall confirm§e within 30s.`,
    );

    await showConfirmationDialog(executor, {
      title: 'Confirm Sell All',
      body: `Sell §e${preview.totalItems}§f items (§b${preview.distinctTypes}§f types) for §a${formatCurrency(preview.totalPayout)}§f?\n\n${topLines}${extraLine}`,
      confirmButtonText: `§2Sell All (${formatCurrency(preview.totalPayout)})`,
      cancelButtonText: '§cCancel',
      onConfirm: () => {
        const currentPending = pendingSellAllConfirmations.get(executor.id);
        if (currentPending !== pendingEntry) {
          if (executor.isValid) {
            executor.sendMessage('§cSell All preview expired or was superseded. Please run /sellall again.');
          }
          return;
        }
        pendingSellAllConfirmations.delete(executor.id);
        if (!executor.isValid) {
          return;
        }
        if (pendingEntry.expiresAt <= Date.now()) {
          executor.sendMessage('§cSell All preview expired. Please run /sellall again.');
          return;
        }
        const res = shopManager.executeSellAllInventory(executor, {
          totalItems: pendingEntry.totalItems,
          totalPayout: pendingEntry.totalPayout,
          breakdown: pendingEntry.breakdown,
        });
        executor.sendMessage(res.message);
      },
      onCancel: () => {
        if (pendingSellAllConfirmations.get(executor.id) === pendingEntry) {
          pendingSellAllConfirmations.delete(executor.id);
        }
        if (!executor.isValid) {
          return;
        }
        executor.sendMessage('§eSell All cancelled.');
      },
    });
  },
};

export default [shopCommand, buyCommand, sellCommand, sellHandCommand, sellAllCommand, shopEditCommand, addShopCommand];
