import { initializeTempRanks } from '@features/ranks/tempRankManager.js';

/**
 * Initializes ranks subsystem and temporary rank expiry tracking.
 *
 * @param _isMigration Whether initialization runs during a version migration.
 */
export async function initialize(_isMigration: boolean) {
  initializeTempRanks();
  // Register configurations
  const { resetRanksConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('ranks', {
    reset: resetRanksConfig,
    message: 'The ranks configuration section has been reset to default.',
  });
}
