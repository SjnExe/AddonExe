import * as mc from '@minecraft/server';

import { getAnticheatConfig } from './anticheatConfigLoader.js';
import { flag } from './flagManager.js';

const lastLocations = new Map<string, { x: number; y: number; z: number; timestamp: number }>();

export function startMovementCheckLoop() {
    // Use runJob for performance if available, or interval
    // runJob requires beta 1.6.0+. We use "beta".
    if (mc.system.runJob) {
        mc.system.runJob(movementCheckGenerator());
    }
}

function* movementCheckGenerator() {
    while (true) {
        const config = getAnticheatConfig();
        if (!config.enabled || !config.movementCheck.enabled) {
            yield;
            continue;
        }

        const players = mc.world.getAllPlayers();
        for (const player of players) {
            if (player.isValid) {
                checkMovement(player, config.movementCheck);
            }
            yield; // Yield after each player to spread load
        }
        yield;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkMovement(player: mc.Player, config: { maxSpeed: number; [key: string]: any }) {
    if (player.getGameMode() === mc.GameMode.Creative || player.getGameMode() === mc.GameMode.Spectator) return;

    // Simple speed check
    const currentLoc = player.location;
    const now = Date.now();

    if (lastLocations.has(player.id)) {
        const last = lastLocations.get(player.id)!;
        const timeDiff = (now - last.timestamp) / 1000;

        if (timeDiff > 0.2) {
            // Check approx every 4 ticks
            const dist = Math.sqrt(
                Math.pow(currentLoc.x - last.x, 2) + Math.pow(currentLoc.z - last.z, 2) // Ignore Y for basic speed check
            );

            const speed = dist / timeDiff; // blocks per second

            // Basic threshold check (vanilla sprint jump is ~5.6 m/s, ice can be faster)
            // Using a lenient default if maxSpeed is low
            const limit = Math.max(config.maxSpeed, 15);

            if (speed > limit && !player.isGliding) {
                // Ensure player isn't riding an entity (API check needed if available, or tag)
                flag(player, 'movementCheck', `Speed: ${speed.toFixed(2)} bps (Limit: ${limit})`);
            }

            // Update last location only after check
            lastLocations.set(player.id, { x: currentLoc.x, y: currentLoc.y, z: currentLoc.z, timestamp: now });
        }
    } else {
        lastLocations.set(player.id, { x: currentLoc.x, y: currentLoc.y, z: currentLoc.z, timestamp: now });
    }
}
