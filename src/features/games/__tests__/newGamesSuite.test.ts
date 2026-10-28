import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { initializeConfigManager, updateMultipleConfig } from '@core/config/configManager.js';
import { addPlayerToCache, clearPlayerCache } from '@core/data/playerCache.js';
import {
  cleanupPlayerDataManager,
  getBalance,
  getOrCreatePlayer,
  setPlayerBalance,
} from '@core/data/playerDataManager.js';
import {
  _clearCodebreakerForTest,
  evaluateCodeGuess,
  lockInCodemakerSecret,
  startMultiplayerCodebreaker,
  submitCodebreakerAttempt,
} from '@features/games/codebreaker/manager.js';
import {
  _clearConnect4ForTest,
  dropConnect4Disc,
  evaluateConnect4Board,
  startConnect4Match,
} from '@features/games/connect4/manager.js';
import {
  _clear2048ForTest,
  apply2048BoardSlide,
  continue2048Endless,
  perform2048Move,
  start2048Game,
} from '@features/games/game2048/manager.js';
import { _clearGameChatForTest, isPlayerInGameChatChannel } from '@features/games/gameChat/manager.js';
import { _clearMatchmakingForTest } from '@features/games/matchmakingManager.js';
import {
  _clearStaffRoundsForTest,
  startFastMathRound,
  startNumberGuessRound,
  startScrambleRound,
  submitFastMathAttempt,
  submitNumberGuessAttempt,
  submitScrambleAttempt,
} from '@features/games/staffRounds/manager.js';
import * as mc from '@minecraft/server';

const createMockPlayer = (id: string, name: string) =>
  ({
    id,
    name,
    isValid: true,
    sendMessage: mock(),
    playSound: mock(),
  }) as unknown as mc.Player;

describe('2048, Connect 4, Codebreaker, Scramble, Fast Math & Number Guess (/gc)', () => {
  beforeEach(async () => {
    await initializeConfigManager(false);
    updateMultipleConfig({ 'economy.enabled': true });
    clearPlayerCache();
    cleanupPlayerDataManager();
    _clearMatchmakingForTest();
    _clear2048ForTest();
    _clearConnect4ForTest();
    _clearCodebreakerForTest();
    _clearStaffRoundsForTest();
    _clearGameChatForTest();
  });

  it('2048 slides, merges, awards 2048 milestone reward, and supports endless continuation', () => {
    const p1 = createMockPlayer('g2048_p1', 'Player2048');
    getOrCreatePlayer(p1);
    setPlayerBalance(p1.id, 0);

    const session = start2048Game(p1);
    session.board = [1024, 1024, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const res = perform2048Move(p1, 'left');
    expect(res.moved).toBe(true);
    expect(session.maxTile).toBe(2048);
    expect(session.won2048).toBe(true);
    expect(session.status).toBe('won_prompt');
    expect(getBalance(p1.id)).toBe(300);

    continue2048Endless(p1.id);
    expect(session.endlessMode).toBe(true);
    expect(session.status).toBe('active');

    const slideRes = apply2048BoardSlide([2, 2, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'left');
    expect(slideRes.changed).toBe(true);
    expect(slideRes.pointsEarned).toBe(12);
  });

  it('Connect 4 drops discs to the lowest empty row in a 7x6 grid and detects 4-in-a-row', () => {
    const p1 = createMockPlayer('c4_p1', 'Alice');
    const p2 = createMockPlayer('c4_p2', 'Bob');
    addPlayerToCache(p1);
    addPlayerToCache(p2);
    getOrCreatePlayer(p1);
    getOrCreatePlayer(p2);
    setPlayerBalance(p1.id, 100);
    setPlayerBalance(p2.id, 100);

    const match = startConnect4Match(p1, p2, 50)!;
    expect(match.board.length).toBe(42);

    // P1 drops in col 0, 1, 2, 3 while P2 drops in col 6
    dropConnect4Disc(match.id, p1.id, 0);
    dropConnect4Disc(match.id, p2.id, 6);
    dropConnect4Disc(match.id, p1.id, 1);
    dropConnect4Disc(match.id, p2.id, 6);
    dropConnect4Disc(match.id, p1.id, 2);
    dropConnect4Disc(match.id, p2.id, 6);
    const winMove = dropConnect4Disc(match.id, p1.id, 3);

    expect(winMove.matchEnded).toBe(true);
    expect(match.status).toBe('won');
    expect(match.winnerId).toBe(p1.id);
    expect(evaluateConnect4Board(match.board).winner).toBe('R');
    // 100 pot minus 5% tax = 95 payout -> 50 + 95 = 145
    expect(getBalance(p1.id)).toBe(145);
  });

  it('Codebreaker scores exact and partial matches and supports 2P Codemaker vs Codebreaker', () => {
    const maker = createMockPlayer('cb_maker', 'Maker');
    const breaker = createMockPlayer('cb_breaker', 'Breaker');
    addPlayerToCache(maker);
    addPlayerToCache(breaker);
    getOrCreatePlayer(maker);
    getOrCreatePlayer(breaker);
    setPlayerBalance(maker.id, 100);
    setPlayerBalance(breaker.id, 100);

    const evalCheck = evaluateCodeGuess(['Red', 'Blue', 'Green', 'Yellow'], ['Red', 'Green', 'Blue', 'Aqua']);
    expect(evalCheck.exactMatches).toBe(1);
    expect(evalCheck.partialMatches).toBe(2);

    const session = startMultiplayerCodebreaker(maker, breaker, 50);
    lockInCodemakerSecret(session, ['Red', 'Blue', 'Green', 'Yellow']);

    const winAttempt = submitCodebreakerAttempt(breaker, ['Red', 'Blue', 'Green', 'Yellow']);
    expect(winAttempt.session.status).toBe('cracked');
    expect(getBalance(breaker.id)).toBe(145);
  });

  it('Scramble, Fast Math, and Number Guess (/gc) charge entry fees and pay out taxed prize pools', () => {
    const p1 = createMockPlayer('sr_p1', 'Solver');
    addPlayerToCache(p1);
    getOrCreatePlayer(p1);
    setPlayerBalance(p1.id, 200);

    startScrambleRound({ word: 'emerald', poolPrize: 100, entryFee: 20, taxRatePercentage: 10, timeLimitSeconds: 0 });
    const scrWin = submitScrambleAttempt(p1, 'emerald');
    expect(scrWin.won).toBe(true);
    // Paid 20 -> balance 180; Pool became 120 -> minus 10% tax = 108 -> balance 288
    expect(getBalance(p1.id)).toBe(288);

    startFastMathRound({
      expression: '12 * 12',
      answer: 144,
      poolPrize: 100,
      entryFee: 0,
      taxRatePercentage: 0,
      timeLimitSeconds: 0,
    });
    const mathWin = submitFastMathAttempt(p1, 144);
    expect(mathWin.won).toBe(true);
    expect(getBalance(p1.id)).toBe(388);

    startNumberGuessRound({
      min: 1,
      max: 50,
      secretNumber: 25,
      poolPrize: 100,
      entryFee: 0,
      taxRatePercentage: 0,
      timeLimitSeconds: 0,
      guessCooldownSeconds: 0,
    });
    const lowTry = submitNumberGuessAttempt(p1, 10);
    expect(lowTry.won).toBe(false);
    expect(lowTry.hint).toBe('higher');
    expect(isPlayerInGameChatChannel(p1.id)).toBe(true);

    const exactTry = submitNumberGuessAttempt(p1, 25);
    expect(exactTry.won).toBe(true);
    expect(getBalance(p1.id)).toBe(488);
  });
});
