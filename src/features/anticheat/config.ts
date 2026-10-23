import { MinecraftItemTypes } from '@minecraft/vanilla-data';

export interface Violation {
  threshold: number;
  command: string;
}

export interface BaseCheckConfig {
  enabled: boolean;
  notifyStaff: boolean;
  flagDecaySeconds: number;
  violations: Violation[];
}

export interface ItemCheckConfig extends BaseCheckConfig {
  bannedItems: string[];
  illegalEnchantments: boolean;
  maxEnchantLevel: number;
  removeIllegalItems: boolean;
}

export interface MovementCheckConfig extends BaseCheckConfig {
  maxSpeed: number;
  maxSpeedIce: number;
  maxSpeedElytra: number;
  flightDetection: boolean;
}

export interface AntiNetherRoofConfig {
  enabled: boolean;
  maxHeight: number;
}

export interface AnticheatConfig {
  enabled: boolean;
  consoleNotifications: boolean;
  itemCheck: ItemCheckConfig;
  movementCheck: MovementCheckConfig;
  antiNetherRoof: AntiNetherRoofConfig;
}

export const anticheatConfig: AnticheatConfig = {
  enabled: false,
  consoleNotifications: true,
  itemCheck: {
    enabled: false,
    notifyStaff: true,
    flagDecaySeconds: 300,
    violations: [
      { threshold: 1, command: 'warn {player} Illegal Item detected.' },
      { threshold: 5, command: 'kick {player} Illegal Items.' },
      { threshold: 10, command: 'ban {player} 1d Illegal Items.' },
    ],
    bannedItems: [
      MinecraftItemTypes.Bedrock,
      MinecraftItemTypes.Barrier,
      MinecraftItemTypes.CommandBlock,
      MinecraftItemTypes.StructureBlock,
      MinecraftItemTypes.BorderBlock,
    ],
    illegalEnchantments: true,
    maxEnchantLevel: 5,
    removeIllegalItems: true,
  },
  movementCheck: {
    enabled: false,
    notifyStaff: true,
    flagDecaySeconds: 60,
    violations: [
      { threshold: 10, command: 'warn {player} Moving too fast.' },
      { threshold: 20, command: 'kick {player} Suspicious movement.' },
    ],
    maxSpeed: 10,
    maxSpeedIce: 25,
    maxSpeedElytra: 80,
    flightDetection: false,
  },
  antiNetherRoof: {
    enabled: false,
    maxHeight: 128,
  },
};

export default anticheatConfig;
