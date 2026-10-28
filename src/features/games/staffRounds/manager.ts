import { getGamesConfig } from '@core/config/configurations.js';
import { getBalance, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { isFeatureActive } from '@core/services/featureManager.js';
import { formatCurrency, playSound } from '@core/utils/index.js';
import { clearTrackedTimeout, setTrackedTimeout } from '@core/utils/timerManager.js';
import {
  broadcastToGameChatChannel,
  joinGameChatChannel,
  registerNumberGuessChatInterceptor,
} from '@features/games/gameChat/manager.js';
import { payoutGamePrize } from '@features/games/matchmakingManager.js';
import { getRandomSolution } from '@features/games/wordle/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

export interface StaffChallengeRound {
  id: string;
  type: 'scramble' | 'fastmath' | 'numberguess';
  promptDisplay: string;
  answer: string;
  numericAnswer?: number;
  minRange?: number;
  maxRange?: number;
  poolPrize: number;
  entryFee: number;
  taxRatePercentage: number;
  guessLimit: number;
  guessCooldownSeconds: number;
  timeLimitSeconds: number;
  expiresAt?: number;
  participants: Set<string>;
  playerGuesses: Record<string, number>;
  lastGuessTime: Record<string, number>;
  status: 'active' | 'won' | 'expired';
  winnerName?: string;
}

let activeScramble: StaffChallengeRound | undefined;
let activeFastMath: StaffChallengeRound | undefined;
let activeNumberGuess: StaffChallengeRound | undefined;

let scrambleTimerId: number | undefined;
let fastMathTimerId: number | undefined;
let numberGuessTimerId: number | undefined;

export function scrambleWordLetters(word: string): string {
  const chars = word.toUpperCase().split('');
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = chars[i]!;
      chars[i] = chars[j]!;
      chars[j] = tmp;
    }
    if (chars.join('') !== word.toUpperCase()) {
      break;
    }
  }
  return chars.join(' ');
}

export function generateRandomMathProblem(): { expression: string; answer: number } {
  const ops = ['+', '-', '*'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)]!;
  if (op === '*') {
    const a = Math.floor(Math.random() * 14) + 3;
    const b = Math.floor(Math.random() * 12) + 3;
    return { expression: `${a} * ${b}`, answer: a * b };
  }
  const a = Math.floor(Math.random() * 80) + 15;
  const b = Math.floor(Math.random() * 60) + 10;
  return op === '+' ? { expression: `${a} + ${b}`, answer: a + b } : { expression: `${a} - ${b}`, answer: a - b };
}

export function initializeStaffRounds(): void {
  registerNumberGuessChatInterceptor((player, text) => {
    if (!isDefined(activeNumberGuess) || activeNumberGuess.status !== 'active') {
      return false;
    }
    const parsed = Number.parseInt(text, 10);
    if (Number.isNaN(parsed)) {
      return false;
    }
    submitNumberGuessAttempt(player, parsed);
    return true;
  });
}

export function getActiveScrambleRound(): StaffChallengeRound | undefined {
  return activeScramble?.status === 'active' ? activeScramble : undefined;
}

export function getActiveFastMathRound(): StaffChallengeRound | undefined {
  return activeFastMath?.status === 'active' ? activeFastMath : undefined;
}

export function getActiveNumberGuessRound(): StaffChallengeRound | undefined {
  return activeNumberGuess?.status === 'active' ? activeNumberGuess : undefined;
}

