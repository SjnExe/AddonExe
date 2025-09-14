/**
 * Defines all possible items that can be available in the shop.
 * The 'edit shop' panel will allow admins to enable/disable these items
 * and override their default prices.
 *
 * Structure for each item:
 * {
 *   itemId: string,        // The Minecraft item type ID (e.g., 'minecraft:diamond').
 *   icon: string,          // The texture path for the icon (e.g., 'textures/items/diamond').
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
        itemId: 'minecraft:diamond',
        icon: 'textures/items/diamond',
        buyPrice: 1000,
        sellPrice: 500,
        category: 'Ores & Minerals',
        displayName: 'Diamond'
    },
    emerald: {
        itemId: 'minecraft:emerald',
        icon: 'textures/items/emerald',
        buyPrice: 800,
        sellPrice: 400,
        category: 'Ores & Minerals',
        displayName: 'Emerald'
    },
    goldIngot: {
        itemId: 'minecraft:gold_ingot',
        icon: 'textures/items/gold_ingot',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Ores & Minerals',
        displayName: 'Gold Ingot'
    },
    ironIngot: {
        itemId: 'minecraft:iron_ingot',
        icon: 'textures/items/iron_ingot',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Ores & Minerals',
        displayName: 'Iron Ingot'
    },
    netheriteIngot: {
        itemId: 'minecraft:netherite_ingot',
        icon: 'textures/items/netherite_ingot',
        buyPrice: 10000,
        sellPrice: 5000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Ingot'
    },
    netheriteScrap: {
        itemId: 'minecraft:netherite_scrap',
        icon: 'textures/items/netherite_scrap',
        buyPrice: 2000,
        sellPrice: 1000,
        category: 'Ores & Minerals',
        displayName: 'Netherite Scrap'
    },
    ancientDebris: {
        itemId: 'minecraft:ancient_debris',
        icon: 'textures/blocks/ancient_debris_side',
        buyPrice: 1800,
        sellPrice: 900,
        category: 'Ores & Minerals',
        displayName: 'Ancient Debris'
    },
    lapisLazuli: {
        itemId: 'minecraft:lapis_lazuli',
        icon: 'textures/blocks/lapis_ore',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Ores & Minerals',
        displayName: 'Lapis Lazuli'
    },
    quartz: {
        itemId: 'minecraft:quartz',
        icon: 'textures/items/quartz',
        buyPrice: 30,
        sellPrice: 15,
        category: 'Ores & Minerals',
        displayName: 'Quartz'
    },

    // == Special Items ==
    totemOfUndying: {
        itemId: 'minecraft:totem_of_undying',
        icon: 'textures/items/totem',
        buyPrice: 5000,
        sellPrice: 2500,
        category: 'Special Items',
        displayName: 'Totem Of Undying'
    },
    netherStar: {
        itemId: 'minecraft:nether_star',
        icon: 'textures/items/nether_star',
        buyPrice: 20000,
        sellPrice: -1, // Cannot be sold
        category: 'Special Items',
        displayName: 'Nether Star'
    },
    shulkerShell: {
        itemId: 'minecraft:shulker_shell',
        icon: 'textures/items/shulker_shell',
        buyPrice: 750,
        sellPrice: 300,
        category: 'Special Items',
        displayName: 'Shulker Shell'
    },
    elytra: {
        itemId: 'minecraft:elytra',
        icon: 'textures/items/elytra',
        buyPrice: 15000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Elytra'
    },
    witherSkeletonSkull: {
        itemId: 'minecraft:wither_skeleton_skull',
        icon: 'textures/items/spawn_eggs/spawn_egg_wither_skeleton',
        buyPrice: 8000,
        sellPrice: 2000,
        category: 'Special Items',
        displayName: 'Wither Skeleton Skull'
    },
    enchantedGoldenApple: {
        itemId: 'minecraft:enchanted_golden_apple',
        icon: 'textures/items/apple_golden',
        buyPrice: 25000,
        sellPrice: -1,
        category: 'Special Items',
        displayName: 'Enchanted Golden Apple'
    },

    // == Logs ==
    oakLog: {
        itemId: 'minecraft:oak_log',
        icon: 'textures/blocks/log_oak_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Oak Log'
    },
    spruceLog: {
        itemId: 'minecraft:spruce_log',
        icon: 'textures/blocks/log_spruce_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Spruce Log'
    },
    birchLog: {
        itemId: 'minecraft:birch_log',
        icon: 'textures/blocks/log_birch_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Birch Log'
    },
    jungleLog: {
        itemId: 'minecraft:jungle_log',
        icon: 'textures/blocks/log_jungle_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Jungle Log'
    },
    acaciaLog: {
        itemId: 'minecraft:acacia_log',
        icon: 'textures/blocks/log_acacia_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Acacia Log'
    },
    darkOakLog: {
        itemId: 'minecraft:dark_oak_log',
        icon: 'textures/blocks/log_big_oak_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Dark Oak Log'
    },
    mangroveLog: {
        itemId: 'minecraft:mangrove_log',
        icon: 'textures/blocks/mangrove_log_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Mangrove Log'
    },
    cherryLog: {
        itemId: 'minecraft:cherry_log',
        icon: 'textures/blocks/cherry_log_top',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Logs',
        displayName: 'Cherry Log'
    },
    crimsonStem: {
        itemId: 'minecraft:crimson_stem',
        icon: 'textures/blocks/huge_fungus/crimson_log_top',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Crimson Stem'
    },
    warpedStem: {
        itemId: 'minecraft:warped_stem',
        icon: 'textures/blocks/huge_fungus/warped_stem_top',
        buyPrice: 25,
        sellPrice: 12,
        category: 'Logs',
        displayName: 'Warped Stem'
    },

    // == Building Blocks ==
    stone: {
        itemId: 'minecraft:stone',
        icon: 'textures/blocks/stone',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Stone'
    },
    cobblestone: {
        itemId: 'minecraft:cobblestone',
        icon: 'textures/blocks/cobblestone',
        buyPrice: 5,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Cobblestone'
    },
    dirt: {
        itemId: 'minecraft:dirt',
        icon: 'textures/blocks/dirt',
        buyPrice: 2,
        sellPrice: 1,
        category: 'Building Blocks',
        displayName: 'Dirt'
    },
    sand: {
        itemId: 'minecraft:sand',
        icon: 'textures/blocks/sand',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Sand'
    },
    gravel: {
        itemId: 'minecraft:gravel',
        icon: 'textures/blocks/gravel',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Building Blocks',
        displayName: 'Gravel'
    },
    glass: {
        itemId: 'minecraft:glass',
        icon: 'textures/blocks/glass',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Glass'
    },
    terracotta: {
        itemId: 'minecraft:terracotta',
        icon: 'textures/blocks/hardened_clay',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Building Blocks',
        displayName: 'Terracotta'
    },
    whiteConcrete: {
        itemId: 'minecraft:white_concrete',
        icon: 'textures/blocks/concrete_white',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Building Blocks',
        displayName: 'White Concrete'
    },
    stoneBricks: {
        itemId: 'minecraft:stone_bricks',
        icon: 'textures/blocks/stonebrick',
        buyPrice: 12,
        sellPrice: 6,
        category: 'Building Blocks',
        displayName: 'Stone Bricks'
    },
    obsidian: {
        itemId: 'minecraft:obsidian',
        icon: 'textures/blocks/obsidian',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Building Blocks',
        displayName: 'Obsidian'
    },
    glowstone: {
        itemId: 'minecraft:glowstone',
        icon: 'textures/blocks/glowstone',
        buyPrice: 80,
        sellPrice: 40,
        category: 'Building Blocks',
        displayName: 'Glowstone'
    },

    // == Food ==
    steak: {
        itemId: 'minecraft:cooked_beef',
        icon: 'textures/items/beef_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Steak'
    },
    cookedPorkchop: {
        itemId: 'minecraft:cooked_porkchop',
        icon: 'textures/items/porkchop_cooked',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Food',
        displayName: 'Cooked Porkchop'
    },
    bread: {
        itemId: 'minecraft:bread',
        icon: 'textures/items/bread',
        buyPrice: 15,
        sellPrice: 5,
        category: 'Food',
        displayName: 'Bread'
    },
    goldenCarrot: {
        itemId: 'minecraft:golden_carrot',
        icon: 'textures/items/carrot_golden',
        buyPrice: 100,
        sellPrice: 40,
        category: 'Food',
        displayName: 'Golden Carrot'
    },

    // == Farming ==
    wheat: {
        itemId: 'minecraft:wheat',
        icon: 'textures/items/wheat',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Wheat'
    },
    carrot: {
        itemId: 'minecraft:carrot',
        icon: 'textures/items/carrot',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Carrot'
    },
    potato: {
        itemId: 'minecraft:potato',
        icon: 'textures/items/potato',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming',
        displayName: 'Potato'
    },
    melonSlice: {
        itemId: 'minecraft:melon_slice',
        icon: 'textures/items/melon',
        buyPrice: 3,
        sellPrice: 1,
        category: 'Farming',
        displayName: 'Melon Slice'
    },
    pumpkin: {
        itemId: 'minecraft:pumpkin',
        icon: 'textures/blocks/pumpkin_face_off',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Farming',
        displayName: 'Pumpkin'
    },
    sugarCane: {
        itemId: 'minecraft:sugar_cane',
        icon: 'textures/items/reeds',
        buyPrice: 8,
        sellPrice: 4,
        category: 'Farming',
        displayName: 'Sugar Cane'
    },
    netherWart: {
        itemId: 'minecraft:nether_wart',
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
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 8000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Mending',
        enchantment: { id: 'mending', level: 1 }
    },
    enchantUnbreaking3: {
        itemId: 'minecraft:enchanted_book',
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
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Sharpness V',
        enchantment: { id: 'sharpness', level: 5 }
    },
    enchantLooting3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Looting III',
        enchantment: { id: 'looting', level: 3 }
    },
    enchantFireAspect2: {
        itemId: 'minecraft:enchanted_book',
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
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Protection IV',
        enchantment: { id: 'protection', level: 4 }
    },
    enchantFeatherFalling4: {
        itemId: 'minecraft:enchanted_book',
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
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Efficiency V',
        enchantment: { id: 'efficiency', level: 5 }
    },
    enchantFortune3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Fortune III',
        enchantment: { id: 'fortune', level: 3 }
    },
    enchantSilkTouch: {
        itemId: 'minecraft:enchanted_book',
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
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Power V',
        enchantment: { id: 'power', level: 5 }
    },
    enchantInfinity: {
        itemId: 'minecraft:enchanted_book',
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
        itemId: 'minecraft:enchanted_book',
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
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Impaling V',
        enchantment: { id: 'impaling', level: 5 }
    },
    enchantLoyalty3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 2500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Loyalty III',
        enchantment: { id: 'loyalty', level: 3 }
    },
    enchantChanneling: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Channeling',
        enchantment: { id: 'channeling', level: 1 }
    },
    enchantRiptide3: {
        itemId: 'minecraft:enchanted_book',
        icon: 'textures/items/book_enchanted',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Riptide III',
        enchantment: { id: 'riptide', level: 3 }
    }
};
