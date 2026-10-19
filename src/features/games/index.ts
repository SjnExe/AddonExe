import { initializeMatchmaking } from '@features/games/matchmakingManager.js';
import { initializeTicTacToe } from '@features/games/tictactoe/manager.js';

export async function initialize(_isMigration: boolean): Promise<void> {
    const { resetGamesConfig, registerConfigReset, resetWordleConfig } = await import('@core/config/configurations.js');
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
}
