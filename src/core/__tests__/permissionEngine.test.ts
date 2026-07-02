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

// Import after the mock
import { calculateRankMap } from '../permissionEngine.js';

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
