import { getShopConfig, saveShopConfig } from '@core/config/configurations.js';
import { ShopItem, ShopSubCategory } from '@features/economy/shop/config.js';
import { ItemData, items } from '@features/economy/shop/itemsConfig.js';
import {
  resolveTradeItemDisplayName,
  resolveTradeItemIcon,
  resolveTradeItemMetadata,
} from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const unobtainableShortIds = new Set<string>([
  'air',
  'allow',
  'barrier',
  'bedrock',
  'border_block',
  'budding_amethyst',
  'chain_command_block',
  'chorus_plant',
  'client_request_placeholder_block',
  'command_block',
  'command_block_minecart',
  'deny',
  'end_gateway',
  'end_portal',
  'end_portal_frame',
  'farmland',
  'fire',
  'flowing_lava',
  'flowing_water',
  'frosted_ice',
  'glowingobsidian',
  'info_update',
  'info_update2',
  'invisible_bedrock',
  'jigsaw',
  'lava',
  'light_block',
  'mob_spawner',
  'monster_egg',
  'moving_block',
  'netherreactor',
  'portal',
  'reinforced_deepslate',
  'repeating_command_block',
  'reserved6',
  'soul_fire',
  'spawner',
  'structure_block',
  'structure_void',
  'trial_spawner',
  'unknown',
  'vault',
  'water',
]);

const unobtainableSubstrings = [
  '_double_slab',
  'double_stone_block_slab',
  '_standing_sign',
  '_wall_sign',
  '_hanging_sign',
  'wall_banner',
  'standing_banner',
  'infested_',
  'lit_',
  'unpowered_',
  'powered_',
  'piston_arm',
  'sticky_piston_arm',
  'chemical_',
  'element_',
  'chemistry_',
  'colored_torch',
  'underwater_torch',
  'hard_glass',
  'camera',
  'chalkboard',
  'compound',
  'ice_bomb',
  'medicine',
  'rapid_fertilizer',
  'sparkler',
  'bleach',
  'balloon',
  'glow_stick',
  'debug_stick',
  'spawn_egg',
  '_request_placeholder',
  '_candle_cake',
];

export function calculateVariantPricing(
  itemId: string,
  baseBuyPrice: number,
  baseSellPrice: number,
): { buyPrice: number; sellPrice: number } {
  const shortId = itemId.replace(/^minecraft:/, '').toLowerCase();
  let multiplier = 1;

  if (shortId.endsWith('_slab')) {
    multiplier = 0.5;
  } else if (shortId.endsWith('_planks')) {
    multiplier = 0.25;
  } else if (shortId.endsWith('_carpet')) {
    multiplier = 0.67;
  } else if (shortId.endsWith('_glass_pane') || shortId.endsWith('glass_pane')) {
    multiplier = 0.38;
  } else if (shortId.endsWith('_button') || shortId.endsWith('_pressure_plate')) {
    multiplier = 0.5;
  } else if (shortId.endsWith('_door') || shortId.endsWith('_trapdoor') || shortId.endsWith('_stairs')) {
    multiplier = 1.25;
  }

  const buyPrice = Math.max(1, Math.round(baseBuyPrice * multiplier * 100) / 100);
  const sellPrice = Math.max(0.25, Math.round(baseSellPrice * multiplier * 100) / 100);
  return { buyPrice, sellPrice };
}

function hydrateItemMap(itemMap: Record<string, ShopItem>): boolean {
  let modified = false;
  for (const [itemKey, itemVal] of Object.entries(itemMap)) {
    if (!isDefined(itemVal)) {
      continue;
    }
    const meta = resolveTradeItemMetadata(itemKey, itemVal);
    if (itemVal.displayName !== meta.displayName) {
      itemVal.displayName = meta.displayName;
      modified = true;
    }
    if (itemVal.icon !== meta.icon) {
      itemVal.icon = meta.icon;
      modified = true;
    }
    if (!isNonEmptyString(itemVal.itemId)) {
      itemVal.itemId = meta.itemId;
      modified = true;
    }
  }
  return modified;
}

let isShopHydrated = false;

export function invalidateShopHydration(): void {
  isShopHydrated = false;
}

/**
 * Ensures shop entries have resolved metadata (displayName, icon, itemId) without mutating category structure.
 *
 * @returns Master item catalog.
 */
