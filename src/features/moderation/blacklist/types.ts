/** Enforcement action taken when an unauthorized player handles or uses a prohibited item. */
export type BlacklistAction = 'confiscate' | 'cancel';

/** Audit log entry for prohibited item detections. */
export interface BlacklistAuditEntry {
  /** Timestamp in milliseconds when the infraction occurred. */
  timestamp: number;
  /** Player name who triggered the infraction. */
  playerName: string;
  /** Unique player identifier. */
  playerId: string;
  /** Type identifier of the prohibited item. */
  itemTypeId: string;
  /** Action context (e.g., 'use', 'place', 'held', 'interact'). */
  trigger: string;
  /** Enforcement action applied. */
  action: BlacklistAction;
}

/** Configuration options for the item blacklist moderation system. */
export interface ItemBlacklistConfig {
  /** Whether the item blacklist system is enabled. Defaults to false per addon policy. */
  enabled: boolean;
  /** List of prohibited item type identifiers. */
  blacklistedItems: string[];
  /** Action executed when a prohibited item is detected: 'confiscate' removes the item, 'cancel' blocks the action. */
  action: BlacklistAction;
  /** Whether to broadcast an in-game alert to active staff members. */
  broadcastToStaff: boolean;
  /** Whether to persist audit log records to persistent storage. */
  persistToLog: boolean;
  /** Whether to output a warning log to the server console. */
  logToConsole: boolean;
  /** List of rank identifiers that are exempt from blacklist enforcement. */
  exemptRanks: string[];
}
