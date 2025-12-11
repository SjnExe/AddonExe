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
