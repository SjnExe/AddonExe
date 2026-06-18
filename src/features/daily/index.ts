export async function initialize(isMigration: boolean) {
    // Empty index for now

    // Register configurations
    const { loadDailyRewardsConfig, resetDailyRewardsConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadDailyRewardsConfig(isMigration);
    registerConfigReset('dailyRewards', {
        reset: resetDailyRewardsConfig,
        message: 'The Daily Rewards configuration section has been reset to default.'
    });
}
