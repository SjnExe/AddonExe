export const wordleConfig = {
    enabled: true,
    singlePlayer: {
        enabled: true,
        cost: 0,
        reward: 75,
        defaultLimit: 6
    },
    multiplayer: {
        enabled: true,
        defaultLimit: 6,
        timeLimitSeconds: 120
    },
    staffHosted: {
        enabled: true,
        taxRatePercentage: 10,
        unlimitedAutoStart: false,
        defaultCost: 50,
        defaultTimeLimitSeconds: 300,
        guessCooldownSeconds: 5,
        guessLimit: 6
    }
};

export type WordleConfig = typeof wordleConfig;
