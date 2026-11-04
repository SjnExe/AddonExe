import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { initialize as initializeFloatingText } from '@features/essentials/floatingText/manager.js';
import { initializeLagSweeper } from '@features/essentials/lagSweeper.js';
import { initializeLandClaim } from '@features/essentials/protection/landclaim/manager.js';
import { initializeSpawnProtection } from '@features/essentials/protection/spawnProtection.js';
import { initializeSurvivalQoL } from '@features/essentials/survival/index.js';
import { initializeWorldBorder } from '@features/essentials/worldBorder/manager.js';

/**
 * Initializes world, survival, protection, and essentials systems and registers dynamic configuration resets.
 *
 * @param _isMigration Whether the addon is running in migration mode.
 */
export async function initialize(_isMigration: boolean) {
  initializeWorldBorder();
  initializeFloatingText();
  initializeSpawnProtection();
  initializeLandClaim();
  initializeSurvivalQoL();
  initializeLagSweeper();
  restartAnnouncer();

  // Register configurations
  const { resetWorldProtectionConfig, resetLandClaimConfig, registerConfigReset } =
    await import('@core/config/configurations.js');
  registerConfigReset('worldProtection', {
    reset: resetWorldProtectionConfig,
    message: 'The World Protection configuration section has been reset to default.',
  });
  registerConfigReset('landclaim', {
    reset: resetLandClaimConfig,
    message: 'The land claim configuration section has been reset to default.',
  });
}
