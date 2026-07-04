import { WorldProtectionPanelHandler } from '@features/essentials/ui/worldProtectionPanel.js';
import { initializeWorldBorder } from '@features/essentials/worldBorderManager.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(_isMigration: boolean) {
    panelRouter.register(new WorldProtectionPanelHandler());
    initializeWorldBorder();

    // Register configurations
    const { resetWorldProtectionConfig, registerConfigReset } = await import('@core/configurations.js');
    registerConfigReset('worldProtection', {
        reset: resetWorldProtectionConfig,
        message: 'The World Protection configuration section has been reset to default.'
    });
}
