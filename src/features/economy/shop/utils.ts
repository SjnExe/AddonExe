import { getShopConfig, saveShopConfig } from '@core/config/configurations.js';
import { ShopCategory, ShopItem, ShopSubCategory } from '@features/economy/shop/config.js';
import { ItemData, items } from '@features/economy/shop/itemsConfig.js';
import {
  resolveTradeItemDisplayName,
  resolveTradeItemIcon,
  resolveTradeItemMetadata,
} from '@features/economy/tradeUtils.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { MinecraftItemTypes } from '@minecraft/vanilla-data';

interface BlockFamilySpec {
  subCategoryName: string;
  legacyKey?: string;
  icon: string;
  baseBuy: number;
  baseSell: number;
  variants: { key: string; typeId: string; displayName: string }[];
}

const buildingBlockFamilies: BlockFamilySpec[] = [
  {
    subCategoryName: 'Stone',
    legacyKey: 'stone',
    icon: 'textures/blocks/stone',
    baseBuy: 10,
    baseSell: 5,
    variants: [
      { key: 'stone', typeId: MinecraftItemTypes.Stone, displayName: 'Stone' },
      { key: 'normalStoneStairs', typeId: MinecraftItemTypes.NormalStoneStairs, displayName: 'Stone Stairs' },
      { key: 'smoothStone', typeId: MinecraftItemTypes.SmoothStone, displayName: 'Smooth Stone' },
      { key: 'smoothStoneSlab', typeId: MinecraftItemTypes.SmoothStoneSlab, displayName: 'Smooth Stone Slab' },
      { key: 'stoneButton', typeId: MinecraftItemTypes.StoneButton, displayName: 'Stone Button' },
      { key: 'stonePressurePlate', typeId: MinecraftItemTypes.StonePressurePlate, displayName: 'Stone Pressure Plate' },
    ],
  },
  {
    subCategoryName: 'Cobblestone',
    legacyKey: 'cobblestone',
    icon: 'textures/blocks/cobblestone',
    baseBuy: 6,
    baseSell: 2,
    variants: [
      { key: 'cobblestone', typeId: MinecraftItemTypes.Cobblestone, displayName: 'Cobblestone' },
      { key: 'stoneStairs', typeId: MinecraftItemTypes.StoneStairs, displayName: 'Cobblestone Stairs' },
      { key: 'cobblestoneSlab', typeId: MinecraftItemTypes.CobblestoneSlab, displayName: 'Cobblestone Slab' },
      { key: 'cobblestoneWall', typeId: MinecraftItemTypes.CobblestoneWall, displayName: 'Cobblestone Wall' },
      { key: 'mossyCobblestone', typeId: MinecraftItemTypes.MossyCobblestone, displayName: 'Mossy Cobblestone' },
      {
        key: 'mossyCobblestoneStairs',
        typeId: MinecraftItemTypes.MossyCobblestoneStairs,
        displayName: 'Mossy Cobblestone Stairs',
      },
      {
        key: 'mossyCobblestoneSlab',
        typeId: MinecraftItemTypes.MossyCobblestoneSlab,
        displayName: 'Mossy Cobblestone Slab',
      },
    ],
  },
  {
    subCategoryName: 'Stone Bricks',
    legacyKey: 'stoneBricks',
    icon: 'textures/blocks/stonebrick',
    baseBuy: 12,
    baseSell: 6,
    variants: [
      { key: 'stoneBricks', typeId: MinecraftItemTypes.StoneBricks, displayName: 'Stone Bricks' },
      { key: 'stoneBrickStairs', typeId: MinecraftItemTypes.StoneBrickStairs, displayName: 'Stone Brick Stairs' },
      { key: 'stoneBrickSlab', typeId: MinecraftItemTypes.StoneBrickSlab, displayName: 'Stone Brick Slab' },
      { key: 'mossyStoneBricks', typeId: MinecraftItemTypes.MossyStoneBricks, displayName: 'Mossy Stone Bricks' },
      {
        key: 'mossyStoneBrickStairs',
        typeId: MinecraftItemTypes.MossyStoneBrickStairs,
        displayName: 'Mossy Stone Brick Stairs',
      },
      {
        key: 'mossyStoneBrickSlab',
        typeId: MinecraftItemTypes.MossyStoneBrickSlab,
        displayName: 'Mossy Stone Brick Slab',
      },
    ],
  },
  {
    subCategoryName: 'Sand & Sandstone',
    legacyKey: 'sand',
    icon: 'textures/blocks/sand',
    baseBuy: 8,
    baseSell: 3,
    variants: [
      { key: 'sand', typeId: MinecraftItemTypes.Sand, displayName: 'Sand' },
      { key: 'gravel', typeId: MinecraftItemTypes.Gravel, displayName: 'Gravel' },
      { key: 'dirt', typeId: MinecraftItemTypes.Dirt, displayName: 'Dirt' },
      { key: 'sandstone', typeId: MinecraftItemTypes.Sandstone, displayName: 'Sandstone' },
      { key: 'sandstoneStairs', typeId: MinecraftItemTypes.SandstoneStairs, displayName: 'Sandstone Stairs' },
      { key: 'sandstoneSlab', typeId: MinecraftItemTypes.SandstoneSlab, displayName: 'Sandstone Slab' },
    ],
  },
  {
    subCategoryName: 'Glass',
    legacyKey: 'glass',
    icon: 'textures/blocks/glass',
    baseBuy: 15,
    baseSell: 5,
    variants: [
      { key: 'glass', typeId: MinecraftItemTypes.Glass, displayName: 'Glass' },
      { key: 'glassPane', typeId: MinecraftItemTypes.GlassPane, displayName: 'Glass Pane' },
      { key: 'tintedGlass', typeId: MinecraftItemTypes.TintedGlass, displayName: 'Tinted Glass' },
    ],
  },
  {
    subCategoryName: 'Concrete & Terracotta',
    legacyKey: 'whiteConcrete',
    icon: 'textures/blocks/concrete_white',
    baseBuy: 20,
    baseSell: 10,
    variants: [
      { key: 'whiteConcrete', typeId: MinecraftItemTypes.WhiteConcrete, displayName: 'White Concrete' },
      { key: 'blackConcrete', typeId: MinecraftItemTypes.BlackConcrete, displayName: 'Black Concrete' },
      { key: 'redConcrete', typeId: MinecraftItemTypes.RedConcrete, displayName: 'Red Concrete' },
      { key: 'blueConcrete', typeId: MinecraftItemTypes.BlueConcrete, displayName: 'Blue Concrete' },
      { key: 'terracotta', typeId: MinecraftItemTypes.HardenedClay, displayName: 'Terracotta' },
    ],
  },
  {
    subCategoryName: 'Nether & Obsidian',
    legacyKey: 'obsidian',
    icon: 'textures/blocks/obsidian',
    baseBuy: 40,
    baseSell: 20,
    variants: [
      { key: 'obsidian', typeId: MinecraftItemTypes.Obsidian, displayName: 'Obsidian' },
      { key: 'glowstone', typeId: MinecraftItemTypes.Glowstone, displayName: 'Glowstone' },
      { key: 'netherrack', typeId: MinecraftItemTypes.Netherrack, displayName: 'Netherrack' },
      { key: 'netherBrick', typeId: MinecraftItemTypes.NetherBrick, displayName: 'Nether Bricks' },
      { key: 'netherBrickStairs', typeId: MinecraftItemTypes.NetherBrickStairs, displayName: 'Nether Brick Stairs' },
      { key: 'netherBrickSlab', typeId: MinecraftItemTypes.NetherBrickSlab, displayName: 'Nether Brick Slab' },
      { key: 'netherBrickFence', typeId: MinecraftItemTypes.NetherBrickFence, displayName: 'Nether Brick Fence' },
    ],
  },
  {
    subCategoryName: 'End & Purpur',
    legacyKey: 'purpurBlock',
    icon: 'textures/blocks/purpur_block',
    baseBuy: 15,
    baseSell: 6,
    variants: [
      { key: 'endStone', typeId: MinecraftItemTypes.EndStone, displayName: 'End Stone' },
      { key: 'endBricks', typeId: MinecraftItemTypes.EndBricks, displayName: 'End Stone Bricks' },
      { key: 'endBrickStairs', typeId: MinecraftItemTypes.EndBrickStairs, displayName: 'End Stone Brick Stairs' },
      { key: 'purpurBlock', typeId: MinecraftItemTypes.PurpurBlock, displayName: 'Purpur Block' },
      { key: 'purpurStairs', typeId: MinecraftItemTypes.PurpurStairs, displayName: 'Purpur Stairs' },
      { key: 'purpurSlab', typeId: MinecraftItemTypes.PurpurSlab, displayName: 'Purpur Slab' },
    ],
  },
];

