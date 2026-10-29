export const teleportConfig = {
  teleportProtectionSeconds: 3,
  tpa: {
    enabled: true,
    requestTimeoutSeconds: 60,
    cooldownSeconds: 30,
    teleportWarmupSeconds: 10,
    cost: 0,
  },
  homes: {
    enabled: true,
    maxHomes: 5,
    cooldownSeconds: 60, // 1 minute
    teleportWarmupSeconds: 10,
    cost: 5,
    setHomeCost: 25,
  },
  warps: {
    enabled: true,
    cooldownSeconds: 60, // 1 minute
    teleportWarmupSeconds: 10,
    cost: 10,
  },
  rtp: {
    enabled: true,
    minRange: 1000,
    maxRange: 10_000,
    cooldownSeconds: 600, // 10 minutes
    teleportWarmupSeconds: 10,
    cost: 50,
    shape: 'circle', // Options: 'circle', 'square'
    centerMode: 'spawn', // Options: 'spawn', 'zero', 'player'
    minPlayerDistance: 100,
    avoidProtectedZones: true,
    maxAttempts: 12,
    useLocationCache: true,
  },
  back: {
    enabled: true,
    cooldownSeconds: 60,
    teleportWarmupSeconds: 10,
    cost: 35,
    saveOnDeath: true,
    saveOnTeleport: true,
  },
};

export default teleportConfig;
