// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
// eslint-disable-next-line import/no-unresolved
import { rpsConfig } from './rpsConfig.js';
// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
// eslint-disable-next-line import/no-unresolved
import { ticTacToeConfig } from './ticTacToeConfig.js';
// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
// eslint-disable-next-line import/no-unresolved
import { wordGuessConfig } from './wordGuessConfig.js';

interface GameConfig {
    enabled: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

export const gamesConfig = {
    enabled: true,
    wordGuess: wordGuessConfig as unknown as GameConfig,
    ticTacToe: ticTacToeConfig as unknown as GameConfig,
    rockPaperScissors: rpsConfig as unknown as GameConfig,
    diceRoll: {
        enabled: true
    }
};

export default gamesConfig;
