import { initializeCodebreaker } from '@features/games/codebreaker/manager.js';
import { initializeCoinFlip } from '@features/games/coinflip/manager.js';
import { initializeConnect4 } from '@features/games/connect4/manager.js';
import { initializeMatchmaking } from '@features/games/matchmakingManager.js';
import { initializeMinesweeper } from '@features/games/minesweeper/manager.js';
import { initializeRps } from '@features/games/rps/manager.js';
import { initializeStaffRounds } from '@features/games/staffRounds/manager.js';
import { initializeTicTacToe } from '@features/games/tictactoe/manager.js';
import { initializeWordleMultiplayer } from '@features/games/wordle/manager.js';

export async function initialize(_isMigration: boolean): Promise<void> {
  const { resetGamesConfig, registerConfigReset, resetWordleConfig } = await import('@core/config/configurations.js');
  registerConfigReset('games', {
    reset: resetGamesConfig,
    message: 'The games configuration section has been reset to default.',
  });

  registerConfigReset('wordle', {
    reset: resetWordleConfig,
    message: 'The wordle configuration section has been reset to default.',
  });

  initializeMatchmaking();
  initializeCoinFlip();
  initializeConnect4();
  initializeCodebreaker();
  initializeStaffRounds();
  initializeTicTacToe();
  initializeRps();
  initializeMinesweeper();
  initializeWordleMultiplayer();
}
