import { CommandExecutor, CustomCommand, CustomCommandParamType } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/configurations.js';
import * as mc from '@minecraft/server';
import { gameManager } from '../gameManager.js';
import { WordGuessGame } from '../games/wordGuess.js';

const wordGuessCommand: CustomCommand = {
    name: 'wordguess',
    description: 'Manage Word Guess game.',
    category: 'Games',
    permissionLevel: 1, // Admin
    allowConsole: true,
    parameters: [
        { name: 'action', type: 'string', enumOptions: ['start', 'stop'] },
        { name: 'word', type: 'string', optional: true },
        { name: 'reward', type: 'int', optional: true }
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const gamesConfig = getGamesConfig();
        if (!gamesConfig.enabled) {
            const msg = '§cThe Games system is currently disabled globally.';
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
            return;
        }

        const action = args.action as string;
        const word = args.word as string;
        const reward = args.reward as number | undefined;

        const game = gameManager.getActiveGame('wordGuess') as WordGuessGame | undefined;
        // Ideally we should get the game definition or instance even if not active,
        // but gameManager only tracks active global games.
        // However, startGlobalGame creates a new instance if needed.

        if (action === 'start') {
            if (!word) {
                const msg = '§cUsage: /wordguess start <word> [reward]';
                if (executor instanceof mc.Player) executor.sendMessage(msg);
                else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
                return;
            }

            // We need to access the game instance. If it's already running, we use it.
            // If not, we start it via gameManager.

            // Actually, gameManager.startGlobalGame creates a NEW instance from factory.
            // But WordGuessGame is a singleton logic inside gameManager?
            // No, gameManager stores instances.

            // If a game is already active, we want to interrupt it.
            if (game) {
                game.startCustom(word, reward);
                const msg = `§aInterrupted current game and started custom Word Guess with word: ${word}`;
                if (executor instanceof mc.Player) executor.sendMessage(msg);
                else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
            } else {
                // Start fresh
                gameManager.startGlobalGame('wordGuess', { word, reward, continuous: true });
                const msg = `§aStarted custom Word Guess with word: ${word}`;
                if (executor instanceof mc.Player) executor.sendMessage(msg);
                else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
            }
        } else if (action === 'stop') {
            gameManager.stopGlobalGame('wordGuess');
            const msg = '§aStopped Word Guess game.';
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
        }
    }
};

export default wordGuessCommand;
