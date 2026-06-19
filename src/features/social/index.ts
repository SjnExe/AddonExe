import { initialize as initSocial } from '@features/social/friendManager.js';

export async function initialize(isMigration: boolean) {
    initSocial();

    // Register configurations
    const { loadFriendConfig, resetFriendConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadFriendConfig(isMigration);
    registerConfigReset('friend', {
        reset: resetFriendConfig,
        message: 'The friend configuration section has been reset to default.'
    });
}
