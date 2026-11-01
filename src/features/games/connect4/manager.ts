import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { setTrackedInterval, setTrackedTimeout } from '@core/utils/timerManager.js';
import {
  payoutWagerPot,
  recordSimpleGameStat,
  registerActiveMatchSession,
  registerMultiplayerGame,
  unregisterActiveMatchSession,
} from '@features/games/matchmakingManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { uiManager } from '@minecraft/server-ui';

export const connect4Cols = 7;
export const connect4Rows = 6;
export const connect4TotalCells = 42;

export type Connect4Disc = '' | 'R' | 'Y';

export interface Connect4Match {
  id: string;
  playerRId: string;
  playerRName: string;
  playerYId: string;
  playerYName: string;
  board: Connect4Disc[]; // 42 cells (row 0 = top, row 5 = bottom)
  currentTurnId: string;
  wager: number;
  status: 'active' | 'won' | 'draw' | 'forfeit';
  winnerId?: string;
  winningCells?: number[];
  endReason?: string;
  lastMoveTime: number;
  refreshingPlayers: Set<string>;
}

const activeMatches = new Map<string, Connect4Match>();
const playerMatchMap = new Map<string, string>();
let c4TimerInitialized = false;

export function initializeConnect4(): void {
  registerMultiplayerGame({
    id: 'connect4',
    name: 'Connect 4',
    icon: 'textures/items/redstone_dust',
    isEnabled: () => {
      const cfg = getGamesConfig();
      return cfg.enabled === true && cfg.connect4?.enabled !== false;
    },
    onStartMatch: async (host, guest, wager) => {
      const match = startConnect4Match(host, guest, wager);
      if (isDefined(match)) {
        const { showConnect4Board } = await import('@features/games/connect4/ui/panel.js');
        void showConnect4Board(host, match.id);
        void showConnect4Board(guest, match.id);
      }
    },
  });

  if (!c4TimerInitialized) {
    c4TimerInitialized = true;
    setTrackedInterval(() => {
      const now = Date.now();
      const timeoutMs = Math.max(15, getGamesConfig().connect4?.turnTimeoutSeconds ?? 45) * 1000;
      for (const match of activeMatches.values()) {
        if (match.status === 'active' && now - match.lastMoveTime >= timeoutMs) {
          forfeitConnect4Match(match.id, match.currentTurnId, 'ran out of time');
        }
      }
    }, 20);
  }
}

export function findLowestEmptyConnect4Row(board: Connect4Disc[], col: number): number {
  if (col < 0 || col >= connect4Cols) {
    return -1;
  }
  for (let r = connect4Rows - 1; r >= 0; r--) {
    if (board[r * connect4Cols + col] === '') {
      return r;
    }
  }
  return -1;
}

export function evaluateConnect4Board(board: Connect4Disc[]): {
  winner?: 'R' | 'Y';
  winningCells?: number[];
  isDraw: boolean;
} {
  const directions: [number, number][] = [
    [0, 1], // Horizontal
    [1, 0], // Vertical
    [1, 1], // Diagonal down-right
    [1, -1], // Diagonal down-left
  ];

  for (let r = 0; r < connect4Rows; r++) {
    for (let c = 0; c < connect4Cols; c++) {
      const disc = board[r * connect4Cols + c];
      if (!disc) {
        continue;
      }
      for (const [dr, dc] of directions) {
        const cells = [r * connect4Cols + c];
        for (let step = 1; step < 4; step++) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= connect4Rows || nc < 0 || nc >= connect4Cols) {
            break;
          }
          if (board[nr * connect4Cols + nc] !== disc) {
            break;
          }
          cells.push(nr * connect4Cols + nc);
        }
        if (cells.length === 4) {
          return { winner: disc, winningCells: cells, isDraw: false };
        }
      }
    }
  }

  const isDraw = board.every((cell) => cell !== '');
  return { isDraw };
}

