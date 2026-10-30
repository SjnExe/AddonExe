import { getWordleConfig } from '@core/configurations.js';
import * as mc from '@minecraft/server';
import { getRandomSolution, isValidWord } from './wordPool.js';

export interface GuessResult {
    word: string;
    // 'g' for green (correct), 'y' for yellow (wrong place), '-' for gray (not in word)
    pattern: string;
    isWin: boolean;
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
    poolPrize?: number;
    winnerId?: string;
}

const activeGames = new Map<string, WordleGame>();
let globalStaffGameId: string | undefined = undefined;

let _fallbackGameIdCounter = 0;

function generateGameId(): string {
    _fallbackGameIdCounter = (_fallbackGameIdCounter + 1) % 100000;
    // Combine timestamp, a counter, and Math.random() as the most practical
    // unique id generation method for QuickJS engine without crypto API.
    const timePart = Date.now().toString(36);
    const randPart = Math.random().toString(36).substring(2, 6);
    return `${timePart}-${_fallbackGameIdCounter}-${randPart}`;
}

export function evaluateGuess(guess: string, answer: string): GuessResult {
    guess = guess.toLowerCase();
    answer = answer.toLowerCase();

    const pattern = new Array(guess.length).fill('-');
    const answerChars: (string | null)[] = answer.split('');
    let isWin = true;

    // First pass: Find exact matches (Green)
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === answer[i]) {
            pattern[i] = 'g';
            answerChars[i] = null; // Mark as used
        } else {
            isWin = false;
        }
    }

    // Second pass: Find wrong place matches (Yellow)
    for (let i = 0; i < guess.length; i++) {
        if (pattern[i] !== 'g') {
            const charIndex = answerChars.indexOf(guess[i] as string);
            if (charIndex !== -1) {
                pattern[i] = 'y';
                answerChars[charIndex] = null; // Mark as used
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
    if (!word) return undefined;

    const config = getWordleConfig();
    const game: WordleGame = {
        id: generateGameId(),
        word,
        guesses: [],
        maxGuesses: config.singlePlayer.defaultLimit,
        playerIds: [player.id],
        startTime: Date.now(),
        status: 'active',
        isStaffHosted: false
    };

    activeGames.set(game.id, game);
    // Overwrite previous active singleplayer game if needed
    // Assuming 1 game per player, we can just map player id to game id
    playerGameMap.set(player.id, game.id);
    return game;
}

const playerGameMap = new Map<string, string>();

export function getPlayerActiveGame(player: mc.Player): WordleGame | undefined {
    const gameId = playerGameMap.get(player.id);
    if (gameId) {
        return activeGames.get(gameId);
    }
    return undefined;
}

export function getStaffHostedGame(): WordleGame | undefined {
    if (globalStaffGameId) {
        return activeGames.get(globalStaffGameId);
    }
    return undefined;
}

export function createStaffHostedGame(word: string, poolPrize: number = 0): WordleGame {
    const game: WordleGame = {
        id: 'staff_game',
        word: word.toLowerCase(),
        guesses: [],
        maxGuesses: 99999, // unlimited guesses for global
        playerIds: [], // everyone can play
        startTime: Date.now(),
        status: 'active',
        isStaffHosted: true,
        poolPrize
    };

    globalStaffGameId = game.id;
    activeGames.set(game.id, game);
    return game;
}

export function endStaffHostedGame(winnerId?: string) {
    if (globalStaffGameId) {
        const game = activeGames.get(globalStaffGameId);
        if (game) {
            game.status = winnerId ? 'won' : 'lost';
            game.winnerId = winnerId;
            const config = getWordleConfig();
            if (config.staffHosted.unlimitedAutoStart) {
                // Inline to avoid cyclical dependency without require
                const defaultWord = 'apple';
                mc.system.runTimeout(() => {
                    if (config.staffHosted.enabled) {
                        createStaffHostedGame(defaultWord, 0);
                        mc.world.sendMessage(`§e[Wordle] A new staff hosted game has automatically started! Type §a/gs <word>§e to join.`);
                    }
                }, 100);
            }
        }
        globalStaffGameId = undefined;
    }
}

import { incrementPlayerBalance } from '@core/playerDataManager.js';

export function submitGuess(gameId: string, player: mc.Player, guess: string): GuessResult | string {
    const game = activeGames.get(gameId);
    if (!game) return 'Game not found.';
    if (game.status !== 'active') return 'Game is no longer active.';

    if (guess.length !== game.word.length) {
        return `Word must be exactly ${game.word.length} letters long.`;
    }

    if (!isValidWord(guess)) {
        return 'Not a valid word.';
    }

    const result = evaluateGuess(guess, game.word);
    game.guesses.push(guess);

    if (result.isWin) {
        game.status = 'won';
        game.winnerId = player.id;
        if (!game.isStaffHosted) {
            playerGameMap.delete(player.id);
            const config = getWordleConfig();
            if (config.singlePlayer.reward > 0) {
                incrementPlayerBalance(player.id, config.singlePlayer.reward);
                player.sendMessage(`§aYou won $${config.singlePlayer.reward} for guessing the word!`);
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

// Utility to format pattern nicely
export function formatGuess(guess: string, pattern: string): string {
    let result = '';
    for (let i = 0; i < guess.length; i++) {
        const char = guess[i]?.toUpperCase();
        if (!char) continue;
        if (pattern[i] === 'g') {
            result += `§a${char} `;
        } else if (pattern[i] === 'y') {
            result += `§e${char} `;
        } else {
            result += `§f${char} `; // Changed from §7 to §f for visibility
        }
    }
    return result.trim();
}
