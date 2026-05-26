import { TeleportPanelHandler } from '@features/teleport/ui/panel.js';
import { panelRouter } from '@ui/PanelRouter.js';

export function initialize() {
    panelRouter.register(new TeleportPanelHandler());
}
