import { loadSidebarConfig } from '@core/configurations.js';
import { initializeSidebar } from '@features/sidebar/manager.js';

export async function initialize(isMigration: boolean) {
    await loadSidebarConfig(isMigration);
    initializeSidebar();
}
