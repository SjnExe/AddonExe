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
    settings: {
        ignoreCreative: true,
        ignoreSpectator: true,
        adminBypass: true,
        bypassPermissionLevel: 1
    },
    notifications: {
        logToConsole: true,
        alertBufferingSeconds: 10,
        alertPermissionLevel: 2
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

export default xrayConfig;