export async function ensureItemsConfig(): Promise<Record<string, ItemData>> {
  if (isShopHydrated) {
    return items;
  }
  await Promise.resolve();
  try {
    const shopCfg = getShopConfig();
    if (!isDefined(shopCfg) || !isDefined(shopCfg.categories)) {
      return items;
    }

    let changed = false;

    for (const [catName, category] of Object.entries(shopCfg.categories)) {
      if (!isDefined(category)) {
        continue;
      }
      if (!isDefined(category.items)) {
        category.items = {};
        changed = true;
      }
      if (!isDefined(category.subCategories)) {
        category.subCategories = {};
        changed = true;
      }
      if (!isNonEmptyString(category.icon)) {
        category.icon = resolveTradeItemIcon(catName);
        changed = true;
      }

      // Rescue any subcategory accidentally nested inside category.items
      for (const [entryKey, entryVal] of Object.entries(category.items)) {
        const candidate = entryVal as unknown as Partial<ShopSubCategory> & Partial<ShopItem>;
        if (
          isDefined(candidate) &&
          typeof candidate === 'object' &&
          isDefined(candidate.items) &&
          typeof candidate.items === 'object' &&
          !('buyPrice' in candidate)
        ) {
          category.subCategories[entryKey] = {
            icon: isNonEmptyString(candidate.icon) ? candidate.icon : resolveTradeItemIcon(entryKey),
            items: candidate.items,
          };
          delete category.items[entryKey];
          changed = true;
        }
      }

      if (hydrateItemMap(category.items)) {
        changed = true;
      }

      for (const [subName, subCat] of Object.entries(category.subCategories)) {
        if (!isDefined(subCat)) {
          continue;
        }
        if (!isDefined(subCat.items)) {
          subCat.items = {};
          changed = true;
        }
        if (!isNonEmptyString(subCat.icon)) {
          const firstSubItemKey = Object.keys(subCat.items)[0];
          subCat.icon = resolveTradeItemIcon(firstSubItemKey ?? subName);
          changed = true;
        }
        if (hydrateItemMap(subCat.items)) {
          changed = true;
        }
      }
    }

    isShopHydrated = true;
    if (changed) {
      saveShopConfig(shopCfg);
    }
  } catch {
    // Ignore if config manager is not initialized in isolated unit test
  }
  return items;
}

export function getAllItems(): Record<string, ItemData> {
  return items;
}

export function parseRankOverrides(overridesStr?: string): Record<string, { buy: number; sell: number }> | undefined {
  if (!isNonEmptyString(overridesStr) || !isNonEmptyString(overridesStr.trim())) {
    return undefined;
  }

  const result: Record<string, { buy: number; sell: number }> = {};
  const trimmed = overridesStr.trim();
  const rawEntries = trimmed.includes('=') ? trimmed.split(/[;\n]+/) : trimmed.split(/[;,\n]+/);

  for (const rawEntry of rawEntries) {
    const entry = rawEntry.trim();
    if (!isNonEmptyString(entry)) {
      continue;
    }

    let rankId = '';
    let buyStr = '';
    let sellStr = '';

    if (entry.includes('=')) {
      const [rPart, vPart] = entry.split('=');
      if (!isNonEmptyString(rPart) || !isNonEmptyString(vPart)) {
        continue;
      }
      rankId = rPart.trim();
      const parts = vPart.split(/[,:]/);
      buyStr = (parts[0] ?? '').trim();
      sellStr = (parts[1] ?? '').trim();
    } else if (entry.includes(':')) {
      const parts = entry.split(':').map((s) => s.trim());
      rankId = parts[0] ?? '';
      if (parts.length >= 3) {
        buyStr = parts[1] ?? '';
        sellStr = parts[2] ?? '';
      } else if (isNonEmptyString(parts[1])) {
        const sub = parts[1].split(',');
        buyStr = (sub[0] ?? '').trim();
        sellStr = (sub[1] ?? '').trim();
      }
    }

    if (!isNonEmptyString(rankId) || !isNonEmptyString(buyStr) || !isNonEmptyString(sellStr)) {
      continue;
    }

    const buy = Number.parseFloat(buyStr);
    const sell = Number.parseFloat(sellStr);
    if (!Number.isNaN(buy) && !Number.isNaN(sell)) {
      result[rankId] = { buy, sell };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function isSurvivalObtainableItem(itemId: string): boolean {
  if (!isNonEmptyString(itemId)) {
    return false;
  }
  const shortId = itemId
    .trim()
    .toLowerCase()
    .replace(/^minecraft:/, '');
  if (unobtainableShortIds.has(shortId)) {
    return false;
  }
  for (const pattern of unobtainableSubstrings) {
    if (shortId.includes(pattern)) {
      return false;
    }
  }
  return true;
}

export function formatItemName(itemId: string): string {
  return resolveTradeItemDisplayName(itemId);
}

export function resolveTexturePath(itemId: string): string {
  return resolveTradeItemIcon(itemId);
}

let cachedValidItems: string[] | null = null;

export function getAllValidItems(): string[] {
  if (cachedValidItems !== null) {
    return cachedValidItems;
  }

  try {
    const itemTypes = mc.ItemTypes.getAll();
    if (itemTypes && itemTypes.length > 0) {
      cachedValidItems = itemTypes
        .map((t) => t.id)
        .filter((id) => isSurvivalObtainableItem(id))
        .toSorted();
      return cachedValidItems;
    }
  } catch {
    // Return empty in mock test environment
  }

  cachedValidItems = [];
  return cachedValidItems;
}
