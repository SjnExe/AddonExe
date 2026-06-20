import { serviceLocator } from '@core/services/serviceLocator.js';
import { initialize as initSocial, isFriend } from '@features/social/friendManager.js';

export async function initialize(isMigration: boolean) {
    initSocial();

    serviceLocator.registerService('social.friends', {
        isFriend
    });

    // Register configurations
    const { loadFriendConfig, resetFriendConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadFriendConfig(isMigration);
    registerConfigReset('friend', {
        reset: resetFriendConfig,
        message: 'The friend configuration section has been reset to default.'
    });
}
