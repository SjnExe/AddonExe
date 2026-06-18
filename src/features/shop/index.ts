import { ShopAdminPanelHandler } from '@features/shop/ui/adminPanel.js';
import { ShopUserPanelHandler } from '@features/shop/ui/userPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    panelRouter.register(new ShopAdminPanelHandler());
    panelRouter.register(new ShopUserPanelHandler());

    // Register configurations
    const { loadShopConfig, resetShopConfig, registerConfigReset } = await import('@core/configurations.js');
    await loadShopConfig(isMigration);
    registerConfigReset('shop', {
        reset: resetShopConfig,
        message: 'The shop configuration section has been reset to default.'
    });
}
