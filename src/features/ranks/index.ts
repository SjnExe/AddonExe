export async function initialize(_isMigration: boolean) {
    // Register configurations
    const { resetRanksConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('ranks', {
        reset: resetRanksConfig,
        message: 'The ranks configuration section has been reset to default.'
    });
}
