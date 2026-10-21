import * as mc from '@minecraft/server';

import { getWordleConfig } from '@core/config/configurations.js';
import { getAllPlayersFromCache } from '@core/data/playerCache.js';
import { getPlayer, incrementPlayerBalance, updatePlayerData } from '@core/data/playerDataManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { clearTrackedTimeout, setTrackedTimeout } from '@core/utils/timerManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import { generateId } from '@lib/id.js';
import { compressedWordPool } from './wordPool.js';

const solutionLimit = 500;

export function isValidWord(word: string): boolean {
    const len = word.length;
    const pool = compressedWordPool[len];
    if (!isNonEmptyString(pool)) {
        return false;
    }

    const idx = pool.indexOf(word.toLowerCase());
    return idx !== -1 && idx % len === 0;
}

export function getRandomSolution(length: number): string | undefined {
    const pool = compressedWordPool[length];
    if (!isNonEmptyString(pool)) {
        return undefined;
    }

    const maxWordsInPool = pool.length / length;
    if (maxWordsInPool === 0) {
        return undefined;
    }

    const limit = Math.min(maxWordsInPool, solutionLimit);
    const randomIdx = Math.floor(Math.random() * limit) * length;

    return pool.substring(randomIdx, randomIdx + length);
}

export interface GuessResult {
    word: string;
    pattern: string;
    isWin: boolean;
}

export interface StaffWordleOptions {
    entryFee?: number;
    taxRatePercentage?: number;
    timeLimitSeconds?: number;
    guessLimit?: number;
    guessCooldownSeconds?: number;
}

export interface WordleGame {
    id: string;
    word: string;
    guesses: string[];
    maxGuesses: number;
    playerIds: string[];
    startTime: number;
    status: 'active' | 'won' | 'lost';
    isStaffHosted: boolean;
    poolPrize: number;
    entryFee: number;
    taxRatePercentage: number;
    timeLimitSeconds: number;
    expiresAt?: number;
    guessLimit: number;
    guessCooldownSeconds: number;
    playerGuesses: Record<string, number>;
    lastGuessTime: Record<string, number>;
    winnerId?: string;
}

const activeGames = new Map<string, WordleGame>();
const playerGameMap = new Map<string, string>();
let globalStaffGameId: string | undefined;
let staffExpiryTimeoutId: number | undefined;

export function broadcastWordleMessage(message: string): void {
    for (const player of getAllPlayersFromCache()) {
        if (!player.isValid) {
            continue;
        }
        const pData = getPlayer(player.id);
        if (pData?.wordleNotificationsMuted === true) {
            continue;
        }
        player.sendMessage(message);
    }
}

export function toggleWordleNotifications(player: mc.Player): boolean {
    let muted = false;
    updatePlayerData(player.id, (d) => {
        muted = !(d.wordleNotificationsMuted ?? false);
        d.wordleNotificationsMuted = muted;
    });
    return !muted;
}

export function areWordleNotificationsEnabled(playerId: string): boolean {
    const pData = getPlayer(playerId);
    return pData?.wordleNotificationsMuted !== true;
}

export function evaluateGuess(guess: string, answer: string): GuessResult {
    guess = guess.toLowerCase();
    answer = answer.toLowerCase();

    const pattern = Array.from({ length: guess.length }).fill('-');
    const answerChars: (string | null)[] = answer.split('');
    let isWin = true;

    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === answer[i]) {
            pattern[i] = 'g';
            answerChars[i] = null;
        } else {
            isWin = false;
        }
    }

    for (let i = 0; i < guess.length; i++) {
        if (pattern[i] !== 'g') {
            const charIndex = answerChars.indexOf(guess[i] as string);
            if (charIndex !== -1) {
                pattern[i] = 'y';
                answerChars[charIndex] = null;
            }
        }
    }

    return {
        word: guess,
        pattern: pattern.join(''),
        isWin
    };
}

export function createSinglePlayerGame(player: mc.Player, wordLength: number = 5): WordleGame | undefined {
    const word = getRandomSolution(wordLength);
    if (!isNonEmptyString(word)) {
        return undefined;
    }

    const config = getWordleConfig();
    const game: WordleGame = {
        id: generateId('wrd'),
        word,
        guesses: [],
        maxGuesses: config.singlePlayer.defaultLimit,
        playerIds: [player.id],
        startTime: Date.now(),
        status: 'active',
        isStaffHosted: false,
        poolPrize: 0,
        entryFee: config.singlePlayer.cost,
        taxRatePercentage: 0,
        timeLimitSeconds: 0,
        guessLimit: config.singlePlayer.defaultLimit,
        guessCooldownSeconds: 0,
        playerGuesses: {},
        lastGuessTime: {}
    };

    activeGames.set(game.id, game);
    playerGameMap.set(player.id, game.id);
    return game;
}

export function getPlayerActiveGame(player: mc.Player): WordleGame | undefined {
    const gameId = playerGameMap.get(player.id);
    if (isNonEmptyString(gameId)) {
        return activeGames.get(gameId);
    }
    return undefined;
}

export function getStaffHostedGame(): WordleGame | undefined {
    if (isNonEmptyString(globalStaffGameId)) {
        const game = activeGames.get(globalStaffGameId);
        if (isDefined(game) && isDefined(game.expiresAt) && Date.now() >= game.expiresAt) {
            endStaffHostedGame(undefined, true);
            return undefined;
        }
        return game;
    }
    return undefined;
}

