import { panelRouter } from '../../core/ui/PanelRouter.js';
import { ShopPanelHandler } from './ui/shopPanel.js';

export function initialize() {
    panelRouter.register(new ShopPanelHandler());
}
