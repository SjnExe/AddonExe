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

export const shopConfig: ShopConfig = {
  categories: {
    'Ores & Minerals': {
      icon: 'textures/ui/icon_iron_pickaxe',
      items: {
        diamond: { buyPrice: 600, sellPrice: 200, dailySellLimit: 128 },
        emerald: { buyPrice: 120, sellPrice: 12, dailySellLimit: 256 },
        goldIngot: { buyPrice: 45, sellPrice: 6, dailySellLimit: 512 },
        ironIngot: { buyPrice: 30, sellPrice: 4, dailySellLimit: 512 },
        netheriteIngot: { buyPrice: 6500, sellPrice: 2200, dailySellLimit: 32 },
        netheriteScrap: { buyPrice: 1500, sellPrice: 500, dailySellLimit: 64 },
        ancientDebris: { buyPrice: 1400, sellPrice: 450, dailySellLimit: 64 },
        lapisLazuli: { buyPrice: 15, sellPrice: 4, dailySellLimit: 512 },
        quartz: { buyPrice: 20, sellPrice: 5, dailySellLimit: 512 },
      },
      subCategories: {},
    },
    'Special Items': {
      icon: 'textures/ui/filledStar',
      items: {
        totemOfUndying: { buyPrice: 3000, sellPrice: 120, dailyBuyLimit: 4, dailySellLimit: 8 },
        netherStar: { buyPrice: 15_000, sellPrice: -1, dailyBuyLimit: 2 },
        shulkerShell: { buyPrice: 600, sellPrice: 120, dailySellLimit: 64 },
        elytra: { buyPrice: 15_000, sellPrice: -1, dailyBuyLimit: 1 },
        witherSkeletonSkull: { buyPrice: 5000, sellPrice: 400, dailySellLimit: 16 },
        enchantedGoldenApple: { buyPrice: 20_000, sellPrice: -1, dailyBuyLimit: 2 },
      },
      subCategories: {},
    },
    'Tools & Weapons': {
      icon: 'textures/items/diamond_sword',
      items: {},
      subCategories: {
        Diamond: {
          icon: 'textures/items/diamond',
          items: {
            diamondSword: { buyPrice: 2500, sellPrice: 1000 },
            diamondPickaxe: { buyPrice: 3500, sellPrice: 1200 },
            diamondAxe: { buyPrice: 3500, sellPrice: 1200 },
            diamondShovel: { buyPrice: 1500, sellPrice: 600 },
            diamondHoe: { buyPrice: 2500, sellPrice: 1000 },
          },
        },
        Netherite: {
          icon: 'textures/items/netherite_ingot',
          items: {
            netheriteSword: { buyPrice: 15_000, sellPrice: 7500 },
            netheritePickaxe: { buyPrice: 18_000, sellPrice: 8000 },
          },
        },
      },
    },
    Armor: {
      icon: 'textures/items/diamond_chestplate',
      items: {},
      subCategories: {
        Diamond: {
          icon: 'textures/items/diamond',
          items: {
            diamondHelmet: { buyPrice: 5000, sellPrice: 2000 },
            diamondChestplate: { buyPrice: 8000, sellPrice: 3500 },
            diamondLeggings: { buyPrice: 7000, sellPrice: 3000 },
            diamondBoots: { buyPrice: 4000, sellPrice: 1800 },
          },
        },
        Netherite: {
          icon: 'textures/items/netherite_ingot',
          items: {
            netheriteHelmet: { buyPrice: 20_000, sellPrice: 10_000 },
            netheriteChestplate: { buyPrice: 30_000, sellPrice: 15_000 },
            netheriteLeggings: { buyPrice: 25_000, sellPrice: 12_000 },
            netheriteBoots: { buyPrice: 18_000, sellPrice: 9000 },
          },
        },
      },
    },
    Logs: {
      icon: 'textures/blocks/sapling_oak',
      items: {
        oakLog: { buyPrice: 20, sellPrice: 10 },
        spruceLog: { buyPrice: 20, sellPrice: 10 },
        birchLog: { buyPrice: 20, sellPrice: 10 },
        jungleLog: { buyPrice: 20, sellPrice: 10 },
        acaciaLog: { buyPrice: 20, sellPrice: 10 },
        darkOakLog: { buyPrice: 20, sellPrice: 10 },
        mangroveLog: { buyPrice: 20, sellPrice: 10 },
        cherryLog: { buyPrice: 20, sellPrice: 10 },
        crimsonStem: { buyPrice: 25, sellPrice: 12 },
        warpedStem: { buyPrice: 25, sellPrice: 12 },
      },
      subCategories: {},
    },
    'Building Blocks': {
      icon: 'textures/blocks/stonebrick',
      items: {
        stone: { buyPrice: 10, sellPrice: 5 },
        cobblestone: { buyPrice: 5, sellPrice: 1 },
        dirt: { buyPrice: 2, sellPrice: 1 },
        sand: { buyPrice: 5, sellPrice: 2 },
        gravel: { buyPrice: 5, sellPrice: 2 },
        glass: { buyPrice: 15, sellPrice: 5 },
        terracotta: { buyPrice: 10, sellPrice: 5 },
        whiteConcrete: { buyPrice: 20, sellPrice: 10 },
        stoneBricks: { buyPrice: 12, sellPrice: 6 },
        obsidian: { buyPrice: 100, sellPrice: 50 },
        glowstone: { buyPrice: 80, sellPrice: 40 },
        netherrack: { buyPrice: 5, sellPrice: 1 },
        endStone: { buyPrice: 10, sellPrice: 2 },
        purpurBlock: { buyPrice: 15, sellPrice: 5 },
      },
      subCategories: {},
    },
    Food: {
      icon: 'textures/items/bread',
      items: {
        steak: { buyPrice: 20, sellPrice: 10 },
        cookedPorkchop: { buyPrice: 20, sellPrice: 10 },
        bread: { buyPrice: 15, sellPrice: 5 },
        goldenCarrot: { buyPrice: 100, sellPrice: 40 },
        cookedSalmon: { buyPrice: 20, sellPrice: 10 },
        cookedCod: { buyPrice: 20, sellPrice: 10 },
        chorusFruit: { buyPrice: 50, sellPrice: 25 },
      },
      subCategories: {},
    },
    Farming: {
      icon: 'textures/items/diamond_hoe',
      items: {
        wheat: { buyPrice: 5, sellPrice: 1, dailySellLimit: 1024 },
        carrot: { buyPrice: 5, sellPrice: 1, dailySellLimit: 1024 },
        potato: { buyPrice: 5, sellPrice: 1, dailySellLimit: 1024 },
        melonSlice: { buyPrice: 3, sellPrice: 0.25, dailySellLimit: 2048 },
        pumpkin: { buyPrice: 8, sellPrice: 0.75, dailySellLimit: 1024 },
        sugarCane: { buyPrice: 6, sellPrice: 0.5, dailySellLimit: 1024 },
      },
      subCategories: {
        Potions: {
          icon: 'textures/items/potion_bottle_empty',
          items: {
            netherWart: { buyPrice: 20, sellPrice: 2, dailySellLimit: 512 },
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
            enchantMending: { buyPrice: 8000, sellPrice: -1 },
            enchantUnbreaking3: { buyPrice: 4000, sellPrice: -1 },
          },
        },
        Sword: {
          icon: 'textures/items/diamond_sword',
          items: {
            enchantSharpness5: { buyPrice: 5000, sellPrice: -1 },
            enchantLooting3: { buyPrice: 3000, sellPrice: -1 },
            enchantFireAspect2: { buyPrice: 2000, sellPrice: -1 },
          },
        },
        Armour: {
          icon: 'textures/items/diamond_chestplate',
          items: {
            enchantProtection4: { buyPrice: 4500, sellPrice: -1 },
            enchantFeatherFalling4: { buyPrice: 3500, sellPrice: -1 },
          },
        },
        Tools: {
          icon: 'textures/items/diamond_pickaxe',
          items: {
            enchantEfficiency5: { buyPrice: 5000, sellPrice: -1 },
            enchantFortune3: { buyPrice: 4000, sellPrice: -1 },
            enchantSilkTouch: { buyPrice: 6000, sellPrice: -1 },
          },
        },
        Bow: {
          icon: 'textures/items/bow_standby',
          items: {
            enchantPower5: { buyPrice: 5000, sellPrice: -1 },
            enchantInfinity: { buyPrice: 7000, sellPrice: -1 },
            enchantFlame: { buyPrice: 2000, sellPrice: -1 },
          },
        },
        Trident: {
          icon: 'textures/items/trident',
          items: {
            enchantImpaling5: { buyPrice: 3000, sellPrice: -1 },
            enchantLoyalty3: { buyPrice: 2500, sellPrice: -1 },
            enchantChanneling: { buyPrice: 4000, sellPrice: -1 },
            enchantRiptide3: { buyPrice: 3500, sellPrice: -1 },
          },
        },
        Mace: {
          icon: 'textures/items/mace',
          items: {
            enchantDensity5: { buyPrice: 5000, sellPrice: -1 },
            enchantBreach4: { buyPrice: 4000, sellPrice: -1 },
            enchantWindBurst3: { buyPrice: 6000, sellPrice: -1 },
          },
        },
        Crossbow: {
          icon: 'textures/items/crossbow_standby',
          items: {
            enchantMultishot1: { buyPrice: 4000, sellPrice: -1 },
            enchantPiercing4: { buyPrice: 4500, sellPrice: -1 },
            enchantQuickCharge3: { buyPrice: 3500, sellPrice: -1 },
          },
        },
      },
    },
  },
};

export default shopConfig;
