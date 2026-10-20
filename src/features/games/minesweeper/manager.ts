import * as mc from '@minecraft/server';
import { uiManager } from '@minecraft/server-ui';

import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { registerActiveMatchSession, registerMultiplayerGame, unregisterActiveMatchSession } from '@features/games/matchmakingManager.js';
import { isDefined } from '@lib/guards.js';

export type MinesweeperDifficulty = 'easy' | 'medium' | 'hard';

export interface MinesweeperDifficultySpec {
    difficulty: MinesweeperDifficulty;
    label: string;
    cols: number;
    rows: number;
    mines: number;
    gridMode: 'ms9' | 'ms12' | 'ms16';
    baseReward: number;
    maxSpeedBonus: number;
    parSeconds: number;
}

export interface MinesweeperCell {
    index: number;
    hasMine: boolean;
    revealed: boolean;
    flagged: boolean;
    adjacentMines: number;
}

export interface MinesweeperGame {
    id: string;
    playerId: string;
    playerName: string;
    cols: number;
    rows: number;
    totalCells: number;
    totalMines: number;
    difficulty: MinesweeperDifficulty;
    gridMode: 'ms9' | 'ms12' | 'ms16';
    baseReward: number;
    maxSpeedBonus: number;
    parSeconds: number;
    cells: MinesweeperCell[];
    minesPlaced: boolean;
    flagMode: boolean;
    status: 'active' | 'won' | 'lost';
    startTime: number;
    actionCount: number;
    netElapsedSeconds?: number;
    earnedReward?: number;
    explodedIndex?: number;
    multiplayerMatchId?: string;
}

export interface MinesweeperRaceMatch {
    id: string;
    player1Id: string;
    player1Name: string;
    player2Id: string;
    player2Name: string;
    difficulty: MinesweeperDifficulty;
    wager: number;
    status: 'active' | 'won' | 'forfeit';
    winnerId?: string;
    endReason?: string;
    p1TimeSeconds?: number;
    p2TimeSeconds?: number;
    refreshingPlayers: Set<string>;
}

export const minesweeperCols = 12;
export const minesweeperRows = 12;
export const minesweeperTotalCells = 144;

const uiLatencyCompensationMsPerTap = 250;

const unminedGrassTexture = 'textures/blocks/grass_carried';
const minedDirtTexture = 'textures/blocks/dirt';
const flaggedTntTexture = 'textures/blocks/tnt_side';
const explodedMineTexture = 'textures/ui/WarningGlyph';

const numberColors: Record<number, string> = {
    1: '§l§b1',
    2: '§l§a2',
    3: '§l§e3',
    4: '§l§d4',
    5: '§l§c5',
    6: '§l§36',
    7: '§l§57',
    8: '§l§f8'
};

const activeGames = new Map<string, MinesweeperGame>();
const activeRaceMatches = new Map<string, MinesweeperRaceMatch>();
const playerRaceMap = new Map<string, string>();
let minesweeperInitialized = false;

export function initializeMinesweeper(): void {
    registerMultiplayerGame({
        id: 'minesweeper',
        name: 'Minesweeper Race',
        icon: 'textures/items/iron_pickaxe',
        isEnabled: () => {
            const cfg = getGamesConfig();
            return cfg.enabled === true && cfg.minesweeper?.enabled !== false;
        },
        onStartMatch: async (host, guest, wager) => {
            const match = startMinesweeperRaceMatch(host, guest, wager, 'easy');
            if (isDefined(match)) {
                const { showMinesweeperBoard } = await import('@features/games/minesweeper/ui/panel.js');
                void showMinesweeperBoard(host);
                void showMinesweeperBoard(guest);
            }
        }
    });

    if (!minesweeperInitialized) {
        minesweeperInitialized = true;
        mc.world.afterEvents.playerLeave.subscribe((ev) => {
            activeGames.delete(ev.playerId);
        });
    }
}

