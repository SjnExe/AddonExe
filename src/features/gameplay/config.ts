import { GameplayConfig } from './types.js';

/** Default configuration for custom gameplay mechanics. Defaults to disabled per addon feature defaulting policy. */
export const defaultGameplayConfig: GameplayConfig = {
  customKnockback: false,
  knockbackScale: 1.0,
  preventFallDamage: false,
  keepInventory: false,
  voidRescue: false,
};
