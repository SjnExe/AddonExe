// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
// eslint-disable-next-line import/no-unresolved
import { rpsConfig } from './rpsConfig.js';
// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
// eslint-disable-next-line import/no-unresolved
import { ticTacToeConfig } from './ticTacToeConfig.js';
// @ts-expect-error - Importing from the compiled output file name to ensure runtime compatibility
// eslint-disable-next-line import/no-unresolved
import { wordGuessConfig } from './wordGuessConfig.js';

interface BaseGameConfig {
    enabled: boolean;
}

interface RPSConfig extends BaseGameConfig {
    rewards: {
        money: number;
    };
}

interface TicTacToeConfig extends BaseGameConfig {
    rewards: {
        money: number;
    };
}

interface WordGuessConfig extends BaseGameConfig {
    rewards: {
        money: number;
    };
    cooldownSeconds: number;
    wordList: string[];
}

export const gamesConfig = {
    enabled: true,
    wordGuess: wordGuessConfig as WordGuessConfig,
    ticTacToe: ticTacToeConfig as TicTacToeConfig,
    rockPaperScissors: rpsConfig as RPSConfig,
    diceRoll: {
        enabled: true
    }
};

export default gamesConfig;