export function getDifficultySettings(difficulty: MinesweeperDifficulty): MinesweeperDifficultySpec {
    const cfg = getGamesConfig().minesweeper;
    if (difficulty === 'easy') {
        return {
            difficulty: 'easy',
            label: 'Beginner (9x9 • 10 Mines)',
            cols: 9,
            rows: 9,
            mines: 10,
            gridMode: 'ms9',
            baseReward: Math.max(0, Number(cfg?.easyReward ?? 5)),
            maxSpeedBonus: Math.max(0, Number(cfg?.easySpeedBonusMax ?? 5)),
            parSeconds: Math.max(10, Number(cfg?.easyParSeconds ?? 180))
        };
    }
    if (difficulty === 'hard') {
        return {
            difficulty: 'hard',
            label: 'Expert (16x12 • 40 Mines)',
            cols: 16,
            rows: 12,
            mines: 40,
            gridMode: 'ms16',
            baseReward: Math.max(0, Number(cfg?.hardReward ?? 30)),
            maxSpeedBonus: Math.max(0, Number(cfg?.hardSpeedBonusMax ?? 20)),
            parSeconds: Math.max(30, Number(cfg?.hardParSeconds ?? 480))
        };
    }
    return {
        difficulty: 'medium',
        label: 'Intermediate (12x12 • 24 Mines)',
        cols: 12,
        rows: 12,
        mines: 24,
        gridMode: 'ms12',
        baseReward: Math.max(0, Number(cfg?.mediumReward ?? 15)),
        maxSpeedBonus: Math.max(0, Number(cfg?.mediumSpeedBonusMax ?? 10)),
        parSeconds: Math.max(20, Number(cfg?.mediumParSeconds ?? 300))
    };
}

export function getNeighborIndices(index: number, cols = 9, rows = 9): number[] {
    const r = Math.floor(index / cols);
    const c = index % cols;
    const neighbors: number[] = [];

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) {
                continue;
            }
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                neighbors.push(nr * cols + nc);
            }
        }
    }
    return neighbors;
}

export function calculateNetElapsedSeconds(game: MinesweeperGame, nowMs = Date.now()): number {
    const rawMs = Math.max(0, nowMs - game.startTime);
    const latencyDiscountMs = game.actionCount * uiLatencyCompensationMsPerTap;
    const netMs = Math.max(1000, rawMs - latencyDiscountMs);
    return Math.round((netMs / 1000) * 10) / 10;
}

export function calculateSoloTimeReward(game: MinesweeperGame, netSeconds: number): { base: number; bonus: number; total: number } {
    const base = game.baseReward;
    if (game.maxSpeedBonus <= 0 || netSeconds >= game.parSeconds) {
        return { base, bonus: 0, total: base };
    }
    const ratio = Math.max(0, Math.min(1, (game.parSeconds - netSeconds) / game.parSeconds));
    const bonus = Math.round(game.maxSpeedBonus * ratio * 100) / 100;
    return { base, bonus, total: Math.round((base + bonus) * 100) / 100 };
}

export function startMinesweeperGame(player: mc.Player, difficulty: MinesweeperDifficulty = 'easy', multiplayerMatchId?: string): MinesweeperGame {
    const spec = getDifficultySettings(difficulty);
    const totalCells = spec.cols * spec.rows;
    const cells: MinesweeperCell[] = Array.from({ length: totalCells }, (_, idx) => ({
        index: idx,
        hasMine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0
    }));

    const game: MinesweeperGame = {
        id: `ms_${Date.now()}_${player.id}`,
        playerId: player.id,
        playerName: player.name,
        cols: spec.cols,
        rows: spec.rows,
        totalCells,
        totalMines: spec.mines,
        difficulty: spec.difficulty,
        gridMode: spec.gridMode,
        baseReward: spec.baseReward,
        maxSpeedBonus: spec.maxSpeedBonus,
        parSeconds: spec.parSeconds,
        cells,
        minesPlaced: false,
        flagMode: false,
        status: 'active',
        startTime: Date.now(),
        actionCount: 0,
        ...(isDefined(multiplayerMatchId) ? { multiplayerMatchId } : {})
    };

    activeGames.set(player.id, game);
    return game;
}

