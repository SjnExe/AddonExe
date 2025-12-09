import { panelRouter } from '@core/ui/PanelRouter.js';
import { KitPanelHandler } from './ui/kitPanel.js';

export function initialize() {
    panelRouter.register(new KitPanelHandler());
}
