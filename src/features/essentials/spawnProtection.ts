import { debugLog } from '@core/logger.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { getProtectionFlags } from '@core/protectionService.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/timerManager.js';
import { isDefined } from '@lib/guards.js';

let intervalId: number | undefined;

export function initializeSpawnProtection() {
    intervalId = setTrackedInterval(() => {
        // We now check protections dynamically using protectionService
        // This loop applies player-specific states (PvP disabled, Hostile Damage disabled)
        // based on the overlapping zone flags. Block events are handled via standard event hooks.

        const players = getAllPlayersFromCache();

        for (const player of players) {
            try {
                const isValid = player.isValid;
                if (!isValid) continue;

                const flags = getProtectionFlags(player.location, player.dimension.id);

                // Process PvP protection
                if (flags.preventPvP && !player.hasTag('exe:in_pvp_protection')) {
                    player.addTag('exe:in_pvp_protection');
                    player.triggerEvent('exe:disable_pvp');
                } else if (!flags.preventPvP && player.hasTag('exe:in_pvp_protection')) {
                    player.removeTag('exe:in_pvp_protection');
                    player.triggerEvent('exe:enable_pvp');
                }

                // Process Hostile Damage protection
                if (flags.preventHostileDamage && !player.hasTag('exe:in_hostile_protection')) {
                    player.addTag('exe:in_hostile_protection');
                    player.triggerEvent('exe:disable_hostile_damage');
                } else if (!flags.preventHostileDamage && player.hasTag('exe:in_hostile_protection')) {
                    player.removeTag('exe:in_hostile_protection');
                    player.triggerEvent('exe:enable_hostile_damage');
                }
            } catch (error) {
                debugLog(`Protection evaluation error for ${player.name}: ${String(error)}`);
            }
        }
    }, 20); // Check every second
}

export function cleanupSpawnProtection() {
    if (isDefined(intervalId)) {
        clearTrackedInterval(intervalId);
        intervalId = undefined;
    }
}
