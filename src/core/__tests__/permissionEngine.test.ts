import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { describe, expect, it, mock } from 'bun:test';

mock.module('../configurations.js', () => ({
    getRanksConfig: () => ({
        permissionGroups: {
            groupA: ['node.a', 'node.b'],
            groupB: ['node.c'],
            groupOverride: ['node.a'],
            emptyGroup: []
        }
    })
}));

mock.module('../playerCache.js', () => ({
    getAllPlayersFromCache: () => [{ id: 'player1' }, { id: 'player2' }]
}));

mock.module('../playerDataManager.js', () => ({
    getPlayer: (id: string) => {
        if (id === 'player1') return { ranks: ['rank1', 'rank3'] };
        if (id === 'player2') return { ranks: ['rank2'] };
        return null;
    }
}));

let rankPermissions: Record<string, string[]> = {
    rank1: ['node.a'],
    rank2: ['node.b'],
    rank3: ['node.c']
};

mock.module('../rankManager.js', () => ({
    getRankById: (id: string) => {
        return {
            id,
            name: id,
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: [],
            allow: rankPermissions[id] || [],
            deny: []
        };
    },
    getAllRanks: () => []
}));

mock.module('@minecraft/server', () => ({
    system: { currentTick: 100 },
    world: {
        afterEvents: {
            playerLeave: { subscribe: () => {} }
        }
    }
}));

mock.module('../../config.js', () => ({
    config: {
        playerDefaults: { rankId: 'member' },
        ownerPlayerNames: []
    }
}));

// Import after the mock
import { calculateRankMap, hasPermission, invalidateAllRankCaches, invalidateRankCache } from '../permissionEngine.js';

describe('calculateRankMap', () => {
    it('should merge permissions from multiple groups', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['groupA', 'groupB'],
            allow: [],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(true);
        expect(map['node.b']).toBe(true);
        expect(map['node.c']).toBe(true);
        expect(Object.keys(map).length).toBe(3);
    });

    it('should handle missing groups gracefully', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['groupA', 'nonExistentGroup'],
            allow: [],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(true);
        expect(map['node.b']).toBe(true);
        expect(Object.keys(map).length).toBe(2);
    });

    it('should combine group permissions with allow array', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['groupA'],
            allow: ['node.x', 'node.y'],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(true);
        expect(map['node.b']).toBe(true);
        expect(map['node.x']).toBe(true);
        expect(map['node.y']).toBe(true);
        expect(Object.keys(map).length).toBe(4);
    });

    it('should override group and allow permissions with deny array', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['groupA', 'groupB'],
            allow: ['node.x', 'node.a'], // node.a is both in group and allow
            deny: ['node.a', 'node.c', 'node.y'] // node.a overlaps, node.c from groupB overlaps
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(false); // Deny overrides allow and group
        expect(map['node.b']).toBe(true); // From groupA
        expect(map['node.c']).toBe(false); // Deny overrides groupB
        expect(map['node.x']).toBe(true); // From allow
        expect(map['node.y']).toBe(false); // From deny
        expect(Object.keys(map).length).toBe(5);
    });

    it('should handle empty inputs gracefully', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: [],
            allow: [],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(Object.keys(map).length).toBe(0);
    });

    it('should handle overlapping group permissions', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['groupA', 'groupOverride'],
            allow: [],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(true);
        expect(map['node.b']).toBe(true);
        expect(Object.keys(map).length).toBe(2);
    });

    it('should handle duplicate groups', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['groupA', 'groupA'],
            allow: [],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(true);
        expect(map['node.b']).toBe(true);
        expect(Object.keys(map).length).toBe(2);
    });

    it('should handle empty groups', () => {
        const rank = {
            id: 'test',
            name: 'Test',
            priority: 1,
            permissionLevel: 1,
            conditions: [],
            groups: ['emptyGroup'],
            allow: [],
            deny: []
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(Object.keys(map).length).toBe(0);
    });
});

describe('invalidateRankCache', () => {
    it('should invalidate rank and player caches properly based on real behavior', () => {
        invalidateAllRankCaches();

        // Initially rank1 has 'node.a', rank2 has 'node.b'
        rankPermissions = {
            rank1: ['node.a'],
            rank2: ['node.b'],
            rank3: ['node.c']
        };

        const player1 = { id: 'player1', name: 'Player 1', hasTag: () => false } as any;
        const player2 = { id: 'player2', name: 'Player 2', hasTag: () => false } as any;

        // Player1 (has rank1) should have 'node.a'
        expect(hasPermission(player1, 'node.a')).toBe(true);
        expect(hasPermission(player1, 'node.new')).toBe(false);

        // Player2 (has rank2) should have 'node.b'
        expect(hasPermission(player2, 'node.b')).toBe(true);
        expect(hasPermission(player2, 'node.new')).toBe(false);

        // Change rank1's underlying permissions
        rankPermissions.rank1 = ['node.a', 'node.new'];

        // Without invalidation, the cache still serves the old values
        expect(hasPermission(player1, 'node.new')).toBe(false);

        // Invalidate rank1 cache
        invalidateRankCache('rank1');

        // Now player1 should have 'node.new' because their cache was cleared
        expect(hasPermission(player1, 'node.new')).toBe(true);

        // Change rank2's underlying permissions
        rankPermissions.rank2 = ['node.b', 'node.new'];

        // Player2's cache was NOT invalidated (since rank1 was invalidated, and they only have rank2), so it still serves old data
        expect(hasPermission(player2, 'node.new')).toBe(false);

        // Invalidate rank2 cache
        invalidateRankCache('rank2');

        // Now player2 should have 'node.new'
        expect(hasPermission(player2, 'node.new')).toBe(true);
    });
});
