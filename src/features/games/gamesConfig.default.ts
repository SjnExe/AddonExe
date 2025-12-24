// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
import { rpsConfig } from './rpsConfig.js';
// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
import { ticTacToeConfig } from './ticTacToeConfig.js';
// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
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

export default gamesConfig;
