import { WorldProtectionPanelHandler } from '@features/essentials/ui/worldProtectionPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    panelRouter.register(new WorldProtectionPanelHandler());

    // Register configurations
    const { loadWorldProtectionConfig, resetWorldProtectionConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadWorldProtectionConfig(isMigration);
    registerConfigReset('worldProtection', {
        reset: resetWorldProtectionConfig,
        message: 'The World Protection configuration section has been reset to default.'
    });
}