export function startMinesweeperRaceMatch(player1: mc.Player, player2: mc.Player, wager: number = 0, difficulty: MinesweeperDifficulty = 'easy'): MinesweeperRaceMatch | undefined {
    if (wager > 0) {
        incrementPlayerBalance(player1.id, -wager);
        incrementPlayerBalance(player2.id, -wager);
    }

    const matchId = `ms_race_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const match: MinesweeperRaceMatch = {
        id: matchId,
        player1Id: player1.id,
        player1Name: player1.name,
        player2Id: player2.id,
        player2Name: player2.name,
        difficulty,
        wager,
        status: 'active',
        refreshingPlayers: new Set()
    };

    activeRaceMatches.set(matchId, match);
    playerRaceMap.set(player1.id, matchId);
    playerRaceMap.set(player2.id, matchId);

    startMinesweeperGame(player1, difficulty, matchId);
    startMinesweeperGame(player2, difficulty, matchId);

    registerActiveMatchSession({
        matchId,
        gameId: 'minesweeper',
        playerIds: [player1.id, player2.id],
        onPlayerDisconnect: (disconnectedPlayerId) => {
            forfeitMinesweeperRace(matchId, disconnectedPlayerId, 'disconnected');
        }
    });

    return match;
}

export function getPlayerMinesweeperGame(playerId: string): MinesweeperGame | undefined {
    return activeGames.get(playerId);
}

export function getMinesweeperRaceMatch(matchId: string): MinesweeperRaceMatch | undefined {
    return activeRaceMatches.get(matchId);
}

export function clearPlayerMinesweeperGame(playerId: string): void {
    activeGames.delete(playerId);
}

function triggerRaceOpponentRefresh(match: MinesweeperRaceMatch, targetPlayerId: string): void {
    const target = getPlayerFromCache(targetPlayerId);
    if (!isDefined(target) || !target.isValid) {
        return;
    }
    match.refreshingPlayers.add(targetPlayerId);
    try {
        if (isDefined(uiManager) && typeof uiManager.closeAllForms === 'function') {
            uiManager.closeAllForms(target);
        }
    } catch {
        // Ignore if closeAllForms fails
    }
}

function finalizeRaceCleanup(match: MinesweeperRaceMatch): void {
    unregisterActiveMatchSession(match.id);
    playerRaceMap.delete(match.player1Id);
    playerRaceMap.delete(match.player2Id);
    mc.system.runTimeout(() => {
        activeRaceMatches.delete(match.id);
    }, 600);
}

export function forfeitMinesweeperRace(matchId: string, losingPlayerId: string, reason: string): void {
    const match = activeRaceMatches.get(matchId);
    if (!isDefined(match) || match.status !== 'active') {
        return;
    }

    const winnerId = losingPlayerId === match.player1Id ? match.player2Id : match.player1Id;
    const winnerName = losingPlayerId === match.player1Id ? match.player2Name : match.player1Name;
    const loserName = losingPlayerId === match.player1Id ? match.player1Name : match.player2Name;

    match.status = 'forfeit';
    match.winnerId = winnerId;
    match.endReason = `§c${loserName} §7${reason}! §a${winnerName} §7wins the Minesweeper Race!`;

    const winnerGame = activeGames.get(winnerId);
    if (isDefined(winnerGame) && winnerGame.status === 'active') {
        winnerGame.status = 'won';
    }

    if (match.wager > 0) {
        incrementPlayerBalance(winnerId, match.wager * 2);
    }

    const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(match.wager * 2)})§r` : '';
    const winnerPlayer = getPlayerFromCache(winnerId);
    const loserPlayer = getPlayerFromCache(losingPlayerId);

    if (isDefined(winnerPlayer)) {
        winnerPlayer.sendMessage(`§e[Minesweeper Race] §c${loserName} §7${reason}! §aYou win!${prizeText}`);
        playSound(winnerPlayer, 'random.levelup');
    }
    if (isDefined(loserPlayer)) {
        loserPlayer.sendMessage(`§e[Minesweeper Race] §cYou lost (${reason}). §e${winnerName} §cwins the match!`);
        playSound(loserPlayer, 'note.bass');
    }

    finalizeRaceCleanup(match);
    triggerRaceOpponentRefresh(match, winnerId);
}

