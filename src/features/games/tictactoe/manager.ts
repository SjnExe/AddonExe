import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayerFromCache } from '@core/data/playerCache.js';
import { incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { setTrackedInterval } from '@core/utils/timerManager.js';
import {
  registerActiveMatchSession,
  registerMultiplayerGame,
  unregisterActiveMatchSession,
} from '@features/games/matchmakingManager.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { uiManager } from '@minecraft/server-ui';

export type CellMark = '' | 'X' | 'O';

export interface TicTacToeMatch {
  id: string;
  playerXId: string;
  playerXName: string;
  playerOId: string;
  playerOName: string;
  board: CellMark[];
  currentTurnId: string;
  wager: number;
  status: 'active' | 'won' | 'draw' | 'forfeit';
  winnerId?: string;
  winningLine?: [number, number, number];
  endReason?: string;
  lastMoveTime: number;
  refreshingPlayers: Set<string>;
}

const winningLines: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const activeMatches = new Map<string, TicTacToeMatch>();
const playerMatchMap = new Map<string, string>();
let turnTimerInitialized = false;

export function initializeTicTacToe(): void {
  registerMultiplayerGame({
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    icon: 'textures/ui/controller_glyph_color',
    isEnabled: () => {
      const cfg = getGamesConfig();
      return cfg.enabled === true && cfg.ticTacToe?.enabled !== false;
    },
    onStartMatch: async (host, guest, wager) => {
      const match = startTicTacToeMatch(host, guest, wager);
      if (isDefined(match)) {
        const { showTicTacToeBoard } = await import('@features/games/tictactoe/ui/panel.js');
        void showTicTacToeBoard(host, match.id);
        void showTicTacToeBoard(guest, match.id);
      }
    },
  });

  if (!turnTimerInitialized) {
    turnTimerInitialized = true;
    setTrackedInterval(() => {
      const now = Date.now();
      const timeoutMs = Math.max(15, getGamesConfig().ticTacToe?.turnTimeoutSeconds ?? 45) * 1000;
      for (const match of activeMatches.values()) {
        if (match.status === 'active' && now - match.lastMoveTime >= timeoutMs) {
          forfeitTicTacToeMatch(match.id, match.currentTurnId, 'ran out of time');
        }
      }
    }, 20);
  }
}

export function evaluateTicTacToeBoard(board: CellMark[]): {
  winner?: 'X' | 'O';
  winningLine?: [number, number, number];
  isDraw: boolean;
} {
  for (const line of winningLines) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) {
      return { winner: mark, winningLine: line, isDraw: false };
    }
  }
  const isDraw = board.every((cell) => cell === 'X' || cell === 'O');
  return { isDraw };
}

