/** Granular permissions and interaction toggles for a claimed chunk. */
export interface LandClaimFlags {
  /** Whether player-versus-player combat is permitted inside the claim boundary. */
  allowPvP?: boolean;
  /** Whether explosive block destruction is permitted within the claim boundary. */
  allowExplosions?: boolean;
  /** Whether non-trusted visitors are permitted to interact with doors, buttons, and levers. */
  allowInteract?: boolean;
  /** Whether non-trusted visitors are permitted to open chests, barrels, and storage containers. */
  allowContainers?: boolean;
}

/** Record representing a trusted player authorized to modify and access claimed land. */
export interface TrustedPlayer {
  /** Stable player entity ID or offline UUID string. */
  id: string;
  /** Gamertag display name at time of trust grant. */
  name: string;
}

/** Persisted chunk land claim record. */
export interface LandClaim {
  /** Unique chunk key formatted as `${dimension}:${chunkX},${chunkZ}`. */
  id: string;
  /** Dimension identifier (e.g. 'minecraft:overworld'). */
  dimension: string;
  /** Chunk coordinate along the X axis. */
  chunkX: number;
  /** Chunk coordinate along the Z axis. */
  chunkZ: number;
  /** Entity ID of the player who owns this claim. */
  ownerId: string;
  /** Gamertag of the owner at time of claim creation. */
  ownerName: string;
  /** Timestamp (epoch ms) when the claim was created. */
  claimedAt: number;
  /** Optional custom display name assigned to the claim. */
  name?: string;
  /** List of trusted players with modification privileges. */
  trusted: TrustedPlayer[];
  /** Visitor protection and interaction flags. */
  flags: LandClaimFlags;
}

/** Standard action response returned by claim management operations. */
export interface ClaimActionResult {
  /** Whether the operation was successful. */
  success: boolean;
  /** Formatted feedback message intended for in-game player display. */
  message: string;
  /** The created or updated claim record, if applicable. */
  claim?: LandClaim;
}
