import { initializeSidebar } from '@features/sidebar/manager.js';

export async function initialize(isMigration: boolean) {
    initializeSidebar();

    // Register configurations
    const { loadSidebarConfig, resetSidebarConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadSidebarConfig(isMigration);
    registerConfigReset('sidebar', {
        reset: resetSidebarConfig,
        message: 'The sidebar configuration section has been reset to default.'
    });
}
