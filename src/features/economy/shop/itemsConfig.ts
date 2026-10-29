import { MinecraftEnchantmentTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

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

const eBook = (buyPrice: number, displayName: string, id: string, level: number): ItemData => ({
  itemId: MinecraftItemTypes.EnchantedBook,
  buyPrice,
  sellPrice: -1,
  displayName,
  enchantment: { id, level },
});

export const items: Record<string, ItemData> = {
  // Ores & Minerals
  diamond: { itemId: MinecraftItemTypes.Diamond, buyPrice: 1000, sellPrice: 500 },
  emerald: { itemId: MinecraftItemTypes.Emerald, buyPrice: 800, sellPrice: 400 },
  goldIngot: { itemId: MinecraftItemTypes.GoldIngot, buyPrice: 100, sellPrice: 50 },
  ironIngot: { itemId: MinecraftItemTypes.IronIngot, buyPrice: 50, sellPrice: 25 },
  netheriteIngot: { itemId: MinecraftItemTypes.NetheriteIngot, buyPrice: 10_000, sellPrice: 5000 },
  netheriteScrap: { itemId: MinecraftItemTypes.NetheriteScrap, buyPrice: 2000, sellPrice: 1000 },
  ancientDebris: { itemId: MinecraftItemTypes.AncientDebris, buyPrice: 1800, sellPrice: 900 },
  lapisLazuli: { itemId: MinecraftItemTypes.LapisLazuli, buyPrice: 20, sellPrice: 10 },
  quartz: { itemId: MinecraftItemTypes.Quartz, buyPrice: 30, sellPrice: 15 },

  // Special Items
  totemOfUndying: { itemId: MinecraftItemTypes.TotemOfUndying, buyPrice: 5000, sellPrice: 2500 },
  netherStar: { itemId: MinecraftItemTypes.NetherStar, buyPrice: 20_000, sellPrice: -1 },
  shulkerShell: { itemId: MinecraftItemTypes.ShulkerShell, buyPrice: 750, sellPrice: 300 },
  elytra: { itemId: MinecraftItemTypes.Elytra, buyPrice: 15_000, sellPrice: -1 },
  witherSkeletonSkull: { itemId: MinecraftItemTypes.WitherSkeletonSkull, buyPrice: 8000, sellPrice: 2000 },
  enchantedGoldenApple: { itemId: MinecraftItemTypes.EnchantedGoldenApple, buyPrice: 25_000, sellPrice: -1 },

  // Tools & Weapons
  diamondSword: { itemId: MinecraftItemTypes.DiamondSword, buyPrice: 2500, sellPrice: 1000 },
  diamondPickaxe: { itemId: MinecraftItemTypes.DiamondPickaxe, buyPrice: 3500, sellPrice: 1200 },
  diamondAxe: { itemId: MinecraftItemTypes.DiamondAxe, buyPrice: 3500, sellPrice: 1200 },
  diamondShovel: { itemId: MinecraftItemTypes.DiamondShovel, buyPrice: 1500, sellPrice: 600 },
  diamondHoe: { itemId: MinecraftItemTypes.DiamondHoe, buyPrice: 2500, sellPrice: 1000 },
  netheriteSword: { itemId: MinecraftItemTypes.NetheriteSword, buyPrice: 15_000, sellPrice: 7500 },
  netheritePickaxe: { itemId: MinecraftItemTypes.NetheritePickaxe, buyPrice: 18_000, sellPrice: 8000 },

  // Armor
  diamondHelmet: { itemId: MinecraftItemTypes.DiamondHelmet, buyPrice: 5000, sellPrice: 2000 },
  diamondChestplate: { itemId: MinecraftItemTypes.DiamondChestplate, buyPrice: 8000, sellPrice: 3500 },
  diamondLeggings: { itemId: MinecraftItemTypes.DiamondLeggings, buyPrice: 7000, sellPrice: 3000 },
  diamondBoots: { itemId: MinecraftItemTypes.DiamondBoots, buyPrice: 4000, sellPrice: 1800 },
  netheriteHelmet: { itemId: MinecraftItemTypes.NetheriteHelmet, buyPrice: 20_000, sellPrice: 10_000 },
  netheriteChestplate: { itemId: MinecraftItemTypes.NetheriteChestplate, buyPrice: 30_000, sellPrice: 15_000 },
  netheriteLeggings: { itemId: MinecraftItemTypes.NetheriteLeggings, buyPrice: 25_000, sellPrice: 12_000 },
  netheriteBoots: { itemId: MinecraftItemTypes.NetheriteBoots, buyPrice: 18_000, sellPrice: 9000 },

  // Logs
  oakLog: { itemId: MinecraftItemTypes.OakLog, buyPrice: 20, sellPrice: 10 },
  spruceLog: { itemId: MinecraftItemTypes.SpruceLog, buyPrice: 20, sellPrice: 10 },
  birchLog: { itemId: MinecraftItemTypes.BirchLog, buyPrice: 20, sellPrice: 10 },
  jungleLog: { itemId: MinecraftItemTypes.JungleLog, buyPrice: 20, sellPrice: 10 },
  acaciaLog: { itemId: MinecraftItemTypes.AcaciaLog, buyPrice: 20, sellPrice: 10 },
  darkOakLog: { itemId: MinecraftItemTypes.DarkOakLog, buyPrice: 20, sellPrice: 10 },
  mangroveLog: { itemId: MinecraftItemTypes.MangroveLog, buyPrice: 20, sellPrice: 10 },
  cherryLog: { itemId: MinecraftItemTypes.CherryLog, buyPrice: 20, sellPrice: 10 },
  crimsonStem: { itemId: MinecraftItemTypes.CrimsonStem, buyPrice: 25, sellPrice: 12 },
  warpedStem: { itemId: MinecraftItemTypes.WarpedStem, buyPrice: 25, sellPrice: 12 },

  // Building Blocks
  stone: { itemId: MinecraftItemTypes.Stone, buyPrice: 10, sellPrice: 5 },
  cobblestone: { itemId: MinecraftItemTypes.Cobblestone, buyPrice: 5, sellPrice: 1 },
  dirt: { itemId: MinecraftItemTypes.Dirt, buyPrice: 2, sellPrice: 1 },
  sand: { itemId: MinecraftItemTypes.Sand, buyPrice: 5, sellPrice: 2 },
  gravel: { itemId: MinecraftItemTypes.Gravel, buyPrice: 5, sellPrice: 2 },
  glass: { itemId: MinecraftItemTypes.Glass, buyPrice: 15, sellPrice: 5 },
  terracotta: { itemId: MinecraftItemTypes.HardenedClay, buyPrice: 10, sellPrice: 5, displayName: 'Terracotta' },
  whiteConcrete: { itemId: MinecraftItemTypes.WhiteConcrete, buyPrice: 20, sellPrice: 10 },
  stoneBricks: { itemId: MinecraftItemTypes.StoneBricks, buyPrice: 12, sellPrice: 6 },
  obsidian: { itemId: MinecraftItemTypes.Obsidian, buyPrice: 100, sellPrice: 50 },
  glowstone: { itemId: MinecraftItemTypes.Glowstone, buyPrice: 80, sellPrice: 40 },
  netherrack: { itemId: MinecraftItemTypes.Netherrack, buyPrice: 5, sellPrice: 1 },
  endStone: { itemId: MinecraftItemTypes.EndStone, buyPrice: 10, sellPrice: 2 },
  purpurBlock: { itemId: MinecraftItemTypes.PurpurBlock, buyPrice: 15, sellPrice: 5 },

  // Food
  steak: { itemId: MinecraftItemTypes.CookedBeef, buyPrice: 20, sellPrice: 10, displayName: 'Steak' },
  cookedPorkchop: { itemId: MinecraftItemTypes.CookedPorkchop, buyPrice: 20, sellPrice: 10 },
  bread: { itemId: MinecraftItemTypes.Bread, buyPrice: 15, sellPrice: 5 },
  goldenCarrot: { itemId: MinecraftItemTypes.GoldenCarrot, buyPrice: 100, sellPrice: 40 },
  cookedSalmon: { itemId: MinecraftItemTypes.CookedSalmon, buyPrice: 20, sellPrice: 10 },
  cookedCod: { itemId: MinecraftItemTypes.CookedCod, buyPrice: 20, sellPrice: 10 },
  chorusFruit: { itemId: MinecraftItemTypes.ChorusFruit, buyPrice: 50, sellPrice: 25 },

  // Farming
  wheat: { itemId: MinecraftItemTypes.Wheat, buyPrice: 5, sellPrice: 2 },
  carrot: { itemId: MinecraftItemTypes.Carrot, buyPrice: 5, sellPrice: 2 },
  potato: { itemId: MinecraftItemTypes.Potato, buyPrice: 5, sellPrice: 2 },
  melonSlice: { itemId: MinecraftItemTypes.MelonSlice, buyPrice: 3, sellPrice: 1 },
  pumpkin: { itemId: MinecraftItemTypes.Pumpkin, buyPrice: 10, sellPrice: 5 },
  sugarCane: { itemId: MinecraftItemTypes.SugarCane, buyPrice: 8, sellPrice: 4 },
  netherWart: { itemId: MinecraftItemTypes.NetherWart, buyPrice: 25, sellPrice: 10 },

  // Enchantment Books
  enchantMending: eBook(8000, 'Mending', MinecraftEnchantmentTypes.Mending, 1),
  enchantUnbreaking3: eBook(4000, 'Unbreaking III', MinecraftEnchantmentTypes.Unbreaking, 3),
  enchantSharpness5: eBook(5000, 'Sharpness V', MinecraftEnchantmentTypes.Sharpness, 5),
  enchantLooting3: eBook(3000, 'Looting III', MinecraftEnchantmentTypes.Looting, 3),
  enchantFireAspect2: eBook(2000, 'Fire Aspect II', MinecraftEnchantmentTypes.FireAspect, 2),
  enchantProtection4: eBook(4500, 'Protection IV', MinecraftEnchantmentTypes.Protection, 4),
  enchantFeatherFalling4: eBook(3500, 'Feather Falling IV', MinecraftEnchantmentTypes.FeatherFalling, 4),
  enchantEfficiency5: eBook(5000, 'Efficiency V', MinecraftEnchantmentTypes.Efficiency, 5),
  enchantFortune3: eBook(4000, 'Fortune III', MinecraftEnchantmentTypes.Fortune, 3),
  enchantSilkTouch: eBook(6000, 'Silk Touch', MinecraftEnchantmentTypes.SilkTouch, 1),
  enchantPower5: eBook(5000, 'Power V', MinecraftEnchantmentTypes.Power, 5),
  enchantInfinity: eBook(7000, 'Infinity', MinecraftEnchantmentTypes.BowInfinity, 1),
  enchantFlame: eBook(2000, 'Flame', MinecraftEnchantmentTypes.Flame, 1),
  enchantImpaling5: eBook(3000, 'Impaling V', MinecraftEnchantmentTypes.Impaling, 5),
  enchantLoyalty3: eBook(2500, 'Loyalty III', MinecraftEnchantmentTypes.Loyalty, 3),
  enchantChanneling: eBook(4000, 'Channeling', MinecraftEnchantmentTypes.Channeling, 1),
  enchantRiptide3: eBook(3500, 'Riptide III', MinecraftEnchantmentTypes.Riptide, 3),
  enchantDensity5: eBook(5000, 'Density V', MinecraftEnchantmentTypes.Density, 5),
  enchantBreach4: eBook(4000, 'Breach IV', MinecraftEnchantmentTypes.Breach, 4),
  enchantWindBurst3: eBook(6000, 'Wind Burst III', MinecraftEnchantmentTypes.WindBurst, 3),
  enchantMultishot1: eBook(4000, 'Multishot', MinecraftEnchantmentTypes.Multishot, 1),
  enchantPiercing4: eBook(4500, 'Piercing IV', MinecraftEnchantmentTypes.Piercing, 4),
  enchantQuickCharge3: eBook(3500, 'Quick Charge III', MinecraftEnchantmentTypes.QuickCharge, 3),
};

export default items;
