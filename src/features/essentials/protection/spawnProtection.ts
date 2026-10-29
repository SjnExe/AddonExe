import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getProtectionFlags } from '@core/events/protectionService.js';
import { debugLog } from '@core/utils/logger.js';
import { clearTrackedInterval, setTrackedInterval } from '@core/utils/timerManager.js';
import { isDefined } from '@lib/guards.js';

let intervalId: number | undefined;
const lastPvpState = new Map<string, boolean>();
const lastHostileState = new Map<string, boolean>();

export function initializeSpawnProtection() {
  intervalId = setTrackedInterval(() => {
    // We now check protections dynamically using protectionService
    // This loop applies player-specific states (PvP disabled, Hostile Damage disabled)
    // based on the overlapping zone flags. Block events are handled via standard event hooks.

    const players = getAllPlayersFromCache();

    for (const player of players) {
      try {
        const isValid = player.isValid;
        if (!isValid) {
          continue;
        }

        const flags = getProtectionFlags(player.location, player.dimension.id);

        if (lastPvpState.get(player.id) !== flags.preventPvP) {
          lastPvpState.set(player.id, flags.preventPvP);
          if (flags.preventPvP) {
            player.addTag('exe:in_pvp_protection');
            player.triggerEvent('exe:disable_pvp');
          } else {
            player.removeTag('exe:in_pvp_protection');
            player.triggerEvent('exe:enable_pvp');
          }
        }

        if (lastHostileState.get(player.id) !== flags.preventHostileDamage) {
          lastHostileState.set(player.id, flags.preventHostileDamage);
          if (flags.preventHostileDamage) {
            player.addTag('exe:in_hostile_protection');
            player.triggerEvent('exe:disable_hostile_damage');
          } else {
            player.removeTag('exe:in_hostile_protection');
            player.triggerEvent('exe:enable_hostile_damage');
          }
        }
      } catch (error) {
        debugLog(`Protection evaluation error for ${player.name}: ${String(error)}`);
      }
    }
  }, 20); // Check every second
}

export function cleanupSpawnProtection() {
  lastPvpState.clear();
  lastHostileState.clear();
  if (isDefined(intervalId)) {
    clearTrackedInterval(intervalId);
    intervalId = undefined;
  }
}
