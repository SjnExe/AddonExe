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
    wordGuess: {
        enabled: true,
        rewards: {
            money: 100
        },
        // continuous mode usually implies 0 cooldown or short delay
        cooldownSeconds: 5,
        wordList: ['apple', 'block', 'craft', 'diamond', 'elytra', 'farm', 'ghast', 'horse', 'iron', 'jump', 'creeper', 'portal', 'dragon', 'wither', 'beacon']
    } satisfies WordGuessConfig,
    ticTacToe: {
        enabled: true,
        rewards: {
            money: 50
        }
    } satisfies TicTacToeConfig,
    rockPaperScissors: {
        enabled: true,
        rewards: {
            money: 50
        }
    } satisfies RPSConfig,
    diceRoll: {
        enabled: true
    }
};

export default gamesConfig;
