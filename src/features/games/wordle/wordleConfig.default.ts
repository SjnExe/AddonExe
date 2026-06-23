export const wordleConfig = {
    enabled: true,
    singlePlayer: {
        enabled: true,
        cost: 0,
        reward: 10,
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
        defaultTimeLimitSeconds: 120
    }
};

export type WordleConfig = typeof wordleConfig;
