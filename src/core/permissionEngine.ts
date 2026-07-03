import { config } from '@core/../config.js';
import { getRanksConfig } from '@core/configurations.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import { getPlayer } from '@core/playerDataManager.js';
import { getAllRanks, getRankById } from '@core/rankManager.js';
import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

// Cache for flattened rank maps
const rankCache = new Map<string, Record<string, boolean>>();

// Cache for player final merged maps
const playerMapCache = new Map<string, { map: Record<string, boolean>; tick: number }>();

export function calculateRankMap(rank: RankDefinition): Record<string, boolean> {
    const map: Record<string, boolean> = Object.create(null) as Record<string, boolean>;

    // 1. Process groups
    for (const group of rank.groups) {
        const groupNodes = getRanksConfig().permissionGroups[group];
        if (groupNodes) {
            for (const node of groupNodes) {
                map[node] = true;
            }
        }
    }

    // 2. Process allow array
    for (const node of rank.allow) {
        map[node] = true;
    }

    // 3. Process deny array
    for (const node of rank.deny) {
        map[node] = false;
    }

    return map;
}

export function invalidateRankCache(rankId: string) {
    rankCache.delete(rankId);
    // Remove from player cache any player holding this rank
    for (const player of getAllPlayersFromCache()) {
        const pData = getPlayer(player.id);
        if (pData && pData.ranks.includes(rankId)) {
            playerMapCache.delete(player.id);
        }
    }
}

export function invalidateAllRankCaches() {
    rankCache.clear();
    playerMapCache.clear();
}

function getRankMap(rankId: string): Record<string, boolean> {
    if (rankCache.has(rankId)) {
        return rankCache.get(rankId)!;
    }

    const rank = getRankById(rankId);
    if (!rank) {
        return Object.create(null) as Record<string, boolean>;
    }

    const map = calculateRankMap(rank);
    rankCache.set(rankId, map);
    return map;
}

export function getPlayerRanks(player: mc.Player): RankDefinition[] {
    const pData = getPlayer(player.id);

    // Fallback logic, ensuring we match `config.playerDefaults.rankId` or the hardcoded default 'member' if all else fails
    let rankIds = pData?.ranks;
    if (!rankIds || rankIds.length === 0) {
        if (config.playerDefaults.rankId) {
            rankIds = [config.playerDefaults.rankId];
        } else {
            rankIds = ['member'];
        }
    }

    // Gather assigned ranks
    const ranks = rankIds.map((id) => getRankById(id)).filter(isDefined);

    // Check condition-based ranks (like isOwner, hasTag) and add them if they apply
    const allRanks = getAllRanks();

    for (const rank of allRanks) {
        if (!ranks.includes(rank) && evaluateRankConditions(player, rank, ranks.length)) {
            ranks.push(rank);
        }
    }

    // If absolutely no rank was assigned or conditions met, explicitly grant the configured default rank
    if (ranks.length === 0) {
        const defaultRank = getRankById(config.playerDefaults.rankId);
        if (defaultRank) {
            ranks.push(defaultRank);
        }
    }

    // Sort ranks by priority (lowest number = highest priority)
    return ranks.toSorted((a, b) => a.priority - b.priority);
}

function evaluateRankConditions(player: mc.Player, rank: RankDefinition, assignedRankCount: number): boolean {
    if (rank.conditions.length === 0) return false;

    for (const condition of rank.conditions) {
        if (condition.type === 'isOwner') {
            const ownerNames = config.ownerPlayerNames.map((name: string) => name.trim().toLowerCase());
            const playerName = player.name.trim().toLowerCase();
            if (!ownerNames.includes(playerName)) return false;
        } else if (condition.type === 'hasTag') {
            if (!player.hasTag(condition.value as string)) return false;
        } else if (condition.type === 'default') {
            // Evaluates true only if the player has absolutely no other ranks
            if (assignedRankCount > 0) return false;
        }
    }
    return true;
}

