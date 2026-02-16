import * as mc from '@minecraft/server';

import { getSpawnConfig } from '@core/configurations.js';
import { debugLog } from '@core/logger.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { getOrCreatePlayer } from '@core/playerDataManager.js';
import { isDefined, isNumber } from '@lib/guards.js';

let intervalId: number | undefined;

export function initializeSpawnProtection() {
    intervalId = mc.system.runInterval(() => {
        const config = getSpawnConfig();
        if (!config.spawnProtection.enabled) return;

        const protection = config.spawnProtection;
        const radius = protection.protectionRadius;
        const radiusSq = radius * radius;

        const spawnLoc = config.spawn.spawnLocation;
        // Ensure spawn location is set
        if (!isDefined(spawnLoc.x) || !isDefined(spawnLoc.z) || !isNumber(spawnLoc.x) || !isNumber(spawnLoc.z)) {
            return;
        }

        const spawnX = spawnLoc.x;
        const spawnZ = spawnLoc.z;

        // Optimization: Use cached players list
        const players = getAllPlayersFromCache();

        for (const player of players) {
            // Check dimension
            if (player.dimension.id !== 'minecraft:overworld') continue;

            const dx = player.location.x - spawnX;
            const dz = player.location.z - spawnZ;
            const distSq = dx * dx + dz * dz;

            if (distSq <= radiusSq) {
                try {
                    // Check permissions
                    const pData = getOrCreatePlayer(player);
                    // Level > 2 implies not staff (Owner=0, Admin=1, Mod=2, Member=1024)
                    if (pData.permissionLevel > 2 && player.getGameMode() === mc.GameMode.Survival) {
                        player.setGameMode(mc.GameMode.Adventure);
                        player.sendMessage('§eEntered spawn. Gamemode set to Adventure.');
                    }
                } catch (error) {
                    debugLog(`Spawn protection error for ${player.name}: ${String(error)}`);
                }
            } else {
                // Left spawn? Logic omitted as per previous analysis
            }
        }
    }, 20); // Check every second
}

export function cleanupSpawnProtection() {
    if (isDefined(intervalId)) {
        mc.system.clearRun(intervalId);
        intervalId = undefined;
    }
}