export function startScrambleRound(options?: {
  word?: string;
  poolPrize?: number;
  entryFee?: number;
  taxRatePercentage?: number;
  timeLimitSeconds?: number;
  guessLimit?: number;
  guessCooldownSeconds?: number;
}): StaffChallengeRound {
  if (isDefined(scrambleTimerId)) {
    clearTrackedTimeout(scrambleTimerId);
  }
  const cfg = getGamesConfig().scramble;
  const rawWord = isNonEmptyString(options?.word?.trim())
    ? options!.word!.trim().toLowerCase()
    : (getRandomSolution(5) ?? 'diamond');
  const scrambled = scrambleWordLetters(rawWord);
  const timeLimitSeconds = Math.max(0, options?.timeLimitSeconds ?? cfg.timeLimitSeconds ?? 180);

  const round: StaffChallengeRound = {
    id: `scr_${Date.now()}`,
    type: 'scramble',
    promptDisplay: scrambled,
    answer: rawWord,
    poolPrize: Math.max(0, options?.poolPrize ?? cfg.defaultPrizePool ?? 100),
    entryFee: Math.max(0, options?.entryFee ?? cfg.defaultEntryCost ?? 25),
    taxRatePercentage: Math.max(0, Math.min(100, options?.taxRatePercentage ?? cfg.taxRatePercentage ?? 10)),
    guessLimit: Math.max(0, options?.guessLimit ?? cfg.guessLimit ?? 5),
    guessCooldownSeconds: Math.max(0, options?.guessCooldownSeconds ?? cfg.guessCooldownSeconds ?? 3),
    timeLimitSeconds,
    ...(timeLimitSeconds > 0 ? { expiresAt: Date.now() + timeLimitSeconds * 1000 } : {}),
    participants: new Set(),
    playerGuesses: {},
    lastGuessTime: {},
    status: 'active',
  };

  activeScramble = round;
  if (timeLimitSeconds > 0) {
    scrambleTimerId = setTrackedTimeout(() => {
      if (activeScramble?.id === round.id && activeScramble.status === 'active') {
        activeScramble.status = 'expired';
        mc.world.sendMessage(
          `§6[Scramble] §cTime is up! Nobody unscrambled the word (§e${round.answer.toUpperCase()}§c).`,
        );
      }
    }, timeLimitSeconds * 20);
  }

  const feeStr = round.entryFee > 0 ? formatCurrency(round.entryFee) : 'Free';
  mc.world.sendMessage(
    `§6§l[Scramble] §r§fUnscramble: §b§l${round.promptDisplay}§r §8| §7Pool: §6${formatCurrency(round.poolPrize)} §7(Fee: ${feeStr}) §8— §fUse §a/scramble <word>§f!`,
  );
  return round;
}

export function startFastMathRound(options?: {
  expression?: string;
  answer?: number;
  poolPrize?: number;
  entryFee?: number;
  taxRatePercentage?: number;
  timeLimitSeconds?: number;
  guessLimit?: number;
  guessCooldownSeconds?: number;
}): StaffChallengeRound {
  if (isDefined(fastMathTimerId)) {
    clearTrackedTimeout(fastMathTimerId);
  }
  const cfg = getGamesConfig().fastMath;
  const generated = generateRandomMathProblem();
  const expr = isNonEmptyString(options?.expression?.trim()) ? options!.expression!.trim() : generated.expression;
  const ans = isDefined(options?.answer) && !Number.isNaN(options.answer) ? options.answer : generated.answer;
  const timeLimitSeconds = Math.max(0, options?.timeLimitSeconds ?? cfg.timeLimitSeconds ?? 120);

  const round: StaffChallengeRound = {
    id: `math_${Date.now()}`,
    type: 'fastmath',
    promptDisplay: expr,
    answer: String(ans),
    numericAnswer: ans,
    poolPrize: Math.max(0, options?.poolPrize ?? cfg.defaultPrizePool ?? 100),
    entryFee: Math.max(0, options?.entryFee ?? cfg.defaultEntryCost ?? 25),
    taxRatePercentage: Math.max(0, Math.min(100, options?.taxRatePercentage ?? cfg.taxRatePercentage ?? 10)),
    guessLimit: Math.max(0, options?.guessLimit ?? cfg.guessLimit ?? 3),
    guessCooldownSeconds: Math.max(0, options?.guessCooldownSeconds ?? cfg.guessCooldownSeconds ?? 3),
    timeLimitSeconds,
    ...(timeLimitSeconds > 0 ? { expiresAt: Date.now() + timeLimitSeconds * 1000 } : {}),
    participants: new Set(),
    playerGuesses: {},
    lastGuessTime: {},
    status: 'active',
  };

  activeFastMath = round;
  if (timeLimitSeconds > 0) {
    fastMathTimerId = setTrackedTimeout(() => {
      if (activeFastMath?.id === round.id && activeFastMath.status === 'active') {
        activeFastMath.status = 'expired';
        mc.world.sendMessage(`§6[FastMath] §cTime is up! The answer was §e${round.answer}§c.`);
      }
    }, timeLimitSeconds * 20);
  }

  const feeStr = round.entryFee > 0 ? formatCurrency(round.entryFee) : 'Free';
  mc.world.sendMessage(
    `§b§l[FastMath] §r§fSolve: §e§l${round.promptDisplay}§r §8| §7Pool: §6${formatCurrency(round.poolPrize)} §7(Fee: ${feeStr}) §8— §fUse §a/math <answer>§f!`,
  );
  return round;
}

