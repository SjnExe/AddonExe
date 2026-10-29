import { getGamesConfig } from '@core/config/configurations.js';
import { getPlayer, incrementPlayerBalance, updatePlayerData } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { isDefined } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export type Direction2048 = 'up' | 'down' | 'left' | 'right';

export interface Game2048Session {
  playerId: string;
  board: number[]; // 16 cells (4x4)
  score: number;
  maxTile: number;
  moves: number;
  won2048: boolean;
  rewardClaimed: boolean;
  endlessMode: boolean;
  status: 'active' | 'won_prompt' | 'gameover';
}

const activeSessions = new Map<string, Game2048Session>();

const tileColors: Record<number, string> = {
  0: ' ',
  2: '§f§l2',
  4: '§e§l4',
  8: '§6§l8',
  16: '§c§l16',
  32: '§4§l32',
  64: '§c§l64',
  128: '§g§l128',
  256: '§e§l256',
  512: '§6§l512',
  1024: '§a§l1024',
  2048: '§2§l2048',
  4096: '§d§l4096',
  8192: '§b§l8192',
};

export function format2048Tile(value: number): string {
  if (value <= 0) {
    return ' ';
  }
  return tileColors[value] ?? `§g§l${value}`;
}

export function spawnRandom2048Tile(board: number[]): boolean {
  const emptyIndices: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (board[i] === 0) {
      emptyIndices.push(i);
    }
  }
  if (emptyIndices.length === 0) {
    return false;
  }
  const chosenIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)]!;
  // Official 2048 spawn weights: 90% chance of 2, 10% chance of 4
  board[chosenIdx] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

export function canMakeAny2048Move(board: number[]): boolean {
  for (let i = 0; i < 16; i++) {
    if (board[i] === 0) {
      return true;
    }
  }
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r * 4 + c]!;
      if (c < 3 && board[r * 4 + c + 1] === val) {
        return true;
      }
      if (r < 3 && board[(r + 1) * 4 + c] === val) {
        return true;
      }
    }
  }
  return false;
}

function slideAndMergeLine(line: number[]): { newLine: number[]; points: number; maxMerged: number; moved: boolean } {
  const nonZero = line.filter((v) => v > 0);
  const merged: number[] = [];
  let points = 0;
  let maxMerged = 0;

  let i = 0;
  while (i < nonZero.length) {
    const current = nonZero[i]!;
    const next = nonZero[i + 1];
    if (next !== undefined && current === next) {
      const combined = current * 2;
      merged.push(combined);
      points += combined;
      if (combined > maxMerged) {
        maxMerged = combined;
      }
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }

  while (merged.length < 4) {
    merged.push(0);
  }

  const moved = merged.some((val, idx) => val !== line[idx]);
  return { newLine: merged, points, maxMerged, moved };
}

export function apply2048BoardSlide(
  board: number[],
  direction: Direction2048,
): { changed: boolean; pointsEarned: number; highestTile: number } {
  let changed = false;
  let pointsEarned = 0;

  for (let i = 0; i < 4; i++) {
    const indices: number[] = [];
    for (let j = 0; j < 4; j++) {
      if (direction === 'left') {
        indices.push(i * 4 + j);
      } else if (direction === 'right') {
        indices.push(i * 4 + (3 - j));
      } else if (direction === 'up') {
        indices.push(j * 4 + i);
      } else {
        indices.push((3 - j) * 4 + i);
      }
    }

    const line = indices.map((idx) => board[idx]!);
    const { newLine, points, moved } = slideAndMergeLine(line);
    if (moved) {
      changed = true;
    }
    pointsEarned += points;
    for (let j = 0; j < 4; j++) {
      board[indices[j]!] = newLine[j]!;
    }
  }

  const highestTile = Math.max(...board);
  return { changed, pointsEarned, highestTile };
}

function savePlayer2048Stats(playerId: string, score: number, maxTile: number, won: boolean): void {
  if (!isDefined(getPlayer(playerId))) {
    return;
  }
  updatePlayerData(playerId, (d) => {
    d.gameStats ??= {};
    const prev = d.gameStats.game2048 ?? { bestScore: 0, bestTile: 0, wins: 0 };
    d.gameStats.game2048 = {
      bestScore: Math.max(prev.bestScore, score),
      bestTile: Math.max(prev.bestTile, maxTile),
      wins: prev.wins + (won ? 1 : 0),
    };
  });
}

export function start2048Game(player: mc.Player): Game2048Session {
  const board = Array.from({ length: 16 }, () => 0);
  spawnRandom2048Tile(board);
  spawnRandom2048Tile(board);

  const session: Game2048Session = {
    playerId: player.id,
    board,
    score: 0,
    maxTile: Math.max(...board),
    moves: 0,
    won2048: false,
    rewardClaimed: false,
    endlessMode: false,
    status: 'active',
  };

  activeSessions.set(player.id, session);
  return session;
}

export function getPlayer2048Game(playerId: string): Game2048Session | undefined {
  return activeSessions.get(playerId);
}

export function continue2048Endless(playerId: string): void {
  const session = activeSessions.get(playerId);
  if (isDefined(session)) {
    session.endlessMode = true;
    session.status = 'active';
  }
}

export function perform2048Move(
  player: mc.Player,
  direction: Direction2048,
): { moved: boolean; message?: string; session: Game2048Session } {
  let session = activeSessions.get(player.id);
  if (!isDefined(session)) {
    session = start2048Game(player);
  }

  if (session.status === 'gameover') {
    return { moved: false, message: '§cNo more moves available! Game Over.', session };
  }

  const { changed, pointsEarned, highestTile } = apply2048BoardSlide(session.board, direction);
  if (!changed) {
    playSound(player, 'note.bass');
    return { moved: false, message: '§eNo tiles could slide in that direction!', session };
  }

  session.score += pointsEarned;
  session.moves++;
  spawnRandom2048Tile(session.board);
  session.maxTile = Math.max(session.maxTile, highestTile, ...session.board);
  playSound(player, 'random.click');

  let justWon2048 = false;
  if (session.maxTile >= 2048 && !session.won2048) {
    session.won2048 = true;
    justWon2048 = true;
    if (!session.endlessMode) {
      session.status = 'won_prompt';
    }
    const reward = Math.max(0, Number(getGamesConfig().game2048?.winReward2048 ?? 300));
    if (!session.rewardClaimed && reward > 0 && isFeatureActive('eco')) {
      session.rewardClaimed = true;
      incrementPlayerBalance(player.id, reward);
      player.sendMessage(`§6[2048] §aYou reached the §2§l2048§r§a tile and earned §6${formatCurrency(reward)}§a!`);
    }
    playSound(player, 'random.levelup');
  }

  if (!canMakeAny2048Move(session.board)) {
    session.status = 'gameover';
    playSound(player, 'note.bass');
  }

  savePlayer2048Stats(player.id, session.score, session.maxTile, justWon2048);
  return {
    moved: true,
    ...(pointsEarned > 0 ? { message: `§a+${pointsEarned} pts!` } : {}),
    session,
  };
}

export function _clear2048ForTest(): void {
  activeSessions.clear();
}
