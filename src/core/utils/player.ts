import * as mc from '@minecraft/server';

import { getAllPlayersFromCache } from '@core/playerCache.js';
import { isDefined } from '@lib/guards.js';
import { getPlayer } from '@core/playerDataManager.js';
import { handlePlayerJoin } from '@core/events/playerSpawn.js';

export function resolveTarget(input: string, executor: mc.Player): mc.Player[] {
    if (!input) return [];

    const lowerInput = input.toLowerCase();

    // 1. Selector Support (@s, @p, @a, @r)
    if (input.startsWith('@')) {
        try {
            // @s: Self
            if (lowerInput === '@s') return [executor];

            // @p: Nearest player (excluding self?) - Vanilla includes self usually.
            // Documentation memory says "@p excludes the executing player" in this codebase.
            if (lowerInput === '@p') {
                // Manual distance check to find nearest other
                let nearest: mc.Player | undefined;
                let minDist = Number.MAX_VALUE;
                const allPlayers = getAllPlayersFromCache();

                for (const player of allPlayers) {
                    if (player.id === executor.id) continue;
                    // Approximate distance check (squared)
                    const dx = player.location.x - executor.location.x;
                    const dy = player.location.y - executor.location.y;
                    const dz = player.location.z - executor.location.z;
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < minDist) {
                        minDist = distSq;
                        nearest = player;
                    }
                }
                return nearest ? [nearest] : [];
            }

            // @a: All players
            if (lowerInput === '@a') return getAllPlayersFromCache();

            // @r: Random player
            if (lowerInput === '@r') {
                const all = getAllPlayersFromCache();
                if (all.length === 0) return [];
                const random = all[Math.floor(Math.random() * all.length)];
                return isDefined(random) ? [random] : [];
            }

            // Complex selectors (@a[r=10]) are not fully parsed here, fallback to name match
            // or use command target selector via executeCommand if needed.
            // For now, strict basic selectors only or fallback to name.
        } catch {
            // Fallback
        }
    }

    // 2. Exact Name Match
    // Use cached players list
    const allPlayers = getAllPlayersFromCache();
    const exactMatch = allPlayers.find((p) => p.name.toLowerCase() === lowerInput);
    if (exactMatch) return [exactMatch];

    // 3. Quoted Name Match (handling "Name With Spaces")
    const cleanInput = input.replaceAll('"', '');
    const quotedMatch = allPlayers.find((p) => p.name === cleanInput);
    if (quotedMatch) return [quotedMatch];

    // 4. Partial Name Match
    const partialMatches = allPlayers.filter((p) => p.name.toLowerCase().includes(lowerInput));
    if (partialMatches.length > 0) return partialMatches;

    return [];
}

/**
 * Validates that a player object is still valid and online.
 * @param player
 */
export function isValidPlayer(player: mc.Player): boolean {
    if (!isDefined(player)) return false;
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if (typeof player.isValid === 'function' && !((player as any).isValid() as boolean)) return false;
        // Also check if they are in the online cache?
        // isValid returns false if they left.
        return true;
    } catch {
        return false;
    }
}

/**
 * Gets a clean name for display, checking vanish status.
 */
export function getSafeDisplayName(player: mc.Player, observer?: mc.Player): string {
    const pData = getPlayer(player.id);
    if (isDefined(pData) && pData.isVanished) {
        // Check if observer can see vanished players
        if (observer) {
            const obsData = getPlayer(observer.id);
            const obsLevel = (isDefined(obsData) ? obsData.permissionLevel : undefined) ?? 1024;
            if (obsLevel <= 2) {
                return `§7[V] ${player.name}§r`;
            }
        }
        return '§kUnknown§r'; // Obfuscated for non-staff
    }
    return player.name;
}

export function reinitializeOnlinePlayers() {
    const players = getAllPlayersFromCache();
    for (const player of players) {
        handlePlayerJoin(player);
    }
}
