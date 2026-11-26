import { serviceLocator } from '@core/services/serviceLocator.js';
import { loadBounties } from '@features/economy/bounty/manager.js';
import { loadChestShops } from '@features/economy/chestShop/manager.js';
import { initializeJobs } from '@features/economy/jobs/manager.js';
import { getLeaderboard } from '@features/economy/leaderboard.js';
import { initializePlaytimeRewards } from '@features/economy/playtime/manager.js';

/**
 * Initializes economy subsystems including bounties, chest shops, jobs, and playtime rewards.
 *
 * @param _isMigration Whether initialization runs during a version migration.
 */
export async function initialize(_isMigration: boolean) {
  loadBounties();
  loadChestShops();
  initializeJobs();
  initializePlaytimeRewards();
  serviceLocator.registerService('economy.leaderboard', {
    getLeaderboard,
  });

  // Register configurations
  const { resetEconomyConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('economy', {
    reset: resetEconomyConfig,
    message: 'The economy configuration section has been reset to default.',
  });
}
