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
        icon: 'minecraft:diamond',
        buyPrice: 1000,
        sellPrice: 500,
        category: 'Ores & Minerals',
        subCategory: 'Gems'
    },
    emerald: {
        icon: 'minecraft:emerald',
        buyPrice: 800,
        sellPrice: 400,
        category: 'Ores & Minerals',
        subCategory: 'Gems'
    },
    goldIngot: {
        icon: 'minecraft:gold_ingot',
        buyPrice: 100,
        sellPrice: 50,
        category: 'Ores & Minerals',
        subCategory: 'Ingots'
    },
    ironIngot: {
        icon: 'minecraft:iron_ingot',
        buyPrice: 50,
        sellPrice: 25,
        category: 'Ores & Minerals',
        subCategory: 'Ingots'
    },
    netheriteIngot: {
        icon: 'minecraft:netherite_ingot',
        buyPrice: 10000,
        sellPrice: 5000,
        category: 'Ores & Minerals',
        subCategory: 'Ingots'
    },
    netheriteScrap: {
        icon: 'minecraft:netherite_scrap',
        buyPrice: 2000,
        sellPrice: 1000,
        category: 'Ores & Minerals',
        subCategory: 'Materials'
    },
    ancientDebris: {
        icon: 'minecraft:ancient_debris',
        buyPrice: 1800,
        sellPrice: 900,
        category: 'Ores & Minerals',
        subCategory: 'Raw Materials'
    },
    lapisLazuli: {
        icon: 'minecraft:lapis_lazuli',
        buyPrice: 20,
        sellPrice: 10,
        category: 'Ores & Minerals',
        subCategory: 'Materials'
    },
    quartz: {
        icon: 'minecraft:quartz',
        buyPrice: 30,
        sellPrice: 15,
        category: 'Ores & Minerals',
        subCategory: 'Materials'
    },

    // == Mob Drops ==
    totemOfUndying: {
        icon: 'minecraft:totem_of_undying',
        buyPrice: 5000,
        sellPrice: 2500,
        category: 'Mob Drops'
    },
    netherStar: {
        icon: 'minecraft:nether_star',
        buyPrice: 20000,
        sellPrice: -1, // Cannot be sold
        category: 'Mob Drops'
    },
    shulkerShell: {
        icon: 'minecraft:shulker_shell',
        buyPrice: 750,
        sellPrice: 300,
        category: 'Mob Drops'
    },
    elytra: {
        icon: 'minecraft:elytra',
        buyPrice: 15000,
        sellPrice: -1,
        category: 'Mob Drops'
    },
    witherSkeletonSkull: {
        icon: 'minecraft:wither_skeleton_skull',
        buyPrice: 8000,
        sellPrice: 2000,
        category: 'Mob Drops'
    },

    // == Farming ==
    wheat: {
        icon: 'minecraft:wheat',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming'
    },
    carrot: {
        icon: 'minecraft:carrot',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming'
    },
    potato: {
        icon: 'minecraft:potato',
        buyPrice: 5,
        sellPrice: 2,
        category: 'Farming'
    },
    melonSlice: {
        icon: 'minecraft:melon_slice',
        buyPrice: 3,
        sellPrice: 1,
        category: 'Farming'
    },
    pumpkin: {
        icon: 'minecraft:pumpkin',
        buyPrice: 10,
        sellPrice: 5,
        category: 'Farming'
    },
    sugarCane: {
        icon: 'minecraft:sugar_cane',
        buyPrice: 8,
        sellPrice: 4,
        category: 'Farming'
    },
    netherWart: {
        icon: 'minecraft:nether_wart',
        buyPrice: 25,
        sellPrice: 10,
        category: 'Farming',
        subCategory: 'Potions'
    },

    // == Enchantment Books ==
    // General
    enchantMending: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 8000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Mending',
        enchantment: { id: 'mending', level: 1 }
    },
    enchantUnbreaking3: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'General',
        displayName: 'Unbreaking III',
        enchantment: { id: 'unbreaking', level: 3 }
    },

    // Sword
    enchantSharpness5: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Sharpness V',
        enchantment: { id: 'sharpness', level: 5 }
    },
    enchantLooting3: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Looting III',
        enchantment: { id: 'looting', level: 3 }
    },
    enchantFireAspect2: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Sword',
        displayName: 'Fire Aspect II',
        enchantment: { id: 'fire_aspect', level: 2 }
    },

    // Armour
    enchantProtection4: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 4500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Protection IV',
        enchantment: { id: 'protection', level: 4 }
    },
    enchantFeatherFalling4: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Armour',
        displayName: 'Feather Falling IV',
        enchantment: { id: 'feather_falling', level: 4 }
    },

    // Tools
    enchantEfficiency5: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Efficiency V',
        enchantment: { id: 'efficiency', level: 5 }
    },
    enchantFortune3: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Fortune III',
        enchantment: { id: 'fortune', level: 3 }
    },
    enchantSilkTouch: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 6000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Tools',
        displayName: 'Silk Touch',
        enchantment: { id: 'silk_touch', level: 1 }
    },

    // Bow
    enchantPower5: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 5000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Power V',
        enchantment: { id: 'power', level: 5 }
    },
    enchantInfinity: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 7000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Infinity',
        enchantment: { id: 'infinity', level: 1 }
    },
    enchantFlame: {
        _comment: "Note: sellPrice changed from 500 to -1",
        icon: 'minecraft:enchanted_book',
        buyPrice: 2000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Bow',
        displayName: 'Flame',
        enchantment: { id: 'flame', level: 1 }
    },

    // Trident
    enchantImpaling5: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 3000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Impaling V',
        enchantment: { id: 'impaling', level: 5 }
    },
    enchantLoyalty3: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 2500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Loyalty III',
        enchantment: { id: 'loyalty', level: 3 }
    },
    enchantChanneling: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 4000,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Channeling',
        enchantment: { id: 'channeling', level: 1 }
    },
    enchantRiptide3: {
        icon: 'minecraft:enchanted_book',
        buyPrice: 3500,
        sellPrice: -1,
        category: 'Enchantments',
        subCategory: 'Trident',
        displayName: 'Riptide III',
        enchantment: { id: 'riptide', level: 3 }
    }
};
