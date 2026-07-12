import { MinecraftBlockTypes, MinecraftDimensionTypes } from '@minecraft/vanilla-data';

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

export interface XrayConfig {
    settings: {
        ignoreCreative: boolean;
        ignoreSpectator: boolean;
        adminBypass: boolean;
        bypassPermissionLevel: number;
    };
    notifications: {
        logToConsole: boolean;
        alertBufferingSeconds: number;
        alertPermissionLevel: number;
    };
    monitoredOreTypes: Record<string, MonitoredOreType>;
}

export const xrayConfig: XrayConfig = {
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
                    blockId: MinecraftBlockTypes.DiamondOre,
                    dimensionId: MinecraftDimensionTypes.Overworld,
                    minY: -64,
                    maxY: 16
                },
                {
                    blockId: MinecraftBlockTypes.DeepslateDiamondOre,
                    dimensionId: MinecraftDimensionTypes.Overworld,
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
                    blockId: MinecraftBlockTypes.AncientDebris,
                    dimensionId: MinecraftDimensionTypes.Nether,
                    minY: 8,
                    maxY: 119
                }
            ]
        }
    }
};

export default xrayConfig;
