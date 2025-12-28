
import { rpsConfig } from './rpsConfig.js';

import { ticTacToeConfig } from './ticTacToeConfig.js';

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
