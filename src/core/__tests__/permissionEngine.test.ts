import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Shared tracking variables for dynamic test scenarios
let rankPermissions: Record<string, string[]> = {
    rank1: ['node.a'],
    rank2: ['node.b'],
    rank3: ['node.c']
};

// Define shared mock function instances to support runtime overriding
const mockGetPlayer = mock(() => null);
const mockGetRankById = mock(() => null);
const mockGetAllRanks = mock(() => []);

// --- MODULE MOCKS ---

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

mock.module('../../config.js', () => ({
    config: {
        playerDefaults: { rankId: 'defaultRank' },
        ownerPlayerNames: ['owner_test']
    }
}));

import { config as Config } from '../../config.js';

mock.module('@core/configManager.js', () => ({
    getConfig: () => Config
}));

mock.module('../playerCache.js', () => ({
    getAllPlayersFromCache: () => [{ id: 'player1' }, { id: 'player2' }]
}));

// Mock both path styles to accommodate PR 1303's path alias change
mock.module('../playerDataManager.js', () => ({ getPlayer: mockGetPlayer }));
mock.module('@core/playerDataManager.js', () => ({ getPlayer: mockGetPlayer }));

mock.module('../rankManager.js', () => ({
    getRankById: mockGetRankById,
    getAllRanks: mockGetAllRanks
}));
mock.module('@core/rankManager.js', () => ({
    getRankById: mockGetRankById,
    getAllRanks: mockGetAllRanks
}));

mock.module('@minecraft/server', () => ({
    system: { currentTick: 100 },
    world: {
        afterEvents: {
            playerLeave: { subscribe: () => {} }
        }
    }
}));

// --- IMPORTS AFTER MOCKS ---
import * as mc from '@minecraft/server';
import { config } from '../../config.js';
import { calculatePlayerMap, calculateRankMap, getPlayerRanks, hasPermission, invalidateAllRankCaches, invalidateRankCache } from '../permissionEngine.js';

// Helper to reset baseline test environments (Main and PR 1311 specs)
function resetToBaseDefaults() {
    mockGetPlayer.mockImplementation((id: string) => {
        if (id === 'test-player-1') return { id: 'test-player-1', name: 'TestPlayer', ranks: ['test-rank'] };
        if (id === 'player1') return { ranks: ['rank1', 'rank3'] };
        if (id === 'player2') return { ranks: ['rank2'] };
        return null;
    });

    mockGetRankById.mockImplementation((id: string) => {
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
        if (id) {
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
        }
        return null;
    });

    mockGetAllRanks.mockReturnValue([]);
    config.playerDefaults.rankId = 'member';
    config.ownerPlayerNames = [];
}

// Initialize setup
resetToBaseDefaults();

