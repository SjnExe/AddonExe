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
        icon: 'textures/items/diamond',
        buyPrice: 1000,
        sellPrice: 500,
        category: 'Ores & Minerals',
        displayName: 'Diamond'
    },
    emerald: {
        icon: 'textures/items/emerald',
        buyPrice: 800,
        sellPrice: 400,
        category: 'Ores & Minerals',
        displayName: 'Emerald'
    },
    goldIngot: {
        icon: 'textures/items/gold_ingot',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Ores & Minerals',
        displayName: 'Gold Ingot'
    },
    ironIngot: {
        icon: 'textures/items/iron_ingot',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Ores & Minerals',
        displayName: 'Iron Ingot'
    },
    netheriteIngot: {
        icon: 'textures/items/netherite_ingot',
        buyPrice: 10000,
        sellPrice: 5000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Ingot'
    },
    netheriteScrap: {
        icon: 'textures/items/netherite_scrap',
        buyPrice: 2000,
        sellPrice: 1000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Scrap'
    },
    ancientDebris: {
        icon: 'textures/blocks/ancient_debris_side',
        buyPrice: 1800,
        sellPrice: 900,
        category: 'Ores & Minerals',
        displayName: 'Ancient Debris'
    },
    lapisLazuli: {
        icon: 'textures/items/lapis',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Ores & Minerals',
        displayName: 'Lapis Lazuli'
    },
    quartz: {
        icon: 'textures/items/quartz',
        buyPrice: 30,
        sellPrice: 15,
        category: 'Ores & Minerals',
        displayName: 'Quartz'
    },

    // == Special Items ==
    totemOfUndying: {
        icon: 'textures/items/totem',
        buyPrice: 5000,
        sellPrice: 2500,
        category: 'Special Items',
        displayName: 'Totem Of Undying'
    },
    netherStar: {
        icon: 'textures/items/nether_star',
        buyPrice: 20000,
        sellPrice: -1, // Cannot be sold
        category: 'Special Items',
        displayName: 'Nether Star'
    },
    shulkerShell: {
        icon: 'textures/items/shulker_shell',
        buyPrice: 750,
        sellPrice: 300,
        category: 'Special Items',
        displayName: 'Shulker Shell'
    },
    elytra: {
        icon: 'textures/items/elytra',
        buyPrice: 15000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Elytra'
    },
    witherSkeletonSkull: {
        icon: 'textures/items/skull_wither_skeleton',
        buyPrice: 8000,
        sellPrice: 2000,
        category: 'Special Items',
        displayName: 'Wither Skeleton Skull'
    },
    enchantedGoldenApple: {
        icon: 'textures/items/apple_golden',
        buyPrice: 25000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Enchanted Golden Apple'
    },

    // == Logs ==
    oakLog: {
        icon: 'textures/blocks/log_oak',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Oak Log'
    },
    spruceLog: {
        icon: 'textures/blocks/log_spruce',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Spruce Log'
    },
    birchLog: {
        icon: 'textures/blocks/log_birch',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Birch Log'
    },
    jungleLog: {
        icon: 'textures/blocks/log_jungle',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Jungle Log'
    },
    acaciaLog: {
        icon: 'textures/blocks/log_acacia',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Acacia Log'
    },
    darkOakLog: {
        icon: 'textures/blocks/log_big_oak',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Dark Oak Log'
    },
    mangroveLog: {
        icon: 'textures/blocks/mangrove_log_side',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Mangrove Log'
    },
    cherryLog: {
        icon: 'textures/blocks/cherry_log_side',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Cherry Log'
    },
    crimsonStem: {
        icon: 'textures/blocks/crimson_stem',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Crimson Stem'
    },
    warpedStem: {
        icon: 'textures/blocks/warped_stem',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Warped Stem'
    },

    // == Building Blocks ==
    stone: {
        icon: 'textures/blocks/stone',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Stone'
    },
    cobblestone: {
        icon: 'textures/blocks/cobblestone',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Cobblestone'
    },
    dirt: {
        icon: 'textures/blocks/dirt',
        buyPrice: 2,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Dirt'
    },
    sand: {
        icon: 'textures/blocks/sand',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Sand'
    },
    gravel: {
        icon: 'textures/blocks/gravel',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Gravel'
    },
    glass: {
        icon: 'textures/blocks/glass',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Glass'
    },
    terracotta: {
        icon: 'textures/blocks/hardened_clay',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Terracotta'
    },
    whiteConcrete: {
        icon: 'textures/blocks/concrete_white',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Building Blocks',
        displayName: 'White Concrete'
    },
    stoneBricks: {
        icon: 'textures/blocks/stonebrick',
        buyPrice: 12,
        sellPrice: 6,
        category: 'Building Blocks',
        displayName: 'Stone Bricks'
    },
    obsidian: {
        icon: 'textures/blocks/obsidian',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Building Blocks',
        displayName: 'Obsidian'
    },
    glowstone: {
        icon: 'textures/blocks/glowstone',
        buyPrice: 80,
        sellPrice: 40,
        category: 'Building Blocks',
        displayName: 'Glowstone'
    },

    // == Food ==
    steak: {
        icon: 'textures/items/beef_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Steak'
    },
    cookedPorkchop: {
        icon: 'textures/items/porkchop_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Porkchop'
    },
    bread: {
        icon: 'textures/items/bread',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Food',
        displayName: 'Bread'
    },
    goldenCarrot: {
        icon: 'textures/items/carrot_golden',
        buyPrice: 100,
        sellPrice: 40,
        category: 'Food',
        displayName: 'Golden Carrot'
    },

    // == Farming ==
    wheat: {
        icon: 'textures/items/wheat',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Wheat'
    },
    carrot: {
        icon: 'textures/items/carrot',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Carrot'
    },
    potato: {
        icon: 'textures/items/potato',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Potato'
    },
    melonSlice: {
        icon: 'textures/items/melon',
        buyPrice: 3,
        sellPrice: 1,
        category: 'Farming',
        displayName: 'Melon Slice'
    },
    pumpkin: {
        icon: 'textures/blocks/pumpkin_side',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Farming',
        displayName: 'Pumpkin'
    },
    sugarCane: {
        icon: 'textures/items/reeds',
        buyPrice: 8,
        sellPrice: 4,
        category: 'Farming',
        displayName: 'Sugar Cane'
    },
    netherWart: {
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
        icon: 'textures/items/book_enchanted',
        buyPrice: 8000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Mending',
        enchantment: { id: 'mending', level: 1 }
    },
    enchantUnbreaking3: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Unbreaking III',
        enchantment: { id: 'unbreaking', level: 3 }
    },

    // Sword
    enchantSharpness5: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Sharpness V',
        enchantment: { id: 'sharpness', level: 5 }
    },
    enchantLooting3: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Looting III',
        enchantment: { id: 'looting', level: 3 }
    },
    enchantFireAspect2: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Fire Aspect II',
        enchantment: { id: 'fire_aspect', level: 2 }
    },

    // Armour
    enchantProtection4: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Protection IV',
        enchantment: { id: 'protection', level: 4 }
    },
    enchantFeatherFalling4: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Feather Falling IV',
        enchantment: { id: 'feather_falling', level: 4 }
    },

    // Tools
    enchantEfficiency5: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Efficiency V',
        enchantment: { id: 'efficiency', level: 5 }
    },
    enchantFortune3: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Fortune III',
        enchantment: { id: 'fortune', level: 3 }
    },
    enchantSilkTouch: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Silk Touch',
        enchantment: { id: 'silk_touch', level: 1 }
    },

    // Bow
    enchantPower5: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Power V',
        enchantment: { id: 'power', level: 5 }
    },
    enchantInfinity: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 7000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Infinity',
        enchantment: { id: 'infinity', level: 1 }
    },
    enchantFlame: {
        _comment: 'Note: sellPrice changed from 500 to -1',
        icon: 'textures/items/book_enchanted',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Flame',
        enchantment: { id: 'flame', level: 1 }
    },

    // Trident
    enchantImpaling5: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Impaling V',
        enchantment: { id: 'impaling', level: 5 }
    },
    enchantLoyalty3: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 2500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Loyalty III',
        enchantment: { id: 'loyalty', level: 3 }
    },
    enchantChanneling: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Channeling',
        enchantment: { id: 'channeling', level: 1 }
    },
    enchantRiptide3: {
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Riptide III',
        enchantment: { id: 'riptide', level: 3 }
    }
};
