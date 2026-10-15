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
    }
};

export type GamesConfig = typeof gamesConfig;
