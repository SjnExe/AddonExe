import { CommandExecutor, CustomCommand } from '@commands/commandManager.js';
import { isDefined, isNonEmptyString } from '@lib/guards.js';
import * as mc from '@minecraft/server';
import { gameManager } from '../gameManager.js';
import { WordGuessGame } from '../games/wordGuess.js';

const guessCommand: CustomCommand = {
    name: 'guess',
    description: 'Make a guess in the Word Guess game.',
    category: 'Games',
    permissionLevel: 1024,
    parameters: [{ name: 'word', type: 'string' }],
    execute: (executor: CommandExecutor, args: Record<string, unknown>) => {
        if (!(executor instanceof mc.Player)) return;
        const word = args.word;

        if (!isNonEmptyString(word)) {
            executor.sendMessage('§cUsage: /guess <word>');
            return;
        }

        const game = gameManager.getActiveGame('wordGuess');
        if (!isDefined(game) || !(game instanceof WordGuessGame)) {
            executor.sendMessage('§cNo Word Guess game is currently active.');
            return;
        }

        game.processGuess(executor, word);
    }
};

export default guessCommand;
