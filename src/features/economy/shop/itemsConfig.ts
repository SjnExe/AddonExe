import { shopConfig } from '@features/economy/shop/config.js';
import { isDefined } from '@lib/guards.js';

export interface ItemData {
  itemId: string;
  icon?: string;
  buyPrice: number;
  sellPrice: number;
  category?: string;
  subCategory?: string;
  displayName?: string;
  enchantment?: {
    id: string;
    level: number;
  };
  rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
}

function buildMasterCatalog(): Record<string, ItemData> {
  const catalog: Record<string, ItemData> = {};

  for (const [categoryName, category] of Object.entries(shopConfig.categories)) {
    for (const [key, item] of Object.entries(category.items ?? {})) {
      catalog[key] = {
        itemId: item.itemId ?? key,
        buyPrice: item.buyPrice,
        sellPrice: item.sellPrice,
        category: categoryName,
        ...(isDefined(item.icon) ? { icon: item.icon } : {}),
        ...(isDefined(item.displayName) ? { displayName: item.displayName } : {}),
        ...(isDefined(item.enchantment) ? { enchantment: item.enchantment } : {}),
        ...(isDefined(item.rankMultiplierOverrides) ? { rankMultiplierOverrides: item.rankMultiplierOverrides } : {}),
      };
    }

    for (const [subName, subCat] of Object.entries(category.subCategories ?? {})) {
      for (const [key, item] of Object.entries(subCat.items ?? {})) {
        catalog[key] = {
          itemId: item.itemId ?? key,
          buyPrice: item.buyPrice,
          sellPrice: item.sellPrice,
          category: categoryName,
          subCategory: subName,
          ...(isDefined(item.icon) ? { icon: item.icon } : {}),
          ...(isDefined(item.displayName) ? { displayName: item.displayName } : {}),
          ...(isDefined(item.enchantment) ? { enchantment: item.enchantment } : {}),
          ...(isDefined(item.rankMultiplierOverrides) ? { rankMultiplierOverrides: item.rankMultiplierOverrides } : {}),
        };
      }
    }
  }

  return catalog;
}

export const items: Record<string, ItemData> = buildMasterCatalog();

export default items;
