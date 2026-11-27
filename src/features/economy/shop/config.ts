import { MinecraftEnchantmentTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

export interface ShopItem {
  buyPrice: number;
  sellPrice: number;
  permission?: string;
  icon?: string;
  displayName?: string;
  itemId?: string;
  enchantment?: { id: string; level: number };
  rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
  dailyBuyLimit?: number;
  dailySellLimit?: number;
  limitScope?: 'player' | 'global';
}

export type ShopItemInfo = ShopItem;

export interface ShopSubCategory {
  icon: string;
  items: Record<string, ShopItem>;
}

export interface ShopCategory {
  icon: string;
  items: Record<string, ShopItem>;
  subCategories: Record<string, ShopSubCategory>;
}

export interface ShopConfig {
  categories: Record<string, ShopCategory>;
}

const entry = (
  itemId: string,
  buyPrice: number,
  sellPrice: number,
  extra?: Omit<ShopItem, 'itemId' | 'buyPrice' | 'sellPrice'>,
): ShopItem => ({
  itemId,
  buyPrice,
  sellPrice,
  ...extra,
});

const eBook = (buyPrice: number, displayName: string, id: string, level: number): ShopItem => ({
  itemId: MinecraftItemTypes.EnchantedBook,
  buyPrice,
  sellPrice: -1,
  displayName,
  enchantment: { id, level },
});

const roundPrice = (value: number, min: number): number => Math.max(min, Math.round(value * 100) / 100);

const variantEntry = (
  itemId: string,
  baseBuy: number,
  baseSell: number,
  multiplier: number,
  displayName?: string,
  dailySellLimit = 512,
): ShopItem => ({
  itemId,
  buyPrice: roundPrice(baseBuy * multiplier, 1),
  sellPrice: baseSell > 0 ? roundPrice(baseSell * multiplier, 0.25) : -1,
  dailySellLimit,
  ...(displayName ? { displayName } : {}),
});

export const shopConfig: ShopConfig = {
  categories: {
    'Ores & Minerals': {
      icon: 'textures/items/diamond',
      items: {
        coal: entry(MinecraftItemTypes.Coal, 10, 2.5, { dailySellLimit: 512 }),
        copperIngot: entry(MinecraftItemTypes.CopperIngot, 12, 3, { dailySellLimit: 512 }),
        ironIngot: entry(MinecraftItemTypes.IronIngot, 25, 5, { dailySellLimit: 512 }),
        goldIngot: entry(MinecraftItemTypes.GoldIngot, 40, 8, { dailySellLimit: 512 }),
        lapisLazuli: entry(MinecraftItemTypes.LapisLazuli, 15, 3, { dailySellLimit: 512 }),
        redstone: entry(MinecraftItemTypes.Redstone, 16, 3.5, { dailySellLimit: 512 }),
        quartz: entry(MinecraftItemTypes.Quartz, 18, 4, { dailySellLimit: 512 }),
        amethystShard: entry(MinecraftItemTypes.AmethystShard, 25, 6, { dailySellLimit: 256 }),
        emerald: entry(MinecraftItemTypes.Emerald, 80, 10, { dailySellLimit: 256 }),
        diamond: entry(MinecraftItemTypes.Diamond, 500, 150, { dailySellLimit: 128 }),
        ancientDebris: entry(MinecraftItemTypes.AncientDebris, 1200, 350, { dailySellLimit: 64 }),
        netheriteScrap: entry(MinecraftItemTypes.NetheriteScrap, 1300, 380, { dailySellLimit: 64 }),
        netheriteIngot: entry(MinecraftItemTypes.NetheriteIngot, 5500, 1600, { dailySellLimit: 32 }),
      },
      subCategories: {},
    },
    'Tools & Weapons': {
      icon: 'textures/items/diamond_sword',
      items: {},
      subCategories: {
        Iron: {
          icon: 'textures/items/iron_sword',
          items: {
            ironSword: entry(MinecraftItemTypes.IronSword, 80, 20),
            ironPickaxe: entry(MinecraftItemTypes.IronPickaxe, 110, 28),
            ironAxe: entry(MinecraftItemTypes.IronAxe, 110, 28),
            ironShovel: entry(MinecraftItemTypes.IronShovel, 50, 12),
            ironHoe: entry(MinecraftItemTypes.IronHoe, 75, 18),
          },
        },
        Diamond: {
          icon: 'textures/items/diamond_pickaxe',
          items: {
            diamondSword: entry(MinecraftItemTypes.DiamondSword, 1200, 350),
            diamondPickaxe: entry(MinecraftItemTypes.DiamondPickaxe, 1700, 500),
            diamondAxe: entry(MinecraftItemTypes.DiamondAxe, 1700, 500),
            diamondShovel: entry(MinecraftItemTypes.DiamondShovel, 650, 180),
            diamondHoe: entry(MinecraftItemTypes.DiamondHoe, 1100, 320),
          },
        },
        Netherite: {
          icon: 'textures/items/netherite_sword',
          items: {
            netheriteSword: entry(MinecraftItemTypes.NetheriteSword, 7500, 2200),
            netheritePickaxe: entry(MinecraftItemTypes.NetheritePickaxe, 8000, 2400),
            netheriteAxe: entry(MinecraftItemTypes.NetheriteAxe, 8000, 2400),
            netheriteShovel: entry(MinecraftItemTypes.NetheriteShovel, 6500, 1900),
            netheriteHoe: entry(MinecraftItemTypes.NetheriteHoe, 7200, 2100),
          },
        },
        'Ranged & Utility': {
          icon: 'textures/items/bow_standby',
          items: {
            bow: entry(MinecraftItemTypes.Bow, 150, 35),
            crossbow: entry(MinecraftItemTypes.Crossbow, 200, 50),
            shield: entry(MinecraftItemTypes.Shield, 120, 30),
            arrow: entry(MinecraftItemTypes.Arrow, 8, 1.5, { dailySellLimit: 512 }),
            trident: entry(MinecraftItemTypes.Trident, 6000, 1200, { dailyBuyLimit: 2 }),
            mace: entry(MinecraftItemTypes.Mace, 12_000, 2500, { dailyBuyLimit: 1 }),
            flintAndSteel: entry(MinecraftItemTypes.FlintAndSteel, 40, 10),
            shears: entry(MinecraftItemTypes.Shears, 60, 15),
            fishingRod: entry(MinecraftItemTypes.FishingRod, 80, 20),
            spyglass: entry(MinecraftItemTypes.Spyglass, 150, 35),
          },
        },
      },
    },
    Armor: {
      icon: 'textures/items/diamond_chestplate',
      items: {},
      subCategories: {
        Iron: {
          icon: 'textures/items/iron_chestplate',
          items: {
            ironHelmet: entry(MinecraftItemTypes.IronHelmet, 160, 40),
            ironChestplate: entry(MinecraftItemTypes.IronChestplate, 250, 65),
            ironLeggings: entry(MinecraftItemTypes.IronLeggings, 220, 55),
            ironBoots: entry(MinecraftItemTypes.IronBoots, 130, 32),
          },
        },
        Diamond: {
          icon: 'textures/items/diamond_chestplate',
          items: {
            diamondHelmet: entry(MinecraftItemTypes.DiamondHelmet, 2800, 800),
            diamondChestplate: entry(MinecraftItemTypes.DiamondChestplate, 4400, 1300),
            diamondLeggings: entry(MinecraftItemTypes.DiamondLeggings, 3800, 1100),
            diamondBoots: entry(MinecraftItemTypes.DiamondBoots, 2200, 650),
          },
        },
        Netherite: {
          icon: 'textures/items/netherite_chestplate',
          items: {
            netheriteHelmet: entry(MinecraftItemTypes.NetheriteHelmet, 9000, 2600),
            netheriteChestplate: entry(MinecraftItemTypes.NetheriteChestplate, 11_000, 3200),
            netheriteLeggings: entry(MinecraftItemTypes.NetheriteLeggings, 10_000, 2900),
            netheriteBoots: entry(MinecraftItemTypes.NetheriteBoots, 8500, 2400),
          },
        },
        Special: {
          icon: 'textures/items/turtle_helmet',
          items: {
            turtleHelmet: entry(MinecraftItemTypes.TurtleHelmet, 1500, 400, { displayName: 'Turtle Shell' }),
          },
        },
      },
    },
    Enchantments: {
      icon: 'textures/items/book_enchanted',
      items: {},
      subCategories: {
        General: {
          icon: 'textures/items/book_normal',
          items: {
            enchantMending: eBook(6500, 'Mending', MinecraftEnchantmentTypes.Mending, 1),
            enchantUnbreaking3: eBook(3200, 'Unbreaking III', MinecraftEnchantmentTypes.Unbreaking, 3),
          },
        },
        Sword: {
          icon: 'textures/items/diamond_sword',
          items: {
            enchantSharpness5: eBook(4000, 'Sharpness V', MinecraftEnchantmentTypes.Sharpness, 5),
            enchantLooting3: eBook(2500, 'Looting III', MinecraftEnchantmentTypes.Looting, 3),
            enchantFireAspect2: eBook(1500, 'Fire Aspect II', MinecraftEnchantmentTypes.FireAspect, 2),
          },
        },
        Armor: {
          icon: 'textures/items/diamond_chestplate',
          items: {
            enchantProtection4: eBook(3800, 'Protection IV', MinecraftEnchantmentTypes.Protection, 4),
            enchantFeatherFalling4: eBook(2800, 'Feather Falling IV', MinecraftEnchantmentTypes.FeatherFalling, 4),
          },
        },
        Tools: {
          icon: 'textures/items/diamond_pickaxe',
          items: {
            enchantEfficiency5: eBook(4000, 'Efficiency V', MinecraftEnchantmentTypes.Efficiency, 5),
            enchantFortune3: eBook(3200, 'Fortune III', MinecraftEnchantmentTypes.Fortune, 3),
            enchantSilkTouch: eBook(5000, 'Silk Touch', MinecraftEnchantmentTypes.SilkTouch, 1),
          },
        },
        Bow: {
          icon: 'textures/items/bow_standby',
          items: {
            enchantPower5: eBook(4000, 'Power V', MinecraftEnchantmentTypes.Power, 5),
            enchantInfinity: eBook(5500, 'Infinity', MinecraftEnchantmentTypes.BowInfinity, 1),
            enchantFlame: eBook(1500, 'Flame', MinecraftEnchantmentTypes.Flame, 1),
          },
        },
        Trident: {
          icon: 'textures/items/trident',
          items: {
            enchantImpaling5: eBook(2500, 'Impaling V', MinecraftEnchantmentTypes.Impaling, 5),
            enchantLoyalty3: eBook(2000, 'Loyalty III', MinecraftEnchantmentTypes.Loyalty, 3),
            enchantChanneling: eBook(3200, 'Channeling', MinecraftEnchantmentTypes.Channeling, 1),
            enchantRiptide3: eBook(2800, 'Riptide III', MinecraftEnchantmentTypes.Riptide, 3),
          },
        },
        Mace: {
          icon: 'textures/items/mace',
          items: {
            enchantDensity5: eBook(4200, 'Density V', MinecraftEnchantmentTypes.Density, 5),
            enchantBreach4: eBook(3400, 'Breach IV', MinecraftEnchantmentTypes.Breach, 4),
            enchantWindBurst3: eBook(5000, 'Wind Burst III', MinecraftEnchantmentTypes.WindBurst, 3),
          },
        },
        Crossbow: {
          icon: 'textures/items/crossbow_standby',
          items: {
            enchantMultishot1: eBook(3200, 'Multishot', MinecraftEnchantmentTypes.Multishot, 1),
            enchantPiercing4: eBook(3600, 'Piercing IV', MinecraftEnchantmentTypes.Piercing, 4),
            enchantQuickCharge3: eBook(2800, 'Quick Charge III', MinecraftEnchantmentTypes.QuickCharge, 3),
          },
        },
      },
    },
    Food: {
      icon: 'textures/items/bread',
      items: {
        bread: entry(MinecraftItemTypes.Bread, 10, 2, { dailySellLimit: 512 }),
        bakedPotato: entry(MinecraftItemTypes.BakedPotato, 10, 2, { dailySellLimit: 512 }),
        apple: entry(MinecraftItemTypes.Apple, 12, 2.5, { dailySellLimit: 512 }),
        pumpkinPie: entry(MinecraftItemTypes.PumpkinPie, 16, 3.5, { dailySellLimit: 512 }),
        steak: entry(MinecraftItemTypes.CookedBeef, 16, 4, { displayName: 'Steak', dailySellLimit: 512 }),
        cookedPorkchop: entry(MinecraftItemTypes.CookedPorkchop, 16, 4, { dailySellLimit: 512 }),
        cookedChicken: entry(MinecraftItemTypes.CookedChicken, 14, 3.5, { dailySellLimit: 512 }),
        cookedSalmon: entry(MinecraftItemTypes.CookedSalmon, 16, 4, { dailySellLimit: 512 }),
        cookedCod: entry(MinecraftItemTypes.CookedCod, 14, 3.5, { dailySellLimit: 512 }),
        goldenCarrot: entry(MinecraftItemTypes.GoldenCarrot, 60, 12, { dailySellLimit: 256 }),
        goldenApple: entry(MinecraftItemTypes.GoldenApple, 450, 100, { dailySellLimit: 32 }),
        chorusFruit: entry(MinecraftItemTypes.ChorusFruit, 40, 10, { dailySellLimit: 256 }),
      },
      subCategories: {},
    },
    Farming: {
      icon: 'textures/items/diamond_hoe',
      items: {
        wheat: entry(MinecraftItemTypes.Wheat, 5, 1, { dailySellLimit: 1024 }),
        carrot: entry(MinecraftItemTypes.Carrot, 5, 1, { dailySellLimit: 1024 }),
        potato: entry(MinecraftItemTypes.Potato, 5, 1, { dailySellLimit: 1024 }),
        melonSlice: entry(MinecraftItemTypes.MelonSlice, 3, 0.25, { dailySellLimit: 2048 }),
        pumpkin: entry(MinecraftItemTypes.Pumpkin, 8, 0.75, { dailySellLimit: 1024 }),
        sugarCane: entry(MinecraftItemTypes.SugarCane, 6, 0.5, { dailySellLimit: 1024 }),
        bamboo: entry(MinecraftItemTypes.Bamboo, 4, 0.25, { dailySellLimit: 2048 }),
        kelp: entry(MinecraftItemTypes.Kelp, 4, 0.25, { dailySellLimit: 2048 }),
        cocoaBeans: entry(MinecraftItemTypes.CocoaBeans, 6, 0.75, { dailySellLimit: 1024 }),
        sweetBerries: entry(MinecraftItemTypes.SweetBerries, 6, 0.75, { dailySellLimit: 1024 }),
        wheatSeeds: entry(MinecraftItemTypes.WheatSeeds, 2, 0.25, { dailySellLimit: 1024 }),
        boneMeal: entry(MinecraftItemTypes.BoneMeal, 8, 1.5, { dailySellLimit: 512 }),
        honeyBottle: entry(MinecraftItemTypes.HoneyBottle, 30, 6, { dailySellLimit: 256 }),
        netherWart: entry(MinecraftItemTypes.NetherWart, 18, 2, { dailySellLimit: 512 }),
      },
      subCategories: {},
    },
    'Mob Drops & Brewing': {
      icon: 'textures/items/ender_pearl',
      items: {
        rottenFlesh: entry(MinecraftItemTypes.RottenFlesh, 6, 0.5, { dailySellLimit: 512 }),
        bone: entry(MinecraftItemTypes.Bone, 12, 2, { dailySellLimit: 512 }),
        string: entry(MinecraftItemTypes.String, 10, 2, { dailySellLimit: 512 }),
        feather: entry(MinecraftItemTypes.Feather, 8, 1.5, { dailySellLimit: 512 }),
        leather: entry(MinecraftItemTypes.Leather, 18, 4, { dailySellLimit: 512 }),
        gunpowder: entry(MinecraftItemTypes.Gunpowder, 25, 5, { dailySellLimit: 512 }),
        spiderEye: entry(MinecraftItemTypes.SpiderEye, 14, 2.5, { dailySellLimit: 512 }),
        slimeBall: entry(MinecraftItemTypes.SlimeBall, 35, 7, { dailySellLimit: 256 }),
        enderPearl: entry(MinecraftItemTypes.EnderPearl, 60, 12, { dailySellLimit: 128 }),
        blazeRod: entry(MinecraftItemTypes.BlazeRod, 80, 16, { dailySellLimit: 128 }),
        blazePowder: entry(MinecraftItemTypes.BlazePowder, 45, 7, { dailySellLimit: 256 }),
        magmaCream: entry(MinecraftItemTypes.MagmaCream, 60, 12, { dailySellLimit: 128 }),
        ghastTear: entry(MinecraftItemTypes.GhastTear, 180, 40, { dailySellLimit: 64 }),
        phantomMembrane: entry(MinecraftItemTypes.PhantomMembrane, 90, 20, { dailySellLimit: 64 }),
        inkSac: entry(MinecraftItemTypes.InkSac, 12, 2.5, { dailySellLimit: 256 }),
        glowInkSac: entry(MinecraftItemTypes.GlowInkSac, 25, 5, { dailySellLimit: 256 }),
        prismarineShard: entry(MinecraftItemTypes.PrismarineShard, 20, 4, { dailySellLimit: 256 }),
        prismarineCrystals: entry(MinecraftItemTypes.PrismarineCrystals, 25, 5, { dailySellLimit: 256 }),
        fermentedSpiderEye: entry(MinecraftItemTypes.FermentedSpiderEye, 30, 6, { dailySellLimit: 128 }),
        glisteringMelonSlice: entry(MinecraftItemTypes.GlisteringMelonSlice, 45, 9, { dailySellLimit: 128 }),
      },
      subCategories: {},
    },
    'Redstone & Utility': {
      icon: 'textures/items/redstone_dust',
      items: {
        repeater: entry(MinecraftItemTypes.Repeater, 55, 12),
        comparator: entry(MinecraftItemTypes.Comparator, 80, 18),
        piston: entry(MinecraftItemTypes.Piston, 60, 14),
        stickyPiston: entry(MinecraftItemTypes.StickyPiston, 95, 22),
        observer: entry(MinecraftItemTypes.Observer, 85, 18),
        hopper: entry(MinecraftItemTypes.Hopper, 150, 35),
        dropper: entry(MinecraftItemTypes.Dropper, 25, 5),
        dispenser: entry(MinecraftItemTypes.Dispenser, 45, 10),
        lever: entry(MinecraftItemTypes.Lever, 8, 1),
        redstoneTorch: entry(MinecraftItemTypes.RedstoneTorch, 18, 3),
        redstoneLamp: entry(MinecraftItemTypes.RedstoneLamp, 110, 25),
        honeyBlock: entry(MinecraftItemTypes.HoneyBlock, 120, 25),
        rail: entry(MinecraftItemTypes.Rail, 15, 3),
        poweredRail: entry(MinecraftItemTypes.GoldenRail, 60, 14, { displayName: 'Powered Rail' }),
        chest: entry(MinecraftItemTypes.Chest, 20, 4),
        barrel: entry(MinecraftItemTypes.Barrel, 18, 4),
        enderChest: entry(MinecraftItemTypes.EnderChest, 450, 100),
        shulkerBox: entry(MinecraftItemTypes.UndyedShulkerBox, 1200, 300, { displayName: 'Shulker Box' }),
        lantern: entry(MinecraftItemTypes.Lantern, 35, 8),
        torch: entry(MinecraftItemTypes.Torch, 5, 1),
        scaffolding: entry(MinecraftItemTypes.Scaffolding, 12, 2),
      },
      subCategories: {},
    },
    'Wood & Logs': {
      icon: 'textures/blocks/sapling_oak',
      items: {},
      subCategories: {
        'Oak Wood': {
          icon: 'textures/blocks/log_oak_top',
          items: {
            oakLog: variantEntry(MinecraftItemTypes.OakLog, 16, 4, 1),
            oakPlanks: variantEntry(MinecraftItemTypes.OakPlanks, 16, 4, 0.25),
            oakStairs: variantEntry(MinecraftItemTypes.OakStairs, 16, 4, 0.375),
            oakSlab: variantEntry(MinecraftItemTypes.OakSlab, 16, 4, 0.125),
            oakFence: variantEntry(MinecraftItemTypes.OakFence, 16, 4, 0.625),
            oakFenceGate: variantEntry(MinecraftItemTypes.FenceGate, 16, 4, 0.625, 'Oak Fence Gate'),
          },
        },
        'Spruce Wood': {
          icon: 'textures/blocks/log_spruce_top',
          items: {
            spruceLog: variantEntry(MinecraftItemTypes.SpruceLog, 16, 4, 1),
            sprucePlanks: variantEntry(MinecraftItemTypes.SprucePlanks, 16, 4, 0.25),
            spruceStairs: variantEntry(MinecraftItemTypes.SpruceStairs, 16, 4, 0.375),
            spruceSlab: variantEntry(MinecraftItemTypes.SpruceSlab, 16, 4, 0.125),
            spruceFence: variantEntry(MinecraftItemTypes.SpruceFence, 16, 4, 0.625),
            spruceFenceGate: variantEntry(MinecraftItemTypes.SpruceFenceGate, 16, 4, 0.625),
          },
        },
        'Birch Wood': {
          icon: 'textures/blocks/log_birch_top',
          items: {
            birchLog: variantEntry(MinecraftItemTypes.BirchLog, 16, 4, 1),
            birchPlanks: variantEntry(MinecraftItemTypes.BirchPlanks, 16, 4, 0.25),
            birchStairs: variantEntry(MinecraftItemTypes.BirchStairs, 16, 4, 0.375),
            birchSlab: variantEntry(MinecraftItemTypes.BirchSlab, 16, 4, 0.125),
          },
        },
        'Jungle, Acacia & Dark Oak': {
          icon: 'textures/blocks/log_big_oak_top',
          items: {
            jungleLog: variantEntry(MinecraftItemTypes.JungleLog, 16, 4, 1),
            junglePlanks: variantEntry(MinecraftItemTypes.JunglePlanks, 16, 4, 0.25),
            acaciaLog: variantEntry(MinecraftItemTypes.AcaciaLog, 16, 4, 1),
            acaciaPlanks: variantEntry(MinecraftItemTypes.AcaciaPlanks, 16, 4, 0.25),
            darkOakLog: variantEntry(MinecraftItemTypes.DarkOakLog, 16, 4, 1),
            darkOakPlanks: variantEntry(MinecraftItemTypes.DarkOakPlanks, 16, 4, 0.25),
          },
        },
        'Mangrove, Cherry & Nether': {
          icon: 'textures/blocks/cherry_log_top',
          items: {
            mangroveLog: variantEntry(MinecraftItemTypes.MangroveLog, 18, 4.5, 1),
            mangrovePlanks: variantEntry(MinecraftItemTypes.MangrovePlanks, 18, 4.5, 0.25),
            cherryLog: variantEntry(MinecraftItemTypes.CherryLog, 18, 4.5, 1),
            cherryPlanks: variantEntry(MinecraftItemTypes.CherryPlanks, 18, 4.5, 0.25),
            crimsonStem: variantEntry(MinecraftItemTypes.CrimsonStem, 20, 5, 1),
            crimsonPlanks: variantEntry(MinecraftItemTypes.CrimsonPlanks, 20, 5, 0.25),
            warpedStem: variantEntry(MinecraftItemTypes.WarpedStem, 20, 5, 1),
            warpedPlanks: variantEntry(MinecraftItemTypes.WarpedPlanks, 20, 5, 0.25),
          },
        },
      },
    },
    'Building Blocks': {
      icon: 'textures/blocks/stonebrick',
      items: {},
      subCategories: {
        Stone: {
          icon: 'textures/blocks/stone',
          items: {
            stone: variantEntry(MinecraftItemTypes.Stone, 8, 2, 1),
            normalStoneStairs: variantEntry(MinecraftItemTypes.NormalStoneStairs, 8, 2, 1.25, 'Stone Stairs'),
            smoothStone: variantEntry(MinecraftItemTypes.SmoothStone, 8, 2, 1),
            smoothStoneSlab: variantEntry(MinecraftItemTypes.SmoothStoneSlab, 8, 2, 0.5),
            stoneButton: variantEntry(MinecraftItemTypes.StoneButton, 8, 2, 0.5),
            stonePressurePlate: variantEntry(MinecraftItemTypes.StonePressurePlate, 8, 2, 0.5),
          },
        },
        Cobblestone: {
          icon: 'textures/blocks/cobblestone',
          items: {
            cobblestone: variantEntry(MinecraftItemTypes.Cobblestone, 4, 1, 1),
            stoneStairs: variantEntry(MinecraftItemTypes.StoneStairs, 4, 1, 1.25, 'Cobblestone Stairs'),
            cobblestoneSlab: variantEntry(MinecraftItemTypes.CobblestoneSlab, 4, 1, 0.5),
            cobblestoneWall: variantEntry(MinecraftItemTypes.CobblestoneWall, 4, 1, 1),
            mossyCobblestone: variantEntry(MinecraftItemTypes.MossyCobblestone, 6, 1.5, 1),
            mossyCobblestoneStairs: variantEntry(
              MinecraftItemTypes.MossyCobblestoneStairs,
              6,
              1.5,
              1.25,
              'Mossy Cobblestone Stairs',
            ),
            mossyCobblestoneSlab: variantEntry(
              MinecraftItemTypes.MossyCobblestoneSlab,
              6,
              1.5,
              0.5,
              'Mossy Cobblestone Slab',
            ),
          },
        },
        'Stone Bricks': {
          icon: 'textures/blocks/stonebrick',
          items: {
            stoneBricks: variantEntry(MinecraftItemTypes.StoneBricks, 10, 2.5, 1),
            stoneBrickStairs: variantEntry(MinecraftItemTypes.StoneBrickStairs, 10, 2.5, 1.25),
            stoneBrickSlab: variantEntry(MinecraftItemTypes.StoneBrickSlab, 10, 2.5, 0.5),
            mossyStoneBricks: variantEntry(MinecraftItemTypes.MossyStoneBricks, 12, 3, 1),
            mossyStoneBrickStairs: variantEntry(
              MinecraftItemTypes.MossyStoneBrickStairs,
              12,
              3,
              1.25,
              'Mossy Stone Brick Stairs',
            ),
            mossyStoneBrickSlab: variantEntry(
              MinecraftItemTypes.MossyStoneBrickSlab,
              12,
              3,
              0.5,
              'Mossy Stone Brick Slab',
            ),
          },
        },
        Deepslate: {
          icon: 'textures/blocks/deepslate/deepslate_top',
          items: {
            deepslate: variantEntry(MinecraftItemTypes.Deepslate, 8, 2, 1),
            cobbledDeepslate: variantEntry(MinecraftItemTypes.CobbledDeepslate, 6, 1.5, 1),
            deepslateBricks: variantEntry(MinecraftItemTypes.DeepslateBricks, 10, 2.5, 1),
            deepslateTiles: variantEntry(MinecraftItemTypes.DeepslateTiles, 10, 2.5, 1),
          },
        },
        'Sand & Sandstone': {
          icon: 'textures/blocks/sand',
          items: {
            sand: variantEntry(MinecraftItemTypes.Sand, 6, 1.5, 1),
            gravel: variantEntry(MinecraftItemTypes.Gravel, 6, 1.5, 1),
            dirt: variantEntry(MinecraftItemTypes.Dirt, 3, 0.5, 1),
            sandstone: variantEntry(MinecraftItemTypes.Sandstone, 10, 2.5, 1),
            sandstoneStairs: variantEntry(MinecraftItemTypes.SandstoneStairs, 10, 2.5, 1.25),
            sandstoneSlab: variantEntry(MinecraftItemTypes.SandstoneSlab, 10, 2.5, 0.5),
          },
        },
        Glass: {
          icon: 'textures/blocks/glass',
          items: {
            glass: variantEntry(MinecraftItemTypes.Glass, 12, 3, 1),
            glassPane: variantEntry(MinecraftItemTypes.GlassPane, 12, 3, 0.38),
            tintedGlass: variantEntry(MinecraftItemTypes.TintedGlass, 20, 5, 1),
          },
        },
        'Concrete & Terracotta': {
          icon: 'textures/blocks/concrete_white',
          items: {
            whiteConcrete: variantEntry(MinecraftItemTypes.WhiteConcrete, 16, 4, 1),
            blackConcrete: variantEntry(MinecraftItemTypes.BlackConcrete, 16, 4, 1),
            redConcrete: variantEntry(MinecraftItemTypes.RedConcrete, 16, 4, 1),
            blueConcrete: variantEntry(MinecraftItemTypes.BlueConcrete, 16, 4, 1),
            terracotta: variantEntry(MinecraftItemTypes.HardenedClay, 12, 3, 1, 'Terracotta'),
          },
        },
        'Quartz & Blackstone': {
          icon: 'textures/blocks/quartz_block_side',
          items: {
            quartzBlock: variantEntry(MinecraftItemTypes.QuartzBlock, 60, 14, 1, 'Block of Quartz'),
            quartzStairs: variantEntry(MinecraftItemTypes.QuartzStairs, 60, 14, 1.25),
            quartzSlab: variantEntry(MinecraftItemTypes.QuartzSlab, 60, 14, 0.5),
            smoothQuartz: variantEntry(MinecraftItemTypes.SmoothQuartz, 65, 15, 1),
            blackstone: variantEntry(MinecraftItemTypes.Blackstone, 10, 2.5, 1),
            polishedBlackstoneBricks: variantEntry(MinecraftItemTypes.PolishedBlackstoneBricks, 14, 3.5, 1),
          },
        },
        'Nether & Obsidian': {
          icon: 'textures/blocks/obsidian',
          items: {
            obsidian: variantEntry(MinecraftItemTypes.Obsidian, 80, 20, 1, undefined, 256),
            glowstone: variantEntry(MinecraftItemTypes.Glowstone, 60, 15, 1, undefined, 256),
            netherrack: variantEntry(MinecraftItemTypes.Netherrack, 4, 1, 1),
            netherBrick: variantEntry(MinecraftItemTypes.NetherBrick, 16, 4, 1, 'Nether Bricks'),
            netherBrickStairs: variantEntry(MinecraftItemTypes.NetherBrickStairs, 16, 4, 1.25),
            netherBrickSlab: variantEntry(MinecraftItemTypes.NetherBrickSlab, 16, 4, 0.5),
            netherBrickFence: variantEntry(MinecraftItemTypes.NetherBrickFence, 16, 4, 1),
          },
        },
        'End & Purpur': {
          icon: 'textures/blocks/purpur_block',
          items: {
            endStone: variantEntry(MinecraftItemTypes.EndStone, 12, 3, 1),
            endBricks: variantEntry(MinecraftItemTypes.EndBricks, 15, 3.5, 1, 'End Stone Bricks'),
            endBrickStairs: variantEntry(MinecraftItemTypes.EndBrickStairs, 15, 3.5, 1.25, 'End Stone Brick Stairs'),
            purpurBlock: variantEntry(MinecraftItemTypes.PurpurBlock, 16, 4, 1),
            purpurStairs: variantEntry(MinecraftItemTypes.PurpurStairs, 16, 4, 1.25),
            purpurSlab: variantEntry(MinecraftItemTypes.PurpurSlab, 16, 4, 0.5),
          },
        },
      },
    },
    'Special Items': {
      icon: 'textures/ui/filledStar',
      items: {
        experienceBottle: entry(MinecraftItemTypes.ExperienceBottle, 75, 15, {
          displayName: "Bottle o' Enchanting",
          dailyBuyLimit: 128,
        }),
        nameTag: entry(MinecraftItemTypes.NameTag, 250, 40),
        saddle: entry(MinecraftItemTypes.Saddle, 300, 50),
        shulkerShell: entry(MinecraftItemTypes.ShulkerShell, 550, 120, { dailySellLimit: 64 }),
        totemOfUndying: entry(MinecraftItemTypes.TotemOfUndying, 2500, 120, {
          dailyBuyLimit: 4,
          dailySellLimit: 8,
        }),
        witherSkeletonSkull: entry(MinecraftItemTypes.WitherSkeletonSkull, 4000, 400, { dailySellLimit: 16 }),
        heartOfTheSea: entry(MinecraftItemTypes.HeartOfTheSea, 5000, 500, { dailyBuyLimit: 2 }),
        netheriteUpgradeSmithingTemplate: entry(MinecraftItemTypes.NetheriteUpgradeSmithingTemplate, 6000, 1000, {
          displayName: 'Netherite Upgrade Template',
          dailyBuyLimit: 4,
        }),
        netherStar: entry(MinecraftItemTypes.NetherStar, 12_000, -1, { dailyBuyLimit: 2 }),
        beacon: entry(MinecraftItemTypes.Beacon, 13_500, -1, { dailyBuyLimit: 2 }),
        elytra: entry(MinecraftItemTypes.Elytra, 15_000, -1, { dailyBuyLimit: 1 }),
        enchantedGoldenApple: entry(MinecraftItemTypes.EnchantedGoldenApple, 18_000, -1, { dailyBuyLimit: 2 }),
      },
      subCategories: {},
    },
  },
};

export default shopConfig;
