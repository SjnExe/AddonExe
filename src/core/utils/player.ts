import { getPlayer } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';

/**
 * Resolves a target string to a list of players.
 * Supports:
 * - Exact name match (case-insensitive)
 * - Partial name match (if unique)
 * - Selectors: @p, @a, @r, @s
 *
 * @param input The input string (e.g., "Steve", "@a", "Ste")
 * @param executor The player executing the command (needed for @p, @s, distance checks)
 * @returns An array of found players. Returns empty array if none found.
 */
export function resolveTarget(input: string, executor: mc.Player): mc.Player[] {
    const allPlayers = [...mc.world.getAllPlayers()];

    // 1. Selector Handling
    if (input.startsWith('@')) {
        switch (input.toLowerCase()) {
            case '@s': {
                return [executor];
            }
            case '@a': {
                return allPlayers;
            }
            case '@p': {
                // Find closest player
                let closestDist = Infinity;
                let closestPlayer: mc.Player | null = null;
                const exLoc = executor.location;

                for (const p of allPlayers) {
                    if (p.id === executor.id) continue;

                    if (p.dimension.id !== executor.dimension.id) continue;

                    const dist = Math.sqrt(
                        Math.pow(p.location.x - exLoc.x, 2) +
                            Math.pow(p.location.y - exLoc.y, 2) +
                            Math.pow(p.location.z - exLoc.z, 2)
                    );

                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPlayer = p;
                    }
                }
                if (closestPlayer) {
                    return [closestPlayer];
                }
                return [executor];
            }
            case '@r': {
                if (allPlayers.length === 0) return [];
                const randomIndex = Math.floor(Math.random() * allPlayers.length);
                const randomPlayer = allPlayers[randomIndex];
                return randomPlayer ? [randomPlayer] : [];
            }
            default: {
                break;
            }
        }
    }

    // 2. Name Matching
    const inputLower = input.toLowerCase();

    // Exact match (highest priority)
    const exactMatch = allPlayers.find((p) => p.name.toLowerCase() === inputLower);
    if (exactMatch) return [exactMatch];

    // Partial match
    const partialMatches = allPlayers.filter((p) => p.name.toLowerCase().includes(inputLower));

    // Vanish Check: remove vanished players if executor is not staff
    const executorData = getPlayer(executor.id);
    const isStaff = executorData && executorData.permissionLevel <= 2;

    const visibleMatches = partialMatches.filter((p) => {
        if (isStaff) return true;
        const targetData = getPlayer(p.id);
        return targetData ? !targetData.isVanished : true;
    });

    return visibleMatches;
}
