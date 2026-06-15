import { ShopAdminPanelHandler } from '@features/shop/ui/adminPanel.js';
import { ShopUserPanelHandler } from '@features/shop/ui/userPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new ShopAdminPanelHandler());
    panelRouter.register(new ShopUserPanelHandler());
}
