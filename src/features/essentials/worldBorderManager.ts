import { setTrackedInterval } from "@core/timerManager.js";
import { errorLog } from '@core/logger.js';
import { StorageManager } from '@core/storage/StorageManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

interface WorldBorderConfig {
    enabled: boolean;
    centerX: number;
    centerZ: number;
    radius: number;
    dimension: string; // overworld, nether, the end
}

const storage = new StorageManager('exe:worldborder');
let config: WorldBorderConfig = {
    enabled: false,
    centerX: 0,
    centerZ: 0,
    radius: 1000,
    dimension: 'minecraft:overworld'
};

export function initializeWorldBorder() {
    const loadedConfig = storage.load<WorldBorderConfig>();
    if (isDefined(loadedConfig)) {
        config = loadedConfig;
    }

    setTrackedInterval(() => checkWorldBorder(), 20); // Check every second (20 ticks)
}

function saveConfig() {
    storage.save(config);
}

export function setWorldBorder(enabled: boolean, centerX?: number, centerZ?: number, radius?: number, dimension?: string) {
    config.enabled = enabled;
    if (isDefined(centerX)) config.centerX = centerX;
    if (isDefined(centerZ)) config.centerZ = centerZ;
    if (isDefined(radius)) config.radius = radius;
    if (isDefined(dimension)) config.dimension = dimension;
    saveConfig();
}

export function getWorldBorder(): WorldBorderConfig {
    return { ...config };
}

function checkWorldBorder() {
    if (!config.enabled) return;

    try {
        const dim = mc.world.getDimension(config.dimension);
        const players = dim.getPlayers();
        for (const player of players) {
            // Ignore admins
            if (player.hasTag('admin') || player.hasTag('owner')) continue;

            const loc = player.location;
            const dx = Math.abs(loc.x - config.centerX);
            const dz = Math.abs(loc.z - config.centerZ);

            if (dx > config.radius || dz > config.radius) {
                // Calculate safe teleport point inside border
                let safeX = loc.x;
                let safeZ = loc.z;

                if (dx > config.radius) {
                    safeX = Math.sign(loc.x - config.centerX) * (config.radius - 2) + config.centerX;
                }

                if (dz > config.radius) {
                    safeZ = Math.sign(loc.z - config.centerZ) * (config.radius - 2) + config.centerZ;
                }

                try {
                    // Try to teleport to top block, but this is simple logic
                    player.teleport({ x: safeX, y: loc.y, z: safeZ }, { dimension: dim });
                    player.sendMessage('§cYou have reached the world border!');
                } catch {
                    // Teleport might fail if dimension not loaded or out of bounds for y, fallback to spawn
                    player.teleport(mc.world.getDefaultSpawnLocation(), { dimension: mc.world.getDimension('overworld') });
                    player.sendMessage('§cYou have reached the world border and were sent to spawn!');
                }
            }
        }
    } catch (err) {
        errorLog(`[WorldBorder] Check failed: ${String(err)}`);
    }
}
