import { wordGuessConfig } from './wordGuessConfig.js';
import { ticTacToeConfig } from './ticTacToeConfig.js';
import { rpsConfig } from './rpsConfig.js';

export const gamesConfig = {
    enabled: true,
    wordGuess: wordGuessConfig,
    ticTacToe: ticTacToeConfig,
    rockPaperScissors: rpsConfig,
    diceRoll: {
        enabled: true
    }
};