export function startConnect4Match(
  playerR: mc.Player,
  playerY: mc.Player,
  wager: number = 0,
): Connect4Match | undefined {
  if (wager > 0) {
    incrementPlayerBalance(playerR.id, -wager);
    incrementPlayerBalance(playerY.id, -wager);
  }

  const matchId = `c4_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const match: Connect4Match = {
    id: matchId,
    playerRId: playerR.id,
    playerRName: playerR.name,
    playerYId: playerY.id,
    playerYName: playerY.name,
    board: Array.from({ length: connect4TotalCells }, () => '' as Connect4Disc),
    currentTurnId: playerR.id,
    wager,
    status: 'active',
    lastMoveTime: Date.now(),
    refreshingPlayers: new Set(),
  };

  activeMatches.set(matchId, match);
  playerMatchMap.set(playerR.id, matchId);
  playerMatchMap.set(playerY.id, matchId);

  registerActiveMatchSession({
    matchId,
    gameId: 'connect4',
    playerIds: [playerR.id, playerY.id],
    onPlayerDisconnect: (disconnectedId) => {
      forfeitConnect4Match(matchId, disconnectedId, 'disconnected');
    },
  });

  return match;
}

export function getConnect4Match(matchId: string): Connect4Match | undefined {
  return activeMatches.get(matchId);
}

function triggerOpponentRefresh(match: Connect4Match, targetPlayerId: string): void {
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
    // Ignore
  }
}

function finalizeMatchCleanup(match: Connect4Match): void {
  unregisterActiveMatchSession(match.id);
  playerMatchMap.delete(match.playerRId);
  playerMatchMap.delete(match.playerYId);
  setTrackedTimeout(() => {
    activeMatches.delete(match.id);
  }, 600);
}

export function dropConnect4Disc(
  matchId: string,
  playerId: string,
  tappedCellOrCol: number,
): { valid: boolean; message?: string; matchEnded: boolean } {
  const match = activeMatches.get(matchId);
  if (!isDefined(match) || match.status !== 'active') {
    return { valid: false, message: '§cMatch is no longer active.', matchEnded: true };
  }

  if (match.currentTurnId !== playerId) {
    return { valid: false, message: "§eWaiting for your opponent's move...", matchEnded: false };
  }

  const col = tappedCellOrCol % connect4Cols;
  const targetRow = findLowestEmptyConnect4Row(match.board, col);
  if (targetRow === -1) {
    return { valid: false, message: '§cThat column is already full! Pick another column.', matchEnded: false };
  }

  const disc: Connect4Disc = playerId === match.playerRId ? 'R' : 'Y';
  const opponentId = playerId === match.playerRId ? match.playerYId : match.playerRId;

  match.board[targetRow * connect4Cols + col] = disc;
  match.lastMoveTime = Date.now();

  const evalRes = evaluateConnect4Board(match.board);
  if (evalRes.winner) {
    match.status = 'won';
    match.winnerId = playerId;
    match.winningCells = evalRes.winningCells;
    recordSimpleGameStat(playerId, 'connect4', 'wins');
    recordSimpleGameStat(opponentId, 'connect4', 'losses');

    const winnerName = playerId === match.playerRId ? match.playerRName : match.playerYName;
    const loserName = playerId === match.playerRId ? match.playerYName : match.playerRName;
    match.endReason = `§a${winnerName} §7connected 4 in a row against §c${loserName}§7!`;

    const payout = match.wager > 0 ? payoutWagerPot(playerId, match.wager) : { netPrize: 0, taxRate: 0 };
    const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(payout.netPrize)})§r` : '';

    const pR = getPlayerFromCache(match.playerRId);
    const pY = getPlayerFromCache(match.playerYId);
    if (isDefined(pR)) {
      pR.sendMessage(`§e[Connect 4] §a${winnerName} §fwon the match!${prizeText}`);
      playSound(pR, playerId === match.playerRId ? 'random.levelup' : 'note.bass');
    }
    if (isDefined(pY)) {
      pY.sendMessage(`§e[Connect 4] §a${winnerName} §fwon the match!${prizeText}`);
      playSound(pY, playerId === match.playerYId ? 'random.levelup' : 'note.bass');
    }

    finalizeMatchCleanup(match);
    triggerOpponentRefresh(match, opponentId);
    return { valid: true, matchEnded: true };
  }

  if (evalRes.isDraw) {
    match.status = 'draw';
    match.endReason = '§eAll 42 slots filled — Match ended in a Draw!';
    if (match.wager > 0) {
      incrementPlayerBalance(match.playerRId, match.wager);
      incrementPlayerBalance(match.playerYId, match.wager);
    }
    finalizeMatchCleanup(match);
    triggerOpponentRefresh(match, opponentId);
    return { valid: true, matchEnded: true };
  }

  match.currentTurnId = opponentId;
  const mover = getPlayerFromCache(playerId);
  const opp = getPlayerFromCache(opponentId);
  if (isDefined(mover)) {
    playSound(mover, 'random.click');
  }
  if (isDefined(opp)) {
    playSound(opp, 'random.orb');
  }

  triggerOpponentRefresh(match, opponentId);
  return { valid: true, matchEnded: false };
}

export function forfeitConnect4Match(matchId: string, forfeitingPlayerId: string, reason = 'closed the UI'): void {
  const match = activeMatches.get(matchId);
  if (!isDefined(match) || match.status !== 'active') {
    return;
  }

  const winnerId = forfeitingPlayerId === match.playerRId ? match.playerYId : match.playerRId;
  const winnerName = forfeitingPlayerId === match.playerRId ? match.playerYName : match.playerRName;
  const loserName = forfeitingPlayerId === match.playerRId ? match.playerRName : match.playerYName;

  match.status = 'forfeit';
  match.winnerId = winnerId;
  match.endReason = `§c${loserName} §7${reason}. §a${winnerName} §7wins by forfeit!`;

  const payout = match.wager > 0 ? payoutWagerPot(winnerId, match.wager) : { netPrize: 0, taxRate: 0 };
  const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(payout.netPrize)})§r` : '';

  getPlayerFromCache(winnerId)?.sendMessage(`§e[Connect 4] §c${loserName} §7${reason}. §aYou won!${prizeText}`);
  getPlayerFromCache(forfeitingPlayerId)?.sendMessage(`§e[Connect 4] §cYou forfeited (${reason}).`);

  finalizeMatchCleanup(match);
  triggerOpponentRefresh(match, winnerId);
}

export function _clearConnect4ForTest(): void {
  activeMatches.clear();
  playerMatchMap.clear();
}