function handleRaceBoardCleared(matchId: string, finisherId: string, netSeconds: number): string {
    const match = activeRaceMatches.get(matchId);
    if (!isDefined(match) || match.status !== 'active') {
        return '';
    }

    const isP1 = finisherId === match.player1Id;
    if (isP1) {
        match.p1TimeSeconds = netSeconds;
    } else {
        match.p2TimeSeconds = netSeconds;
    }

    const opponentId = isP1 ? match.player2Id : match.player1Id;
    const winnerName = isP1 ? match.player1Name : match.player2Name;
    const loserName = isP1 ? match.player2Name : match.player1Name;

    match.status = 'won';
    match.winnerId = finisherId;
    match.endReason = `§a${winnerName} §7cleared the minefield first in §b${netSeconds.toFixed(1)}s §7against §c${loserName}§7!`;

    const oppGame = activeGames.get(opponentId);
    if (isDefined(oppGame) && oppGame.status === 'active') {
        oppGame.status = 'lost';
    }

    if (match.wager > 0) {
        incrementPlayerBalance(finisherId, match.wager * 2);
    }

    const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(match.wager * 2)})§r` : '';
    const p1 = getPlayerFromCache(match.player1Id);
    const p2 = getPlayerFromCache(match.player2Id);

    if (isDefined(p1)) {
        p1.sendMessage(`§e[Minesweeper Race] ${match.endReason}${prizeText}`);
        playSound(p1, isP1 ? 'random.levelup' : 'note.bass');
    }
    if (isDefined(p2)) {
        p2.sendMessage(`§e[Minesweeper Race] ${match.endReason}${prizeText}`);
        playSound(p2, !isP1 ? 'random.levelup' : 'note.bass');
    }

    finalizeRaceCleanup(match);
    triggerRaceOpponentRefresh(match, opponentId);
    return `§aWon 2P Race in §b${netSeconds.toFixed(1)}s§a!${prizeText}`;
}

export function placeMinesSafely(game: MinesweeperGame, safeIndex: number): void {
    const safeZone = new Set<number>([safeIndex, ...getNeighborIndices(safeIndex, game.cols, game.rows)]);
    const candidates: number[] = [];

    for (let i = 0; i < game.cells.length; i++) {
        if (!safeZone.has(i)) {
            candidates.push(i);
        }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = candidates[i]!;
        candidates[i] = candidates[j]!;
        candidates[j] = temp;
    }

    const mineCount = Math.min(game.totalMines, candidates.length);
    for (let i = 0; i < mineCount; i++) {
        const idx = candidates[i]!;
        const cell = game.cells[idx];
        if (isDefined(cell)) {
            cell.hasMine = true;
        }
    }

    for (const cell of game.cells) {
        if (cell.hasMine) {
            continue;
        }
        const neighbors = getNeighborIndices(cell.index, game.cols, game.rows);
        cell.adjacentMines = neighbors.reduce((count, nIdx) => count + (game.cells[nIdx]?.hasMine ? 1 : 0), 0);
    }

    game.minesPlaced = true;
}

function floodReveal(game: MinesweeperGame, startIndex: number): void {
    const queue: number[] = [startIndex];
    const visited = new Set<number>([startIndex]);

    while (queue.length > 0) {
        const currentIdx = queue.shift()!;
        const cell = game.cells[currentIdx];
        if (!isDefined(cell) || cell.hasMine) {
            continue;
        }

        cell.revealed = true;
        cell.flagged = false;

        if (cell.adjacentMines === 0) {
            for (const nIdx of getNeighborIndices(currentIdx, game.cols, game.rows)) {
                const neighbor = game.cells[nIdx];
                if (isDefined(neighbor) && !neighbor.revealed && !neighbor.flagged && !neighbor.hasMine && !visited.has(nIdx)) {
                    visited.add(nIdx);
                    queue.push(nIdx);
                }
            }
        }
    }
}

function checkWinCondition(game: MinesweeperGame): boolean {
    for (const cell of game.cells) {
        if (!cell.hasMine && !cell.revealed) {
            return false;
        }
    }
    return true;
}

function revealAllMines(game: MinesweeperGame): void {
    for (const cell of game.cells) {
        if (cell.hasMine) {
            cell.revealed = true;
        }
    }
}

export function toggleMinesweeperFlagMode(playerId: string): boolean {
    const game = activeGames.get(playerId);
    if (!isDefined(game)) {
        return false;
    }
    game.actionCount++;
    game.flagMode = !game.flagMode;
    return game.flagMode;
}

function handleMineDetonation(player: mc.Player, game: MinesweeperGame, mineIndex: number, reasonMsg: string): { status: 'lost'; message: string } {
    game.status = 'lost';
    game.explodedIndex = mineIndex;
    game.netElapsedSeconds = calculateNetElapsedSeconds(game);
    revealAllMines(game);
    playSound(player, 'random.explode');

    if (isDefined(game.multiplayerMatchId)) {
        forfeitMinesweeperRace(game.multiplayerMatchId, player.id, 'detonated a mine');
    }

    return { status: 'lost', message: reasonMsg };
}

export function handleMinesweeperCellTap(player: mc.Player, cellIndex: number): { status: 'active' | 'won' | 'lost'; message?: string } {
    const game = activeGames.get(player.id);
    if (!isDefined(game) || game.status !== 'active') {
        return { status: 'lost', message: '§cNo active Minesweeper game.' };
    }

    const cell = game.cells[cellIndex];
    if (!isDefined(cell)) {
        return { status: game.status };
    }

    game.actionCount++;

    if (cell.revealed) {
        if (cell.adjacentMines > 0) {
            const neighbors = getNeighborIndices(cellIndex, game.cols, game.rows);
            const flaggedCount = neighbors.reduce((acc, idx) => acc + (game.cells[idx]?.flagged ? 1 : 0), 0);
            if (flaggedCount === cell.adjacentMines) {
                for (const nIdx of neighbors) {
                    const nCell = game.cells[nIdx];
                    if (isDefined(nCell) && !nCell.revealed && !nCell.flagged) {
                        if (nCell.hasMine) {
                            return handleMineDetonation(player, game, nIdx, '§cBOOM! A misplaced flag triggered a mine!');
                        }
                        floodReveal(game, nIdx);
                    }
                }
                if (checkWinCondition(game)) {
                    return completeWin(player, game);
                }
                playSound(player, 'random.click');
                return { status: 'active', message: '§aChord revealed adjacent tiles!' };
            }
        }
        return { status: 'active' };
    }

    if (game.flagMode) {
        cell.flagged = !cell.flagged;
        playSound(player, 'random.click');
        return {
            status: 'active',
            message: cell.flagged ? '§e⚑ Flag placed.' : '§7Flag removed.'
        };
    }

    if (cell.flagged) {
        return { status: 'active', message: '§eTile is flagged! Switch to Flag Mode to unflag it.' };
    }

    if (!game.minesPlaced) {
        placeMinesSafely(game, cellIndex);
    }

    if (cell.hasMine) {
        return handleMineDetonation(player, game, cellIndex, '§cBOOM! You hit a mine!');
    }

    floodReveal(game, cellIndex);
    playSound(player, 'random.click');

    if (checkWinCondition(game)) {
        return completeWin(player, game);
    }

    return { status: 'active' };
}

function completeWin(player: mc.Player, game: MinesweeperGame): { status: 'won'; message: string } {
    game.status = 'won';
    const netSeconds = calculateNetElapsedSeconds(game);
    game.netElapsedSeconds = netSeconds;

    for (const cell of game.cells) {
        if (cell.hasMine) {
            cell.flagged = true;
        }
    }

    if (isDefined(game.multiplayerMatchId)) {
        const raceMsg = handleRaceBoardCleared(game.multiplayerMatchId, player.id, netSeconds);
        return { status: 'won', message: raceMsg };
    }

    playSound(player, 'random.levelup');
    const rewardInfo = calculateSoloTimeReward(game, netSeconds);
    game.earnedReward = rewardInfo.total;

    let rewardText = '';
    if (rewardInfo.total > 0 && isFeatureActive('eco')) {
        incrementPlayerBalance(player.id, rewardInfo.total);
        const bonusNote = rewardInfo.bonus > 0 ? ` (Base ${formatCurrency(rewardInfo.base)} + Speed Bonus ${formatCurrency(rewardInfo.bonus)})` : '';
        rewardText = ` §6+${formatCurrency(rewardInfo.total)}§7${bonusNote}`;
        player.sendMessage(`§e[Minesweeper] §aCleared ${game.cols}x${game.rows} (${game.difficulty.toUpperCase()}) in §b${netSeconds.toFixed(1)}s§a!${rewardText}`);
    }

    return {
        status: 'won',
        message: `§aCleared in §b${netSeconds.toFixed(1)}s§a!${rewardText}`
    };
}

export function getCellVisual(game: MinesweeperGame, cell: MinesweeperCell): { label: string; icon?: string } {
    if (!cell.revealed) {
        if (cell.flagged) {
            return { label: '§l§e⚑', icon: flaggedTntTexture };
        }
        return { label: ' ', icon: unminedGrassTexture };
    }
    if (cell.hasMine) {
        const isExploded = game.explodedIndex === cell.index;
        return { label: isExploded ? '§l§4✸' : '§l§c✸', icon: explodedMineTexture };
    }
    if (cell.adjacentMines === 0) {
        return { label: ' ', icon: minedDirtTexture };
    }
    return {
        label: numberColors[cell.adjacentMines] ?? String(cell.adjacentMines),
        icon: minedDirtTexture
    };
}

export function _clearMinesweeperForTest(): void {
    activeGames.clear();
    activeRaceMatches.clear();
    playerRaceMap.clear();
}