export function startTicTacToeMatch(
  playerX: mc.Player,
  playerO: mc.Player,
  wager: number = 0,
): TicTacToeMatch | undefined {
  if (wager > 0) {
    incrementPlayerBalance(playerX.id, -wager);
    incrementPlayerBalance(playerO.id, -wager);
  }

  const matchId = `ttt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const match: TicTacToeMatch = {
    id: matchId,
    playerXId: playerX.id,
    playerXName: playerX.name,
    playerOId: playerO.id,
    playerOName: playerO.name,
    board: Array.from({ length: 9 }, () => '' as CellMark),
    currentTurnId: playerX.id,
    wager,
    status: 'active',
    lastMoveTime: Date.now(),
    refreshingPlayers: new Set(),
  };

  activeMatches.set(matchId, match);
  playerMatchMap.set(playerX.id, matchId);
  playerMatchMap.set(playerO.id, matchId);

  registerActiveMatchSession({
    matchId,
    gameId: 'tictactoe',
    playerIds: [playerX.id, playerO.id],
    onPlayerDisconnect: (disconnectedPlayerId) => {
      forfeitTicTacToeMatch(matchId, disconnectedPlayerId, 'disconnected');
    },
  });

  return match;
}

export function getTicTacToeMatch(matchId: string): TicTacToeMatch | undefined {
  return activeMatches.get(matchId);
}

export function getPlayerTicTacToeMatch(playerId: string): TicTacToeMatch | undefined {
  const matchId = playerMatchMap.get(playerId);
  return isDefined(matchId) ? activeMatches.get(matchId) : undefined;
}

function triggerOpponentUiRefresh(match: TicTacToeMatch, targetPlayerId: string): void {
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

function finalizeMatchCleanup(match: TicTacToeMatch): void {
  unregisterActiveMatchSession(match.id);
  playerMatchMap.delete(match.playerXId);
  playerMatchMap.delete(match.playerOId);
  mc.system.runTimeout(() => {
    activeMatches.delete(match.id);
  }, 600);
}

export function makeTicTacToeMove(
  matchId: string,
  playerId: string,
  cellIndex: number,
): { valid: boolean; message?: string; matchEnded: boolean } {
  const match = activeMatches.get(matchId);
  if (!isDefined(match) || match.status !== 'active') {
    return { valid: false, message: '§cMatch is no longer active.', matchEnded: true };
  }

  if (match.currentTurnId !== playerId) {
    return { valid: false, message: "§eWaiting for your opponent's move...", matchEnded: false };
  }

  if (cellIndex < 0 || cellIndex >= 9 || match.board[cellIndex] !== '') {
    return { valid: false, message: '§cThat square is already occupied!', matchEnded: false };
  }

  const mark: CellMark = playerId === match.playerXId ? 'X' : 'O';
  const opponentId = playerId === match.playerXId ? match.playerOId : match.playerXId;

  match.board[cellIndex] = mark;
  match.lastMoveTime = Date.now();

  const evalResult = evaluateTicTacToeBoard(match.board);

  if (evalResult.winner) {
    match.status = 'won';
    match.winnerId = playerId;
    match.winningLine = evalResult.winningLine;
    const winnerName = playerId === match.playerXId ? match.playerXName : match.playerOName;
    const loserName = playerId === match.playerXId ? match.playerOName : match.playerXName;
    match.endReason = `§a${winnerName} §7connected 3 in a row against §c${loserName}§7!`;

    if (match.wager > 0) {
      incrementPlayerBalance(playerId, match.wager * 2);
    }

    const pX = getPlayerFromCache(match.playerXId);
    const pO = getPlayerFromCache(match.playerOId);
    const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(match.wager * 2)})§r` : '';
    if (isDefined(pX)) {
      pX.sendMessage(`§e[Tic-Tac-Toe] §a${winnerName} §fwon the match!${prizeText}`);
      playSound(pX, playerId === match.playerXId ? 'random.levelup' : 'note.bass');
    }
    if (isDefined(pO)) {
      pO.sendMessage(`§e[Tic-Tac-Toe] §a${winnerName} §fwon the match!${prizeText}`);
      playSound(pO, playerId === match.playerOId ? 'random.levelup' : 'note.bass');
    }

    finalizeMatchCleanup(match);
    triggerOpponentUiRefresh(match, opponentId);
    return { valid: true, matchEnded: true };
  }

  if (evalResult.isDraw) {
    match.status = 'draw';
    match.endReason = '§eAll 9 squares filled — Match ended in a Draw!';

    if (match.wager > 0) {
      incrementPlayerBalance(match.playerXId, match.wager);
      incrementPlayerBalance(match.playerOId, match.wager);
    }

    const pX = getPlayerFromCache(match.playerXId);
    const pO = getPlayerFromCache(match.playerOId);
    const refundText = match.wager > 0 ? ` §7(${formatCurrency(match.wager)} refunded)` : '';
    if (isDefined(pX)) {
      pX.sendMessage(`§e[Tic-Tac-Toe] §fMatch ended in a §eDraw§f!${refundText}`);
      playSound(pX, 'random.orb');
    }
    if (isDefined(pO)) {
      pO.sendMessage(`§e[Tic-Tac-Toe] §fMatch ended in a §eDraw§f!${refundText}`);
      playSound(pO, 'random.orb');
    }

    finalizeMatchCleanup(match);
    triggerOpponentUiRefresh(match, opponentId);
    return { valid: true, matchEnded: true };
  }

  match.currentTurnId = opponentId;
  const mover = getPlayerFromCache(playerId);
  const opponent = getPlayerFromCache(opponentId);
  if (isDefined(mover)) {
    playSound(mover, 'random.click');
  }
  if (isDefined(opponent)) {
    playSound(opponent, 'random.orb');
  }

  triggerOpponentUiRefresh(match, opponentId);
  return { valid: true, matchEnded: false };
}

export function forfeitTicTacToeMatch(
  matchId: string,
  forfeitingPlayerId: string,
  reason: string = 'closed the UI',
): void {
  const match = activeMatches.get(matchId);
  if (!isDefined(match) || match.status !== 'active') {
    return;
  }

  const winnerId = forfeitingPlayerId === match.playerXId ? match.playerOId : match.playerXId;
  const winnerName = forfeitingPlayerId === match.playerXId ? match.playerOName : match.playerXName;
  const loserName = forfeitingPlayerId === match.playerXId ? match.playerXName : match.playerOName;

  match.status = 'forfeit';
  match.winnerId = winnerId;
  match.endReason = `§c${loserName} §7${reason}. §a${winnerName} §7wins by forfeit!`;

  if (match.wager > 0) {
    incrementPlayerBalance(winnerId, match.wager * 2);
  }

  const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(match.wager * 2)})§r` : '';
  const winnerPlayer = getPlayerFromCache(winnerId);
  const loserPlayer = getPlayerFromCache(forfeitingPlayerId);

  if (isDefined(winnerPlayer)) {
    winnerPlayer.sendMessage(`§e[Tic-Tac-Toe] §c${loserName} §7${reason}. §aYou won by forfeit!${prizeText}`);
    playSound(winnerPlayer, 'random.levelup');
  }
  if (isDefined(loserPlayer)) {
    loserPlayer.sendMessage(`§e[Tic-Tac-Toe] §cYou forfeited the match (${reason}). §e${winnerName} §cwins!`);
    playSound(loserPlayer, 'note.bass');
  }

  finalizeMatchCleanup(match);
  triggerOpponentUiRefresh(match, winnerId);
}

export function _clearTicTacToeForTest(): void {
  activeMatches.clear();
  playerMatchMap.clear();
}
