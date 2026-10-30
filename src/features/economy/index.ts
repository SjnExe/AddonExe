import { serviceLocator } from '@core/services/serviceLocator.js';
import { getLeaderboard } from '@features/economy/leaderboardManager.js';

export async function initialize(_isMigration: boolean) {
    serviceLocator.registerService('economy.leaderboard', {
        getLeaderboard
    });

    // Register configurations
    const { resetEconomyConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('economy', {
        reset: resetEconomyConfig,
        message: 'The economy configuration section has been reset to default.'
    });
}
