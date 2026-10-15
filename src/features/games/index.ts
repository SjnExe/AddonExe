import { initializeMatchmaking } from './matchmakingManager.js';
import { initializeTicTacToe } from './tictactoe/ticTacToeManager.js';

export async function initialize(_isMigration: boolean) {
    const { resetGamesConfig, registerConfigReset, resetWordleConfig } = await import('@core/configurations.js');
    registerConfigReset('games', {
        reset: resetGamesConfig,
        message: 'The games configuration section has been reset to default.'
    });

    registerConfigReset('wordle', {
        reset: resetWordleConfig,
        message: 'The wordle configuration section has been reset to default.'
    });

    initializeMatchmaking();
    initializeTicTacToe();

    const { registerWordleCommands } = await import('./wordle/commands/wordle.js');
    registerWordleCommands();

    const { registerGuessCommand } = await import('./wordle/commands/guess.js');
    registerGuessCommand();
}
