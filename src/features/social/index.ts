import { serviceLocator } from '@core/services/serviceLocator.js';
import { initialize as initSocial, isFriend } from '@features/social/friendManager.js';

export async function initialize(_isMigration: boolean) {
    initSocial();

    serviceLocator.registerService('social.friends', {
        isFriend
    });

    // Register configurations
    const { resetFriendConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('friend', {
        reset: resetFriendConfig,
        message: 'The friend configuration section has been reset to default.'
    });
}
