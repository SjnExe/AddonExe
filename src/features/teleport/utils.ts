import * as mc from '@minecraft/server';

import { getConfig } from '@core/configManager.js';
import { setPlayerLastLocation } from '@core/playerDataManager.js';
import { isDefined } from '@lib/guards.js';

/**
 * Saves the player's current location as their "last location" for /back command.
 * @param player The player to save location for.
 * @param reason The reason for saving ('death' or 'teleport'). Defaults to 'teleport'.
 */
export function saveLastLocation(player: mc.Player, reason: 'death' | 'teleport' = 'teleport') {
    if (!isDefined(player)) return;

    if (!player.isValid) return;

    // Check if Back system is globally enabled
    const backConfig = getConfig().back as { enabled?: boolean; saveOnDeath?: boolean; saveOnTeleport?: boolean } | undefined;

    if (!backConfig?.enabled) return;

    if (reason === 'death' && backConfig.saveOnDeath !== true) return;

    if (reason === 'teleport' && backConfig.saveOnTeleport !== true) return;

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
 * @returns The safe location or undefined.
 */
export function findSafeLocation(dimension: mc.Dimension, location: mc.Vector3): mc.Vector3 | undefined {
    const { x: startX, y: startY, z: startZ } = location;
    const radius = 3; // Scan radius
    const baseX = Math.floor(startX);
    const baseY = Math.floor(startY);
    const baseZ = Math.floor(startZ);

    for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
            for (let y = -2; y <= 2; y++) {
                const checkPos = {
                    x: baseX + x,
                    y: baseY + y,
                    z: baseZ + z
                };

                // Block below feet
                const ground = dimension.getBlock({ x: checkPos.x, y: checkPos.y - 1, z: checkPos.z });
                // Block at feet
                const feet = dimension.getBlock(checkPos);
                // Block at head
                const head = dimension.getBlock({ x: checkPos.x, y: checkPos.y + 1, z: checkPos.z });

                if (isDefined(ground) && isDefined(feet) && isDefined(head)) {
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
    return undefined;
}
