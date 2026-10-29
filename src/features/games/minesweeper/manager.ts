import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { getPlayer, incrementPlayerBalance, updatePlayerData } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { setTrackedTimeout } from '@core/utils/timerManager.js';
import {
  payoutWagerPot,
  registerActiveMatchSession,
  registerMultiplayerGame,
  unregisterActiveMatchSession,
} from '@features/games/matchmakingManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { uiManager } from '@minecraft/server-ui';

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
  safeCleared: number;
  flaggedCount: number;
  minesPlaced: boolean;
  flagMode: boolean;
  status: 'active' | 'won' | 'lost';
  startTime: number;
  activeThinkMs: number;
  turnShownAt?: number;
  effectiveMoves: number;
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

export interface MinesweeperPlayerStats {
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  bestTimes: Partial<Record<MinesweeperDifficulty, number>>;
}

export interface MinesweeperBoardProgress {
  safeCleared: number;
  totalSafe: number;
  percent: number;
  flaggedCount: number;
  remainingMines: number;
}

export const minesweeperCols = 12;
export const minesweeperRows = 12;
export const minesweeperTotalCells = 144;

const unminedGrassTexture = 'textures/blocks/grass_carried';
const minedDirtTexture = 'textures/blocks/dirt';
const flaggedTntTexture = 'textures/blocks/tnt_side';
const explodedMineTexture = 'textures/ui/WarningGlyph';

const unminedCellVisual = { label: '§a§r ', icon: unminedGrassTexture };
const minedEmptyCellVisual = { label: '§8§r ', icon: minedDirtTexture };
const flaggedActiveCellVisual = { label: '§6§r§l§e⚑', icon: flaggedTntTexture };
const flaggedWonCellVisual = { label: '§6§r§l§a⚑', icon: flaggedTntTexture };
const wrongFlagCellVisual = { label: '§4§r§l§c*', icon: flaggedTntTexture };
const explodedMineCellVisual = { label: '§4§r§l§4*', icon: explodedMineTexture };
const revealedMineCellVisual = { label: '§4§r§l§c*', icon: explodedMineTexture };

const numberCellVisuals: Record<number, { label: string; icon: string }> = {
  1: { label: '§8§r§l§b1', icon: minedDirtTexture },
  2: { label: '§8§r§l§a2', icon: minedDirtTexture },
  3: { label: '§8§r§l§e3', icon: minedDirtTexture },
  4: { label: '§8§r§l§d4', icon: minedDirtTexture },
  5: { label: '§8§r§l§c5', icon: minedDirtTexture },
  6: { label: '§8§r§l§36', icon: minedDirtTexture },
  7: { label: '§8§r§l§57', icon: minedDirtTexture },
  8: { label: '§8§r§l§f8', icon: minedDirtTexture },
};

const neighborCache = new Map<string, number[][]>();

function computeNeighborTable(cols: number, rows: number): number[][] {
  const key = `${cols}x${rows}`;
  const existing = neighborCache.get(key);
  if (isDefined(existing)) {
    return existing;
  }
  const total = cols * rows;
  const table: number[][] = Array.from({ length: total }, () => []);
  for (let idx = 0; idx < total; idx++) {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const list = table[idx]!;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) {
          continue;
        }
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          list.push(nr * cols + nc);
        }
      }
    }
  }
  neighborCache.set(key, table);
  return table;
}

computeNeighborTable(9, 9);
computeNeighborTable(12, 12);
computeNeighborTable(16, 12);

const activeGames = new Map<string, MinesweeperGame>();
const activeRaceMatches = new Map<string, MinesweeperRaceMatch>();
const playerRaceMap = new Map<string, string>();
const playerSessionStats = new Map<string, MinesweeperPlayerStats>();
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
    },
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
      baseReward: Math.max(0, Number(cfg?.easyReward ?? 50)),
      maxSpeedBonus: Math.max(0, Number(cfg?.easySpeedBonusMax ?? 50)),
      parSeconds: Math.max(10, Number(cfg?.easyParSeconds ?? 180)),
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
      baseReward: Math.max(0, Number(cfg?.hardReward ?? 400)),
      maxSpeedBonus: Math.max(0, Number(cfg?.hardSpeedBonusMax ?? 250)),
      parSeconds: Math.max(30, Number(cfg?.hardParSeconds ?? 480)),
    };
  }
  return {
    difficulty: 'medium',
    label: 'Intermediate (12x12 • 24 Mines)',
    cols: 12,
    rows: 12,
    mines: 24,
    gridMode: 'ms12',
    baseReward: Math.max(0, Number(cfg?.mediumReward ?? 150)),
    maxSpeedBonus: Math.max(0, Number(cfg?.mediumSpeedBonusMax ?? 100)),
    parSeconds: Math.max(20, Number(cfg?.mediumParSeconds ?? 300)),
  };
}