export function startNumberGuessRound(options?: {
  min?: number;
  max?: number;
  secretNumber?: number;
  poolPrize?: number;
  entryFee?: number;
  taxRatePercentage?: number;
  timeLimitSeconds?: number;
  guessLimit?: number;
  guessCooldownSeconds?: number;
}): StaffChallengeRound {
  if (isDefined(numberGuessTimerId)) {
    clearTrackedTimeout(numberGuessTimerId);
  }
  const cfg = getGamesConfig().numberGuess;
  const min = Math.floor(options?.min ?? cfg.defaultMin ?? 1);
  const max = Math.max(min + 5, Math.floor(options?.max ?? cfg.defaultMax ?? 100));
  const secret =
    isDefined(options?.secretNumber) && options.secretNumber >= min && options.secretNumber <= max
      ? Math.floor(options.secretNumber)
      : Math.floor(Math.random() * (max - min + 1)) + min;
  const timeLimitSeconds = Math.max(0, options?.timeLimitSeconds ?? cfg.timeLimitSeconds ?? 180);

  const round: StaffChallengeRound = {
    id: `num_${Date.now()}`,
    type: 'numberguess',
    promptDisplay: `${min} to ${max}`,
    answer: String(secret),
    numericAnswer: secret,
    minRange: min,
    maxRange: max,
    poolPrize: Math.max(0, options?.poolPrize ?? cfg.defaultPrizePool ?? 100),
    entryFee: Math.max(0, options?.entryFee ?? cfg.defaultEntryCost ?? 25),
    taxRatePercentage: Math.max(0, Math.min(100, options?.taxRatePercentage ?? cfg.taxRatePercentage ?? 10)),
    guessLimit: Math.max(0, options?.guessLimit ?? cfg.guessLimit ?? 8),
    guessCooldownSeconds: Math.max(0, options?.guessCooldownSeconds ?? cfg.guessCooldownSeconds ?? 2),
    timeLimitSeconds,
    ...(timeLimitSeconds > 0 ? { expiresAt: Date.now() + timeLimitSeconds * 1000 } : {}),
    participants: new Set(),
    playerGuesses: {},
    lastGuessTime: {},
    status: 'active',
  };

  activeNumberGuess = round;
  if (timeLimitSeconds > 0) {
    numberGuessTimerId = setTrackedTimeout(() => {
      if (activeNumberGuess?.id === round.id && activeNumberGuess.status === 'active') {
        activeNumberGuess.status = 'expired';
        broadcastToGameChatChannel(
          `§d[NumberGuess] §cTime is up! Nobody guessed the secret number (§e${round.numericAnswer}§c).`,
        );
      }
    }, timeLimitSeconds * 20);
  }

  const feeStr = round.entryFee > 0 ? formatCurrency(round.entryFee) : 'Free';
  mc.world.sendMessage(
    `§d§l[NumberGuess] §r§fGuess the number between §e${min} §fand §e${max}§f! Pool: §6${formatCurrency(round.poolPrize)} §7(Fee: ${feeStr})\n§7Use §a/numguess <number>§7 (auto-joins §dGame Chat /gc§7 so General Chat stays clean; leave anytime with §e/gc leave§7)!`,
  );
  return round;
}

