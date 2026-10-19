import { serviceLocator } from '@core/services/serviceLocator.js';
import { loadBounties } from '@features/economy/bountyManager.js';
import { getLeaderboard } from '@features/economy/leaderboardManager.js';

export async function initialize(_isMigration: boolean) {
    loadBounties();
    serviceLocator.registerService('economy.leaderboard', {
        getLeaderboard
    });

    // Register configurations
    const { resetEconomyConfig, registerConfigReset } = await import('@core/config/configurations.js');
    registerConfigReset('economy', {
        reset: resetEconomyConfig,
        message: 'The economy configuration section has been reset to default.'
    });
}
