/** Configuration schema for the chunk-based Land Claim system. */
export interface LandClaimConfig {
  /** Master toggle governing whether land claims are active on the server. */
  enabled: boolean;
  /** Maximum number of chunks an ordinary player can claim without permission overrides. */
  maxClaimsPerPlayer: number;
  /** Economy currency cost required to claim a single chunk (0 for free). */
  claimCost: number;
  /** Whether land claiming is permitted in the Nether dimension. */
  allowNether: boolean;
  /** Whether land claiming is permitted in The End dimension. */
  allowTheEnd: boolean;
  /** Radius around (0, 0) in The End where land claiming is strictly prohibited. */
  endIslandProtectedRadius: number;
  /** Default state of explosion protection for newly created claims. */
  preventExplosionsDefault: boolean;
  /** Default state of PvP prevention for newly created claims. */
  preventPvPDefault: boolean;
  /** Duration in seconds that chunk boundary particles remain visible. */
  visualizerDurationSeconds: number;
}

export const landClaimConfig: LandClaimConfig = {
  enabled: false,
  maxClaimsPerPlayer: 4,
  claimCost: 100,
  allowNether: true,
  allowTheEnd: false,
  endIslandProtectedRadius: 300,
  preventExplosionsDefault: true,
  preventPvPDefault: true,
  visualizerDurationSeconds: 15,
};

export default landClaimConfig;
