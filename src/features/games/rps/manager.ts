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

export type RpsChoice = 'rock' | 'paper' | 'scissors';

export interface RpsRoundRecord {
  round: number;
  p1Choice: RpsChoice;
  p2Choice: RpsChoice;
  winnerId?: string;
}

export interface RpsMatch {
  id: string;
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  isBotMatch: boolean;
  wager: number;
  bestOf: number;
  targetWins: number;
  round: number;
  p1Wins: number;
  p2Wins: number;
  p1Choice?: RpsChoice;
  p2Choice?: RpsChoice;
  rounds: RpsRoundRecord[];
  status: 'active' | 'won' | 'forfeit';
  winnerId?: string;
  lastRoundSummary?: string;
  endReason?: string;
  lastActionTime: number;
  refreshingPlayers: Set<string>;
}

const botPlayerId = 'rpsBot';
const rpsChoices: RpsChoice[] = ['rock', 'paper', 'scissors'];

const activeMatches = new Map<string, RpsMatch>();
const playerMatchMap = new Map<string, string>();
let turnTimerInitialized = false;

export function formatRpsChoice(choice: RpsChoice): string {
  if (choice === 'rock') {
    return '§7🪨 Rock§r';
  }
  if (choice === 'paper') {
    return '§f📄 Paper§r';
  }
  return '§c✂ Scissors§r';
}

export function evaluateRpsRound(p1Choice: RpsChoice, p2Choice: RpsChoice): 'p1' | 'p2' | 'draw' {
  if (p1Choice === p2Choice) {
    return 'draw';
  }
  if (
    (p1Choice === 'rock' && p2Choice === 'scissors') ||
    (p1Choice === 'paper' && p2Choice === 'rock') ||
    (p1Choice === 'scissors' && p2Choice === 'paper')
  ) {
    return 'p1';
  }
  return 'p2';
}

export function initializeRps(): void {
  registerMultiplayerGame({
    id: 'rps',
    name: 'Rock Paper Scissors',
    icon: 'textures/items/shears',
    isEnabled: () => {
      const cfg = getGamesConfig();
      return cfg.enabled === true && cfg.rps?.enabled !== false;
    },
    onStartMatch: async (host, guest, wager) => {
      const match = startRpsMatch(host, guest, wager);
      if (isDefined(match)) {
        const { showRpsMatchPanel } = await import('@features/games/rps/ui/panel.js');
        void showRpsMatchPanel(host, match.id);
        void showRpsMatchPanel(guest, match.id);
      }
    },
  });

  if (!turnTimerInitialized) {
    turnTimerInitialized = true;
    setTrackedInterval(() => {
      const now = Date.now();
      const timeoutMs = Math.max(15, getGamesConfig().rps?.turnTimeoutSeconds ?? 30) * 1000;
      for (const match of activeMatches.values()) {
        if (match.status === 'active' && !match.isBotMatch && now - match.lastActionTime >= timeoutMs) {
          const slowPlayerId = !isDefined(match.p1Choice) ? match.player1Id : match.player2Id;
          forfeitRpsMatch(match.id, slowPlayerId, 'ran out of time');
        }
      }
    }, 20);
  }
}

function normalizeBestOf(rawBestOf?: number): number {
  const val = rawBestOf ?? 3;
  if (val <= 1) {
    return 1;
  }
  if (val >= 5) {
    return 5;
  }
  return 3;
}

export function startRpsMatch(player1: mc.Player, player2: mc.Player, wager: number = 0): RpsMatch | undefined {
  if (wager > 0) {
    incrementPlayerBalance(player1.id, -wager);
    incrementPlayerBalance(player2.id, -wager);
  }

  const bestOf = normalizeBestOf(getGamesConfig().rps?.bestOfRounds);
  const targetWins = Math.ceil(bestOf / 2);
  const matchId = `rps_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const match: RpsMatch = {
    id: matchId,
    player1Id: player1.id,
    player1Name: player1.name,
    player2Id: player2.id,
    player2Name: player2.name,
    isBotMatch: false,
    wager,
    bestOf,
    targetWins,
    round: 1,
    p1Wins: 0,
    p2Wins: 0,
    rounds: [],
    status: 'active',
    lastActionTime: Date.now(),
    refreshingPlayers: new Set(),
  };

  activeMatches.set(matchId, match);
  playerMatchMap.set(player1.id, matchId);
  playerMatchMap.set(player2.id, matchId);

  registerActiveMatchSession({
    matchId,
    gameId: 'rps',
    playerIds: [player1.id, player2.id],
    onPlayerDisconnect: (disconnectedPlayerId) => {
      forfeitRpsMatch(matchId, disconnectedPlayerId, 'disconnected');
    },
  });

  return match;
}

export function startRpsBotMatch(player: mc.Player): RpsMatch {
  const existing = getPlayerRpsMatch(player.id);
  if (isDefined(existing) && existing.isBotMatch) {
    activeMatches.delete(existing.id);
    playerMatchMap.delete(player.id);
  }

  const bestOf = normalizeBestOf(getGamesConfig().rps?.bestOfRounds);
  const targetWins = Math.ceil(bestOf / 2);
  const matchId = `rps_bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const match: RpsMatch = {
    id: matchId,
    player1Id: player.id,
    player1Name: player.name,
    player2Id: botPlayerId,
    player2Name: 'AddonExe Bot',
    isBotMatch: true,
    wager: 0,
    bestOf,
    targetWins,
    round: 1,
    p1Wins: 0,
    p2Wins: 0,
    rounds: [],
    status: 'active',
    lastActionTime: Date.now(),
    refreshingPlayers: new Set(),
  };

  activeMatches.set(matchId, match);
  playerMatchMap.set(player.id, matchId);
  return match;
}

