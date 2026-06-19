export async function initialize(isMigration: boolean) {
    // Register configurations
    const { loadRanksConfig, resetRanksConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadRanksConfig(isMigration);
    registerConfigReset('ranks', {
        reset: resetRanksConfig,
        message: 'The ranks configuration section has been reset to default.'
    });
}
