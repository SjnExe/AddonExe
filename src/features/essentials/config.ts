import { MinecraftDimensionTypes } from '@minecraft/vanilla-data';

export const essentialsConfig = {
  spawn: {
    cooldownSeconds: 60,
    teleportWarmupSeconds: 10,
    syncWorldSpawn: true,
    worldSpawnRadius: 1,
    spawnLocation: {
      x: undefined as number | undefined,
      y: undefined as number | undefined,
      z: undefined as number | undefined,
      dimensionId: MinecraftDimensionTypes.Overworld,
    },
  },
  spawnProtection: {
    enabled: false,
    protectionRadius: 32,
    allowAdminBypass: true,
    preventPvP: true,
    preventHostileDamage: true,
    preventHostileMobSpawning: true,
    preventBlockBreaking: true,
    preventBlockPlacing: true,
    preventExplosions: true,
    preventBlockInteraction: true,
    preventItemPickup: true,
    preventFallDamage: true,
    preventMagicDamage: true,
    preventMobGriefing: true,
    preventEntityInteraction: true,
    preventProjectileUsage: true,
  },
  afk: {
    enabled: false,
    autoAfkMinutes: 10,
    broadcastAfk: true,
  },
  playerUtilities: {
    healEnabled: false,
    feedEnabled: false,
    repairEnabled: false,
    repairCost: 0,
    trashEnabled: false,
    nearEnabled: false,
    nearRadius: 100,
  },
  combat: {
    enabled: true,
    tagDurationSeconds: 15,
    blockTeleportInCombat: true,
    combatLogPenalty: true,
    reconnectGraceSeconds: 30,
    killOnRejoin: false,
  },
  announcements: {
    enabled: false,
    message: '§2Welcome to the server! Enjoy your stay.',
    interval: 300,
  },
  dimensionLock: {
    allowAdminBypass: true,
    netherLock: false,
    endLock: false,
  },
  playerInfo: {
    enableWelcomer: false,
    welcomeMessage: 'Welcome, §a{playerName}§r, to {serverName}!§r\nUse §e/h§r to see available commands.',
    notifyAdminOnNewPlayer: true,
    enableDeathCoords: false,
    deathCoordsMessage: '§7You died at {x}, {y}, {z} in {dimensionId}.',
    customJoinLeave: {
      enabled: false,
      joinMessage: '§e{playerName} joined the game',
      leaveMessage: '§e{playerName} left the game',
    },
  },
  serverInfo: {
    discordLink: 'https://discord.gg/example',
    websiteLink: 'https://example.com',
    rules: [
      '§e1. §rBe respectful to all players and staff.',
      '§e2. §rNo cheating, hacking, or using exploits (e.g., §cX-Ray§r, §cduping§r).',
      '§e3. §rDo not spam chat or use excessive caps.',
      '§e4. §rNo griefing or stealing from other players.',
      '§e5. §rRespect player builds. Do not alter or destroy them without permission.',
      '§e6. §rNo advertising other servers or websites.',
      '§e7. §rKeep conversations in English.',
      '§e8. §rFollow directions from staff members.',
      '§e9. §rDo not use offensive language, skins, or usernames.',
    ],
    helpfulLinks: [
      {
        title: '§9Discord Server',
        url: 'https://discord.gg/example',
      },
      {
        title: '§aWebsite',
        url: 'https://example.com',
      },
    ],
  },
  helpSystem: {
    defaultMode: 'chat',
  },
  soundEvents: {
    tpaRequestReceived: { enabled: true, soundId: 'random.orb', volume: 1, pitch: 1.2 },
    adminNotificationReceived: { enabled: true, soundId: 'note.pling', volume: 0.8, pitch: 1.5 },
    playerWarningReceived: { enabled: true, soundId: 'note.bass', volume: 1, pitch: 0.8 },
    commandError: { enabled: true, soundId: 'mob.villager.no', volume: 1, pitch: 0.9 },
  },
};

export default essentialsConfig;
