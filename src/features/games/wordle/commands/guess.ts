import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getWordleConfig } from '@core/config/configurations.js';
import { getBalance, incrementPlayerBalance } from '@core/data/playerDataManager.js';
import { formatCurrency } from '@core/utils/index.js';
import { broadcastWordleMessage, formatGuess, getStaffHostedGame, isValidWord, submitGuess } from '@features/games/wordle/manager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';

const pendingConfirmations = new Map<string, string>();

const guessCommand: CustomCommand = {
    name: 'guess',
    aliases: ['gs'],
    description: 'Guess the word for the global staff-hosted Wordle game.',
    category: 'Games',
    permissionNode: 'cmd.guess.member',
    parameters: [{ name: 'word', type: 'string', optional: false }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) {
            return;
        }
        const config = getWordleConfig();
        if (!config.enabled || !config.staffHosted.enabled) {
            executor.sendMessage('§cStaff-hosted Wordle is currently disabled.');
            return;
        }

        const game = getStaffHostedGame();
        if (!isDefined(game)) {
            executor.sendMessage('§cThere is no active staff-hosted Wordle game.');
            return;
        }

        const rawWord = args['word'] as string | undefined;
        if (!isNonEmptyString(rawWord)) {
            executor.sendMessage('§cUsage: /guess <word>');
            return;
        }

        const guessWord = rawWord.trim().toLowerCase();

        // 1. Check per-player guess cooldown first
        const now = Date.now();
        const lastGuessAt = game.lastGuessTime[executor.id] ?? 0;
        if (game.guessCooldownSeconds > 0 && now - lastGuessAt < game.guessCooldownSeconds * 1000) {
            const waitSec = Math.ceil((game.guessCooldownSeconds * 1000 - (now - lastGuessAt)) / 1000);
            executor.sendMessage(`§cPlease wait ${waitSec}s before submitting another guess.`);
            return;
        }

        // 2. Validate word length and dictionary before charging any entry fee
        if (guessWord.length !== game.word.length) {
            executor.sendMessage(`§cWord must be exactly ${game.word.length} letters long.`);
            return;
        }
        if (!isValidWord(guessWord)) {
            executor.sendMessage('§cNot a valid 5-letter English word.');
            return;
        }

        // 3. Check entry fee & guess limit re-entry fee
        const cost = game.entryFee;
        const hasJoined = game.playerIds.includes(executor.id);
        const usedGuesses = game.playerGuesses[executor.id] ?? 0;
        const exceededGuessLimit = hasJoined && game.guessLimit > 0 && usedGuesses >= game.guessLimit;

        if (cost > 0 && (!hasJoined || exceededGuessLimit)) {
            const confirmKey = `${game.id}:${exceededGuessLimit ? 'rebuy' : 'join'}`;
            if (pendingConfirmations.get(executor.id) !== confirmKey) {
                pendingConfirmations.set(executor.id, confirmKey);
                if (exceededGuessLimit) {
                    executor.sendMessage(`§e[Wordle] You used all ${game.guessLimit} guesses! Type §a/gs ${guessWord} §eagain to pay ${formatCurrency(cost)} for ${game.guessLimit} more guesses.`);
                } else {
                    const limitInfo = game.guessLimit > 0 ? `${game.guessLimit} guesses` : 'unlimited guesses';
                    executor.sendMessage(`§e[Wordle] Entry fee is ${formatCurrency(cost)} (${limitInfo}). Type §a/gs ${guessWord} §eagain to confirm and join.`);
                }
                return;
            }

            const balance = getBalance(executor.id) ?? 0;
            if (balance < cost) {
                executor.sendMessage(`§cInsufficient funds. You need ${formatCurrency(cost)} to enter.`);
                pendingConfirmations.delete(executor.id);
                return;
            }

            incrementPlayerBalance(executor.id, -cost);
            pendingConfirmations.delete(executor.id);

            if (!hasJoined) {
                game.playerIds.push(executor.id);
            }
            game.playerGuesses[executor.id] = 0;
            game.poolPrize = Math.round((game.poolPrize + cost) * 100) / 100;

            broadcastWordleMessage(
                `§e[Wordle] §b${executor.name} §f${exceededGuessLimit ? 're-entered' : 'joined'} the Wordle round (+${formatCurrency(cost)})! New Prize Pool: §6${formatCurrency(game.poolPrize)}§f!`
            );
        } else if (!hasJoined) {
            game.playerIds.push(executor.id);
            game.playerGuesses[executor.id] = 0;
        }

        const result = submitGuess(game.id, executor, guessWord);
        if (typeof result === 'string') {
            executor.sendMessage(`§c${result}`);
            return;
        }

        let correctCount = 0;
        let differentPlaceCount = 0;
        for (let i = 0; i < result.pattern.length; i++) {
            if (result.pattern[i] === 'g') {
                correctCount++;
            } else if (result.pattern[i] === 'y') {
                differentPlaceCount++;
            }
        }

        const currentUsed = game.playerGuesses[executor.id] ?? 1;
        const limitTag = game.guessLimit > 0 ? `${currentUsed}/${game.guessLimit}` : `#${currentUsed}`;

        // Private exact Wordle feedback to the guessing player
        executor.sendMessage(`§e[Wordle] §7Your Guess (${limitTag}): §r${formatGuess(result.word, result.pattern)}`);

        // Vague global summary to players with Wordle notifications on
        broadcastWordleMessage(`§e[Wordle] §b${executor.name} §fguessed a word! §a${correctCount} correct§f, §e${differentPlaceCount} in wrong place§f.`);

        if (result.isWin) {
            const grossPool = game.poolPrize;
            const taxAmount = game.taxRatePercentage > 0 ? Math.round(grossPool * (game.taxRatePercentage / 100) * 100) / 100 : 0;
            const netPrize = Math.max(0, Math.round((grossPool - taxAmount) * 100) / 100);

            if (netPrize > 0) {
                incrementPlayerBalance(executor.id, netPrize);
            }

            const prizeSuffix = netPrize > 0 ? ` and won §6${formatCurrency(netPrize)}§a${taxAmount > 0 ? ` §7(${formatCurrency(grossPool)} pool - ${game.taxRatePercentage}% tax)` : ''}!` : '!';
            broadcastWordleMessage(`§e[Wordle] §b${executor.name} §ahas guessed the secret word (§e${game.word.toUpperCase()}§a)${prizeSuffix}`);
        }
    }
};

export default guessCommand;