export function createStaffHostedGame(word: string, poolPrize: number = 0, options: StaffWordleOptions = {}): WordleGame {
    if (isDefined(staffExpiryTimeoutId)) {
        clearTrackedTimeout(staffExpiryTimeoutId);
        staffExpiryTimeoutId = undefined;
    }

    const cfg = getWordleConfig().staffHosted;
    const entryFee = Math.max(0, options.entryFee ?? cfg.defaultCost ?? 50);
    const taxRatePercentage = Math.max(0, Math.min(100, options.taxRatePercentage ?? cfg.taxRatePercentage ?? 10));
    const timeLimitSeconds = Math.max(0, options.timeLimitSeconds ?? cfg.defaultTimeLimitSeconds ?? 300);
    const guessLimit = Math.max(0, options.guessLimit ?? cfg.guessLimit ?? 6);
    const guessCooldownSeconds = Math.max(0, options.guessCooldownSeconds ?? cfg.guessCooldownSeconds ?? 5);
    const now = Date.now();

    const game: WordleGame = {
        id: generateId('staffwrd'),
        word: word.toLowerCase(),
        guesses: [],
        maxGuesses: 99999,
        playerIds: [],
        startTime: now,
        status: 'active',
        isStaffHosted: true,
        poolPrize: Math.max(0, poolPrize),
        entryFee,
        taxRatePercentage,
        timeLimitSeconds,
        ...(timeLimitSeconds > 0 ? { expiresAt: now + timeLimitSeconds * 1000 } : {}),
        guessLimit,
        guessCooldownSeconds,
        playerGuesses: {},
        lastGuessTime: {}
    };

    globalStaffGameId = game.id;
    activeGames.set(game.id, game);

    if (timeLimitSeconds > 0) {
        const targetId = game.id;
        staffExpiryTimeoutId = setTrackedTimeout(() => {
            if (globalStaffGameId === targetId) {
                endStaffHostedGame(undefined, true);
            }
        }, timeLimitSeconds * 20);
    }

    return game;
}

export function endStaffHostedGame(winnerId?: string, expired = false): void {
    if (isDefined(staffExpiryTimeoutId)) {
        clearTrackedTimeout(staffExpiryTimeoutId);
        staffExpiryTimeoutId = undefined;
    }

    if (isNonEmptyString(globalStaffGameId)) {
        const game = activeGames.get(globalStaffGameId);
        globalStaffGameId = undefined;

        if (isDefined(game)) {
            game.status = isNonEmptyString(winnerId) ? 'won' : 'lost';
            game.winnerId = winnerId;

            if (expired && !isNonEmptyString(winnerId)) {
                broadcastWordleMessage(`§e[Wordle] §cTime is up! Nobody solved the staff-hosted Wordle. The word was §e${game.word.toUpperCase()}§c.`);
            }

            const config = getWordleConfig();
            if (config.staffHosted.unlimitedAutoStart && config.staffHosted.enabled) {
                setTrackedTimeout(() => {
                    const freshConfig = getWordleConfig();
                    if (freshConfig.staffHosted.enabled && !isDefined(getStaffHostedGame())) {
                        const nextWord = getRandomSolution(5) ?? 'apple';
                        const nextGame = createStaffHostedGame(nextWord, 0);
                        broadcastWordleMessage(
                            `§e[Wordle] §aA new Staff-Hosted Wordle round has automatically started! Entry Fee: §6${formatCurrency(nextGame.entryFee)}§a. Type §e/gs <word>§a to join!`
                        );
                    }
                }, 100);
            }
        }
    }
}

export function submitGuess(gameId: string, player: mc.Player, guess: string): GuessResult | string {
    const game = activeGames.get(gameId);
    if (!isDefined(game)) {
        return 'Game not found.';
    }
    if (game.status !== 'active') {
        return 'Game is no longer active.';
    }

    const cleanGuess = guess.trim().toLowerCase();
    if (cleanGuess.length !== game.word.length) {
        return `Word must be exactly ${game.word.length} letters long.`;
    }

    if (!isValidWord(cleanGuess)) {
        return 'Not a valid 5-letter English word.';
    }

    const result = evaluateGuess(cleanGuess, game.word);
    game.guesses.push(cleanGuess);
    game.playerGuesses[player.id] = (game.playerGuesses[player.id] ?? 0) + 1;
    game.lastGuessTime[player.id] = Date.now();

    if (result.isWin) {
        game.status = 'won';
        game.winnerId = player.id;
        if (!game.isStaffHosted) {
            playerGameMap.delete(player.id);
            const config = getWordleConfig();
            if (config.singlePlayer.reward > 0) {
                incrementPlayerBalance(player.id, config.singlePlayer.reward);
                player.sendMessage(`§aYou won ${formatCurrency(config.singlePlayer.reward)} for guessing the word!`);
            }
        } else {
            endStaffHostedGame(player.id);
        }
    } else if (game.guesses.length >= game.maxGuesses) {
        game.status = 'lost';
        if (!game.isStaffHosted) {
            playerGameMap.delete(player.id);
        } else {
            endStaffHostedGame();
        }
    }

    return result;
}

export function formatGuess(guess: string, pattern: string): string {
    let result = '';
    for (let i = 0; i < guess.length; i++) {
        const char = guess[i]?.toUpperCase();
        if (!char) {
            continue;
        }
        if (pattern[i] === 'g') {
            result += `§a${char} `;
        } else if (pattern[i] === 'y') {
            result += `§e${char} `;
        } else {
            result += `§f${char} `;
        }
    }
    return result.trim();
}
