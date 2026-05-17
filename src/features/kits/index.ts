import { KitPanelHandler } from '@features/kits/ui/kitPanel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new KitPanelHandler());
}
