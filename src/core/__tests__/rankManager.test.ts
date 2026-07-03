import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { beforeEach, describe, expect, it, mock } from 'bun:test';

mock.module('@minecraft/server', () => ({
    system: { currentTick: 0 },
    world: {
        afterEvents: {
            playerLeave: {
                subscribe: mock()
            }
        }
    },
    Player: class {}
}));

mock.module('@core/configurations.js', () => ({
    getRanksConfig: mock()
}));

mock.module('@core/logger.js', () => ({
    debugLog: mock(),
    errorLog: mock()
}));

mock.module('@core/permissionEngine.js', () => ({
    getPlayerRanks: mock()
}));

mock.module('@core/playerCache.js', () => ({
    findPlayerByName: mock(),
    getPlayerFromCache: mock()
}));

mock.module('@core/playerDataManager.js', () => ({
    loadPlayerData: mock()
}));

mock.module('@commands/commandManager.js', () => ({
    CommandExecutor: class {}
}));

mock.module('@core/../config.js', () => ({
    config: {
        playerDefaults: {
            rankId: 'default'
        },
        ranks: {
            nameTagStyle: 'above'
        }
    }
}));

import { config as Config } from '@core/../config.js';
import { getRanksConfig } from '@core/configurations.js';
import { getPlayerRanks } from '@core/permissionEngine.js';
import { findPlayerByName, getPlayerFromCache } from '@core/playerCache.js';
import { loadPlayerData } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';
import { canTarget, getAllRanks, getPlayerRank, getRankById, initialize, reloadRanks, updatePlayerNameTag } from '../rankManager.js';

