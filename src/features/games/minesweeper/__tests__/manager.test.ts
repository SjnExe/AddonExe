import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager } from '@core/config/configManager.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import { cleanupPlayerDataManager, getBalance, getOrCreatePlayer, setPlayerBalance } from '@core/data/playerDataManager.js';
import { _clearMatchmakingForTest } from '@features/games/matchmakingManager.js';
import {
    _clearMinesweeperForTest,
    calculateSoloTimeReward,
    getCellVisual,
    getNeighborIndices,
    handleMinesweeperCellTap,
    initializeMinesweeper,
    startMinesweeperGame,
    startMinesweeperRaceMatch,
    toggleMinesweeperFlagMode
} from '@features/games/minesweeper/manager.js';
import * as mc from '@minecraft/server';

const createMockPlayer = (id: string, name: string) =>
    ({
        id,
        name,
        isValid: true,
        sendMessage: mock(),
        playSound: mock()
    }) as unknown as mc.Player;

describe('Minesweeper Manager (Beginner 9x9, Intermediate 12x12, Expert 16x12 & 2P Race)', () => {
    beforeEach(async () => {
        await initializeConfigManager(false);
        clearPlayerCache();
        cleanupPlayerDataManager();
        _clearMatchmakingForTest();
        _clearMinesweeperForTest();
        initializeMinesweeper();
    });

    it('creates Beginner (9x9, 10 mines), Intermediate (12x12, 24 mines), and Expert (16x12, 40 mines) boards accurately', () => {
        const player = createMockPlayer('ms_tester', 'Sweeper');

        const easyGame = startMinesweeperGame(player, 'easy');
        expect(easyGame.cols).toBe(9);
        expect(easyGame.rows).toBe(9);
        expect(easyGame.totalCells).toBe(81);
        expect(easyGame.totalMines).toBe(10);

        const medGame = startMinesweeperGame(player, 'medium');
        expect(medGame.cols).toBe(12);
        expect(medGame.rows).toBe(12);
        expect(medGame.totalCells).toBe(144);
        expect(medGame.totalMines).toBe(24);

        const hardGame = startMinesweeperGame(player, 'hard');
        expect(hardGame.cols).toBe(16);
        expect(hardGame.rows).toBe(12);
        expect(hardGame.totalCells).toBe(192);
        expect(hardGame.totalMines).toBe(40);

        const firstIdx = 40;
        const res = handleMinesweeperCellTap(player, firstIdx);
        expect(res.status).toBe('active');
        expect(hardGame.minesPlaced).toBe(true);
        expect(hardGame.cells[firstIdx]?.hasMine).toBe(false);

        for (const nIdx of getNeighborIndices(firstIdx, hardGame.cols, hardGame.rows)) {
            expect(hardGame.cells[nIdx]?.hasMine).toBe(false);
        }

        const totalMinesPlaced = hardGame.cells.filter((c) => c.hasMine).length;
        expect(totalMinesPlaced).toBe(40);
    });

    it('uses Grass for unmined, Dirt for empty and numbered mined cells, and TNT on Grass for flagged cells', () => {
        const player = createMockPlayer('ms_vis', 'VisualTester');
        const game = startMinesweeperGame(player, 'easy');

        const unminedVis = getCellVisual(game, game.cells[0]!);
        expect(unminedVis.icon).toBe('textures/blocks/grass_side_carried');

        toggleMinesweeperFlagMode(player.id);
        handleMinesweeperCellTap(player, 0);
        const flaggedVis = getCellVisual(game, game.cells[0]!);
        expect(flaggedVis.icon).toBe('textures/blocks/tnt_side');

        toggleMinesweeperFlagMode(player.id);
        handleMinesweeperCellTap(player, 10);
        const minedEmptyVis = getCellVisual(game, game.cells[10]!);
        expect(minedEmptyVis.icon).toBe('textures/blocks/dirt');

        const numberedCell = game.cells.find((c) => c.revealed && c.adjacentMines > 0);
        if (numberedCell) {
            const minedNumberVis = getCellVisual(game, numberedCell);
            expect(minedNumberVis.icon).toBe('textures/blocks/dirt');
            expect(minedNumberVis.label).toContain(String(numberedCell.adjacentMines));
        }
    });

    it('calculates time-based speed bonus rewards and awards 2P Race victory if opponent hits a mine first', () => {
        const p1 = createMockPlayer('race_p1', 'Alice');
        const p2 = createMockPlayer('race_p2', 'Bob');
        addPlayerToCache(p1);
        addPlayerToCache(p2);
        getOrCreatePlayer(p1);
        getOrCreatePlayer(p2);
        setPlayerBalance(p1.id, 100);
        setPlayerBalance(p2.id, 100);

        const soloGame = startMinesweeperGame(p1, 'easy');
        const fastReward = calculateSoloTimeReward(soloGame, 30);
        expect(fastReward.base).toBe(50);
        expect(fastReward.bonus).toBeGreaterThan(0);
        expect(fastReward.total).toBeGreaterThan(50);

        const raceMatch = startMinesweeperRaceMatch(p1, p2, 20, 'easy');
        expect(raceMatch).toBeDefined();
        expect(getBalance(p1.id)).toBe(80);
        expect(getBalance(p2.id)).toBe(80);

        // P1 taps first cell safely, then intentionally taps a mine
        const p1Game = startMinesweeperGame(p1, 'easy', raceMatch!.id);
        handleMinesweeperCellTap(p1, 0);
        const mineCell = p1Game.cells.find((c) => c.hasMine)!;
        const boomRes = handleMinesweeperCellTap(p1, mineCell.index);

        expect(boomRes.status).toBe('lost');
        expect(raceMatch!.status).toBe('forfeit');
        expect(raceMatch!.winnerId).toBe(p2.id);
        expect(getBalance(p2.id)).toBe(120);
    });
});
