export const gamesConfig = {
    enabled: true,
    wordle: {
        enabled: true
    },
    ticTacToe: {
        enabled: true,
        requireFriends: true,
        inviteTimeoutSeconds: 60,
        turnTimeoutSeconds: 45,
        allowWagers: true
    },
    rps: {
        enabled: true,
        bestOfRounds: 3,
        turnTimeoutSeconds: 30,
        allowWagers: true
    },
    minesweeper: {
        enabled: true,
        easyReward: 5,
        easySpeedBonusMax: 5,
        easyParSeconds: 180,
        mediumReward: 15,
        mediumSpeedBonusMax: 10,
        mediumParSeconds: 300,
        hardReward: 30,
        hardSpeedBonusMax: 20,
        hardParSeconds: 480,
        allowWagers: true
    }
};

export type GamesConfig = typeof gamesConfig;
