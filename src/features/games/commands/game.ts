import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { getGamesConfig } from '@core/configurations.js';
import * as mc from '@minecraft/server';
import { gameManager } from '../gameManager.js';

const gameCommand: CustomCommand = {
    name: 'game',
    description: 'Manage server games.',
    category: 'Games',
    permissionLevel: 1, // Admin
    allowConsole: true,
    parameters: [
        { name: 'action', type: 'string', enumOptions: ['start', 'stop'] },
        { name: 'gameId', type: 'string', enumOptions: ['wordGuess', 'diceRoll', 'ticTacToe'] },
        { name: 'arg1', type: 'string', optional: true } // Custom word
    ],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        const action = args.action as string;
        const gameId = args.gameId as string;
        const arg1 = args.arg1 as string;

        const gamesConfig = getGamesConfig();
        if (!gamesConfig.enabled) {
            const msg = '§cThe Games system is currently disabled globally.';
            if (executor instanceof mc.Player) executor.sendMessage(msg);
            else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
            return;
        }

        if (action === 'start') {
            const config: Record<string, unknown> = { word: arg1 };

            // Check individual game enabled status
            const specificGameConfig = (gamesConfig as unknown as Record<string, { enabled?: boolean }>)[gameId];
            if (specificGameConfig && specificGameConfig.enabled === false) {
                const msg = `§cGame '${gameId}' is disabled in configuration.`;
                if (executor instanceof mc.Player) executor.sendMessage(msg);
                else (executor as { sendMessage: (s: string) => void }).sendMessage(msg);
                return;
            }

            if (gameId === 'wordGuess' && !arg1) {
                const words = gamesConfig.wordGuess.wordList;
                config.word = words[Math.floor(Math.random() * words.length)];
            }

            if (gameManager.startGlobalGame(gameId, config)) {
                if (executor instanceof mc.Player) executor.sendMessage(`§aStarted ${gameId}.`);
                else (executor as { sendMessage: (s: string) => void }).sendMessage(`§aStarted ${gameId}.`);
            } else {
                if (executor instanceof mc.Player) executor.sendMessage(`§cFailed to start ${gameId}.`);
                else (executor as { sendMessage: (s: string) => void }).sendMessage(`§cFailed to start ${gameId}.`);
            }
        } else if (action === 'stop') {
            gameManager.stopGlobalGame(gameId);
            if (executor instanceof mc.Player) executor.sendMessage(`§aStopped ${gameId}.`);
            else (executor as { sendMessage: (s: string) => void }).sendMessage(`§aStopped ${gameId}.`);
        }
    }
};

export default gameCommand;
