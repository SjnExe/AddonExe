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
  invalidSprint: boolean;
}

export interface CombatCheckConfig extends BaseCheckConfig {
  maxCps: number;
  maxReach: number;
  checkAutoClicker: boolean;
  checkReach: boolean;
}

export interface MiningCheckConfig extends BaseCheckConfig {
  maxBreaksPerTick: number;
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
  combatCheck: CombatCheckConfig;
  miningCheck: MiningCheckConfig;
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
    invalidSprint: true,
  },
  combatCheck: {
    enabled: false,
    notifyStaff: true,
    flagDecaySeconds: 60,
    violations: [
      { threshold: 5, command: 'warn {player} Suspicious combat activity.' },
      { threshold: 15, command: 'kick {player} Combat modification detected.' },
    ],
    maxCps: 18,
    maxReach: 4.2,
    checkAutoClicker: true,
    checkReach: true,
  },
  miningCheck: {
    enabled: false,
    notifyStaff: true,
    flagDecaySeconds: 60,
    violations: [
      { threshold: 5, command: 'warn {player} Unnatural block breaking.' },
      { threshold: 15, command: 'kick {player} FastBreak or Nuker detected.' },
    ],
    maxBreaksPerTick: 2,
  },
  antiNetherRoof: {
    enabled: false,
    maxHeight: 128,
  },
};

export default anticheatConfig;