function validateAndChargeRoundEntry(
  round: StaffChallengeRound,
  player: mc.Player,
): { allowed: boolean; error?: string } {
  const now = Date.now();
  if (isDefined(round.expiresAt) && now >= round.expiresAt) {
    round.status = 'expired';
    return { allowed: false, error: '§cThis round has expired.' };
  }

  const lastAt = round.lastGuessTime[player.id] ?? 0;
  if (round.guessCooldownSeconds > 0 && now - lastAt < round.guessCooldownSeconds * 1000) {
    const waitSec = Math.ceil((round.guessCooldownSeconds * 1000 - (now - lastAt)) / 1000);
    return { allowed: false, error: `§cPlease wait ${waitSec}s before guessing again.` };
  }

  const hasJoined = round.participants.has(player.id);
  const used = round.playerGuesses[player.id] ?? 0;
  const needsEntryPayment = !hasJoined || (round.guessLimit > 0 && used >= round.guessLimit);

  if (needsEntryPayment && round.entryFee > 0 && isFeatureActive('eco')) {
    const bal = getBalance(player.id) ?? 0;
    if (bal < round.entryFee) {
      return {
        allowed: false,
        error: `§cYou need ${formatCurrency(round.entryFee)} to ${hasJoined ? 'buy more guesses' : 'enter this round'}.`,
      };
    }
    incrementPlayerBalance(player.id, -round.entryFee);
    round.poolPrize = Math.round((round.poolPrize + round.entryFee) * 100) / 100;
    round.playerGuesses[player.id] = 0;
    player.sendMessage(
      `§e Paid ${formatCurrency(round.entryFee)} entry fee (Prize Pool: §6${formatCurrency(round.poolPrize)}§e).`,
    );
  }

  round.participants.add(player.id);
  round.playerGuesses[player.id] = (round.playerGuesses[player.id] ?? 0) + 1;
  round.lastGuessTime[player.id] = now;
  return { allowed: true };
}

export function submitScrambleAttempt(
  player: mc.Player,
  rawGuess: string,
): { success: boolean; won: boolean; message: string } {
  const round = getActiveScrambleRound();
  if (!isDefined(round)) {
    return { success: false, won: false, message: '§cThere is no active Scramble round.' };
  }

  const entry = validateAndChargeRoundEntry(round, player);
  if (!entry.allowed) {
    return { success: false, won: false, message: entry.error! };
  }

  const clean = rawGuess.trim().toLowerCase();
  if (clean === round.answer) {
    round.status = 'won';
    round.winnerName = player.name;
    if (isDefined(scrambleTimerId)) {
      clearTrackedTimeout(scrambleTimerId);
    }
    const netPrize = payoutGamePrize(player.id, round.poolPrize, round.taxRatePercentage);
    playSound(player, 'random.levelup');
    const prizeTag = netPrize > 0 ? ` and won §6${formatCurrency(netPrize)}§a!` : '!';
    mc.world.sendMessage(
      `§6§l[Scramble] §r§b${player.name} §aunscrambled the word (§e${round.answer.toUpperCase()}§a)${prizeTag}`,
    );
    return { success: true, won: true, message: '' };
  }

  playSound(player, 'note.bass');
  const used = round.playerGuesses[player.id] ?? 1;
  const lim = round.guessLimit > 0 ? `${used}/${round.guessLimit}` : `#${used}`;
  return {
    success: true,
    won: false,
    message: `§cIncorrect unscramble (${lim})! Prompt: §e${round.promptDisplay}`,
  };
}

