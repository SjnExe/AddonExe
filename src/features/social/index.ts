import { serviceLocator } from '@core/services/serviceLocator.js';
import { initialize as initSocial, isFriend } from '@features/social/friends/manager.js';
import { initializeLandClaim } from '@features/social/landclaim/manager.js';

export async function initialize(_isMigration: boolean) {
  initSocial();
  initializeLandClaim();

  serviceLocator.registerService('social.friends', {
    isFriend,
  });

  // Register configurations
  const { resetFriendConfig, resetLandClaimConfig, registerConfigReset } =
    await import('@core/config/configurations.js');
  registerConfigReset('friend', {
    reset: resetFriendConfig,
    message: 'The friend configuration section has been reset to default.',
  });
  registerConfigReset('landclaim', {
    reset: resetLandClaimConfig,
    message: 'The land claim configuration section has been reset to default.',
  });
}
