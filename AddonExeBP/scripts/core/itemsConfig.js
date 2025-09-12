/**
 * Defines all possible items that can be available in the shop.
 * The 'edit shop' panel will allow admins to enable/disable these items
 * and override their default prices.
 *
 * Structure for each item:
 * {
 *   icon: string,          // The Minecraft item ID for the icon.
 *   buyPrice: number,      // Default buy price. -1 to disable buying.
 *   sellPrice: number,     // Default sell price. -1 to disable selling.
 *   category: string,      // The main category for the item.
 *   subCategory?: string,   // Optional sub-category for more detailed sorting.
 *   displayName?: string    // Optional display name for items like enchanted books.
 * }
 */
export const items = {
    // == Ores & Minerals ==
    diamond: {
        icon: 'textures/items/diamond.png',
        buyPrice: 1000,
        sellPrice: 500,
        category: 'Ores & Minerals',
        displayName: 'Diamond'
    },
    emerald: {
        icon: 'textures/items/emerald.png',
        buyPrice: 800,
        sellPrice: 400,
        category: 'Ores & Minerals',
        displayName: 'Emerald'
    },
    goldIngot: {
        icon: 'textures/items/gold_ingot.png',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Ores & Minerals',
        displayName: 'Gold Ingot'
    },
    ironIngot: {
        icon: 'textures/items/iron_ingot.png',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Ores & Minerals',
        displayName: 'Iron Ingot'
    },
    netheriteIngot: {
        icon: 'textures/items/netherite_ingot.png',
        buyPrice: 10000,
        sellPrice: 5000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Ingot'
    },
    netheriteScrap: {
        icon: 'textures/items/netherite_scrap.png',
        buyPrice: 2000,
        sellPrice: 1000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Scrap'
    },
    ancientDebris: {
        icon: 'textures/blocks/ancient_debris_side.png',
        buyPrice: 1800,
        sellPrice: 900,
        category: 'Ores & Minerals',
        displayName: 'Ancient Debris'
    },
    lapisLazuli: {
        icon: 'textures/items/lapis_lazuli.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Ores & Minerals',
        displayName: 'Lapis Lazuli'
    },
    quartz: {
        icon: 'textures/items/quartz.png',
        buyPrice: 30,
        sellPrice: 15,
        category: 'Ores & Minerals',
        displayName: 'Quartz'
    },

    // == Special Items ==
    totemOfUndying: {
        icon: 'textures/items/totem.png',
        buyPrice: 5000,
        sellPrice: 2500,
        category: 'Special Items',
        displayName: 'Totem Of Undying'
    },
    netherStar: {
        icon: 'textures/items/nether_star.png',
        buyPrice: 20000,
        sellPrice: -1, // Cannot be sold
        category: 'Special Items',
        displayName: 'Nether Star'
    },
    shulkerShell: {
        icon: 'textures/items/shulker_shell.png',
        buyPrice: 750,
        sellPrice: 300,
        category: 'Special Items',
        displayName: 'Shulker Shell'
    },
    elytra: {
        icon: 'textures/items/elytra.png',
        buyPrice: 15000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Elytra'
    },
    witherSkeletonSkull: {
        icon: 'textures/items/skull_wither_skeleton.png',
        buyPrice: 8000,
        sellPrice: 2000,
        category: 'Special Items',
        displayName: 'Wither Skeleton Skull'
    },
    enchantedGoldenApple: {
        icon: 'textures/items/apple_golden.png',
        buyPrice: 25000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Enchanted Golden Apple'
    },

    // == Logs ==
    oakLog: {
        icon: 'textures/blocks/log_oak.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Oak Log'
    },
    spruceLog: {
        icon: 'textures/blocks/log_spruce.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Spruce Log'
    },
    birchLog: {
        icon: 'textures/blocks/log_birch.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Birch Log'
    },
    jungleLog: {
        icon: 'textures/blocks/log_jungle.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Jungle Log'
    },
    acaciaLog: {
        icon: 'textures/blocks/log_acacia.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Acacia Log'
    },
    darkOakLog: {
        icon: 'textures/blocks/log_big_oak.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Dark Oak Log'
    },
    mangroveLog: {
        icon: 'textures/blocks/mangrove_log_side.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Mangrove Log'
    },
    cherryLog: {
        icon: 'textures/blocks/cherry_log_side.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Cherry Log'
    },
    crimsonStem: {
        icon: 'textures/blocks/crimson_stem.png',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Crimson Stem'
    },
    warpedStem: {
        icon: 'textures/blocks/warped_stem.png',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Warped Stem'
    },

    // == Building Blocks ==
    stone: {
        icon: 'textures/blocks/stone.png',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Stone'
    },
    cobblestone: {
        icon: 'textures/blocks/cobblestone.png',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Cobblestone'
    },
    dirt: {
        icon: 'textures/blocks/dirt.png',
        buyPrice: 2,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Dirt'
    },
    sand: {
        icon: 'textures/blocks/sand.png',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Sand'
    },
    gravel: {
        icon: 'textures/blocks/gravel.png',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Gravel'
    },
    glass: {
        icon: 'textures/blocks/glass.png',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Glass'
    },
    terracotta: {
        icon: 'textures/blocks/hardened_clay.png',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Terracotta'
    },
    whiteConcrete: {
        icon: 'textures/blocks/concrete_white.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Building Blocks',
        displayName: 'White Concrete'
    },
    stoneBricks: {
        icon: 'textures/blocks/stonebrick.png',
        buyPrice: 12,
        sellPrice: 6,
        category: 'Building Blocks',
        displayName: 'Stone Bricks'
    },
    obsidian: {
        icon: 'textures/blocks/obsidian.png',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Building Blocks',
        displayName: 'Obsidian'
    },
    glowstone: {
        icon: 'textures/blocks/glowstone.png',
        buyPrice: 80,
        sellPrice: 40,
        category: 'Building Blocks',
        displayName: 'Glowstone'
    },

    // == Food ==
    steak: {
        icon: 'textures/items/beef_cooked.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Steak'
    },
    cookedPorkchop: {
        icon: 'textures/items/porkchop_cooked.png',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Porkchop'
    },
    bread: {
        icon: 'textures/items/bread.png',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Food',
        displayName: 'Bread'
    },
    goldenCarrot: {
        icon: 'textures/items/carrot_golden.png',
        buyPrice: 100,
        sellPrice: 40,
        category: 'Food',
        displayName: 'Golden Carrot'
    },

    // == Farming ==
    wheat: {
        icon: 'textures/items/wheat.png',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Wheat'
    },
    carrot: {
        icon: 'textures/items/carrot.png',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Carrot'
    },
    potato: {
        icon: 'textures/items/potato.png',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Potato'
    },
    melonSlice: {
        icon: 'textures/items/melon.png',
        buyPrice: 3,
        sellPrice: 1,
        category: 'Farming',
        displayName: 'Melon Slice'
    },
    pumpkin: {
        icon: 'textures/blocks/pumpkin_side.png',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Farming',
        displayName: 'Pumpkin'
    },
    sugarCane: {
        icon: 'textures/items/reeds.png',
        buyPrice: 8,
        sellPrice: 4,
        category: 'Farming',
        displayName: 'Sugar Cane'
    },
    netherWart: {
        icon: 'textures/items/nether_wart.png',
        buyPrice: 25,
        sellPrice: 10,
        category: 'Farming',
        subCategory: 'Potions',
        displayName: 'Nether Wart'
    },

    // == Enchantment Books ==
    // General
    enchantMending: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 8000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Mending',
        enchantment: { id: 'mending', level: 1 }
    },
    enchantUnbreaking3: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Unbreaking III',
        enchantment: { id: 'unbreaking', level: 3 }
    },

    // Sword
    enchantSharpness5: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Sharpness V',
        enchantment: { id: 'sharpness', level: 5 }
    },
    enchantLooting3: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Looting III',
        enchantment: { id: 'looting', level: 3 }
    },
    enchantFireAspect2: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Fire Aspect II',
        enchantment: { id: 'fire_aspect', level: 2 }
    },

    // Armour
    enchantProtection4: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Protection IV',
        enchantment: { id: 'protection', level: 4 }
    },
    enchantFeatherFalling4: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Feather Falling IV',
        enchantment: { id: 'feather_falling', level: 4 }
    },

    // Tools
    enchantEfficiency5: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Efficiency V',
        enchantment: { id: 'efficiency', level: 5 }
    },
    enchantFortune3: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Fortune III',
        enchantment: { id: 'fortune', level: 3 }
    },
    enchantSilkTouch: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Silk Touch',
        enchantment: { id: 'silk_touch', level: 1 }
    },

    // Bow
    enchantPower5: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Power V',
        enchantment: { id: 'power', level: 5 }
    },
    enchantInfinity: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 7000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Infinity',
        enchantment: { id: 'infinity', level: 1 }
    },
    enchantFlame: {
        _comment: 'Note: sellPrice changed from 500 to -1',
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Flame',
        enchantment: { id: 'flame', level: 1 }
    },

    // Trident
    enchantImpaling5: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Impaling V',
        enchantment: { id: 'impaling', level: 5 }
    },
    enchantLoyalty3: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 2500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Loyalty III',
        enchantment: { id: 'loyalty', level: 3 }
    },
    enchantChanneling: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Channeling',
        enchantment: { id: 'channeling', level: 1 }
    },
    enchantRiptide3: {
        icon: 'textures/items/book_enchanted.png',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Riptide III',
        enchantment: { id: 'riptide', level: 3 }
    }
};
