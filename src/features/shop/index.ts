export async function initialize(_isMigration: boolean) {
    // Register configurations
    const { resetShopConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('shop', {
        reset: resetShopConfig,
        message: 'The shop configuration section has been reset to default.'
    });
}