export function submitFastMathAttempt(
  player: mc.Player,
  numericGuess: number,
): { success: boolean; won: boolean; message: string } {
  const round = getActiveFastMathRound();
  if (!isDefined(round)) {
    return { success: false, won: false, message: '§cThere is no active Fast Math round.' };
  }

  const entry = validateAndChargeRoundEntry(round, player);
  if (!entry.allowed) {
    return { success: false, won: false, message: entry.error! };
  }

  if (numericGuess === round.numericAnswer) {
    round.status = 'won';
    round.winnerName = player.name;
    if (isDefined(fastMathTimerId)) {
      clearTrackedTimeout(fastMathTimerId);
    }
    const netPrize = payoutGamePrize(player.id, round.poolPrize, round.taxRatePercentage);
    playSound(player, 'random.levelup');
    const prizeTag = netPrize > 0 ? ` and won §6${formatCurrency(netPrize)}§a!` : '!';
    mc.world.sendMessage(
      `§b§l[FastMath] §r§e${player.name} §asolved §f${round.promptDisplay} = ${round.numericAnswer}§a${prizeTag}`,
    );
    return { success: true, won: true, message: '' };
  }

  playSound(player, 'note.bass');
  const used = round.playerGuesses[player.id] ?? 1;
  const lim = round.guessLimit > 0 ? `${used}/${round.guessLimit}` : `#${used}`;
  return {
    success: true,
    won: false,
    message: `§cWrong answer (${lim})! Equation: §e${round.promptDisplay}`,
  };
}

export function submitNumberGuessAttempt(
  player: mc.Player,
  guessNum: number,
): { success: boolean; won: boolean; hint?: 'higher' | 'lower'; message: string } {
  const round = getActiveNumberGuessRound();
  if (!isDefined(round) || !isDefined(round.numericAnswer)) {
    return { success: false, won: false, message: '§cThere is no active Number Guess round.' };
  }

  joinGameChatChannel(player.id);

  const entry = validateAndChargeRoundEntry(round, player);
  if (!entry.allowed) {
    player.sendMessage(entry.error!);
    return { success: false, won: false, message: entry.error! };
  }

  if (guessNum === round.numericAnswer) {
    round.status = 'won';
    round.winnerName = player.name;
    if (isDefined(numberGuessTimerId)) {
      clearTrackedTimeout(numberGuessTimerId);
    }
    const netPrize = payoutGamePrize(player.id, round.poolPrize, round.taxRatePercentage);
    playSound(player, 'random.levelup');
    const prizeTag = netPrize > 0 ? ` and won §6${formatCurrency(netPrize)}§a!` : '!';
    const winMsg = `§d§l[NumberGuess] §r§b${player.name} §aguessed the exact number (§e${round.numericAnswer}§a)${prizeTag}`;
    mc.world.sendMessage(winMsg);
    return { success: true, won: true, message: '' };
  }

  const hint: 'higher' | 'lower' = guessNum < round.numericAnswer ? 'higher' : 'lower';
  const used = round.playerGuesses[player.id] ?? 1;
  const lim = round.guessLimit > 0 ? `${used}/${round.guessLimit}` : `#${used}`;
  const hintLabel = hint === 'higher' ? '§a▲ HIGHER' : '§e▼ LOWER';

  playSound(player, 'random.click');
  broadcastToGameChatChannel(
    `§d[GameChat • NumberGuess] §e${player.name} §7guessed §f${guessNum} §8(${lim}) §7-> Target is ${hintLabel}§7! §8(Pool: ${formatCurrency(round.poolPrize)})`,
  );

  return {
    success: true,
    won: false,
    hint,
    message: `§d[NumberGuess] §7Target is ${hintLabel} §7than ${guessNum}!`,
  };
}

export function _clearStaffRoundsForTest(): void {
  activeScramble = undefined;
  activeFastMath = undefined;
  activeNumberGuess = undefined;
}
