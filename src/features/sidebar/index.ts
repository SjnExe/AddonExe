import { serviceLocator } from '@core/services/serviceLocator.js';
import { forceUpdate, initializeSidebar, resolveGlobalPlaceholders } from '@features/sidebar/manager.js';

export async function initialize(isMigration: boolean) {
    initializeSidebar();

    serviceLocator.registerService('sidebar.manager', {
        forceUpdate
    });

    serviceLocator.registerService('sidebar.utils', {
        resolveGlobalPlaceholders
    });

    // Register configurations
    const { resetSidebarConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('sidebar', {
        reset: resetSidebarConfig,
        message: 'The sidebar configuration section has been reset to default.'
    });
}
