export interface KitItem {
    typeId: string;
    amount: number;
}

export interface KitDefinition {
    enabled: boolean;
    description: string;
    cooldownSeconds: number;
    icon: string;
    price: number;
    permissionLevel: number;
    items: KitItem[];
}

export interface KitsConfig {
    enabled: boolean;
    kitDefinitions: Record<string, KitDefinition>;
}

export const kitsConfig: KitsConfig = {
    enabled: true,
    kitDefinitions: {
        starter: {
            enabled: true,
            description: 'A basic kit to get you started.',
            cooldownSeconds: 3600, // 1 hour
            icon: 'textures/items/stone_sword',
            price: 0,
            permissionLevel: 1024,
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
            icon: 'textures/items/beef_cooked',
            price: 10,
            permissionLevel: 1024,
            items: [
                { typeId: 'minecraft:cooked_beef', amount: 8 }
            ]
        },
        warrior: {
            enabled: true,
            description: 'A kit for the aspiring warrior.',
            cooldownSeconds: 86400, // 24 hours
            icon: 'textures/items/iron_sword',
            price: 100,
            permissionLevel: 1024,
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
            enabled: true,
            description: 'A kit for the skilled archer.',
            cooldownSeconds: 86400, // 24 hours
            icon: 'textures/items/bow_standby',
            price: 100,
            permissionLevel: 1024,
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
            enabled: true,
            description: 'A kit for the dedicated miner.',
            cooldownSeconds: 43200, // 12 hours
            icon: 'textures/items/iron_pickaxe',
            price: 50,
            permissionLevel: 1024,
            items: [
                { typeId: 'minecraft:iron_pickaxe', amount: 1 },
                { typeId: 'minecraft:iron_shovel', amount: 1 },
                { typeId: 'minecraft:torch', amount: 64 },
                { typeId: 'minecraft:coal', amount: 16 },
                { typeId: 'minecraft:bread', amount: 16 }
            ]
        },
        builder: {
            enabled: true,
            description: 'A kit for the creative builder.',
            cooldownSeconds: 86400, // 24 hours
            icon: 'textures/blocks/planks_oak',
            price: 200,
            permissionLevel: 1024,
            items: [
                { typeId: 'minecraft:oak_log', amount: 64 },
                { typeId: 'minecraft:oak_log', amount: 64 },
                { typeId: 'minecraft:glass', amount: 64 },
                { typeId: 'minecraft:stone_bricks', amount: 64 }
            ]
        }
    }
};
