import { serviceLocator } from '@core/services/serviceLocator.js';
import { forceUpdate, initializeSidebar, resolveGlobalPlaceholders } from '@features/sidebar/manager.js';

export async function initialize(_isMigration: boolean) {
    const { getSidebarConfig, registerConfigReset, resetSidebarConfig } = await import('@core/configurations.js');

    const current = getSidebarConfig();
    if (current.globalInfo?.sidebarLines?.[0] === '§7----------------' || current.globalInfo?.sidebarLines?.includes('§8━━━━━━━━━━━━━━')) {
        await resetSidebarConfig();
    }

    initializeSidebar();

    serviceLocator.registerService('sidebar.manager', {
        forceUpdate
    });

    serviceLocator.registerService('sidebar.utils', {
        resolveGlobalPlaceholders
    });

    registerConfigReset('sidebar', {
        reset: resetSidebarConfig,
        message: 'The sidebar configuration section has been reset to default.'
    });
}
