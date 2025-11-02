export const xrayConfig = {
    enabled: false,
    notifications: {
        message: '§8[§cX-Ray§8]§r §7{playerName}§r mined §e{oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r'
    },
    monitoredOres: [
        {
            blockId: 'minecraft:diamond_ore',
            dimensionId: 'minecraft:overworld',
            minY: -64,
            maxY: 16,
            oreName: 'Diamond Ore'
        },
        {
            blockId: 'minecraft:deepslate_diamond_ore',
            dimensionId: 'minecraft:overworld',
            minY: -64,
            maxY: 16,
            oreName: 'Diamond Ore'
        },
        {
            blockId: 'minecraft:ancient_debris',
            dimensionId: 'minecraft:the_nether',
            minY: 8,
            maxY: 119,
            oreName: 'Ancient Debris'
        }
    ]
};
