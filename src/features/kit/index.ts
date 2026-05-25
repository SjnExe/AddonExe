import { KitPanelHandler } from '@features/kit/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new KitPanelHandler());
}
