export const spawnConfig = {
    // --- Spawn Settings ---
    spawn: {
        cooldownSeconds: 60,
        teleportWarmupSeconds: 10,
        syncWorldSpawn: true,
        worldSpawnRadius: 1,
        // Default spawn location. Can be set manually here (e.g., { x: 0, y: 100, z: 0, dimensionId: 'minecraft:overworld' }) or with the in-game /setspawn command.
        spawnLocation: {
            x: undefined as number | undefined,
            y: undefined as number | undefined,
            z: undefined as number | undefined,
            dimensionId: 'minecraft:overworld'
        }
    },

    // --- Spawn Protection Settings ---
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
        preventBlockInteraction: true
    }
};

export default spawnConfig;
