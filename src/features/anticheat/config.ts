import { MinecraftItemTypes } from '@minecraft/vanilla-data';

/** Defines an automated command action triggered when a player crosses a violation level threshold. */
export interface Violation {
  /** Violation Level (VL) threshold required to trigger this action. */
  threshold: number;
  /** Command template to execute, with `{player}` as placeholder. */
  command: string;
}

/** Base configuration options shared by all anti-cheat checks. */
export interface BaseCheckConfig {
  /** Whether this specific check is enabled. */
  enabled: boolean;
  /** Whether to broadcast detection alerts to online staff members. */
  notifyStaff: boolean;
  /** Seconds of clean activity required for violation level to decay by 1. */
  flagDecaySeconds: number;
  /** Configured disciplinary violation thresholds. */
  violations: Violation[];
}

/** Configuration for inventory and item verification checks. */
export interface ItemCheckConfig extends BaseCheckConfig {
  /** List of item type identifiers prohibited from player inventories. */
  bannedItems: string[];
  /** Whether to verify and flag enchantments exceeding maximum levels. */
  illegalEnchantments: boolean;
  /** Maximum allowable enchantment level before flagging. */
  maxEnchantLevel: number;
  /** Whether to automatically purge detected illegal items from inventories. */
  removeIllegalItems: boolean;
}

/** Configuration for physics and movement checks. */
export interface MovementCheckConfig extends BaseCheckConfig {
  /** Maximum normal horizontal travel speed in blocks per second (bps). */
  maxSpeed: number;
  /** Maximum allowable horizontal speed while on slippery blocks (ice, packed ice, blue ice). */
  maxSpeedIce: number;
  /** Maximum allowable horizontal speed while gliding with an Elytra. */
  maxSpeedElytra: number;
  /** Whether to verify and flag hovering, prolonged floating, and impossible flight. */
  flightDetection: boolean;
  /** Whether to flag impossible sprint states (e.g. sprinting while sneaking or blinded). */
  invalidSprint: boolean;
  /** Grace duration in milliseconds for lingering ice inertia after jumping off slippery blocks. */
  iceFrictionGraceMs?: number;
  /** Grace duration in milliseconds for bounce inertia after landing on slime blocks. */
  slimeBounceGraceMs?: number;
}

/** Configuration for melee combat reach and auto-clicker checks. */
export interface CombatCheckConfig extends BaseCheckConfig {
  /** Maximum allowable attack swings per second (CPS). */
  maxCps: number;
  /** Maximum allowable distance in blocks between attacker eye and target entity. */
  maxReach: number;
  /** Whether to verify and flag rapid or rhythmic automated attack inputs. */
  checkAutoClicker: boolean;
  /** Whether to verify and flag combat hits originating outside normal reach boundaries. */
  checkReach: boolean;
  /** Maximum reach distance permitted when attacking wide-hitbox boss mobs (e.g. Ender Dragon, Ghast). */
  maxReachLargeMobs?: number;
}

/** Configuration for block destruction rate and fast-break / nuker checks. */
export interface MiningCheckConfig extends BaseCheckConfig {
  /** Maximum allowable solid block break events permitted in a single server tick. */
  maxBreaksPerTick: number;
}

/** Configuration for the Nether roof restriction system. */
export interface AntiNetherRoofConfig {
  /** Whether players are forbidden from traveling above the Nether bedrock ceiling. */
  enabled: boolean;
  /** Maximum allowable Y-coordinate in the Nether dimension. */
  maxHeight: number;
}

/** Master configuration schema for the Anti-Cheat module. */
export interface AnticheatConfig {
  /** Global master switch governing all anti-cheat detection routines. */
  enabled: boolean;
  /** Whether detection alerts are also emitted to server console logs. */
  consoleNotifications: boolean;
  /** Minimum interval in seconds between staff alert messages for the same player and check. */
  alertCooldownSeconds?: number;
  /** Minimum violation level before staff notifications are broadcast (suppresses low-confidence jitter). */
  minAlertVl?: number;
  /** Item and equipment inspection rules. */
  itemCheck: ItemCheckConfig;
  /** Movement and speed verification rules. */
  movementCheck: MovementCheckConfig;
  /** Melee combat rate and reach verification rules. */
  combatCheck: CombatCheckConfig;
  /** Mining rate and fast-break rules. */
  miningCheck: MiningCheckConfig;
  /** Nether ceiling boundary protection rules. */
  antiNetherRoof: AntiNetherRoofConfig;
}

/** Default Anti-Cheat configuration presets. */
export const anticheatConfig: AnticheatConfig = {
  enabled: false,
  consoleNotifications: true,
  alertCooldownSeconds: 2,
  minAlertVl: 2,
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
    maxSpeed: 11.5,
    maxSpeedIce: 30,
    maxSpeedElytra: 80,
    flightDetection: false,
    invalidSprint: true,
    iceFrictionGraceMs: 1500,
    slimeBounceGraceMs: 2500,
  },
  combatCheck: {
    enabled: false,
    notifyStaff: true,
    flagDecaySeconds: 60,
    violations: [
      { threshold: 5, command: 'warn {player} Suspicious combat activity.' },
      { threshold: 15, command: 'kick {player} Combat modification detected.' },
    ],
    maxCps: 20,
    maxReach: 4.5,
    checkAutoClicker: true,
    checkReach: true,
    maxReachLargeMobs: 6.5,
  },
  miningCheck: {
    enabled: false,
    notifyStaff: true,
    flagDecaySeconds: 60,
    violations: [
      { threshold: 5, command: 'warn {player} Unnatural block breaking.' },
      { threshold: 15, command: 'kick {player} FastBreak or Nuker detected.' },
    ],
    maxBreaksPerTick: 3,
  },
  antiNetherRoof: {
    enabled: false,
    maxHeight: 128,
  },
};

export default anticheatConfig;
