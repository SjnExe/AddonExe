/**
 * @typedef {object} KitItem
 * @property {string} typeId The Minecraft item ID (e.g., 'minecraft:iron_sword').
 * @property {number} amount The number of items to give.
 * @property {string} [nameTag] An optional custom name for the item.
 * @property {string[]} [lore] Optional lore text for the item.
 */

/**
 * @typedef {object} Kit
 * @property {string} description A brief description of the kit.
 * @property {number} cooldownSeconds The cooldown in seconds before the kit can be claimed again.
 * @property {KitItem[]} items An array of items included in the kit.
 */

/**
 * @type {Object.<string, Kit>}
 */
export const kits = {
    starter: {
        enabled: true,
        description: 'A basic kit to get you started.',
        cooldownSeconds: 3600, // 1 hour
        items: [
            { typeId: 'minecraft:stone_sword', amount: 1 },
            { typeId: 'minecraft:stone_pickaxe', amount: 1 },
            { typeId: 'minecraft:stone_axe', amount: 1 },
            { typeId: 'minecraft:stone_shovel', amount: 1 },
            { typeId: 'minecraft:bread', amount: 16 }
        ]
    },
    food: {
        enabled: true,
        description: 'A simple food refill.',
        cooldownSeconds: 900, // 15 minutes
        items: [
            { typeId: 'minecraft:cooked_beef', amount: 8 }
        ]
    },
    warrior: {
        enabled: false,
        description: 'A kit for the aspiring warrior.',
        cooldownSeconds: 86400, // 24 hours
        items: [
            { typeId: 'minecraft:iron_sword', amount: 1 },
            { typeId: 'minecraft:iron_helmet', amount: 1 },
            { typeId: 'minecraft:iron_chestplate', amount: 1 },
            { typeId: 'minecraft:iron_leggings', amount: 1 },
            { typeId: 'minecraft:iron_boots', amount: 1 },
            { typeId: 'minecraft:shield', amount: 1 },
            { typeId: 'minecraft:cooked_beef', amount: 16 }
        ]
    },
    archer: {
        enabled: false,
        description: 'A kit for the skilled archer.',
        cooldownSeconds: 86400, // 24 hours
        items: [
            { typeId: 'minecraft:bow', amount: 1 },
            { typeId: 'minecraft:arrow', amount: 64 },
            { typeId: 'minecraft:leather_helmet', amount: 1 },
            { typeId: 'minecraft:leather_chestplate', amount: 1 },
            { typeId: 'minecraft:leather_leggings', amount: 1 },
            { typeId: 'minecraft:leather_boots', amount: 1 },
            { typeId: 'minecraft:cooked_chicken', amount: 16 }
        ]
    },
    miner: {
        enabled: false,
        description: 'A kit for the dedicated miner.',
        cooldownSeconds: 43200, // 12 hours
        items: [
            { typeId: 'minecraft:iron_pickaxe', amount: 1 },
            { typeId: 'minecraft:iron_shovel', amount: 1 },
            { typeId: 'minecraft:torch', amount: 64 },
            { typeId: 'minecraft:coal', amount: 16 },
            { typeId: 'minecraft:bread', amount: 16 }
        ]
    },
    builder: {
        enabled: false,
        description: 'A kit for the creative builder.',
        cooldownSeconds: 86400, // 24 hours
        items: [
            { typeId: 'minecraft:oak_log', amount: 64 },
            { typeId: 'minecraft:oak_log', amount: 64 },
            { typeId: 'minecraft:glass', amount: 64 },
            { typeId: 'minecraft:stone_bricks', amount: 64 }
        ]
    }
};
