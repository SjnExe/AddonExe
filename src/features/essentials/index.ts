import { initialize as initializeFloatingText } from '@features/essentials/floatingText/manager.js';
import { initializeWorldBorder } from '@features/essentials/worldBorder/manager.js';

export async function initialize(_isMigration: boolean) {
  initializeWorldBorder();
  initializeFloatingText();

  // Register configurations
  const { resetWorldProtectionConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('worldProtection', {
    reset: resetWorldProtectionConfig,
    message: 'The World Protection configuration section has been reset to default.',
  });
}
