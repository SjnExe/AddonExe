import { SerializedItem } from '@core/data/itemSerializer.js';
import { formatCurrency, validateCurrencyAmount } from '@core/utils/economy.js';
import { generateDisplayName, isFormattedDisplayName, resolveIcon } from '@core/utils/item.js';
import { ItemData, items as masterItems } from '@features/economy/shop/itemsConfig.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface TradeItemMetadata {
  key: string;
  itemId: string;
  displayName: string;
  icon: string;
  enchantment?: { id: string; level: number };
}

function findMasterEntry(keyOrTypeId: string): ItemData | undefined {
  const direct = masterItems[keyOrTypeId];
  if (isDefined(direct)) {
    return direct;
  }
  const withPrefix = keyOrTypeId.includes(':') ? keyOrTypeId : 'minecraft:' + keyOrTypeId;
  return Object.values(masterItems).find((entry) => entry.itemId === keyOrTypeId || entry.itemId === withPrefix);
}

export function resolveCanonicalItemId(keyOrTypeId: string, explicitItemId?: string): string {
  const candidate = isNonEmptyString(explicitItemId) ? explicitItemId : keyOrTypeId;
  const master = findMasterEntry(candidate) ?? findMasterEntry(keyOrTypeId);
  if (isDefined(master) && isNonEmptyString(master.itemId)) {
    return master.itemId;
  }
  if (candidate.includes(':')) {
    return candidate;
  }
  const snake = candidate
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
  return 'minecraft:' + snake;
}

export function resolveTradeItemDisplayName(keyOrTypeId: string, customDisplayName?: string): string {
  if (isFormattedDisplayName(customDisplayName)) {
    return customDisplayName!.trim();
  }
  const master = findMasterEntry(keyOrTypeId);
  if (isDefined(master) && isFormattedDisplayName(master.displayName)) {
    return master.displayName!;
  }
  return generateDisplayName(isNonEmptyString(customDisplayName) ? customDisplayName : (master?.itemId ?? keyOrTypeId));
}

export function resolveTradeItemIcon(keyOrTypeId: string, customIcon?: string): string {
  if (isNonEmptyString(customIcon) && /^textures\//.test(customIcon)) {
    return customIcon;
  }
  const master = findMasterEntry(keyOrTypeId);
  if (isDefined(master) && isNonEmptyString(master.icon)) {
    return master.icon;
  }
  return resolveIcon(master?.itemId ?? keyOrTypeId);
}

export function resolveTradeItemMetadata(
  key: string,
  raw?: { itemId?: string; displayName?: string; icon?: string; enchantment?: { id: string; level: number } },
): TradeItemMetadata {
  const master = findMasterEntry(raw?.itemId ?? key) ?? findMasterEntry(key);
  const itemId = resolveCanonicalItemId(key, raw?.itemId);
  const displayName = resolveTradeItemDisplayName(key, raw?.displayName);
  const icon = resolveTradeItemIcon(itemId, raw?.icon ?? master?.icon);
  const enchantment = raw?.enchantment ?? master?.enchantment;

  return {
    key,
    itemId,
    displayName,
    icon,
    ...(isDefined(enchantment) ? { enchantment } : {}),
  };
}

export function formatTwoLineButton(topTitle: string, bottomDescription: string): string {
  const cleanTop = topTitle.startsWith('§') ? topTitle : `§l§f${topTitle}`;
  const cleanBottom = bottomDescription.startsWith('§') ? bottomDescription : `§7${bottomDescription}`;
  return `${cleanTop}\n§r${cleanBottom}`;
}

export function parseTradeAmount(input: string, requirePositive = true): number | undefined {
  return validateCurrencyAmount(input, requirePositive);
}

export function formatSerializedItemSummary(item: SerializedItem): { title: string; icon: string; details: string[] } {
  const title = isNonEmptyString(item.nameTag) ? item.nameTag : resolveTradeItemDisplayName(item.typeId);
  const icon = resolveTradeItemIcon(item.typeId);
  const details: string[] = [`§7Type: §f${resolveTradeItemDisplayName(item.typeId)}`, `§7Quantity: §ex${item.amount}`];

  if (isDefined(item.durability)) {
    const remaining = Math.max(0, item.durability.max - item.durability.damage);
    details.push(`§7Durability: §a${remaining}§7/§f${item.durability.max}`);
  }
  if (isDefined(item.enchantments) && item.enchantments.length > 0) {
    const enchList = item.enchantments.map((e) => `${generateDisplayName(e.id)} ${e.level}`).join(', ');
    details.push(`§7Enchantments: §d${enchList}`);
  }
  if (isDefined(item.lore) && item.lore.length > 0) {
    details.push(`§7Lore: §5${item.lore.join(' | ')}`);
  }
  if (isDefined(item.containerItems) && item.containerItems.length > 0) {
    const preview = item.containerItems
      .slice(0, 4)
      .map((entry) => `${resolveTradeItemDisplayName(entry.item.typeId)} x${entry.item.amount}`)
      .join(', ');
    const more = item.containerItems.length > 4 ? ` +${item.containerItems.length - 4} more` : '';
    details.push(`§7Contents (${item.containerItems.length} slots): §b${preview}${more}`);
  }

  return { title, icon, details };
}

export function calculateInventorySpaceForItem(inventory: mc.Container, itemStackTemplate: mc.ItemStack): number {
  let spaceFound = 0;
  const maxStackSize = itemStackTemplate.maxAmount;

  if (maxStackSize > 1) {
    for (let i = 0; i < inventory.size; i++) {
      const slotItem = inventory.getItem(i);
      if (!isDefined(slotItem)) {
        spaceFound += maxStackSize;
      } else if (slotItem.isStackableWith(itemStackTemplate)) {
        spaceFound += Math.max(0, maxStackSize - slotItem.amount);
      }
    }
  } else {
    spaceFound = inventory.emptySlotsCount;
  }

  return spaceFound;
}

export function countMatchingInventoryItems(inventory: mc.Container, matcher: (item: mc.ItemStack) => boolean): number {
  let total = 0;
  for (let i = 0; i < inventory.size; i++) {
    const item = inventory.getItem(i);
    if (isDefined(item) && matcher(item)) {
      total += item.amount;
    }
  }
  return total;
}

export function formatShopPriceSubtitle(buyPrice: number, sellPrice: number): string {
  const parts: string[] = [];
  if (buyPrice > 0) {
    parts.push(`§2B:${formatCurrency(buyPrice)}`);
  }
  if (sellPrice > 0) {
    parts.push(`§cS:${formatCurrency(sellPrice)}`);
  }
  return parts.length > 0 ? parts.join(' ') : '§cNot For Sale';
}
