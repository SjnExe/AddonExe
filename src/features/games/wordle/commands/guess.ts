import { commandManager, CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getStaffHostedGame, submitGuess } from '../wordleManager.js';
import { getWordleConfig } from '@core/configurations.js';
import { getBalance, incrementPlayerBalance } from '@core/playerDataManager.js';
import * as mc from '@minecraft/server';

const pendingConfirmations = new Map<string, string>(); // playerId -> gameId

export function registerGuessCommand() {
    commandManager.register({
        name: 'guess',
        aliases: ['gs'],
        description: 'Guess the word for the global staff-hosted Wordle game.',
        permissionNode: 'command.member',
        parameters: [{ name: 'word', type: 'string', optional: false }],
        execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
            if (!(executor instanceof mc.Player)) return;
            const config = getWordleConfig();
            if (!config.enabled || !config.staffHosted.enabled) {
                executor.sendMessage('§cStaff-hosted Wordle is currently disabled.');
                return;
            }

            const game = getStaffHostedGame();
            if (!game) {
                executor.sendMessage('§cThere is no active staff-hosted game.');
                return;
            }

            const guessWord = args['word'] as string;

            if (!guessWord) {
                executor.sendMessage('§cUsage: /guess <word>');
                return;
            }

            // Handle entry fee confirmation
            const cost = config.staffHosted.defaultCost;

            // To properly track if they played this game:
            const hasPlayedThisGame = game.playerIds.includes(executor.id);

            if (cost > 0 && !hasPlayedThisGame) {
                const confirmationGameId = pendingConfirmations.get(executor.id);
                if (confirmationGameId !== game.id) {
                    pendingConfirmations.set(executor.id, game.id);
                    executor.sendMessage(`§e[Wordle] This game has a $${cost} entry fee. Type §a/gs ${guessWord} §eagain to confirm and pay.`);
                    return;
                }

                // Confirm pay
                const balance = getBalance(executor.id);
                if (balance === undefined || balance < cost) {
                    executor.sendMessage('§cYou do not have enough money to enter this game.');
                    pendingConfirmations.delete(executor.id);
                    return;
                }

                incrementPlayerBalance(executor.id, -cost); // Using incrementPlayerBalance with negative value to decrement
                pendingConfirmations.delete(executor.id);
                game.playerIds.push(executor.id);

                const tax = Math.floor(cost * (config.staffHosted.taxRatePercentage / 100));
                const addToPool = cost - tax;
                if (game.poolPrize !== undefined) {
                    game.poolPrize += addToPool;
                }
            }

            const result = submitGuess(game.id, executor, guessWord);
            if (typeof result === 'string') {
                executor.sendMessage(`§c${result}`);
                return;
            }

            // Broadcast the result to everyone, but hide the exact letters.
            // Example broadcast: "Player guessed a word! 3 correct, 2 in different place"
            let correctCount = 0;
            let differentPlaceCount = 0;
            for (let i = 0; i < result.pattern.length; i++) {
                if (result.pattern[i] === 'g') correctCount++;
                if (result.pattern[i] === 'y') differentPlaceCount++;
            }

            mc.world.sendMessage(`§e[Wordle] §b${executor.name} §fguessed a word! §a${correctCount} correct§f, §e${differentPlaceCount} in different place§f.`);

            if (result.isWin) {
                mc.world.sendMessage(`§e[Wordle] §b${executor.name} §ahas guessed the correct word!`);
                if (game.poolPrize && game.poolPrize > 0) {
                    incrementPlayerBalance(executor.id, game.poolPrize);
                    mc.world.sendMessage(`§e[Wordle] §b${executor.name} §awon the pool prize of §6$${game.poolPrize}§a!`);
                }
            }
        }
    } as CustomCommand);
}
