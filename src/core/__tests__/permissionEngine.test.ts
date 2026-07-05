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

mock.module('../playerDataManager.js', () => ({
    getPlayer: mock(() => ({
        id: 'test-player-1',
        name: 'TestPlayer',
        ranks: ['test-rank']
    }))
}));

mock.module('../rankManager.js', () => ({
    getRankById: mock((id: string) => {
        if (id === 'test-rank') {
            return {
                id: 'test-rank',
                name: 'Test Rank',
                priority: 10,
                permissionLevel: 1,
                conditions: [],
                groups: ['groupA'],
                allow: ['node.custom'],
                deny: []
            };
        }
        return undefined;
    }),
    getAllRanks: mock(() => [])
}));

// Import after the mock
import * as mc from '@minecraft/server';
import { calculatePlayerMap, calculateRankMap, invalidateAllRankCaches } from '../permissionEngine.js';

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

describe('calculatePlayerMap', () => {
    it('should calculate initial player map and populate cache', () => {
        invalidateAllRankCaches();
        const player = { id: 'test-player-1' } as mc.Player;
        (mc.system as any).currentTick = 100;

        const result = calculatePlayerMap(player);

        expect(result.map['node.a']).toBe(true);
        expect(result.map['node.b']).toBe(true);
        expect(result.map['node.custom']).toBe(true);
        expect(Object.keys(result.map).length).toBe(3);
    });

    it('should return cached map within 20 ticks', () => {
        invalidateAllRankCaches();
        const player = { id: 'test-player-1' } as mc.Player;

        // Initial call at tick 100
        (mc.system as any).currentTick = 100;
        const initialResult = calculatePlayerMap(player);

        // Modify the underlying map just to verify it's returning the exact same object
        initialResult.map['injected-for-test'] = true;

        // Second call at tick 119 (within 20 ticks)
        (mc.system as any).currentTick = 119;
        const cachedResult = calculatePlayerMap(player);

        // It should return the exact same object we mutated
        expect(cachedResult.map).toBe(initialResult.map);
        expect(cachedResult.map['injected-for-test']).toBe(true);
    });

    it('should recalculate map after 20 ticks', () => {
        invalidateAllRankCaches();
        const player = { id: 'test-player-1' } as mc.Player;

        // Initial call at tick 100
        (mc.system as any).currentTick = 100;
        const initialResult = calculatePlayerMap(player);

        initialResult.map['injected-for-test'] = true;

        // Second call at tick 120 (exactly 20 ticks later, should recalculate)
        (mc.system as any).currentTick = 120;
        const newResult = calculatePlayerMap(player);

        // It should be a new object, not the mutated cached one
        expect(newResult.map).not.toBe(initialResult.map);
        expect(newResult.map['injected-for-test']).toBeUndefined();
        expect(newResult.map['node.a']).toBe(true);
    });
});
