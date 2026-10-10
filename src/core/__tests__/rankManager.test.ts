import { RankDefinition } from '@features/ranks/ranksConfig.js';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import * as configManager from '@core/configManager.js';
import * as configurations from '@core/configurations.js';

import * as permissionEngine from '@core/permissionEngine.js';
import { addPlayerToCache, initializePlayerCache } from '@core/playerCache.js';
import * as playerDataManager from '@core/playerDataManager.js';

import { config as Config } from '@core/../config.js';
import * as mc from '@minecraft/server';
import { canTarget, getAllRanks, getPlayerRank, getRankById, initialize, reloadRanks, updatePlayerNameTag } from '../rankManager.js';

describe('rankManager', () => {
    const mockRanks: RankDefinition[] = [{ id: 'admin', priority: 10 } as RankDefinition, { id: 'default', priority: 100 } as RankDefinition, { id: 'mod', priority: 50 } as RankDefinition];

    let getConfigSpy: any;
    let getRanksConfigSpy: any;
    let getPlayerRanksSpy: any;
    let loadPlayerDataSpy: any;
    let getAllPlayersSpy: any;

    beforeEach(() => {
        Config.playerDefaults.rankId = 'default';
        getAllPlayersSpy = spyOn(mc.world, 'getAllPlayers').mockReturnValue([]);
        getConfigSpy = spyOn(configManager, 'getConfig').mockReturnValue(Config as any);
        getRanksConfigSpy = spyOn(configurations, 'getRanksConfig').mockReturnValue({
            rankDefinitions: mockRanks
        } as any);
        getPlayerRanksSpy = spyOn(permissionEngine, 'getPlayerRanks').mockReturnValue([]);
        loadPlayerDataSpy = spyOn(playerDataManager, 'loadPlayerData').mockReturnValue(undefined);
        // @ts-expect-error mocking readonly
        mc.system.currentTick = 0;
        reloadRanks();
    });

    afterEach(() => {
        getAllPlayersSpy?.mockRestore();
        getConfigSpy?.mockRestore();
        getRanksConfigSpy?.mockRestore();
        getPlayerRanksSpy?.mockRestore();
        loadPlayerDataSpy?.mockRestore();
    });

    describe('reloadRanks', () => {
        it('should sort ranks and clear cache', () => {
            reloadRanks();
            const ranks = getAllRanks();
            expect(ranks).toEqual(mockRanks);
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
            reloadRanks();
            const player = { id: 'player1' } as mc.Player;
            getPlayerRanksSpy.mockReturnValue([
                mockRanks[1], // default (priority 100)
                mockRanks[0] // admin (priority 10)
            ]);

            const rank = getPlayerRank(player, Config);
            expect(rank).toEqual(mockRanks[0]);
        });

        it('should return cached rank if within 20 ticks', () => {
            const player = { id: 'player2' } as mc.Player;
            getPlayerRanksSpy.mockReturnValue([mockRanks[0]]);

            // @ts-expect-error mocking readonly
            mc.system.currentTick = 100;
            const rank1 = getPlayerRank(player, Config);

            // @ts-expect-error mocking readonly
            mc.system.currentTick = 110;
            getPlayerRanksSpy.mockReturnValue([mockRanks[1]]);
            const rank2 = getPlayerRank(player, Config);

            expect(rank1).toEqual(mockRanks[0]);
            expect(rank2).toEqual(mockRanks[0]);
        });

        it('should fallback to default configured rank if no ranks found', () => {
            const player = { id: 'player3' } as mc.Player;
            getPlayerRanksSpy.mockReturnValue([]);

            const rank = getPlayerRank(player, Config);
            expect(rank).toEqual(mockRanks[1]);
        });

        it('should fallback to minimal safe fallback if default rank is missing', () => {
            const player = { id: 'player4' } as mc.Player;
            getPlayerRanksSpy.mockReturnValue([]);
            getRanksConfigSpy.mockReturnValue({
                rankDefinitions: [mockRanks[0], mockRanks[2]]
            } as any);
            reloadRanks();

            const rank = getPlayerRank(player, Config);
            expect(rank.id).toBe('fallback');
            expect(rank.priority).toBe(1000);

            getRanksConfigSpy.mockReturnValue({
                rankDefinitions: mockRanks
            } as any);
            reloadRanks();
        });
    });

    describe('canTarget', () => {
        beforeEach(() => {
            initializePlayerCache();
            // @ts-expect-error mocking readonly
            mc.system.currentTick = 200;
            getRanksConfigSpy.mockReturnValue({
                rankDefinitions: mockRanks
            } as any);
            reloadRanks();
        });

        it('should allow console to target anyone', () => {
            const executor = {} as any;
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
            getPlayerRanksSpy.mockImplementation((p: any) => {
                if (p.id === 'adminId') {
                    return [mockRanks[0]];
                }
                if (p.id === 'modId') {
                    return [mockRanks[2]];
                }
                return [];
            });

            const targetPlayer = { id: 'modId', name: 'modId', isValid: true } as mc.Player;
            addPlayerToCache(targetPlayer);

            expect(canTarget(executor, 'modId', Config)).toBe(true);
        });

        it('should deny lower priority (higher number) targeting higher priority', () => {
            const executor = { id: 'modId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            getPlayerRanksSpy.mockImplementation((p: any) => {
                if (p.id === 'adminId') {
                    return [mockRanks[0]];
                }
                if (p.id === 'modId') {
                    return [mockRanks[2]];
                }
                return [];
            });

            const targetPlayer = { id: 'adminId', name: 'adminId', isValid: true } as mc.Player;
            addPlayerToCache(targetPlayer);

            expect(canTarget(executor, 'adminId', Config)).toBe(false);
        });

        it('should resolve target rank for offline players via data manager', () => {
            const executor = { id: 'adminId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            getPlayerRanksSpy.mockReturnValue([mockRanks[0]]);

            loadPlayerDataSpy.mockReturnValue({
                ranks: ['mod']
            });

            expect(canTarget(executor, 'offlineModId', Config)).toBe(true);
        });

        it('should fallback for offline players with no data', () => {
            const executor = { id: 'modId' } as mc.Player;
            Object.setPrototypeOf(executor, mc.Player.prototype);
            getPlayerRanksSpy.mockReturnValue([mockRanks[2]]);

            loadPlayerDataSpy.mockReturnValue(undefined);

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
            if (!Config.ranks) {
                (Config as any).ranks = { nameTagStyle: 'above' };
            }
            if (!Config.playerDefaults) {
                (Config as any).playerDefaults = { rankId: 'default' };
            }
            player = { id: 'player1', name: 'PlayerName', nameTag: 'PlayerName' } as mc.Player;
            getPlayerRanksSpy.mockReturnValue([mockRanks[0]]);
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

        it('should default to above if an unknown nametag style is provided', () => {
            // @ts-expect-error mocking wrong enum
            Config.ranks.nameTagStyle = 'unknown_style';
            updatePlayerNameTag(player, Config);
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

            updatePlayerNameTag(player, Config);
            expect(player.nameTag).toBe('§e[§rADMIN§e]§r\nPlayerName');
        });
    });
});