export function getNeighborIndices(index: number, cols = 9, rows = 9): number[] {
  return computeNeighborTable(cols, rows)[index] ?? [];
}

export function recordMinesweeperTurnShown(playerId: string): void {
  const game = activeGames.get(playerId);
  if (isDefined(game) && game.status === 'active') {
    // Only start the turn clock if it isn't already running so non-move actions cannot reset think time
    game.turnShownAt ??= Date.now();
  }
}

export function calculateNetElapsedSeconds(game: MinesweeperGame, nowMs = Date.now()): number {
  if (game.activeThinkMs > 0) {
    return Math.max(0.5, Math.round((game.activeThinkMs / 1000) * 10) / 10);
  }
  if (!game.minesPlaced) {
    return 0;
  }
  const rawMs = Math.max(500, nowMs - game.startTime);
  return Math.round((rawMs / 1000) * 10) / 10;
}

export function calculateSoloTimeReward(
  game: MinesweeperGame,
  netSeconds: number,
): { base: number; bonus: number; total: number } {
  const base = game.baseReward;
  if (game.maxSpeedBonus <= 0) {
    return { base, bonus: 0, total: base };
  }

  let ratio = 0;
  if (game.effectiveMoves > 0 && game.activeThinkMs > 0) {
    const avgSecPerMove = netSeconds / Math.max(1, game.effectiveMoves);
    const fastTargetSec = 1.5;
    const slowLimitSec = 6.5;
    if (avgSecPerMove <= fastTargetSec) {
      ratio = 1;
    } else if (avgSecPerMove < slowLimitSec) {
      ratio = (slowLimitSec - avgSecPerMove) / (slowLimitSec - fastTargetSec);
    }
  } else if (netSeconds < game.parSeconds) {
    ratio = Math.max(0, Math.min(1, (game.parSeconds - netSeconds) / game.parSeconds));
  }

  const bonus = Math.round(game.maxSpeedBonus * Math.max(0, Math.min(1, ratio)) * 100) / 100;
  return { base, bonus, total: Math.round((base + bonus) * 100) / 100 };
}