const woodFamilies: BlockFamilySpec[] = [
  {
    subCategoryName: 'Oak Wood',
    legacyKey: 'oakLog',
    icon: 'textures/blocks/log_oak_top',
    baseBuy: 20,
    baseSell: 10,
    variants: [
      { key: 'oakLog', typeId: MinecraftItemTypes.OakLog, displayName: 'Oak Log' },
      { key: 'oakPlanks', typeId: MinecraftItemTypes.OakPlanks, displayName: 'Oak Planks' },
      { key: 'oakStairs', typeId: MinecraftItemTypes.OakStairs, displayName: 'Oak Stairs' },
      { key: 'oakSlab', typeId: MinecraftItemTypes.OakSlab, displayName: 'Oak Slab' },
      { key: 'oakFence', typeId: MinecraftItemTypes.OakFence, displayName: 'Oak Fence' },
      { key: 'oakFenceGate', typeId: MinecraftItemTypes.FenceGate, displayName: 'Oak Fence Gate' },
    ],
  },
  {
    subCategoryName: 'Spruce Wood',
    legacyKey: 'spruceLog',
    icon: 'textures/blocks/log_spruce_top',
    baseBuy: 20,
    baseSell: 10,
    variants: [
      { key: 'spruceLog', typeId: MinecraftItemTypes.SpruceLog, displayName: 'Spruce Log' },
      { key: 'sprucePlanks', typeId: MinecraftItemTypes.SprucePlanks, displayName: 'Spruce Planks' },
      { key: 'spruceStairs', typeId: MinecraftItemTypes.SpruceStairs, displayName: 'Spruce Stairs' },
      { key: 'spruceSlab', typeId: MinecraftItemTypes.SpruceSlab, displayName: 'Spruce Slab' },
      { key: 'spruceFence', typeId: MinecraftItemTypes.SpruceFence, displayName: 'Spruce Fence' },
      { key: 'spruceFenceGate', typeId: MinecraftItemTypes.SpruceFenceGate, displayName: 'Spruce Fence Gate' },
    ],
  },
  {
    subCategoryName: 'Birch Wood',
    legacyKey: 'birchLog',
    icon: 'textures/blocks/log_birch_top',
    baseBuy: 20,
    baseSell: 10,
    variants: [
      { key: 'birchLog', typeId: MinecraftItemTypes.BirchLog, displayName: 'Birch Log' },
      { key: 'birchPlanks', typeId: MinecraftItemTypes.BirchPlanks, displayName: 'Birch Planks' },
      { key: 'birchStairs', typeId: MinecraftItemTypes.BirchStairs, displayName: 'Birch Stairs' },
      { key: 'birchSlab', typeId: MinecraftItemTypes.BirchSlab, displayName: 'Birch Slab' },
    ],
  },
  {
    subCategoryName: 'Jungle, Acacia & Dark Oak',
    legacyKey: 'darkOakLog',
    icon: 'textures/blocks/log_big_oak_top',
    baseBuy: 20,
    baseSell: 10,
    variants: [
      { key: 'jungleLog', typeId: MinecraftItemTypes.JungleLog, displayName: 'Jungle Log' },
      { key: 'junglePlanks', typeId: MinecraftItemTypes.JunglePlanks, displayName: 'Jungle Planks' },
      { key: 'acaciaLog', typeId: MinecraftItemTypes.AcaciaLog, displayName: 'Acacia Log' },
      { key: 'acaciaPlanks', typeId: MinecraftItemTypes.AcaciaPlanks, displayName: 'Acacia Planks' },
      { key: 'darkOakLog', typeId: MinecraftItemTypes.DarkOakLog, displayName: 'Dark Oak Log' },
      { key: 'darkOakPlanks', typeId: MinecraftItemTypes.DarkOakPlanks, displayName: 'Dark Oak Planks' },
    ],
  },
  {
    subCategoryName: 'Mangrove, Cherry & Nether Stems',
    legacyKey: 'cherryLog',
    icon: 'textures/blocks/cherry_log_top',
    baseBuy: 25,
    baseSell: 12,
    variants: [
      { key: 'mangroveLog', typeId: MinecraftItemTypes.MangroveLog, displayName: 'Mangrove Log' },
      { key: 'cherryLog', typeId: MinecraftItemTypes.CherryLog, displayName: 'Cherry Log' },
      { key: 'crimsonStem', typeId: MinecraftItemTypes.CrimsonStem, displayName: 'Crimson Stem' },
      { key: 'warpedStem', typeId: MinecraftItemTypes.WarpedStem, displayName: 'Warped Stem' },
    ],
  },
];

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

