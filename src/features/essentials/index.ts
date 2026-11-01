import { restartAnnouncer } from '@features/essentials/commands/announcement.js';
import { initialize as initializeFloatingText } from '@features/essentials/floatingText/manager.js';
import { initializeLagSweeper } from '@features/essentials/lagSweeper.js';
import { initializeSpawnProtection } from '@features/essentials/protection/spawnProtection.js';
import { initializeSurvivalQoL } from '@features/essentials/survival/index.js';
import { initializeWorldBorder } from '@features/essentials/worldBorder/manager.js';

export async function initialize(_isMigration: boolean) {
  initializeWorldBorder();
  initializeFloatingText();
  initializeSpawnProtection();
  initializeSurvivalQoL();
  initializeLagSweeper();
  restartAnnouncer();

  // Register configurations
  const { resetWorldProtectionConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('worldProtection', {
    reset: resetWorldProtectionConfig,
    message: 'The World Protection configuration section has been reset to default.',
  });
}
