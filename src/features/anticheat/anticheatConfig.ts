export const anticheatConfig = {
    enabled: false,
    itemCheck: {
        enabled: true,
        bannedItems: ['minecraft:bedrock', 'minecraft:barrier', 'minecraft:command_block', 'minecraft:structure_block', 'minecraft:border_block'],
        illegalEnchantments: true,
        removeIllegalItems: true
    },
    movementCheck: {
        enabled: false, // High performance impact, disabled by default
        maxSpeed: 2.0, // Blocks per tick (approx)
        flightDetection: false
    }
};
