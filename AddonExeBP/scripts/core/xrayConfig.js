export const xrayConfig = {
    notifications: {
        message: '§8[§cX-Ray§8]§r §7{playerName}§r mined §e{oreName}§r at §a{x}§r, §a{y}§r, §a{z}§r',
        logToConsole: true,
        alertBufferingSeconds: 10
    },
    monitoredOreTypes: {
        diamond: {
            enabled: true,
            oreName: 'Diamond Ore',
            blocks: [
                {
                    blockId: 'minecraft:diamond_ore',
                    dimensionId: 'minecraft:overworld',
                    minY: -64,
                    maxY: 16
                },
                {
                    blockId: 'minecraft:deepslate_diamond_ore',
                    dimensionId: 'minecraft:overworld',
                    minY: -64,
                    maxY: 16
                }
            ]
        },
        ancientDebris: {
            enabled: true,
            oreName: 'Ancient Debris',
            blocks: [
                {
                    blockId: 'minecraft:ancient_debris',
                    dimensionId: 'minecraft:nether',
                    minY: 8,
                    maxY: 119
                }
            ]
        }
    }
};
