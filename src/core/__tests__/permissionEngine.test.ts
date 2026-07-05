import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

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
mock.module('../../config.js', () => ({
    config: {
        playerDefaults: { rankId: 'defaultRank' },
        ownerPlayerNames: ['owner_test']
    }
}));

mock.module('@core/playerDataManager.js', () => ({
    getPlayer: mock(() => ({ ranks: [] }))
}));

mock.module('@core/rankManager.js', () => ({
    getAllRanks: mock(() => []),
    getRankById: mock((id) => null)
}));

// Import after the mock
import { calculateRankMap, getPlayerRanks } from '../permissionEngine.js';
import { getPlayer } from '@core/playerDataManager.js';
import { getAllRanks, getRankById } from '@core/rankManager.js';
import { config } from '../../config.js';


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



describe('getPlayerRanks', () => {
    let mockPlayer: any;

    beforeEach(() => {
        mockPlayer = {
            id: '123',
            name: 'test_player',
            hasTag: mock(() => false)
        };
        // Reset mocks
        (getPlayer as any).mockClear();
        (getAllRanks as any).mockClear();
        (getRankById as any).mockClear();

        config.playerDefaults.rankId = 'defaultRank';
        config.ownerPlayerNames = ['owner_test'];
    });

    it('should return assigned ranks from player data', () => {
        const assignedRank = { id: 'admin', name: 'Admin', priority: 1, conditions: [] };
        (getPlayer as any).mockReturnValue({ ranks: ['admin'] });
        (getRankById as any).mockImplementation((id: string) => id === 'admin' ? assignedRank : null);
        (getAllRanks as any).mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('admin');
    });

    it('should fallback to config default rank if no rank assigned', () => {
        const defaultRank = { id: 'defaultRank', name: 'Default', priority: 10, conditions: [] };
        (getPlayer as any).mockReturnValue({ ranks: [] }); // No ranks
        (getRankById as any).mockImplementation((id: string) => id === 'defaultRank' ? defaultRank : null);
        (getAllRanks as any).mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('defaultRank');
    });

    it('should fallback to "member" if config default is missing and no rank assigned', () => {
        config.playerDefaults.rankId = undefined as any; // Clear config default
        const memberRank = { id: 'member', name: 'Member', priority: 20, conditions: [] };

        (getPlayer as any).mockReturnValue({ ranks: [] });
        (getRankById as any).mockImplementation((id: string) => id === 'member' ? memberRank : null);
        (getAllRanks as any).mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('member');
    });

    it('should add condition-based ranks (isOwner)', () => {
        mockPlayer.name = 'owner_test'; // Match the config

        const ownerRank = { id: 'owner', name: 'Owner', priority: 0, conditions: [{ type: 'isOwner' }] };
        const memberRank = { id: 'member', name: 'Member', priority: 20, conditions: [] };

        (getPlayer as any).mockReturnValue({ ranks: ['member'] });
        (getRankById as any).mockImplementation((id: string) => id === 'member' ? memberRank : null);
        (getAllRanks as any).mockReturnValue([ownerRank, memberRank]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(2);
        // Sorted by priority (lowest number = highest priority)
        expect(ranks[0].id).toBe('owner');
        expect(ranks[1].id).toBe('member');
    });

    it('should add condition-based ranks (hasTag)', () => {
        mockPlayer.hasTag = mock((tag: string) => tag === 'vip_tag');

        const vipRank = { id: 'vip', name: 'VIP', priority: 5, conditions: [{ type: 'hasTag', value: 'vip_tag' }] };
        const memberRank = { id: 'member', name: 'Member', priority: 20, conditions: [] };

        (getPlayer as any).mockReturnValue({ ranks: ['member'] });
        (getRankById as any).mockImplementation((id: string) => id === 'member' ? memberRank : null);
        (getAllRanks as any).mockReturnValue([vipRank, memberRank]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(2);
        expect(ranks[0].id).toBe('vip');
        expect(ranks[1].id).toBe('member');
    });

    it('should add condition-based ranks (default condition) only if no other ranks assigned', () => {
        // Here, the default rank fallback adds config.playerDefaults.rankId to rankIds
        // so assignedRankCount > 0 normally.
        // We will make getRankById return null so ranks array is empty.

        const autoDefaultRank = { id: 'autoDefault', name: 'Auto Default', priority: 30, conditions: [{ type: 'default' }] };

        (getPlayer as any).mockReturnValue({ ranks: ['someMissingRank'] });
        // Return null for everything, so ranks length will be 0 before condition check
        (getRankById as any).mockReturnValue(null);
        (getAllRanks as any).mockReturnValue([autoDefaultRank]);

        const ranks = getPlayerRanks(mockPlayer);
        // It should match 'default' condition because ranks.length === 0 when evaluateRankConditions runs
        expect(ranks.some(r => r.id === 'autoDefault')).toBe(true);
    });

    it('should explicitely add default config rank if absolutely no ranks were assigned or conditions met', () => {
        const defaultRank = { id: 'defaultRank', name: 'Default', priority: 10, conditions: [] };

        // Let's pretend rankIds fallback happened but getRankById returned null for it.
        (getPlayer as any).mockReturnValue({ ranks: ['someMissingRank'] });

        // This will be called a second time explicitly
        (getRankById as any).mockImplementation((id: string) => id === 'defaultRank' ? defaultRank : null);
        (getAllRanks as any).mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('defaultRank');
    });
});
