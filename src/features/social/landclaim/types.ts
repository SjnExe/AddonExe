export interface LandClaimFlags {
  allowPvP?: boolean;
  allowExplosions?: boolean;
  allowInteract?: boolean;
  allowContainers?: boolean;
}

export interface LandClaim {
  id: string; // `${dimension}:${chunkX},${chunkZ}`
  dimension: string;
  chunkX: number;
  chunkZ: number;
  ownerId: string;
  ownerName: string;
  claimedAt: number;
  name?: string;
  trusted: string[]; // Player IDs or lowercase names
  flags: LandClaimFlags;
}

export interface ClaimActionResult {
  success: boolean;
  message: string;
  claim?: LandClaim;
}
