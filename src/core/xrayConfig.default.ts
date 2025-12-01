export interface MonitoredBlock {
    blockId: string;
    dimensionId: string;
    minY: number;
    maxY: number;
}

export interface MonitoredOreType {
    enabled: boolean;
    oreName: string;
    blocks: MonitoredBlock[];
}

export const xrayConfig = {
    notifications: {
        logToConsole: true,
        alertBufferingSeconds: 10,
        alertPermissionLevel: 2
    },
    obfuscation: {
        enabled: false,
        radius: 1, // Chunk radius
        updateInterval: 10 // Seconds
    },
    heuristics: {
        enabled: false,
        lightLevelCheck: false,
        tunnelCheck: false,
        gazeTracking: false,
        baitOres: false
    },
    performance: {
        maxBlockUpdatesPerTick: 100
    },
    monitoredOreTypes: {
        diamond: {
            enabled: false,
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
            enabled: false,
            oreName: 'Ancient Debris',
            blocks: [
                {
                    blockId: 'minecraft:ancient_debris',
                    dimensionId: 'minecraft:nether',
                    minY: 8,
                    maxY: 119
                }
            ]
        },
        gold: {
            enabled: false,
            oreName: 'Gold Ore',
            blocks: [
                {
                    blockId: 'minecraft:gold_ore',
                    dimensionId: 'minecraft:overworld',
                    minY: -64,
                    maxY: 32
                },
                {
                    blockId: 'minecraft:deepslate_gold_ore',
                    dimensionId: 'minecraft:overworld',
                    minY: -64,
                    maxY: 32
                },
                {
                    blockId: 'minecraft:nether_gold_ore',
                    dimensionId: 'minecraft:nether',
                    minY: 10,
                    maxY: 117
                }
            ]
        }
    }
};

export default xrayConfig;
