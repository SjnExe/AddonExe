export const spawnConfig = {
    // --- Spawn Settings ---
    spawn: {
        cooldownSeconds: 60,
        teleportWarmupSeconds: 10,
        // Default spawn location. Can be set manually here (e.g., { x: 0, y: 100, z: 0, dimensionId: 'minecraft:overworld' }) or with the in-game /setspawn command.
        spawnLocation: null
    },

    // --- Spawn Protection Settings ---
    spawnProtection: {
        enabled: true,
        protectionRadius: 32,
        allowAdminBypass: true,
        preventPvP: true,
        preventPvE: true,
        preventMobSpawning: true,
        preventBlockBreaking: true,
        preventBlockPlacing: true,
        preventExplosions: true,
        preventBlockInteraction: true,
        preventFire: true,
        preventHungerLoss: true,
        preventItemDropping: false,
        preventItemPickup: false
    }
};