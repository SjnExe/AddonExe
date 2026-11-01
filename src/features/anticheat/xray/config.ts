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

export interface XrayHeuristicsConfig {
  enabled: boolean;
  checkAirExposure: boolean;
  minStoneBreaksForRatio: number;
  ratioThreshold: number;
  alertSuspicionThreshold: number;
}

export interface XrayConfig {
  settings: {
    ignoreCreative: boolean;
    ignoreSpectator: boolean;
    adminBypass: boolean;
  };
  notifications: {
    logToConsole: boolean;
    alertBufferingSeconds: number;
  };
  heuristics: XrayHeuristicsConfig;
  monitoredOreTypes: Record<string, MonitoredOreType>;
}

export const xrayConfig: XrayConfig = {
  settings: {
    ignoreCreative: true,
    ignoreSpectator: true,
    adminBypass: true,
  },
  notifications: {
    logToConsole: true,
    alertBufferingSeconds: 10,
  },
  heuristics: {
    enabled: true,
    checkAirExposure: true,
    minStoneBreaksForRatio: 40,
    ratioThreshold: 0.12,
    alertSuspicionThreshold: 75,
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
          maxY: 16,
        },
        {
          blockId: MinecraftBlockTypes.DeepslateDiamondOre,
          dimensionId: MinecraftDimensionTypes.Overworld,
          minY: -64,
          maxY: 16,
        },
      ],
    },
    ancientDebris: {
      enabled: true,
      oreName: 'Ancient Debris',
      blocks: [
        {
          blockId: MinecraftBlockTypes.AncientDebris,
          dimensionId: MinecraftDimensionTypes.Nether,
          minY: 8,
          maxY: 119,
        },
      ],
    },
  },
};

export default xrayConfig;
