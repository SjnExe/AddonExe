import { serviceLocator } from '@core/services/serviceLocator.js';
import { initialize as initSocial, isFriend } from '@features/social/friends/manager.js';

export async function initialize(_isMigration: boolean) {
  initSocial();

  serviceLocator.registerService('social.friends', {
    isFriend,
  });

  // Register configurations
  const { resetFriendConfig, registerConfigReset } = await import('@core/config/configurations.js');
  registerConfigReset('friend', {
    reset: resetFriendConfig,
    message: 'The friend configuration section has been reset to default.',
  });
}