// --- TEST SUITES ---

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
            allow: ['node.x', 'node.a'],
            deny: ['node.a', 'node.c', 'node.y']
        } as unknown as RankDefinition;

        const map = calculateRankMap(rank);
        expect(map['node.a']).toBe(false);
        expect(map['node.b']).toBe(true);
        expect(map['node.c']).toBe(false);
        expect(map['node.x']).toBe(true);
        expect(map['node.y']).toBe(false);
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
    beforeEach(() => {
        resetToBaseDefaults();
    });

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

        (mc.system as any).currentTick = 100;
        const initialResult = calculatePlayerMap(player);
        initialResult.map['injected-for-test'] = true;

        (mc.system as any).currentTick = 119;
        const cachedResult = calculatePlayerMap(player);

        expect(cachedResult.map).toBe(initialResult.map);
        expect(cachedResult.map['injected-for-test']).toBe(true);
    });

    it('should recalculate map after 20 ticks', () => {
        invalidateAllRankCaches();
        const player = { id: 'test-player-1' } as mc.Player;

        (mc.system as any).currentTick = 100;
        const initialResult = calculatePlayerMap(player);
        initialResult.map['injected-for-test'] = true;

        (mc.system as any).currentTick = 120;
        const newResult = calculatePlayerMap(player);

        expect(newResult.map).not.toBe(initialResult.map);
        expect(newResult.map['injected-for-test']).toBeUndefined();
        expect(newResult.map['node.a']).toBe(true);
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

        mockGetPlayer.mockClear();
        mockGetAllRanks.mockClear();
        mockGetRankById.mockClear();

        config.playerDefaults.rankId = 'defaultRank';
        config.ownerPlayerNames = ['owner_test'];
    });

    it('should return assigned ranks from player data', () => {
        const assignedRank = { id: 'admin', name: 'Admin', priority: 1, conditions: [] };
        mockGetPlayer.mockReturnValue({ ranks: ['admin'] });
        mockGetRankById.mockImplementation((id: string) => (id === 'admin' ? assignedRank : null));
        mockGetAllRanks.mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('admin');
    });

    it('should fallback to config default rank if no rank assigned', () => {
        const defaultRank = { id: 'defaultRank', name: 'Default', priority: 10, conditions: [] };
        mockGetPlayer.mockReturnValue({ ranks: [] });
        mockGetRankById.mockImplementation((id: string) => (id === 'defaultRank' ? defaultRank : null));
        mockGetAllRanks.mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('defaultRank');
    });

    it('should fallback to "member" if config default is missing and no rank assigned', () => {
        config.playerDefaults.rankId = undefined as any;
        const memberRank = { id: 'member', name: 'Member', priority: 20, conditions: [] };

        mockGetPlayer.mockReturnValue({ ranks: [] });
        mockGetRankById.mockImplementation((id: string) => (id === 'member' ? memberRank : null));
        mockGetAllRanks.mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('member');
    });

    it('should add condition-based ranks (isOwner)', () => {
        mockPlayer.name = 'owner_test';

        const ownerRank = { id: 'owner', name: 'Owner', priority: 0, conditions: [{ type: 'isOwner' }] };
        const memberRank = { id: 'member', name: 'Member', priority: 20, conditions: [] };

        mockGetPlayer.mockReturnValue({ ranks: ['member'] });
        mockGetRankById.mockImplementation((id: string) => (id === 'member' ? memberRank : null));
        mockGetAllRanks.mockReturnValue([ownerRank, memberRank]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(2);
        expect(ranks[0].id).toBe('owner');
        expect(ranks[1].id).toBe('member');
    });

    it('should add condition-based ranks (hasTag)', () => {
        mockPlayer.hasTag = mock((tag: string) => tag === 'vip_tag');

        const vipRank = { id: 'vip', name: 'VIP', priority: 5, conditions: [{ type: 'hasTag', value: 'vip_tag' }] };
        const memberRank = { id: 'member', name: 'Member', priority: 20, conditions: [] };

        mockGetPlayer.mockReturnValue({ ranks: ['member'] });
        mockGetRankById.mockImplementation((id: string) => (id === 'member' ? memberRank : null));
        mockGetAllRanks.mockReturnValue([vipRank, memberRank]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(2);
        expect(ranks[0].id).toBe('vip');
        expect(ranks[1].id).toBe('member');
    });

    it('should add condition-based ranks (default condition) only if no other ranks assigned', () => {
        const autoDefaultRank = { id: 'autoDefault', name: 'Auto Default', priority: 30, conditions: [{ type: 'default' }] };

        mockGetPlayer.mockReturnValue({ ranks: ['someMissingRank'] });
        mockGetRankById.mockReturnValue(null);
        mockGetAllRanks.mockReturnValue([autoDefaultRank]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks.some((r) => r.id === 'autoDefault')).toBe(true);
    });

    it('should explicitely add default config rank if absolutely no ranks were assigned or conditions met', () => {
        const defaultRank = { id: 'defaultRank', name: 'Default', priority: 10, conditions: [] };

        mockGetPlayer.mockReturnValue({ ranks: ['someMissingRank'] });
        mockGetRankById.mockImplementation((id: string) => (id === 'defaultRank' ? defaultRank : null));
        mockGetAllRanks.mockReturnValue([]);

        const ranks = getPlayerRanks(mockPlayer);
        expect(ranks).toHaveLength(1);
        expect(ranks[0].id).toBe('defaultRank');
    });
});

describe('invalidateRankCache', () => {
    beforeEach(() => {
        resetToBaseDefaults();
    });

    it('should invalidate rank and player caches properly based on real behavior', () => {
        invalidateAllRankCaches();

        rankPermissions = {
            rank1: ['node.a'],
            rank2: ['node.b'],
            rank3: ['node.c']
        };

        const player1 = { id: 'player1', name: 'Player 1', hasTag: () => false } as any;
        const player2 = { id: 'player2', name: 'Player 2', hasTag: () => false } as any;

        expect(hasPermission(player1, 'node.a')).toBe(true);
        expect(hasPermission(player1, 'node.new')).toBe(false);

        expect(hasPermission(player2, 'node.b')).toBe(true);
        expect(hasPermission(player2, 'node.new')).toBe(false);

        rankPermissions.rank1 = ['node.a', 'node.new'];
        expect(hasPermission(player1, 'node.new')).toBe(false);

        invalidateRankCache('rank1');
        expect(hasPermission(player1, 'node.new')).toBe(true);

        rankPermissions.rank2 = ['node.b', 'node.new'];
        expect(hasPermission(player2, 'node.new')).toBe(false);

        invalidateRankCache('rank2');
        expect(hasPermission(player2, 'node.new')).toBe(true);
    });
});
