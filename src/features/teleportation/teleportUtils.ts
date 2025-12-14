import * as mc from '@minecraft/server';

import { setPlayerLastLocation } from '@core/playerDataManager.js';

/**
 * Saves the player's current location as their "last location" for /back command.
 * @param player The player to save location for.
 */
export function saveLastLocation(player: mc.Player) {
    if (!player || !player.isValid) return;
    try {
        const location = {
            x: player.location.x,
            y: player.location.y,
            z: player.location.z,
            dimensionId: player.dimension.id
        };
        setPlayerLastLocation(player.id, location);
    } catch {
        // Ignore errors (e.g. player disconnected during call)
    }
}

/**
 * Finds a safe location near the target location.
 * Scans a small radius for a solid block with 2 air blocks above.
 * @param dimension The dimension to check.
 * @param location The target location.
 * @returns The safe location or null.
 */
export function findSafeLocation(dimension: mc.Dimension, location: mc.Vector3): mc.Vector3 | null {
    const { x: startX, y: startY, z: startZ } = location;
    const radius = 3; // Scan radius

    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            for (let y = -2; y <= 2; y++) {
                const checkPos = {
                    x: Math.floor(startX) + x,
                    y: Math.floor(startY) + y,
                    z: Math.floor(startZ) + z
                };

                // Block below feet
                const ground = dimension.getBlock({ x: checkPos.x, y: checkPos.y - 1, z: checkPos.z });
                // Block at feet
                const feet = dimension.getBlock(checkPos);
                // Block at head
                const head = dimension.getBlock({ x: checkPos.x, y: checkPos.y + 1, z: checkPos.z });

                if (ground && feet && head) {
                    const isGroundSafe = !ground.isAir && !ground.isLiquid;
                    // Ensure feet and head are breathable (air or non-blocking) and NOT liquid (lava/water)
                    const isFeetSafe = !feet.isLiquid && feet.isAir;
                    const isHeadSafe = !head.isLiquid && head.isAir;

                    if (isGroundSafe && isFeetSafe && isHeadSafe) {
                        return {
                            x: checkPos.x + 0.5,
                            y: checkPos.y,
                            z: checkPos.z + 0.5
                        };
                    }
                }
            }
        }
    }
    return null;
}
