export interface LandClaimConfig {
  enabled: boolean;
  maxClaimsPerPlayer: number;
  claimCost: number;
  allowNether: boolean;
  allowTheEnd: boolean;
  endIslandProtectedRadius: number;
  preventExplosionsDefault: boolean;
  preventPvPDefault: boolean;
  preventMobGriefingDefault: boolean;
  visualizerDurationSeconds: number;
}

export const landClaimConfig: LandClaimConfig = {
  enabled: false,
  maxClaimsPerPlayer: 4,
  claimCost: 0,
  allowNether: true,
  allowTheEnd: false,
  endIslandProtectedRadius: 300,
  preventExplosionsDefault: true,
  preventPvPDefault: true,
  preventMobGriefingDefault: true,
  visualizerDurationSeconds: 15,
};

export default landClaimConfig;
