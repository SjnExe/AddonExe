/**
 * Defines all possible items that can be available in the shop.
 * The 'edit shop' panel will allow admins to enable/disable these items
 * and override their default prices.
 *
 * Structure for each item:
 * {
 *   itemId: string,        // The Minecraft item type ID (e.g., MinecraftItemTypes.Diamond).
 *   icon: string,          // The texture path for the icon (e.g., 'textures/items/diamond').
 *   buyPrice: number,      // Default buy price. -1 to disable buying.
 *   sellPrice: number,     // Default sell price. -1 to disable selling.
 *   category: string,      // The main category for the item.
 *   subCategory?: string,   // Optional sub-category for more detailed sorting.
 *   displayName?: string    // Optional display name for items like enchanted books.
 * }
 */
import { MinecraftEnchantmentTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

export interface ItemData {
    itemId: string;
    icon: string;
    buyPrice: number;
    sellPrice: number;
    category: string;
    subCategory?: string;
    displayName?: string;
    _comment?: string;
    enchantment?: {
        id: string;
        level: number;
    };
    rankMultiplierOverrides?: Record<string, { buy: number; sell: number }>;
}

export const items: Record<string, ItemData> = {
    // == Ores & Minerals ==
    diamond: {
        itemId: MinecraftItemTypes.Diamond,
        icon: 'textures/items/diamond',
        buyPrice: 1000,
        sellPrice: 500,
        category: 'Ores & Minerals',
        displayName: 'Diamond'
    },
    emerald: {
        itemId: MinecraftItemTypes.Emerald,
        icon: 'textures/items/emerald',
        buyPrice: 800,
        sellPrice: 400,
        category: 'Ores & Minerals',
        displayName: 'Emerald'
    },
    goldIngot: {
        itemId: MinecraftItemTypes.GoldIngot,
        icon: 'textures/items/gold_ingot',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Ores & Minerals',
        displayName: 'Gold Ingot'
    },
    ironIngot: {
        itemId: MinecraftItemTypes.IronIngot,
        icon: 'textures/items/iron_ingot',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Ores & Minerals',
        displayName: 'Iron Ingot'
    },
    netheriteIngot: {
        itemId: MinecraftItemTypes.NetheriteIngot,
        icon: 'textures/items/netherite_ingot',
        buyPrice: 10_000,
        sellPrice: 5000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Ingot'
    },
    netheriteScrap: {
        itemId: MinecraftItemTypes.NetheriteScrap,
        icon: 'textures/items/netherite_scrap',
        buyPrice: 2000,
        sellPrice: 1000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Scrap'
    },
    ancientDebris: {
        itemId: MinecraftItemTypes.AncientDebris,
        icon: 'textures/blocks/ancient_debris_side',
        buyPrice: 1800,
        sellPrice: 900,
        category: 'Ores & Minerals',
        displayName: 'Ancient Debris'
    },
    lapisLazuli: {
        itemId: MinecraftItemTypes.LapisLazuli,
        icon: 'textures/blocks/lapis_ore',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Ores & Minerals',
        displayName: 'Lapis Lazuli'
    },
    quartz: {
        itemId: MinecraftItemTypes.Quartz,
        icon: 'textures/items/quartz',
        buyPrice: 30,
        sellPrice: 15,
        category: 'Ores & Minerals',
        displayName: 'Quartz'
    },

    // == Special Items ==
    totemOfUndying: {
        itemId: MinecraftItemTypes.TotemOfUndying,
        icon: 'textures/items/totem',
        buyPrice: 5000,
        sellPrice: 2500,
        category: 'Special Items',
        displayName: 'Totem Of Undying'
    },
    netherStar: {
        itemId: MinecraftItemTypes.NetherStar,
        icon: 'textures/items/nether_star',
        buyPrice: 20_000,
        sellPrice: -1, // Cannot be sold
        category: 'Special Items',
        displayName: 'Nether Star'
    },
    shulkerShell: {
        itemId: MinecraftItemTypes.ShulkerShell,
        icon: 'textures/items/shulker_shell',
        buyPrice: 750,
        sellPrice: 300,
        category: 'Special Items',
        displayName: 'Shulker Shell'
    },
    elytra: {
        itemId: MinecraftItemTypes.Elytra,
        icon: 'textures/items/elytra',
        buyPrice: 15_000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Elytra'
    },
    witherSkeletonSkull: {
        itemId: MinecraftItemTypes.WitherSkeletonSkull,
        icon: 'textures/items/spawn_eggs/spawn_egg_wither_skeleton',
        buyPrice: 8000,
        sellPrice: 2000,
        category: 'Special Items',
        displayName: 'Wither Skeleton Skull'
    },
    enchantedGoldenApple: {
        itemId: MinecraftItemTypes.EnchantedGoldenApple,
        icon: 'textures/items/apple_golden',
        buyPrice: 25_000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Enchanted Golden Apple'
    },

    // == Tools & Weapons ==
    diamondSword: {
        itemId: MinecraftItemTypes.DiamondSword,
        icon: 'textures/items/diamond_sword',
        buyPrice: 2500,
        sellPrice: 1000,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Sword'
    },
    diamondPickaxe: {
        itemId: MinecraftItemTypes.DiamondPickaxe,
        icon: 'textures/items/diamond_pickaxe',
        buyPrice: 3500,
        sellPrice: 1200,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Pickaxe'
    },
    diamondAxe: {
        itemId: MinecraftItemTypes.DiamondAxe,
        icon: 'textures/items/diamond_axe',
        buyPrice: 3500,
        sellPrice: 1200,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Axe'
    },
    diamondShovel: {
        itemId: MinecraftItemTypes.DiamondShovel,
        icon: 'textures/items/diamond_shovel',
        buyPrice: 1500,
        sellPrice: 600,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Shovel'
    },
    diamondHoe: {
        itemId: MinecraftItemTypes.DiamondHoe,
        icon: 'textures/items/diamond_hoe',
        buyPrice: 2500,
        sellPrice: 1000,
        category: 'Tools & Weapons',
        subCategory: 'Diamond',
        displayName: 'Diamond Hoe'
    },
    netheriteSword: {
        itemId: MinecraftItemTypes.NetheriteSword,
        icon: 'textures/items/netherite_sword',
        buyPrice: 15_000,
        sellPrice: 7500,
        category: 'Tools & Weapons',
        subCategory: 'Netherite',
        displayName: 'Netherite Sword'
    },
    netheritePickaxe: {
        itemId: MinecraftItemTypes.NetheritePickaxe,
        icon: 'textures/items/netherite_pickaxe',
        buyPrice: 18_000,
        sellPrice: 8000,
        category: 'Tools & Weapons',
        subCategory: 'Netherite',
        displayName: 'Netherite Pickaxe'
    },

    // == Armor ==
    diamondHelmet: {
        itemId: MinecraftItemTypes.DiamondHelmet,
        icon: 'textures/items/diamond_helmet',
        buyPrice: 5000,
        sellPrice: 2000,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Helmet'
    },
    diamondChestplate: {
        itemId: MinecraftItemTypes.DiamondChestplate,
        icon: 'textures/items/diamond_chestplate',
        buyPrice: 8000,
        sellPrice: 3500,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Chestplate'
    },
    diamondLeggings: {
        itemId: MinecraftItemTypes.DiamondLeggings,
        icon: 'textures/items/diamond_leggings',
        buyPrice: 7000,
        sellPrice: 3000,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Leggings'
    },
    diamondBoots: {
        itemId: MinecraftItemTypes.DiamondBoots,
        icon: 'textures/items/diamond_boots',
        buyPrice: 4000,
        sellPrice: 1800,
        category: 'Armor',
        subCategory: 'Diamond',
        displayName: 'Diamond Boots'
    },
    netheriteHelmet: {
        itemId: MinecraftItemTypes.NetheriteHelmet,
        icon: 'textures/items/netherite_helmet',
        buyPrice: 20_000,
        sellPrice: 10_000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Helmet'
    },
    netheriteChestplate: {
        itemId: MinecraftItemTypes.NetheriteChestplate,
        icon: 'textures/items/netherite_chestplate',
        buyPrice: 30_000,
        sellPrice: 15_000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Chestplate'
    },
    netheriteLeggings: {
        itemId: MinecraftItemTypes.NetheriteLeggings,
        icon: 'textures/items/netherite_leggings',
        buyPrice: 25_000,
        sellPrice: 12_000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Leggings'
    },
    netheriteBoots: {
        itemId: MinecraftItemTypes.NetheriteBoots,
        icon: 'textures/items/netherite_boots',
        buyPrice: 18_000,
        sellPrice: 9000,
        category: 'Armor',
        subCategory: 'Netherite',
        displayName: 'Netherite Boots'
    },

    // == Logs ==
    oakLog: {
        itemId: MinecraftItemTypes.OakLog,
        icon: 'textures/blocks/log_oak_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Oak Log'
    },
    spruceLog: {
        itemId: MinecraftItemTypes.SpruceLog,
        icon: 'textures/blocks/log_spruce_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Spruce Log'
    },
    birchLog: {
        itemId: MinecraftItemTypes.BirchLog,
        icon: 'textures/blocks/log_birch_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Birch Log'
    },
    jungleLog: {
        itemId: MinecraftItemTypes.JungleLog,
        icon: 'textures/blocks/log_jungle_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Jungle Log'
    },
    acaciaLog: {
        itemId: MinecraftItemTypes.AcaciaLog,
        icon: 'textures/blocks/log_acacia_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Acacia Log'
    },
    darkOakLog: {
        itemId: MinecraftItemTypes.DarkOakLog,
        icon: 'textures/blocks/log_big_oak_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Dark Oak Log'
    },
    mangroveLog: {
        itemId: MinecraftItemTypes.MangroveLog,
        icon: 'textures/blocks/mangrove_log_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Mangrove Log'
    },
    cherryLog: {
        itemId: MinecraftItemTypes.CherryLog,
        icon: 'textures/blocks/cherry_log_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Cherry Log'
    },
    crimsonStem: {
        itemId: MinecraftItemTypes.CrimsonStem,
        icon: 'textures/blocks/huge_fungus/crimson_log_top',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Crimson Stem'
    },
    warpedStem: {
        itemId: MinecraftItemTypes.WarpedStem,
        icon: 'textures/blocks/huge_fungus/warped_stem_top',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Warped Stem'
    },

    // == Building Blocks ==
    stone: {
        itemId: MinecraftItemTypes.Stone,
        icon: 'textures/blocks/stone',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Stone'
    },
    cobblestone: {
        itemId: MinecraftItemTypes.Cobblestone,
        icon: 'textures/blocks/cobblestone',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Cobblestone'
    },
    dirt: {
        itemId: MinecraftItemTypes.Dirt,
        icon: 'textures/blocks/dirt',
        buyPrice: 2,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Dirt'
    },
    sand: {
        itemId: MinecraftItemTypes.Sand,
        icon: 'textures/blocks/sand',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Sand'
    },
    gravel: {
        itemId: MinecraftItemTypes.Gravel,
        icon: 'textures/blocks/gravel',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Gravel'
    },
    glass: {
        itemId: MinecraftItemTypes.Glass,
        icon: 'textures/blocks/glass',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Glass'
    },
    terracotta: {
        itemId: MinecraftItemTypes.HardenedClay,
        icon: 'textures/blocks/hardened_clay',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Terracotta'
    },
    whiteConcrete: {
        itemId: MinecraftItemTypes.WhiteConcrete,
        icon: 'textures/blocks/concrete_white',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Building Blocks',
        displayName: 'White Concrete'
    },
    stoneBricks: {
        itemId: MinecraftItemTypes.StoneBricks,
        icon: 'textures/blocks/stonebrick',
        buyPrice: 12,
        sellPrice: 6,
        category: 'Building Blocks',
        displayName: 'Stone Bricks'
    },
    obsidian: {
        itemId: MinecraftItemTypes.Obsidian,
        icon: 'textures/blocks/obsidian',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Building Blocks',
        displayName: 'Obsidian'
    },
    glowstone: {
        itemId: MinecraftItemTypes.Glowstone,
        icon: 'textures/blocks/glowstone',
        buyPrice: 80,
        sellPrice: 40,
        category: 'Building Blocks',
        displayName: 'Glowstone'
    },
    netherrack: {
        itemId: MinecraftItemTypes.Netherrack,
        icon: 'textures/blocks/netherrack',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Netherrack'
    },
    endStone: {
        itemId: MinecraftItemTypes.EndStone,
        icon: 'textures/blocks/end_stone',
        buyPrice: 10,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'End Stone'
    },
    purpurBlock: {
        itemId: MinecraftItemTypes.PurpurBlock,
        icon: 'textures/blocks/purpur_block',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Purpur Block'
    },

    // == Food ==
    steak: {
        itemId: MinecraftItemTypes.CookedBeef,
        icon: 'textures/items/beef_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Steak'
    },
    cookedPorkchop: {
        itemId: MinecraftItemTypes.CookedPorkchop,
        icon: 'textures/items/porkchop_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Porkchop'
    },
    bread: {
        itemId: MinecraftItemTypes.Bread,
        icon: 'textures/items/bread',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Food',
        displayName: 'Bread'
    },
    goldenCarrot: {
        itemId: MinecraftItemTypes.GoldenCarrot,
        icon: 'textures/items/carrot_golden',
        buyPrice: 100,
        sellPrice: 40,
        category: 'Food',
        displayName: 'Golden Carrot'
    },
    cookedSalmon: {
        itemId: MinecraftItemTypes.CookedSalmon,
        icon: 'textures/items/fish_salmon_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Salmon'
    },
    cookedCod: {
        itemId: MinecraftItemTypes.CookedCod,
        icon: 'textures/items/fish_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Cod'
    },
    chorusFruit: {
        itemId: MinecraftItemTypes.ChorusFruit,
        icon: 'textures/items/chorus_fruit',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Food',
        displayName: 'Chorus Fruit'
    },

    // == Farming ==
    wheat: {
        itemId: MinecraftItemTypes.Wheat,
        icon: 'textures/items/wheat',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Wheat'
    },
    carrot: {
        itemId: MinecraftItemTypes.Carrot,
        icon: 'textures/items/carrot',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Carrot'
    },
    potato: {
        itemId: MinecraftItemTypes.Potato,
        icon: 'textures/items/potato',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Potato'
    },
    melonSlice: {
        itemId: MinecraftItemTypes.MelonSlice,
        icon: 'textures/items/melon',
        buyPrice: 3,
        sellPrice: 1,
        category: 'Farming',
        displayName: 'Melon Slice'
    },
    pumpkin: {
        itemId: MinecraftItemTypes.Pumpkin,
        icon: 'textures/blocks/pumpkin_face_off',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Farming',
        displayName: 'Pumpkin'
    },
    sugarCane: {
        itemId: MinecraftItemTypes.SugarCane,
        icon: 'textures/items/reeds',
        buyPrice: 8,
        sellPrice: 4,
        category: 'Farming',
        displayName: 'Sugar Cane'
    },
    netherWart: {
        itemId: MinecraftItemTypes.NetherWart,
        icon: 'textures/items/nether_wart',
        buyPrice: 25,
        sellPrice: 10,
        category: 'Farming',
        subCategory: 'Potions',
        displayName: 'Nether Wart'
    },

    // == Enchantment Books ==
    // General
    enchantMending: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 8000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Mending',
        enchantment: { id: MinecraftEnchantmentTypes.Mending, level: 1 }
    },
    enchantUnbreaking3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Unbreaking III',
        enchantment: { id: MinecraftEnchantmentTypes.Unbreaking, level: 3 }
    },

    // Sword
    enchantSharpness5: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Sharpness V',
        enchantment: { id: MinecraftEnchantmentTypes.Sharpness, level: 5 }
    },
    enchantLooting3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Looting III',
        enchantment: { id: MinecraftEnchantmentTypes.Looting, level: 3 }
    },
    enchantFireAspect2: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Fire Aspect II',
        enchantment: { id: MinecraftEnchantmentTypes.FireAspect, level: 2 }
    },

    // Armour
    enchantProtection4: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Protection IV',
        enchantment: { id: MinecraftEnchantmentTypes.Protection, level: 4 }
    },
    enchantFeatherFalling4: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Feather Falling IV',
        enchantment: { id: MinecraftEnchantmentTypes.FeatherFalling, level: 4 }
    },

    // Tools
    enchantEfficiency5: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Efficiency V',
        enchantment: { id: MinecraftEnchantmentTypes.Efficiency, level: 5 }
    },
    enchantFortune3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Fortune III',
        enchantment: { id: MinecraftEnchantmentTypes.Fortune, level: 3 }
    },
    enchantSilkTouch: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Silk Touch',
        enchantment: { id: MinecraftEnchantmentTypes.SilkTouch, level: 1 }
    },

    // Bow
    enchantPower5: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Power V',
        enchantment: { id: MinecraftEnchantmentTypes.Power, level: 5 }
    },
    enchantInfinity: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 7000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Infinity',
        enchantment: { id: MinecraftEnchantmentTypes['BowInfinity'], level: 1 }
    },
    enchantFlame: {
        _comment: 'Note: sellPrice changed from 500 to -1',
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Flame',
        enchantment: { id: MinecraftEnchantmentTypes.Flame, level: 1 }
    },

    // Trident
    enchantImpaling5: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Impaling V',
        enchantment: { id: MinecraftEnchantmentTypes.Impaling, level: 5 }
    },
    enchantLoyalty3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 2500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Loyalty III',
        enchantment: { id: MinecraftEnchantmentTypes.Loyalty, level: 3 }
    },
    enchantChanneling: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Channeling',
        enchantment: { id: MinecraftEnchantmentTypes.Channeling, level: 1 }
    },
    enchantRiptide3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Riptide III',
        enchantment: { id: MinecraftEnchantmentTypes.Riptide, level: 3 }
    },

    // Mace
    enchantDensity5: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Mace',
        displayName: 'Density V',
        enchantment: { id: MinecraftEnchantmentTypes.Density, level: 5 }
    },
    enchantBreach4: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Mace',
        displayName: 'Breach IV',
        enchantment: { id: MinecraftEnchantmentTypes.Breach, level: 4 }
    },
    enchantWindBurst3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Mace',
        displayName: 'Wind Burst III',
        enchantment: { id: MinecraftEnchantmentTypes.WindBurst, level: 3 }
    },

    // Crossbow
    enchantMultishot1: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Crossbow',
        displayName: 'Multishot',
        enchantment: { id: MinecraftEnchantmentTypes.Multishot, level: 1 }
    },
    enchantPiercing4: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Crossbow',
        displayName: 'Piercing IV',
        enchantment: { id: MinecraftEnchantmentTypes.Piercing, level: 4 }
    },
    enchantQuickCharge3: {
        itemId: MinecraftItemTypes.EnchantedBook,
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Crossbow',
        displayName: 'Quick Charge III',
        enchantment: { id: MinecraftEnchantmentTypes.QuickCharge, level: 3 }
    }
};

export default items;
