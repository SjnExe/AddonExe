import { panelRouter } from '@ui/PanelRouter.js';
import { KitPanelHandler } from '@features/kits/ui/kitPanel.js';

export function initialize() {
    panelRouter.register(new KitPanelHandler());
}