export function startMinesweeperGame(
  player: mc.Player,
  difficulty: MinesweeperDifficulty = 'easy',
  multiplayerMatchId?: string,
): MinesweeperGame {
  const spec = getDifficultySettings(difficulty);
  const totalCells = spec.cols * spec.rows;
  const cells: MinesweeperCell[] = Array.from({ length: totalCells }, (_, idx) => ({
    index: idx,
    hasMine: false,
    revealed: false,
    flagged: false,
    adjacentMines: 0,
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
    safeCleared: 0,
    flaggedCount: 0,
    minesPlaced: false,
    flagMode: false,
    status: 'active',
    startTime: Date.now(),
    activeThinkMs: 0,
    effectiveMoves: 0,
    actionCount: 0,
    ...(isDefined(multiplayerMatchId) ? { multiplayerMatchId } : {}),
  };

  activeGames.set(player.id, game);
  return game;
}

export function startMinesweeperRaceMatch(
  player1: mc.Player,
  player2: mc.Player,
  wager: number = 0,
  difficulty: MinesweeperDifficulty = 'easy',
): MinesweeperRaceMatch | undefined {
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
    refreshingPlayers: new Set(),
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
    },
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

export function getPlayerMinesweeperStats(playerId: string): MinesweeperPlayerStats {
  let stats = playerSessionStats.get(playerId);
  if (!isDefined(stats)) {
    const pData = getPlayer(playerId);
    const saved = pData?.gameStats?.minesweeper;
    stats = saved
      ? {
          wins: saved.wins ?? 0,
          losses: saved.losses ?? 0,
          currentStreak: saved.currentStreak ?? 0,
          bestStreak: saved.bestStreak ?? 0,
          bestTimes: { ...(saved.bestTimes ?? {}) },
        }
      : {
          wins: 0,
          losses: 0,
          currentStreak: 0,
          bestStreak: 0,
          bestTimes: {},
        };
    playerSessionStats.set(playerId, stats);
  }
  return stats;
}

function persistMinesweeperStats(playerId: string, stats: MinesweeperPlayerStats): void {
  if (!isDefined(getPlayer(playerId))) {
    return;
  }
  updatePlayerData(playerId, (d) => {
    d.gameStats ??= {};
    d.gameStats.minesweeper = {
      wins: stats.wins,
      losses: stats.losses,
      currentStreak: stats.currentStreak,
      bestStreak: stats.bestStreak,
      bestTimes: { ...stats.bestTimes },
    };
  });
}

function syncBoardCounts(game: MinesweeperGame): void {
  let safeCleared = 0;
  let flaggedCount = 0;
  for (let i = 0; i < game.cells.length; i++) {
    const cell = game.cells[i]!;
    if (cell.flagged) {
      flaggedCount++;
    }
    if (!cell.hasMine && cell.revealed) {
      safeCleared++;
    }
  }
  game.safeCleared = safeCleared;
  game.flaggedCount = flaggedCount;
}

export function getMinesweeperBoardProgress(game: MinesweeperGame): MinesweeperBoardProgress {
  const totalSafe = Math.max(1, game.totalCells - game.totalMines);
  const percent = Math.min(100, Math.floor((game.safeCleared / totalSafe) * 100));
  const remainingMines = Math.max(0, game.totalMines - game.flaggedCount);
  return {
    safeCleared: game.safeCleared,
    totalSafe,
    percent,
    flaggedCount: game.flaggedCount,
    remainingMines,
  };
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
  setTrackedTimeout(() => {
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

  const payout = match.wager > 0 ? payoutWagerPot(winnerId, match.wager) : { netPrize: 0, taxRate: 0 };

  const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(payout.netPrize)})§r` : '';
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

  const payout = match.wager > 0 ? payoutWagerPot(finisherId, match.wager) : { netPrize: 0, taxRate: 0 };

  const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(payout.netPrize)})§r` : '';
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

  const neighborTable = computeNeighborTable(game.cols, game.rows);
  for (let i = 0; i < game.cells.length; i++) {
    const cell = game.cells[i]!;
    if (cell.hasMine) {
      continue;
    }
    const neighbors = neighborTable[i] ?? [];
    let count = 0;
    for (let j = 0; j < neighbors.length; j++) {
      if (game.cells[neighbors[j]!]?.hasMine) {
        count++;
      }
    }
    cell.adjacentMines = count;
  }

  game.startTime = Date.now();
  game.minesPlaced = true;
}

function floodReveal(game: MinesweeperGame, startIndex: number): void {
  const neighborTable = computeNeighborTable(game.cols, game.rows);
  const queue: number[] = [startIndex];
  let head = 0;

  while (head < queue.length) {
    const currentIdx = queue[head++]!;
    const cell = game.cells[currentIdx];
    if (!isDefined(cell) || cell.hasMine || cell.revealed) {
      continue;
    }

    cell.revealed = true;
    if (cell.flagged) {
      cell.flagged = false;
      game.flaggedCount = Math.max(0, game.flaggedCount - 1);
    }
    game.safeCleared++;

    if (cell.adjacentMines === 0) {
      const neighbors = neighborTable[currentIdx] ?? [];
      for (let i = 0; i < neighbors.length; i++) {
        const nIdx = neighbors[i]!;
        const neighbor = game.cells[nIdx];
        if (isDefined(neighbor) && !neighbor.revealed && !neighbor.flagged && !neighbor.hasMine) {
          queue.push(nIdx);
        }
      }
    }
  }
}

function checkWinCondition(game: MinesweeperGame): boolean {
  if (game.safeCleared >= game.totalCells - game.totalMines) {
    syncBoardCounts(game);
    return game.safeCleared >= game.totalCells - game.totalMines;
  }
  return false;
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
  // Bank any think time spent before toggling mode so players cannot reset the timer by toggling Dig/Flag
  if (game.minesPlaced && isDefined(game.turnShownAt)) {
    const deltaMs = Math.max(50, Math.min(15_000, Date.now() - game.turnShownAt));
    game.activeThinkMs += deltaMs;
  }
  game.turnShownAt = undefined;
  game.actionCount++;
  game.flagMode = !game.flagMode;
  return game.flagMode;
}

function handleMineDetonation(
  player: mc.Player,
  game: MinesweeperGame,
  mineIndex: number,
  reasonMsg: string,
): { status: 'lost'; message: string } {
  game.status = 'lost';
  game.explodedIndex = mineIndex;
  game.netElapsedSeconds = calculateNetElapsedSeconds(game);
  revealAllMines(game);
  playSound(player, 'random.explode');

  const stats = getPlayerMinesweeperStats(player.id);
  stats.losses++;
  stats.currentStreak = 0;
  persistMinesweeperStats(player.id, stats);

  if (isDefined(game.multiplayerMatchId)) {
    forfeitMinesweeperRace(game.multiplayerMatchId, player.id, 'detonated a mine');
  }

  return { status: 'lost', message: reasonMsg };
}

export function handleMinesweeperCellTap(
  player: mc.Player,
  cellIndex: number,
): { status: 'active' | 'won' | 'lost'; message?: string } {
  const game = activeGames.get(player.id);
  if (!isDefined(game) || game.status !== 'active') {
    return { status: 'lost', message: '§cNo active Minesweeper game.' };
  }

  const cell = game.cells[cellIndex];
  if (!isDefined(cell)) {
    return { status: game.status };
  }

  const now = Date.now();
  const turnDeltaMs = isDefined(game.turnShownAt) ? Math.max(50, Math.min(15_000, now - game.turnShownAt)) : 0;
  game.turnShownAt = undefined;
  game.actionCount++;

  if (cell.revealed) {
    if (cell.adjacentMines > 0) {
      const neighbors = getNeighborIndices(cellIndex, game.cols, game.rows);
      let flaggedCount = 0;
      let unflaggedHiddenCount = 0;
      for (let i = 0; i < neighbors.length; i++) {
        const nCell = game.cells[neighbors[i]!];
        if (!isDefined(nCell) || nCell.revealed) {
          continue;
        }
        if (nCell.flagged) {
          flaggedCount++;
        } else {
          unflaggedHiddenCount++;
        }
      }

      if (flaggedCount === cell.adjacentMines && unflaggedHiddenCount > 0) {
        game.effectiveMoves++;
        game.activeThinkMs += turnDeltaMs;
        for (let i = 0; i < neighbors.length; i++) {
          const nIdx = neighbors[i]!;
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
    game.activeThinkMs += turnDeltaMs;
    cell.flagged = !cell.flagged;
    game.flaggedCount = Math.max(0, game.flaggedCount + (cell.flagged ? 1 : -1));
    playSound(player, 'random.click');
    return {
      status: 'active',
      message: cell.flagged ? '§e⚑ Flag placed.' : '§7Flag removed.',
    };
  }

  if (cell.flagged) {
    return { status: 'active', message: '§eTile is flagged! Switch to Flag Mode to unflag it.' };
  }

  if (!game.minesPlaced) {
    placeMinesSafely(game, cellIndex);
  } else {
    game.activeThinkMs += turnDeltaMs;
  }
  game.effectiveMoves++;

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

  const stats = getPlayerMinesweeperStats(player.id);
  stats.wins++;
  stats.currentStreak++;
  if (stats.currentStreak > stats.bestStreak) {
    stats.bestStreak = stats.currentStreak;
  }
  const prevBest = stats.bestTimes[game.difficulty];
  if (!isDefined(prevBest) || netSeconds < prevBest) {
    stats.bestTimes[game.difficulty] = netSeconds;
  }
  persistMinesweeperStats(player.id, stats);

  for (const cell of game.cells) {
    if (cell.hasMine && !cell.flagged) {
      cell.flagged = true;
      game.flaggedCount++;
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
    const bonusNote =
      rewardInfo.bonus > 0
        ? ` (Base ${formatCurrency(rewardInfo.base)} + Speed Bonus ${formatCurrency(rewardInfo.bonus)})`
        : '';
    rewardText = ` §6+${formatCurrency(rewardInfo.total)}§7${bonusNote}`;
    player.sendMessage(
      `§e[Minesweeper] §aCleared ${game.cols}x${game.rows} (${game.difficulty.toUpperCase()}) in §b${netSeconds.toFixed(1)}s§a!${rewardText}`,
    );
  }

  return {
    status: 'won',
    message: `§aCleared in §b${netSeconds.toFixed(1)}s§a!${rewardText}`,
  };
}

export function getCellVisual(game: MinesweeperGame, cell: MinesweeperCell): { label: string; icon?: string } {
  if (!cell.revealed) {
    if (cell.flagged) {
      if (game.status === 'lost' && !cell.hasMine) {
        return wrongFlagCellVisual;
      }
      return game.status === 'won' ? flaggedWonCellVisual : flaggedActiveCellVisual;
    }
    return unminedCellVisual;
  }
  if (cell.hasMine) {
    return game.explodedIndex === cell.index ? explodedMineCellVisual : revealedMineCellVisual;
  }
  if (cell.adjacentMines === 0) {
    return minedEmptyCellVisual;
  }
  return numberCellVisuals[cell.adjacentMines] ?? minedEmptyCellVisual;
}

export function _clearMinesweeperForTest(): void {
  activeGames.clear();
  activeRaceMatches.clear();
  playerRaceMap.clear();
  playerSessionStats.clear();
}
