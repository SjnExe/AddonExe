import { loadShopConfig } from '@core/configurations.js';
import { ShopAdminPanelHandler } from '@features/shop/ui/adminPanel.js';
import { ShopUserPanelHandler } from '@features/shop/ui/userPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export async function initialize(isMigration: boolean) {
    await loadShopConfig(isMigration);
    panelRouter.register(new ShopAdminPanelHandler());
    panelRouter.register(new ShopUserPanelHandler());
}