export function getRpsMatch(matchId: string): RpsMatch | undefined {
  return activeMatches.get(matchId);
}

export function getPlayerRpsMatch(playerId: string): RpsMatch | undefined {
  const matchId = playerMatchMap.get(playerId);
  return isDefined(matchId) ? activeMatches.get(matchId) : undefined;
}

function triggerOpponentUiRefresh(match: RpsMatch, targetPlayerId: string): void {
  if (targetPlayerId === botPlayerId) {
    return;
  }
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
    // Ignore if closeAllForms is unavailable
  }
}

function finalizeMatchCleanup(match: RpsMatch): void {
  if (!match.isBotMatch) {
    unregisterActiveMatchSession(match.id);
  }
  playerMatchMap.delete(match.player1Id);
  playerMatchMap.delete(match.player2Id);
  setTrackedTimeout(() => {
    activeMatches.delete(match.id);
  }, 600);
}

export function submitRpsChoice(
  matchId: string,
  playerId: string,
  choice: RpsChoice,
): { valid: boolean; waitingForOpponent: boolean; roundResolved: boolean; matchEnded: boolean; message?: string } {
  const match = activeMatches.get(matchId);
  if (!isDefined(match) || match.status !== 'active') {
    return {
      valid: false,
      waitingForOpponent: false,
      roundResolved: false,
      matchEnded: true,
      message: '§cMatch is no longer active.',
    };
  }

  const isP1 = playerId === match.player1Id;
  const isP2 = playerId === match.player2Id;
  if (!isP1 && !isP2) {
    return {
      valid: false,
      waitingForOpponent: false,
      roundResolved: false,
      matchEnded: false,
      message: '§cYou are not part of this match.',
    };
  }

  if ((isP1 && isDefined(match.p1Choice)) || (isP2 && isDefined(match.p2Choice))) {
    return {
      valid: false,
      waitingForOpponent: true,
      roundResolved: false,
      matchEnded: false,
      message: '§eYou already locked in your choice for this round!',
    };
  }

  if (isP1) {
    match.p1Choice = choice;
  } else {
    match.p2Choice = choice;
  }
  match.lastActionTime = Date.now();

  if (match.isBotMatch) {
    const randomIdx = Math.floor(Math.random() * rpsChoices.length);
    match.p2Choice = rpsChoices[randomIdx] ?? 'rock';
  }

  const mover = getPlayerFromCache(playerId);
  if (isDefined(mover)) {
    playSound(mover, 'random.click');
  }

  if (!isDefined(match.p1Choice) || !isDefined(match.p2Choice)) {
    return {
      valid: true,
      waitingForOpponent: true,
      roundResolved: false,
      matchEnded: false,
      message: `§aLocked in ${formatRpsChoice(choice)}§a! Waiting for opponent...`,
    };
  }

  const c1 = match.p1Choice;
  const c2 = match.p2Choice;
  const outcome = evaluateRpsRound(c1, c2);
  const currentRound = match.round;

  let roundWinnerId: string | undefined;
  if (outcome === 'p1') {
    match.p1Wins++;
    roundWinnerId = match.player1Id;
    match.lastRoundSummary = `§eRound ${currentRound}: §b${match.player1Name} §7(${formatRpsChoice(c1)}§7) beat §f${match.player2Name} §7(${formatRpsChoice(c2)}§7)!`;
  } else if (outcome === 'p2') {
    match.p2Wins++;
    roundWinnerId = match.player2Id;
    match.lastRoundSummary = `§eRound ${currentRound}: §b${match.player2Name} §7(${formatRpsChoice(c2)}§7) beat §f${match.player1Name} §7(${formatRpsChoice(c1)}§7)!`;
  } else {
    match.lastRoundSummary = `§eRound ${currentRound}: §6Draw! §7Both picked ${formatRpsChoice(c1)}§7.`;
  }

  match.rounds.push({
    round: currentRound,
    p1Choice: c1,
    p2Choice: c2,
    ...(isDefined(roundWinnerId) ? { winnerId: roundWinnerId } : {}),
  });

  match.p1Choice = undefined;
  match.p2Choice = undefined;

  const otherPlayerId = isP1 ? match.player2Id : match.player1Id;

  if (match.p1Wins >= match.targetWins || match.p2Wins >= match.targetWins) {
    match.status = 'won';
    const p1Won = match.p1Wins >= match.targetWins;
    match.winnerId = p1Won ? match.player1Id : match.player2Id;
    const loserId = p1Won ? match.player2Id : match.player1Id;
    if (match.winnerId !== botPlayerId) {
      recordSimpleGameStat(match.winnerId, 'rps', 'wins');
    }
    if (loserId !== botPlayerId) {
      recordSimpleGameStat(loserId, 'rps', 'losses');
    }
    const winnerName = p1Won ? match.player1Name : match.player2Name;
    const loserName = p1Won ? match.player2Name : match.player1Name;

    match.endReason = `§a${winnerName} §7defeated §c${loserName} §7(${match.p1Wins} - ${match.p2Wins})!`;

    const payout =
      match.wager > 0 && isDefined(match.winnerId) && match.winnerId !== botPlayerId
        ? payoutWagerPot(match.winnerId, match.wager)
        : { netPrize: 0, taxRate: 0 };

    const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(payout.netPrize)})§r` : '';
    const p1 = getPlayerFromCache(match.player1Id);
    const p2 = getPlayerFromCache(match.player2Id);

    if (isDefined(p1)) {
      p1.sendMessage(
        `§e[RPS] ${match.lastRoundSummary}\n§e[RPS] §a${winnerName} §fwon the match (${match.p1Wins}-${match.p2Wins})!${prizeText}`,
      );
      playSound(p1, p1Won ? 'random.levelup' : 'note.bass');
    }
    if (isDefined(p2)) {
      p2.sendMessage(
        `§e[RPS] ${match.lastRoundSummary}\n§e[RPS] §a${winnerName} §fwon the match (${match.p1Wins}-${match.p2Wins})!${prizeText}`,
      );
      playSound(p2, !p1Won ? 'random.levelup' : 'note.bass');
    }

    finalizeMatchCleanup(match);
    triggerOpponentUiRefresh(match, otherPlayerId);
    return {
      valid: true,
      waitingForOpponent: false,
      roundResolved: true,
      matchEnded: true,
      message: match.lastRoundSummary,
    };
  }

  match.round++;
  const p1 = getPlayerFromCache(match.player1Id);
  const p2 = getPlayerFromCache(match.player2Id);
  if (isDefined(p1)) {
    playSound(p1, 'random.orb');
  }
  if (isDefined(p2)) {
    playSound(p2, 'random.orb');
  }

  triggerOpponentUiRefresh(match, otherPlayerId);
  return {
    valid: true,
    waitingForOpponent: false,
    roundResolved: true,
    matchEnded: false,
    message: match.lastRoundSummary,
  };
}

export function forfeitRpsMatch(matchId: string, forfeitingPlayerId: string, reason: string = 'closed the UI'): void {
  const match = activeMatches.get(matchId);
  if (!isDefined(match) || match.status !== 'active') {
    return;
  }

  if (match.isBotMatch) {
    match.status = 'forfeit';
    match.winnerId = botPlayerId;
    match.endReason = '§eYou ended the solo match.';
    finalizeMatchCleanup(match);
    return;
  }

  const winnerId = forfeitingPlayerId === match.player1Id ? match.player2Id : match.player1Id;
  const winnerName = forfeitingPlayerId === match.player1Id ? match.player2Name : match.player1Name;
  const loserName = forfeitingPlayerId === match.player1Id ? match.player1Name : match.player2Name;

  match.status = 'forfeit';
  match.winnerId = winnerId;
  match.endReason = `§c${loserName} §7${reason}. §a${winnerName} §7wins by forfeit!`;

  const payout = match.wager > 0 ? payoutWagerPot(winnerId, match.wager) : { netPrize: 0, taxRate: 0 };

  const prizeText = match.wager > 0 ? ` §6(+${formatCurrency(payout.netPrize)})§r` : '';
  const winnerPlayer = getPlayerFromCache(winnerId);
  const loserPlayer = getPlayerFromCache(forfeitingPlayerId);

  if (isDefined(winnerPlayer)) {
    winnerPlayer.sendMessage(`§e[RPS] §c${loserName} §7${reason}. §aYou won by forfeit!${prizeText}`);
    playSound(winnerPlayer, 'random.levelup');
  }
  if (isDefined(loserPlayer)) {
    loserPlayer.sendMessage(`§e[RPS] §cYou forfeited the match (${reason}). §e${winnerName} §cwins!`);
    playSound(loserPlayer, 'note.bass');
  }

  finalizeMatchCleanup(match);
  triggerOpponentUiRefresh(match, winnerId);
}

export function _clearRpsForTest(): void {
  activeMatches.clear();
  playerMatchMap.clear();
}