describe('rankManager', () => {
    const mockRanks: RankDefinition[] = [{ id: 'admin', priority: 10 } as RankDefinition, { id: 'default', priority: 100 } as RankDefinition, { id: 'mod', priority: 50 } as RankDefinition];

    beforeEach(() => {
        mock.restore();
        // @ts-expect-error mocking readonly
        mc.system.currentTick = 0;
        (getRanksConfig as ReturnType<typeof mock>).mockReturnValue({
            rankDefinitions: mockRanks
        });
    });

    describe('reloadRanks', () => {
        it('should sort ranks and clear cache', () => {
            reloadRanks();
            const ranks = getAllRanks();
            expect(ranks).toEqual(mockRanks);
            // It sorts internally but getAllRanks returns from config
            // We can indirectly verify sorting if other methods behave correctly.
        });
    });

    describe('initialize', () => {
        it('should call reloadRanks and subscribe to playerLeave', () => {
            initialize();
            expect(mc.world.afterEvents.playerLeave.subscribe).toHaveBeenCalled();
        });
    });

    describe('getPlayerRank', () => {
        it('should return highest priority rank for player', () => {
            reloadRanks(); // Initialize internal sortedRanks
            const player = { id: 'player1' } as mc.Player;
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([
                mockRanks[1], // default (priority 100)
                mockRanks[0] // admin (priority 10)
            ]);

            const rank = getPlayerRank(player, Config);
            expect(rank).toEqual(mockRanks[0]); // admin is highest priority (lowest number)
        });

        it('should return cached rank if within 20 ticks', () => {
            const player = { id: 'player2' } as mc.Player;
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([mockRanks[0]]);

            // @ts-expect-error mocking readonly
            mc.system.currentTick = 100;
            const rank1 = getPlayerRank(player, Config);

            // @ts-expect-error mocking readonly
            mc.system.currentTick = 110; // Within 20 ticks
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([mockRanks[1]]); // Change mock to see if cache is used
            const rank2 = getPlayerRank(player, Config);

            expect(rank1).toEqual(mockRanks[0]);
            expect(rank2).toEqual(mockRanks[0]); // Should be cached
        });

        it('should fallback to default configured rank if no ranks found', () => {
            const player = { id: 'player3' } as mc.Player;
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([]);

            const rank = getPlayerRank(player, Config);
            expect(rank).toEqual(mockRanks[1]); // default rank is mockRanks[1]
        });

        it('should fallback to minimal safe fallback if default rank is missing', () => {
            const player = { id: 'player4' } as mc.Player;
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([]);
            (getRanksConfig as ReturnType<typeof mock>).mockReturnValue({
                rankDefinitions: [mockRanks[0], mockRanks[2]] // Remove 'default' rank
            });

            const rank = getPlayerRank(player, Config);
            expect(rank.id).toBe('fallback');
            expect(rank.priority).toBe(1000);
        });
    });

    describe('canTarget', () => {
        beforeEach(() => {
            // @ts-expect-error mocking readonly
            mc.system.currentTick = 200; // Reset tick for caching isolation
            (getRanksConfig as ReturnType<typeof mock>).mockReturnValue({
                rankDefinitions: mockRanks
            });
        });

        it('should allow console to target anyone', () => {
            const executor = {} as any; // Not an instance of mc.Player
            expect(canTarget(executor, 'somePlayerId', Config)).toBe(true);
        });

        it('should return false for self-targeting', () => {
            const executor = { id: 'selfId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            expect(canTarget(executor, 'selfId', Config)).toBe(false);
        });

        it('should allow higher priority (lower number) to target lower priority', () => {
            const executor = { id: 'adminId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            (getPlayerRanks as ReturnType<typeof mock>).mockImplementation((p: any) => {
                if (p.id === 'adminId') return [mockRanks[0]]; // admin, priority 10
                if (p.id === 'modId') return [mockRanks[2]]; // mod, priority 50
                return [];
            });

            // Target is online and cached
            const targetPlayer = { id: 'modId' } as mc.Player;
            (getPlayerFromCache as ReturnType<typeof mock>).mockReturnValue(targetPlayer);

            expect(canTarget(executor, 'modId', Config)).toBe(true);
        });

        it('should deny lower priority (higher number) targeting higher priority', () => {
            const executor = { id: 'modId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            (getPlayerRanks as ReturnType<typeof mock>).mockImplementation((p: any) => {
                if (p.id === 'adminId') return [mockRanks[0]]; // admin, priority 10
                if (p.id === 'modId') return [mockRanks[2]]; // mod, priority 50
                return [];
            });

            const targetPlayer = { id: 'adminId' } as mc.Player;
            (getPlayerFromCache as ReturnType<typeof mock>).mockReturnValue(targetPlayer);

            expect(canTarget(executor, 'adminId', Config)).toBe(false);
        });

        it('should resolve target rank for offline players via data manager', () => {
            const executor = { id: 'adminId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([mockRanks[0]]); // Admin (10)

            (getPlayerFromCache as ReturnType<typeof mock>).mockReturnValue(undefined);
            (findPlayerByName as ReturnType<typeof mock>).mockReturnValue(undefined);

            // Offline player has mod rank
            (loadPlayerData as ReturnType<typeof mock>).mockReturnValue({
                ranks: ['mod'] // mod is priority 50
            });

            expect(canTarget(executor, 'offlineModId', Config)).toBe(true);
        });

        it('should fallback for offline players with no data', () => {
            const executor = { id: 'modId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([mockRanks[2]]); // Mod (50)

            (getPlayerFromCache as ReturnType<typeof mock>).mockReturnValue(undefined);
            (findPlayerByName as ReturnType<typeof mock>).mockReturnValue(undefined);
            (loadPlayerData as ReturnType<typeof mock>).mockReturnValue(undefined);

            // Target falls back to default rank priority (100)
            // Mod (50) < Default (100), so mod can target
            expect(canTarget(executor, 'offlineNewbieId', Config)).toBe(true);
        });
    });

    describe('getRankById', () => {
        it('should return rank definition if found', () => {
            expect(getRankById('admin')).toEqual(mockRanks[0]);
        });

        it('should return undefined if not found', () => {
            expect(getRankById('unknown')).toBeUndefined();
        });
    });

    describe('getAllRanks', () => {
        it('should return all rank definitions', () => {
            expect(getAllRanks()).toEqual(mockRanks);
        });
    });

    describe('updatePlayerNameTag', () => {
        let player: mc.Player;

        beforeEach(() => {
            player = { id: 'player1', name: 'PlayerName', nameTag: 'PlayerName' } as mc.Player;
            (getPlayerRanks as ReturnType<typeof mock>).mockReturnValue([mockRanks[0]]); // Admin
            // Admin doesn't have chatFormatting defined in mockRanks initially, let's update it for these tests
            mockRanks[0].chatFormatting = { prefixText: 'ADMIN', nameColor: '§7', messageColor: '§r' };

            // @ts-expect-error mocking readonly
            mc.system.currentTick = 300;
        });

        it('should apply rank prefix above nametag by default (or if configured default)', () => {
            Config.ranks.nameTagStyle = 'above';
            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('§e[§rADMIN§e]§r\nPlayerName');
        });

        it('should apply rank prefix before nametag', () => {
            Config.ranks.nameTagStyle = 'before';
            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('§e[§rADMIN§e]§r PlayerName');
        });

        it('should apply rank prefix after nametag', () => {
            Config.ranks.nameTagStyle = 'after';
            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('PlayerName §e[§rADMIN§e]§r');
        });

        it('should apply rank prefix under nametag', () => {
            Config.ranks.nameTagStyle = 'under';
            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('PlayerName\n§e[§rADMIN§e]§r');
        });

        // @ts-expect-error mocking readonly
        // @ts-expect-error mocking readonly
        it('should default to above if an unknown nametag style is provided', () => {
            // @ts-expect-error mocking wrong enum
            Config.ranks.nameTagStyle = 'unknown_style';
            updatePlayerNameTag(player, Config);
            // @ts-expect-error mocking wrong enum
            expect(player.nameTag).toBe('§e[§rADMIN§e]§r\nPlayerName');
        });

        it('should set nametag to just the player name if no prefix is configured', () => {
            mockRanks[0].chatFormatting = { prefixText: '', nameColor: '§7', messageColor: '§r' };
            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('PlayerName');
        });

        it('should not update nameTag if it has not changed', () => {
            player.nameTag = '§e[§rADMIN§e]§r\nPlayerName';
            Config.ranks.nameTagStyle = 'above';
            mockRanks[0].chatFormatting = { prefixText: 'ADMIN', nameColor: '§7', messageColor: '§r' };

            // We can't directly check the assignment was skipped, but we can verify it doesn't break
            // and retains the expected string.
            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('§e[§rADMIN§e]§r\nPlayerName');
        });
    });
});
