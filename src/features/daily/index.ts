export async function initialize(_isMigration: boolean) {
    // Empty index for now

    // Register configurations
    const { resetDailyRewardsConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('dailyRewards', {
        reset: resetDailyRewardsConfig,
        message: 'The Daily Rewards configuration section has been reset to default.'
    });
}
