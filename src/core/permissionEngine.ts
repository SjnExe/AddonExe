import * as configManager from '@core/configManager.js';
import * as configurations from '@core/configurations.js';
import { getAllPlayersFromCache } from '@core/playerCache.js';
import * as playerDataManager from '@core/playerDataManager.js';
import * as rankManager from '@core/rankManager.js';
import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

// Cache for flattened rank maps
const rankCache = new Map<string, Record<string, boolean>>();

// Cache for player final merged maps
const playerMapCache = new Map<string, { map: Record<string, boolean>; tick: number; resolvedCache: Map<string, boolean> }>();

export function calculateRankMap(rank: RankDefinition): Record<string, boolean> {
    const map: Record<string, boolean> = Object.create(null) as Record<string, boolean>;

    // 1. Process groups
    for (const group of rank.groups) {
        const groupNodes = configurations.getRanksConfig().permissionGroups[group];
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
        const pData = playerDataManager.getPlayer(player.id);
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

    const rank = rankManager.getRankById(rankId);
    if (!rank) {
        return Object.create(null) as Record<string, boolean>;
    }

    const map = calculateRankMap(rank);
    rankCache.set(rankId, map);
    return map;
}

export function getPlayerRanks(player: mc.Player): RankDefinition[] {
    const pData = playerDataManager.getPlayer(player.id);

    // Fallback logic, ensuring we match `configManager.getConfig().playerDefaults.rankId` or the hardcoded default 'member' if all else fails
    let rankIds = pData?.ranks;
    if (!rankIds || rankIds.length === 0) {
        if (configManager.getConfig().playerDefaults.rankId) {
            rankIds = [configManager.getConfig().playerDefaults.rankId];
        } else {
            rankIds = ['member'];
        }
    }

    // Gather assigned ranks
    const ranks = rankIds.reduce<RankDefinition[]>((acc, id) => {
        const rank = rankManager.getRankById(id);
        if (isDefined(rank)) {
            acc.push(rank);
        }
        return acc;
    }, []);

    // Check condition-based ranks (like isOwner, hasTag) and add them if they apply
    const allRanks = rankManager.getAllRanks();

    for (const rank of allRanks) {
        if (!ranks.includes(rank) && evaluateRankConditions(player, rank, ranks.length)) {
            ranks.push(rank);
        }
    }

    // If absolutely no rank was assigned or conditions met, explicitly grant the configured default rank
    if (ranks.length === 0) {
        const defaultRank = rankManager.getRankById(configManager.getConfig().playerDefaults.rankId);
        if (defaultRank) {
            ranks.push(defaultRank);
        }
    }

    // Sort ranks by priority (lowest number = highest priority)
    return ranks.toSorted((a, b) => a.priority - b.priority);
}

function evaluateRankConditions(player: mc.Player, rank: RankDefinition, assignedRankCount: number): boolean {
    if (rank.conditions.length === 0) {
        return false;
    }

    for (const condition of rank.conditions) {
        if (condition.type === 'hasTag') {
            if (!player.hasTag(condition.value as string)) {
                return false;
            }
        } else if (condition.type === 'default') {
            // Evaluates true only if the player has absolutely no other ranks
            if (assignedRankCount > 0) {
                return false;
            }
        }
    }
    return true;
}

export function calculatePlayerMap(player: mc.Player): { map: Record<string, boolean>; resolvedCache: Map<string, boolean> } {
    const currentTick = mc.system.currentTick;
    const cached = playerMapCache.get(player.id);

    if (cached && currentTick - cached.tick < 20) {
        return cached;
    }

    const ranks = getPlayerRanks(player);

    // Reversing ranks so higher priority (lower integer) gets merged last, overwriting lower priority maps
    const reversedRanks = [...ranks].reverse();

    const playerMap: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
    for (const rank of reversedRanks) {
        const rankMap = getRankMap(rank.id);
        Object.assign(playerMap, rankMap);
    }

    const resolvedCache = new Map<string, boolean>();
    playerMapCache.set(player.id, { map: playerMap, tick: currentTick, resolvedCache });
    return { map: playerMap, resolvedCache };
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
    const { map: playerMap, resolvedCache } = calculatePlayerMap(player);

    // Exact match
    if (playerMap[node] !== undefined) {
        return playerMap[node];
    }

    const cachedResolution = resolvedCache.get(node);
    if (cachedResolution !== undefined) {
        return cachedResolution;
    }

    // Check wildcards using Linux-style rules (* for 1 segment, ** for 0 or more)
    const nSegs = node.split('.');
    let hasMatch = false;
    let allowed = false;

    const mapEntries = Object.entries(playerMap);
    for (const [pattern, patternAllowed] of mapEntries) {
        if (!pattern.includes('*')) {
            continue;
        }

        if (pattern === '*') {
            if (patternAllowed === false) {
                resolvedCache.set(node, false);
                return false;
            }
            hasMatch = true;
            allowed = true;
            continue;
        }

        const pSegs = pattern.split('.');
        if (matchPermissionSegments(pSegs, nSegs, 0, 0)) {
            if (patternAllowed === false) {
                resolvedCache.set(node, false);
                return false;
            }
            hasMatch = true;
            allowed = true;
        }
    }

    const finalResult = hasMatch ? allowed : false;
    resolvedCache.set(node, finalResult);
    return finalResult;
}

function matchPermissionSegments(pSegs: string[], nSegs: string[], pIdx: number, nIdx: number): boolean {
    if (pIdx === pSegs.length && nIdx === nSegs.length) {
        return true;
    }
    if (pIdx === pSegs.length) {
        return false;
    }

    const pSeg = pSegs[pIdx];

    if (pSeg === '**') {
        if (matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx)) {
            return true;
        }
        if (nIdx < nSegs.length && matchPermissionSegments(pSegs, nSegs, pIdx, nIdx + 1)) {
            return true;
        }
        return false;
    } else if (pSeg === '*') {
        if (nIdx < nSegs.length && matchPermissionSegments(pSegs, nSegs, pIdx + 1, nIdx + 1)) {
            return true;
        }
        return false;
    } else {
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