function populateFamilyVariantsIntoShop(
  categoryName: string,
  category: ShopCategory,
  families: BlockFamilySpec[],
  legacyFlatKeysToRemove: string[],
): boolean {
  let changed = false;
  if (!isDefined(category.subCategories)) {
    category.subCategories = {};
    changed = true;
  }

  for (const family of families) {
    for (const variant of family.variants) {
      const prices = calculateVariantPricing(variant.typeId, family.baseBuy, family.baseSell);
      if (!isDefined(items[variant.key])) {
        items[variant.key] = {
          itemId: variant.typeId,
          icon: family.icon,
          buyPrice: prices.buyPrice,
          sellPrice: prices.sellPrice,
          category: categoryName,
          subCategory: family.subCategoryName,
          displayName: variant.displayName,
        };
      }
    }

    const existingSub = category.subCategories[family.subCategoryName];
    if (!isDefined(existingSub) || Object.keys(existingSub.items ?? {}).length === 0) {
      const subItems: Record<string, ShopItem> = {};
      for (const variant of family.variants) {
        const legacyPriceItem = isDefined(family.legacyKey) ? category.items?.[family.legacyKey] : undefined;
        const baseBuy = legacyPriceItem?.buyPrice ?? family.baseBuy;
        const baseSell = legacyPriceItem?.sellPrice ?? family.baseSell;
        const prices =
          variant.key === family.legacyKey
            ? { buyPrice: baseBuy, sellPrice: baseSell }
            : calculateVariantPricing(variant.typeId, baseBuy, baseSell);

        subItems[variant.key] = {
          buyPrice: prices.buyPrice,
          sellPrice: prices.sellPrice,
          permission: legacyPriceItem?.permission ?? 'ui.panel.member',
          icon: family.icon,
          displayName: variant.displayName,
          itemId: variant.typeId,
        };
      }
      category.subCategories[family.subCategoryName] = {
        icon: family.icon,
        items: subItems,
      };
      changed = true;
    }
  }

  for (const flatKey of legacyFlatKeysToRemove) {
    if (isDefined(category.items?.[flatKey])) {
      delete category.items[flatKey];
      changed = true;
    }
  }

  return changed;
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

      if (catName === 'Building Blocks') {
        const legacyBuildingKeys = [
          'stone',
          'cobblestone',
          'dirt',
          'sand',
          'gravel',
          'glass',
          'terracotta',
          'whiteConcrete',
          'stoneBricks',
          'obsidian',
          'glowstone',
          'netherrack',
          'endStone',
          'purpurBlock',
        ];
        if (populateFamilyVariantsIntoShop(catName, category, buildingBlockFamilies, legacyBuildingKeys)) {
          changed = true;
        }
      } else if (catName === 'Logs') {
        const legacyLogKeys = [
          'oakLog',
          'spruceLog',
          'birchLog',
          'jungleLog',
          'acaciaLog',
          'darkOakLog',
          'mangroveLog',
          'cherryLog',
          'crimsonStem',
          'warpedStem',
        ];
        if (populateFamilyVariantsIntoShop(catName, category, woodFamilies, legacyLogKeys)) {
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
