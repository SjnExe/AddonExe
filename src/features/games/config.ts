export const gamesConfig = {
  enabled: true,
  wordle: {
    enabled: true,
  },
  ticTacToe: {
    enabled: true,
    requireFriends: true,
    inviteTimeoutSeconds: 60,
    turnTimeoutSeconds: 45,
    allowWagers: true,
  },
  rps: {
    enabled: true,
    bestOfRounds: 3,
    turnTimeoutSeconds: 30,
    allowWagers: true,
  },
  minesweeper: {
    enabled: true,
    easyReward: 50,
    easySpeedBonusMax: 50,
    easyParSeconds: 180,
    mediumReward: 150,
    mediumSpeedBonusMax: 100,
    mediumParSeconds: 300,
    hardReward: 400,
    hardSpeedBonusMax: 250,
    hardParSeconds: 480,
    allowWagers: true,
  },
};

export type GamesConfig = typeof gamesConfig;