export function calculatePlayerMap(player: mc.Player): Record<string, boolean> {
    const currentTick = mc.system.currentTick;
    const cached = playerMapCache.get(player.id);

    if (cached && currentTick - cached.tick < 20) {
        return cached.map;
    }

    const ranks = getPlayerRanks(player);

    // Reversing ranks so higher priority (lower integer) gets merged last, overwriting lower priority maps
    const reversedRanks = [...ranks].reverse();

    const playerMap: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
    for (const rank of reversedRanks) {
        const rankMap = getRankMap(rank.id);
        Object.assign(playerMap, rankMap);
    }

    playerMapCache.set(player.id, { map: playerMap, tick: currentTick });
    return playerMap;
}

// Ensure cache is cleared when players leave
mc.world.afterEvents.playerLeave.subscribe((event) => {
    playerMapCache.delete(event.playerId);
});

export function hasPermission(player: mc.Player, node: string): boolean {
    const ranks = getPlayerRanks(player);

    // 1. Hardcoded Fallbacks

    // Owner bypass
    if (ranks.some((r) => r.id === 'owner' || r.allow.includes('*'))) {
        return true;
    }

    // Admin core permissions
    if (ranks.some((r) => r.id === 'admin')) {
        const adminCorePermissions = ['cmd.ban.admin', 'cmd.unban.admin', 'cmd.tp.admin', 'cmd.warp.admin', 'cmd.setbalance.admin', 'ui.panel.admin'];
        if (adminCorePermissions.includes(node)) {
            return true;
        }
    }

    // 2. Map Lookup
    const playerMap = calculatePlayerMap(player);

    // Exact match
    if (playerMap[node] !== undefined) {
        return playerMap[node];
    }

    // Check wildcards using Linux-style rules (* for 1 segment, ** for 0 or more)
    // Because a node could match multiple patterns (e.g. `cmd.**` allowed, but `cmd.pay.**` denied),
    // and because `calculatePlayerMap` processes higher priority ranks last (overwriting `playerMap` keys),
    // we need to be careful. Currently, `playerMap` stores `pattern -> boolean`.
    // We should return `false` if any matched pattern explicitly denies it. Wait, the exact rules:
    // If a pattern matches and it's false, and there's another pattern that matches and it's true, which wins?
    // Since we merged everything into `playerMap`, all we have are the final effective patterns for the player.
    // Usually, explicit deny overrides allow, or longest match wins.
    // For simplicity: If ANY matching pattern is FALSE, deny it. Otherwise if ANY matching pattern is TRUE, allow it.

    const nSegs = node.split('.');
    let hasMatch = false;
    let allowed = false;

    // To respect specificity or order, we can check all matches.
    // If ANY match is `false`, we explicitly return `false` (deny overrides).
    // If NO match is `false` but AT LEAST ONE match is `true`, we return `true`.

    for (const [pattern, patternAllowed] of Object.entries(playerMap)) {
        if (pattern === '*') {
            // Support legacy global '*' just in case
            if (patternAllowed === false) return false;
            hasMatch = true;
            allowed = true;
            continue;
        }

        const pSegs = pattern.split('.');
        if (matchPermissionSegments(pSegs, nSegs, 0, 0)) {
            if (patternAllowed === false) {
                return false; // Explicit deny wins immediately
            }
            hasMatch = true;
            allowed = true;
        }
    }

    return hasMatch ? allowed : false;
}

function matchPermissionSegments(pSegs: string[], nSegs: string[], pIdx: number, nIdx: number): boolean {
    if (pIdx === pSegs.length && nIdx === nSegs.length) return true;
    if (pIdx === pSegs.length) return false;

    const pSeg = pSegs[pIdx];

    if (pSeg === '**') {
        // ** can match 0 or more segments
        if (matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx)) return true;
        if (nIdx < nSegs.length && matchPermissionSegments(pSegs, nSegs, pIdx, nIdx + 1)) return true;
        return false;
    } else if (pSeg === '*') {
        // * matches exactly 1 segment
        if (nIdx < nSegs.length && matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx + 1)) return true;
        return false;
    } else {
        // Exact match
        if (nIdx < nSegs.length && pSeg === nSegs[nIdx]) {
            return matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx + 1);
        }
        return false;
    }
}

export function canGrantPermissions(editor: mc.Player, nodes: string[]): boolean {
    for (const node of nodes) {
        if (!hasPermission(editor, node)) {
            return false;
        }
    }
    return true;
}
