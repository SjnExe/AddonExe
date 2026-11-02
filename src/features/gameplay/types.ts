/** Configuration options governing server-wide gameplay mechanics and survival physics. */
export interface GameplayConfig {
  /** Whether to modify entity and player combat knockback velocity. */
  customKnockback: boolean;
  /** Multiplier applied to combat knockback (1.0 = vanilla, 0.0 = no knockback, 2.0 = double). */
  knockbackScale: number;
  /** Whether to prevent players from taking fall damage. */
  preventFallDamage: boolean;
  /** Whether players retain their inventory upon death without dropping items. */
  keepInventory: boolean;
  /** Whether players falling into the void are automatically rescued and safely teleported back to spawn. */
  voidRescue: boolean;
}
