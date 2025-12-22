import { rpsConfig } from './rpsConfig.js';
import { ticTacToeConfig } from './ticTacToeConfig.js';
import { wordGuessConfig } from './wordGuessConfig.js';

export const gamesConfig = {
    enabled: true,
    wordGuess: wordGuessConfig,
    ticTacToe: ticTacToeConfig,
    rockPaperScissors: rpsConfig,
    diceRoll: {
        enabled: true
    }
};
