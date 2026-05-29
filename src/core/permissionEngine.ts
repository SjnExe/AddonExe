import * as mc from '@minecraft/server';
import { getPlayer } from '@core/playerDataManager.js';
import { getRankById, getAllRanks } from '@core/rankManager.js';
import { RankDefinition, permissionGroups } from '@core/ranksConfig.default.js';
import { config } from '@core/../config.default.js';
import { isDefined } from '@lib/guards.js';

// Cache for flattened rank maps
const rankCache = new Map<string, Record<string, boolean>>();

// Cache for player final merged maps
const playerMapCache = new Map<string, { map: Record<string, boolean>; tick: number }>();

export function calculateRankMap(rank: RankDefinition): Record<string, boolean> {
    const map = Object.create(null);

    // 1. Process groups
    for (const group of rank.groups) {
        const groupNodes = permissionGroups[group];
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
    for (const player of mc.world.getAllPlayers()) {
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
        return Object.create(null);
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
    const ranks = rankIds.map(id => getRankById(id)).filter(isDefined);

    // Check condition-based ranks (like isOwner, hasTag) and add them if they apply
    const allRanks = getAllRanks();

    for (const rank of allRanks) {
        if (!ranks.includes(rank) && evaluateRankConditions(player, rank, ranks.length)) {
            ranks.push(rank);
        }
    }

    // If absolutely no rank was assigned or conditions met, explicitly grant the configured default rank
    if (ranks.length === 0) {
        const defaultRank = getRankById(config.playerDefaults.rankId ?? 'member');
        if (defaultRank) {
            ranks.push(defaultRank);
        }
    }

    // Sort ranks by priority (lowest number = highest priority)
    return ranks.toSorted((a, b) => a.priority - b.priority);
}

function evaluateRankConditions(player: mc.Player, rank: RankDefinition, assignedRankCount: number): boolean {
    if (!rank.conditions || rank.conditions.length === 0) return false;

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

    const playerMap = Object.create(null);
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
    if (ranks.some(r => r.id === 'owner' || r.allow.includes('*'))) {
        return true;
    }

    // Admin core permissions
    if (ranks.some(r => r.id === 'admin')) {
        const adminCorePermissions = ['cmd.ban', 'cmd.unban', 'cmd.tp', 'cmd.warp', 'cmd.setbalance', 'ui.panel.admin'];
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

    // Wildcard matching (e.g., cmd.*)
    const segments = node.split('.');
    let currentWildcard = '';

    for (let i = 0; i < segments.length - 1; i++) {
        currentWildcard += (i === 0 ? '' : '.') + segments[i];
        const wildcardNode = currentWildcard + '.*';
        if (playerMap[wildcardNode] !== undefined) {
            return playerMap[wildcardNode];
        }
    }

    // Global wildcard
    if (playerMap['*'] !== undefined) {
        return playerMap['*'];
    }

    return false;
}
