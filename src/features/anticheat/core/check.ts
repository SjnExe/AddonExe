/** Core interface and types defining modular anti-cheat checks. */

/** Categorical grouping of anti-cheat checks. */
export type AntiCheatCheckCategory = 'movement' | 'combat' | 'mining' | 'inventory' | 'world';

/** Contract implemented by all modular anti-cheat checks. */
export interface AntiCheatCheck {
  /** Unique programmatic identifier for this check (e.g. 'movementCheck'). */
  readonly id: string;

  /** Human-readable display name. */
  readonly name: string;

  /** Categorical domain monitored by this check. */
  readonly category: AntiCheatCheckCategory;

  /** Concise summary of anomalous behaviors targeted by this check. */
  readonly description: string;

  /** Starts or registers event subscriptions and monitoring intervals for this check. */
  start(): void;

  /** Stops or cleans up event subscriptions and monitoring intervals for this check. */
  stop(): void;

  /** Clears all ephemeral tracking states and buffers for a specific player (e.g. on disconnect). */
  clearPlayer(playerId: string): void;

  /** Resets all internal states across all players for unit test isolation. */
  reset(): void;
}
