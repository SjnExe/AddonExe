import * as mc from '@minecraft/server';

import { handlePlayerJoin } from '@core/events/playerSpawn.js';
import { findPlayerByName, getAllPlayersFromCache } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { isDefined } from '@lib/guards.js';

export function resolveTarget(input: string, executor: mc.Player): mc.Player[] {
    if (!input) return [];

    const lowerInput = input.toLowerCase();

    // 1. Selector Support (@s, @p, @a, @r)
    if (input.startsWith('@')) {
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
            // nosemgrep: javascript.builtins.insecure-random.insecure-random
            // Risk Accepted: Math.random() is acceptable here because this is for simple random player selection in a game context, not for cryptography.
            const random = all[Math.floor(Math.random() * all.length)];
            return isDefined(random) ? [random] : [];
        }
    }

    // 2. Exact Name Match
    const exactMatch = findPlayerByName(lowerInput);
    if (exactMatch) return [exactMatch];

    // 3. Quoted Name Match (handling "Name With Spaces")
    const cleanInput = input.replaceAll('"', '');
    const quotedMatch = findPlayerByName(cleanInput);
    // ensure exact case match like the previous implementation
    if (quotedMatch && quotedMatch.name === cleanInput) return [quotedMatch];

    // 4. Partial Name Match
    const allPlayers = getAllPlayersFromCache();
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
        return player.isValid;
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
