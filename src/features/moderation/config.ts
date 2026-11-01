export const moderationMainDefaults = {
  reports: {
    resolvedReportLifetimeDays: 7,
  },
  chat: {
    enabled: true,
    allowMentions: true,
    logToConsole: false,
    loggingEnabled: true,
    logExpirationDays: 7,
    cooldownSeconds: 2,
    preventDuplicateMessages: true,
    maxCapsPercentage: 70,
    blockedWords: ['badword1', 'badword2'],
  },
};

export default moderationMainDefaults;
